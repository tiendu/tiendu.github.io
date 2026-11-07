import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import { frontier } from "../src/mines/board.mjs";

test(
  "live players share one authoritative field and can resume a seat",
  { timeout: 30000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "mines-worker-"));
    const origin = "http://localhost:4321",
      address = "127.0.0.1:8796",
      sockets = [];
    const child = spawn(
      process.execPath,
      [
        "node_modules/wrangler/bin/wrangler.js",
        "dev",
        "--config",
        "wrangler.mines.jsonc",
        "--ip",
        "127.0.0.1",
        "--port",
        "8796",
        "--persist-to",
        dir,
        "--var",
        "ALLOWED_ORIGINS:" + origin,
      ],
      { stdio: "ignore" },
    );
    try {
      let ready = false;
      for (let i = 0; i < 100 && child.exitCode === null; i++) {
        try {
          ready = (await fetch("http://" + address)).status === 403;
        } catch {}
        if (ready) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      assert.ok(ready, "local Worker startup");
      for (const count of [2, 5]) {
        const response = await fetch("http://" + address + "/mines/rooms", {
          method: "POST",
          headers: { Origin: origin },
        });
        assert.equal(response.status, 200);
        const { room, token } = await response.json();
        const connect = async (i, key) => {
          const ws = new WebSocket("ws://" + address + "/mines/rooms/" + room, {
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
            key,
            name: "Crew " + i,
            token: i === 0 ? token : undefined,
          });
          return { send, take, ws };
        };
        const host = await connect(0);
        const { you } = await host.take((m) => m.you);
        const guests = [];
        for (let i = 1; i < count; i++) guests.push(await connect(i));
        const guest = guests[0],
          identity = await guest.take((m) => m.you);
        await host.take((m) => m.players?.length === count);
        if (count === 5) {
          const sixth = await connect(5);
          await sixth.take((m) => m.error);
          sixth.ws.close();
        }
        host.send({ type: "start", round: 0 });
        const started = await host.take((m) => m.board);
        assert.equal(started.board.players.length, count);
        assert.ok(!("clues" in started.board));
        const cell = [...frontier(started.board, you)][0];
        guest.send({ type: "dig", cell, round: 1 });
        await guest.take((m) => m.error);
        host.send({ type: "dig", cell, round: 1 });
        await guest.take((m) => m.board?.cells[cell] != null);
        const resumed = await connect(1, identity.key);
        assert.equal((await resumed.take((m) => m.you)).you, identity.you);
        resumed.send({ type: "ping", cell, round: 1 });
        await host.take((m) => m.ping?.cell === cell);
        host.send({ type: "leave", round: 1 });
        await resumed.take(
          (m) => m.host !== you && m.players?.length === count - 1,
        );
      }
    } finally {
      for (const ws of sockets) ws.terminate();
      if (child.exitCode === null) {
        const stopped = new Promise((r) => child.once("exit", r));
        child.kill();
        await stopped;
      }
      await rm(dir, { recursive: true, force: true });
    }
  },
);
