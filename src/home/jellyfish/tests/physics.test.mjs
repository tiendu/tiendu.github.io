import test from "node:test";
import assert from "node:assert/strict";
import { renderFpsFor } from "../config.mjs";
import { heroSizeFor } from "../jellyfish.mjs";
import { currentWeather, OceanField } from "../ocean.mjs";
import { VerletChain } from "../physics.mjs";
import { pulseEnvelope } from "../pulse.mjs";
import { JellyWorld } from "../world.mjs";

function anatomyBounds(jelly) {
  let minX = jelly.x - jelly.bellWidth() * 0.5;
  let maxX = jelly.x + jelly.bellWidth() * 0.5;
  let minY = jelly.y - jelly.bellHeight();
  let maxY = jelly.y;
  for (const item of jelly.chains) {
    for (let i = 0; i < item.chain.count; i += 1) {
      minX = Math.min(minX, item.chain.x[i]);
      maxX = Math.max(maxX, item.chain.x[i]);
      minY = Math.min(minY, item.chain.y[i]);
      maxY = Math.max(maxY, item.chain.y[i]);
    }
    for (const branch of item.branches) {
      for (let i = 0; i < branch.chain.count; i += 1) {
        minX = Math.min(minX, branch.chain.x[i]);
        maxX = Math.max(maxX, branch.chain.x[i]);
        minY = Math.min(minY, branch.chain.y[i]);
        maxY = Math.max(maxY, branch.chain.y[i]);
      }
    }
  }
  return { minX, maxX, minY, maxY };
}

function assertFiniteAnatomy(jelly) {
  assert.ok(Number.isFinite(jelly.x));
  assert.ok(Number.isFinite(jelly.y));
  for (const item of jelly.chains) {
    for (let i = 0; i < item.chain.count; i += 1) {
      assert.ok(Number.isFinite(item.chain.x[i]));
      assert.ok(Number.isFinite(item.chain.y[i]));
    }
    for (const branch of item.branches) {
      for (let i = 0; i < branch.chain.count; i += 1) {
        assert.ok(Number.isFinite(branch.chain.x[i]));
        assert.ok(Number.isFinite(branch.chain.y[i]));
      }
    }
  }
}

test("pulse contracts quickly and releases over a longer interval", () => {
  assert.ok(pulseEnvelope(0.16) > 0.9);
  assert.ok(pulseEnvelope(0.30) > pulseEnvelope(0.52));
  assert.equal(pulseEnvelope(0.8), 0);
});

test("verlet constraints keep a tentacle near its requested segment length", () => {
  const chain = new VerletChain({ anchorX: 20, anchorY: 10, segments: 18, segmentLength: 6, seed: 4 });
  for (let n = 0; n < 120; n += 1) {
    chain.step(1 / 60, 20 + Math.sin(n / 18) * 3, 10, () => ({ x: 28, y: -3 }), 6);
  }
  assert.ok(chain.maxConstraintError() < 1.0, `constraint error ${chain.maxConstraintError()}`);
});

test("bend limiting prevents a thin chain from winding into tight circles", () => {
  const chain = new VerletChain({
    anchorX: 40,
    anchorY: 18,
    segments: 52,
    segmentLength: 5,
    damping: 0.991,
    gravity: 15,
    bend: 0.55,
    bendStiffness: 0.018,
    bendFrequency: 0.82,
    bendPhase: 1.2,
    tipDrag: 0.018,
    maxBendAngle: 0.50,
    bendLimitStiffness: 0.80,
    maxTotalTurn: 2.85,
    totalTurnStiffness: 0.84,
  });
  for (let n = 0; n < 900; n += 1) {
    const phase = n / 150;
    chain.step(
      1 / 60,
      40 + Math.sin(phase * 0.7) * 4,
      18,
      (_x, _y, along) => ({
        x: Math.sin(phase + along * 2.4) * 34 * along * along,
        y: 2.5 * along * along,
      }),
      6,
    );
  }
  assert.ok(chain.maxTurnAngle() < 0.72, `turn angle ${chain.maxTurnAngle()}`);
  assert.ok(Math.abs(chain.signedTurn()) < 3.10, `signed turn ${chain.signedTurn()}`);
});

test("world contains one detailed specimen with long tentacles and ribbon oral arms", () => {
  const world = new JellyWorld(1200, 760, 991);
  assert.equal("jellies" in world, false);
  const jelly = world.jelly;
  const tentacles = jelly.chains.filter((item) => !item.arm);
  const arms = jelly.chains.filter((item) => item.arm);
  assert.ok(jelly.bellWidth() > 220, `bell width ${jelly.bellWidth()}`);
  assert.ok(tentacles.length >= 14, `tentacles ${tentacles.length}`);
  assert.equal(arms.length, 7);
  assert.ok(Math.max(...tentacles.map((item) => item.chain.count)) >= 50);
  assert.ok(Math.max(...arms.map((item) => item.chain.count)) >= 30);
  assert.ok(Math.min(...arms.map((item) => item.offset)) < -0.35);
  assert.ok(Math.max(...arms.map((item) => item.offset)) > 0.35);
  assert.equal(arms.reduce((sum, item) => sum + item.branches.length, 0), 3);
  assert.ok(arms.every((item) => item.twistRate > 1));
  assert.ok(arms.every((item) => item.width >= 2.5));
  assert.equal(tentacles.filter((item) => item.expressiveTentacle).length, 2);
  assert.ok(tentacles.every((item) => item.chain.tipDrag >= 0.014));
  assert.ok(tentacles.every((item) => item.chain.maxBendAngle <= 0.54));
  assert.ok(tentacles.every((item) => item.chain.maxTotalTurn <= 3.02));
});

