import test from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { startServer } from "../src/node-server.mjs";
import {
  course,
  runner,
  input,
  move,
  newRace,
  step,
} from "../src/chicken/race.mjs";
import { reserveRoom } from "../src/admission.mjs";

test("five Chicken leases share the global room limit with Number", () => {
  const leases = {};
  for (let i = 0; i < 5; i++) assert.ok(reserveRoom(leases, 6, 0, "chicken"));
  assert.equal(reserveRoom(leases, 6, 0, "chicken"), null);
  assert.ok(reserveRoom(leases, 6, 0));
  assert.equal(reserveRoom(leases, 6, 0), null);
  assert.ok(reserveRoom(leases, 6, 900001, "chicken"));
});

test("sprint drains stamina, jumps preserve momentum, roof catches a descending chicken", () => {
  const p = runner("a");
  input(p, "down");
  for (let i = 0; i < 20; i++) move(p, 0.05, []);
  assert.equal(p.vx, 128);
  assert.ok(p.stamina < 2.1);
  input(p, "jump");
  input(p, "up");
  move(p, 0.05, []);
  assert.equal(p.vx, 128);
  input(p, "jump");
  move(p, 0.05, []);
  const v = p.vy;
  input(p, "jump");
  assert.equal(p.vy, v);
  const roof = [{ x: 0, width: 1000, h: 28 }];
  for (let i = 0; i < 40; i++) move(p, 0.05, roof);
  assert.equal(p.y, 28);
  assert.equal(p.jumps, 0);
});
test("fox spends one earned rescue and unassisted jogging can end the round", () => {
  const r = newRace(["a"], 1);
  r.time = 10;
  r.fox = -4;
  r.picked = [0, 1, 2];
  step(r, course(1));
  assert.ok(r.rescued);
  assert.equal(r.runners[0].status, "running");
  for (let i = 0; i < 1500 && !r.over; i++) step(r, course(1));
  assert.ok(r.over);
  assert.equal(r.runners[0].status, "caught");
});
test("a marked aerial strike catches exposed birds while a ground runner survives", () => {
  const r = newRace(["a", "b"], 1);
  r.time = 7;
  r.hawk = { x: 4, at: 7.04 };
  r.runners[0].y = 60;
  step(r, course(1));
  assert.equal(r.runners[0].status, "caught");
  assert.equal(r.runners[1].status, "running");
});
test(
  "five real sockets select unique chickens, start, sprint and transfer host",
  { timeout: 30000 },
  async () => {
    const origin = "http://localhost:4321";
    const worker = process.env.CHICKEN_TEST_BACKEND === "worker";
    const app = worker
      ? null
      : await startServer({ port: 0, database: ":memory:", origins: origin });
    const address = "127.0.0.1:" + (app?.server.address().port ?? 8792),
      sockets = [];
    const dir = worker ? await mkdtemp(join(tmpdir(), "flock-worker-")) : null;
    const child = worker
      ? spawn(
          process.execPath,
          [
            "node_modules/wrangler/bin/wrangler.js",
            "dev",
            "--config",
            "wrangler.chicken.jsonc",
            "--ip",
            "127.0.0.1",
            "--port",
            "8792",
            "--persist-to",
            dir,
            "--var",
            "ALLOWED_ORIGINS:" + origin,
          ],
          { stdio: "ignore" },
        )
      : null;
    try {
      if (worker) {
        let ready = false;
        for (let i = 0; i < 100 && child.exitCode === null; i++) {
          try {
            ready = (await fetch("http://" + address)).status === 403;
          } catch {}
          if (ready) break;
          await new Promise((r) => setTimeout(r, 100));
        }
        assert.ok(ready, "Local Worker did not start");
      }
      const res = await fetch("http://" + address + "/chicken/rooms", {
        method: "POST",
        headers: { Origin: origin },
      });
      assert.equal(res.status, 200);
      const { room, token } = await res.json();
      const connect = async (i) => {
        const ws = new WebSocket("ws://" + address + "/chicken/rooms/" + room, {
          origin,
        });
        sockets.push(ws);
        const messages = [];
        ws.on("message", (text) => messages.push(JSON.parse(text)));
        const send = (msg) => ws.send(JSON.stringify(msg));
        const take = async (f) => {
          const end = Date.now() + 5000;
          while (Date.now() < end) {
            const index = messages.findIndex(f);
            if (index >= 0) return messages.splice(index, 1)[0];
            await new Promise((r) => setTimeout(r, 10));
          }
          assert.fail("Missing room message");
        };
        await new Promise((ok, no) => {
          ws.once("open", ok);
          ws.once("error", no);
        });
        send({
          type: "join",
          name: "Bird " + i,
          token: i === 0 ? token : undefined,
        });
        return { send, take, ws };
      };
      const host = await connect(0);
      const { id } = await host.take((m) => m.id);
      host.send({ type: "start" });
      await host.take((m) => m.error);
      const guests = [];
      for (let i = 1; i <= 4; i++) guests.push(await connect(i));
      const state = await host.take((m) => m.players?.length === 5);
      assert.equal(new Set(state.players.map((p) => p.bird)).size, 5);
      const sixth = await connect(5);
      await sixth.take((m) => m.error);
      sixth.ws.close();
      guests[0].send({ type: "bird", bird: 0 });
      await guests[0].take((m) => m.error);
      host.send({ type: "start" });
      await host.take((m) => m.race?.time >= 0);
      host.send({ type: "input", key: "down" });
      await host.take((m) =>
        m.race?.runners.some((p) => p.id === id && p.vx > 72),
      );
      host.send({ type: "leave" });
      await guests[0].take(
        (m) =>
          m.host !== id &&
          m.race?.runners.some((p) => p.id === id && p.status === "away"),
      );
    } finally {
      for (const ws of sockets) ws.terminate();
      await app?.close();
      if (child) {
        if (child.exitCode === null) {
          const stopped = new Promise((r) => child.once("exit", r));
          child.kill();
          await stopped;
        }
        await rm(dir, { recursive: true, force: true });
      }
    }
  },
);
