import { raceClimate, updatePredators } from "../src/chicken/encounters.mjs";
import test from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { startServer } from "../src/node-server.mjs";
import {
  birds,
  course,
  groundHeight,
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

test("sprint accelerates, jumps preserve momentum, roof catches a descending chicken", () => {
  const p = runner("a");
  input(p, "down");
  for (let i = 0; i < 20; i++) move(p, 0.05, []);
  assert.equal(p.vx, 128);
  assert.equal(p.burstLeft, 0);
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
test("each chosen bird can reach the high roof and escape the first fox", () => {
  const track = course(0);
  for (const [bird, traits] of birds.entries()) {
    const race = newRace([{ id: "a", bird }], 0);
    const p = race.runners[0];
    assert.equal(p.vx, 72 * traits.speed);
    p.x = track.roofs[0].x + 30;
    p.y = track.roofs[0].h;
    input(p, "jump");
    const launch = p.vy;
    assert.equal(launch, 220 * Math.sqrt(traits.jumpHeight));
    for (let i = 0; i < 22; i++) move(p, 0.05, track.roofs);
    assert.equal(p.y, track.roofs[1].h, traits.name);

    const chase = newRace([{ id: "a", bird }], 0);
    chase.time = 9;
    const chicken = chase.runners[0];
    for (let tick = 0; tick < 100; tick++) {
      if (tick === 24 || tick === 60) input(chicken, "down");
      step(chase, { roofs: [], corn: [] });
    }
    assert.equal(chicken.status, "running", traits.name);
  }
});

test("a sprint continues after release and repeated taps cannot extend it", () => {
  const p = runner("a");
  input(p, "down");
  input(p, "up");
  for (let i = 0; i < 20; i++) {
    input(p, "down");
    move(p, 0.05, []);
  }
  assert.equal(p.burstLeft, 0);
  move(p, 0.05, []);
  assert.ok(p.vx < 128);
});

test("fox spends one earned rescue and unassisted jogging can end the round", () => {
  const r = newRace(["a"], 1, 2);
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
  const r = newRace(["a", "b"], 1, 2);
  r.time = 7;
  r.hawk = { x: 4, at: 7.04 };
  r.runners[0].y = 60;
  step(r, course(1));
  assert.equal(r.runners[0].status, "caught");
  assert.equal(r.runners[1].status, "running");
});
for (const playerCount of [2, 5]) test(
  `race with ${playerCount} connected players`,
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
      for (let i = 1; i < playerCount; i++) guests.push(await connect(i));
      const state = await host.take((m) => m.players?.length === playerCount);
      assert.equal(new Set(state.players.map((p) => p.bird)).size, playerCount);
      if (playerCount === 5) {
        const sixth = await connect(5);
        await sixth.take((m) => m.error);
        sixth.ws.close();
      }
      guests[0].send({ type: "bird", bird: 0 });
      await guests[0].take((m) => m.error);
      host.send({ type: "start" });
      const started = await host.take((m) => m.race?.time >= 0);
      assert.equal(started.race.runners.length, playerCount);
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

test("seeded coop courses finish on the displayed step for every bird", () => {
  for (const seed of [0, 17, 0xffffffff, 916402]) {
    const track = course(seed);
    assert.deepEqual(course(seed), track);
    assert.ok(track.finish >= 3200 && track.finish <= 4800);
    assert.ok(track.hills.every(h => h.x + h.width < track.finish));
    for (const bird of birds.keys()) {
      const race = newRace([{ id: "a", bird }], seed);
      const p = race.runners[0];
      race.time = 0;
      p.safeUntil = 1000;
      for (let i = 0; i < 2000 && !race.over; i++) {
        input(p, "down");
        step(race, track);
        assert.equal(p.jumps, 0);
        assert.equal(p.y, groundHeight(track.hills, p.x));
      }
      assert.equal(p.status, "home");
      assert.equal(p.x, track.finish);
      assert.equal(race.over, true);
    }
  }
  assert.notDeepEqual(course(17).hills, course(18).hills);
  assert.notEqual(course(17).weatherOffset, course(18).weatherOffset);
});

test("daylight, rain and safe retreats on seeded courses", () => {
  let chases = 0, strikes = 0, retreats = 0;
  for (let seed = 0; seed < 32; seed++) {
    const track = course(Math.imul(seed, 2654435761) >>> 0);
    for (const bird of birds.keys()) {
      const race = newRace([{ id: "me", bird }], seed);
      const p = race.runners[0], phases = new Set();
      let reactAt = Infinity;
      for (let tick = 0; tick < 1800 && !race.over; tick++) {
        if (tick === reactAt) input(p, "down");
        const previousFox = race.fox;
        step(race, track);
        if (race.time < 0) continue;
        const { cycle, weather } = raceClimate(track, race.time);
        phases.add(cycle.phase);
        if (race.fox !== null && race.foxRetreat == null) {
          assert.equal(cycle.phase, "night");
          if (previousFox === null) {
            assert.ok(p.x - race.fox <= 225 * 0.3); // visible on narrowest course canvas
            reactAt = tick + 10; // allow half a second to react
            chases++;
          }
        }
        if (race.foxRetreat != null) retreats++;
        if (race.hawk && race.hawk.lift == null) {
          strikes++;
          assert.equal(cycle.phase, "day");
          assert.ok(weather.rainIntensity < 0.65);
        }
        assert.ok(!(race.hawk && race.fox !== null));
      }
      assert.equal(p.status, "home", "single sprint must suffice for " + birds[bird].name);
      assert.ok(phases.has("day") && phases.has("night"));
    }
  }
  assert.ok(chases && strikes && retreats);
});

test("a marked rooftop strike gives every bird time for one sprint", () => {
  const track = { ...course(1), skyOffset: 0, weatherOffset: 0, weatherRate: 1,
    roofs: [{ x: -5, width: 500, h: 48 }], hills: [], mud: [], corn: [] };
  for (const bird of birds.keys()) {
    for (const sprint of [true, false]) {
      const race = newRace([{ id: "me", bird }], 1);
      race.time = 3;
      const p = race.runners[0];
      p.y = 48;
      step(race, track);
      const mark = race.hawk.x;
      for (let tick = 0; tick < 29 && !race.over; tick++) {
        if (sprint && tick === 10) input(p, "down");
        step(race, track);
        assert.equal(race.hawk.x, mark);
      }
      assert.equal(p.status, sprint ? "running" : "caught");
      assert.ok(race.hawk.lift > 0);
    }
  }
});

test("winter keeps snowfall out of the rain rules and ice preserves jump control", () => {
  const winter = course(256);
  const summer = course(0);
  const climates = Array.from({ length: 180 }, (_, t) => raceClimate(winter, t));
  assert.ok(climates.some(c => c.snowfall > 0.8));
  assert.ok(climates.every(c => c.icy && !c.muddy && !c.rain && !c.weather.rainIntensity));
  assert.ok(Array.from({ length: 180 }, (_, t) => raceClimate(summer, t))
    .some(c => !c.rain && c.muddy));
  assert.equal(course(256, 3).snowCourse, false);
  const ice = runner("on ice"), dirt = runner("on dirt");
  ice.vx = dirt.vx = 120;
  move(ice, 0.05, [], [], [{ x: 0, width: 42 }], true);
  move(dirt, 0.05, [], [], null);
  assert.ok(ice.vx > dirt.vx);
  input(ice, "jump");
  move(ice, 0.05, [], [], [{ x: 0, width: 42 }], true);
  assert.ok(ice.y > 0);
});

test("rain breaks off a dive and an elevated chicken can escape a fox on ice", () => {
  const track = course(256);
  const race = newRace(["me"], 256);
  race.time = 10;
  const bird = race.runners[0];
  race.hawk = { target: bird.id, x: bird.x, at: 11 };
  const weather = { rainIntensity: 0.08 };
  updatePredators(race, track, { cycle: { phase: "day" }, rain: true, weather }, 0.05, assert.fail);
  assert.equal(race.hawk.lift, race.time);

  race.hawk = null;
  race.fox = track.mud[0].x;
  race.foxTarget = bird.id;
  race.chaseEnd = 12;
  bird.x = race.fox + 30;
  bird.altitude = 24;
  updatePredators(race, track, { cycle: { phase: "night" }, icy: true, weather }, 0.05, assert.fail);
  assert.equal(race.foxRetreat, race.time);
  assert.equal(race.foxSkid, true);
});