test("ocean weather has calm transitions plus meaningful left and right currents", () => {
  let minX = Infinity;
  let maxX = -Infinity;
  let calmest = Infinity;
  for (let time = 0; time <= 1800; time += 1) {
    const weather = currentWeather(time);
    minX = Math.min(minX, weather.x);
    maxX = Math.max(maxX, weather.x);
    calmest = Math.min(calmest, weather.strength);
  }
  assert.ok(minX < -10, `left current ${minX}`);
  assert.ok(maxX > 10, `right current ${maxX}`);
  assert.ok(calmest < 0.25, `calmest strength ${calmest}`);

  for (const time of [20, 220, 520, 900, 1250]) {
    const a = currentWeather(time);
    const b = currentWeather(time + 0.05);
    assert.ok(Math.hypot(b.x - a.x, b.y - a.y) < 0.2, `weather jump at ${time}`);
  }
});

test("pointer disturbance is clamped below a disruptive impulse", () => {
  const ocean = new OceanField(1000, 600);
  const before = ocean.sample(500, 300, 100, 1);
  ocean.disturb(500, 300, 10_000, -10_000);
  const after = ocean.sample(500, 300, 100, 1);
  const delta = Math.hypot(after.x - before.x, after.y - before.y);
  assert.ok(delta < 20, `pointer impulse ${delta}`);
  assert.equal(ocean.pointer.vx, 100);
  assert.equal(ocean.pointer.vy, -100);
});

test("compact and short viewports use the lower render budget", () => {
  assert.equal(renderFpsFor(390, 700), 24);
  assert.equal(renderFpsFor(844, 270), 24);
  assert.equal(renderFpsFor(1200, 760), 30);
});

test("anatomy scales with height and survives portrait-landscape-portrait resize", () => {
  assert.ok(heroSizeFor(844, 180) < 72);
  assert.ok(heroSizeFor(844, 270) < 110);
  assert.ok(heroSizeFor(320, 420) <= 165);
  assert.ok(heroSizeFor(1200, 760) > 250);

  const world = new JellyWorld(390, 700, 42);
  for (let n = 0; n < 300; n += 1) world.step(1 / 60);
  const portraitSize = world.jelly.baseSize;

  world.resize(844, 180);
  for (let n = 0; n < 900; n += 1) world.step(1 / 60);
  assertFiniteAnatomy(world.jelly);
  const landscape = anatomyBounds(world.jelly);
  assert.ok(world.jelly.baseSize < portraitSize * 0.45, `landscape size ${world.jelly.baseSize}`);
  assert.ok(landscape.minY > -16, `landscape top ${landscape.minY}`);
  assert.ok(landscape.maxY < 180 + 18, `landscape bottom ${landscape.maxY}`);

  world.resize(390, 700);
  for (let n = 0; n < 900; n += 1) world.step(1 / 60);
  assertFiniteAnatomy(world.jelly);
  assert.ok(world.jelly.baseSize > 180, `restored size ${world.jelly.baseSize}`);
});

test("single jellyfish and all branch chains remain finite during a long changing-current drift", () => {
  const world = new JellyWorld(960, 620, 123456);
  let minY = Infinity;
  let maxY = -Infinity;
  for (let n = 0; n < 7200; n += 1) {
    if (n === 900) world.disturb(480, 280, 100, -50);
    world.step(1 / 60);
    minY = Math.min(minY, world.jelly.y);
    maxY = Math.max(maxY, world.jelly.y);
  }

  const jelly = world.jelly;
  assertFiniteAnatomy(jelly);
  assert.ok(jelly.x > -80 && jelly.x < 1040, `x ${jelly.x}`);
  assert.ok(jelly.y > 20 && jelly.y < 500, `y ${jelly.y}`);
  assert.ok(maxY - minY > 6, `vertical travel ${maxY - minY}`);
  for (const item of jelly.chains) {
    assert.ok(item.chain.maxConstraintError() < 0.8, `main constraint ${item.chain.maxConstraintError()}`);
    if (!item.arm) {
      assert.ok(item.chain.maxTurnAngle() < 0.78, `tentacle turn ${item.chain.maxTurnAngle()}`);
      assert.ok(Math.abs(item.chain.signedTurn()) < 3.20, `tentacle signed turn ${item.chain.signedTurn()}`);
    }
    for (const branch of item.branches) {
      assert.ok(branch.chain.maxConstraintError() < 0.8, `branch constraint ${branch.chain.maxConstraintError()}`);
    }
  }
});
