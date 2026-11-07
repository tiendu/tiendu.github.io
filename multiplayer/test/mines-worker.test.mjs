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
  { timeout: 60000 },
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
          const take = async (f, timeout = 5000) => {
            const end = Date.now() + timeout;
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
        if (count === 2) {
          const watcher = await connect(2);
          const late = await watcher.take((m) => m.you);
          const state = await watcher.take((m) => m.players?.length === 3);
          assert.equal(state.turn, identity.you);
          assert.ok(!state.board.players.includes(late.you));
          watcher.send({ type: "pass", round: 1 });
          await watcher.take((m) => m.error);
          resumed.ws.close();
          await host.take((m) =>
            m.players?.some((p) => p.id === identity.you && !p.online),
          );
          host.send({ type: "pass", round: 1 });
          await host.take((m) => m.error?.includes("reconnect"));
          await host.take((m) => m.turn === you && m.move >= 2, 20000);
          const back = await connect(1, identity.key);
          await back.take((m) => m.you === identity.you);
          host.send({ type: "leave", round: 1 });
          const lobby = await watcher.take(
            (m) => m.players?.length === 2 && !m.board,
          );
          const newHost = lobby.host === late.you ? watcher : back;
          newHost.send({ type: "start", round: 1 });
          const next = await watcher.take((m) => m.round === 2);
          assert.deepEqual(next.board.players, [identity.you, late.you]);
        } else {
          resumed.send({ type: "pass", round: 1 });
          await host.take((m) => m.turn === started.board.players[2]);
        }
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
