import test from "node:test";
import assert from "node:assert/strict";
import { JellyWorld } from "../world.mjs";
import { restoreWorld, saveWorld, snapshotWorld, STORAGE_KEY } from "../persistence.mjs";

function storage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

function swimmingWorld() {
  const world = new JellyWorld(390, 565, 991, 1200);
  for (let i = 0; i < 12; i++) world.step();
  return world;
}

test("hibernation preserves specimen, pose, history and water clock", () => {
  const world = swimmingWorld();
  const store = storage();
  assert.ok(saveWorld(world, store));
  const resumed = restoreWorld(world.width, world.height, store);
  assert.ok(resumed);
  assert.deepEqual(snapshotWorld(resumed), snapshotWorld(world));
  assert.deepEqual(resumed.ocean.weatherAt(resumed.time), world.ocean.weatherAt(world.time));
  assert.equal(resumed.jelly.chains.length, world.jelly.chains.length);
  resumed.step();
  assert.ok(resumed.time > world.time);
  assert.ok(resumed.jelly.chains.every(item => item.chain.x.every(Number.isFinite)));
});

test("restoration after viewport rotation follows ordinary resize geometry", () => {
  const world = swimmingWorld();
  world.resize(960, 620);
  const store = storage();
  assert.ok(saveWorld(world, store));
  assert.deepEqual(snapshotWorld(restoreWorld(960, 620, store)), snapshotWorld(world));
  const resumed = restoreWorld(390, 720, store);
  world.resize(390, 720);
  assert.deepEqual(snapshotWorld(resumed), snapshotWorld(world));
});

test("invalid, incompatible and blocked storage never prevents a fresh world", () => {
  const store = storage();
  assert.equal(restoreWorld(390, 565, store), null);
  store.setItem(STORAGE_KEY, "{broken");
  assert.equal(restoreWorld(390, 565, store), null);
  const world = swimmingWorld();
  const saved = snapshotWorld(world);
  store.setItem(STORAGE_KEY, JSON.stringify({ ...saved, version: 999 }));
  assert.equal(restoreWorld(390, 565, store), null);
  saved.trails[0].points[0].pop();
  store.setItem(STORAGE_KEY, JSON.stringify(saved));
  assert.equal(restoreWorld(390, 565, store), null);
  const blocked = { getItem() { throw Error("blocked"); }, setItem() { throw Error("quota"); } };
  assert.equal(restoreWorld(390, 565, blocked), null);
  assert.equal(saveWorld(world, blocked), false);
});

test("transient contact and force state are not replayed", () => {
  const world = swimmingWorld();
  world.tap(world.jelly.x, world.jelly.y);
  const store = storage();
  assert.ok(saveWorld(world, store));
  const resumed = restoreWorld(390, 565, store);
  assert.equal(resumed.ocean.pointer.strength, 0);
  assert.equal(resumed.jelly.light.flash, null);
  assert.equal(resumed.jelly.propulsion.packets.length, 0);
});
