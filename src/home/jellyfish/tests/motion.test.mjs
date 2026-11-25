import test from "node:test";
import assert from "node:assert/strict";
import {
  ambientEddyAt,
  fluidSensitivityFor,
  oralArmBillowAt,
  ribbonSurfaceBreathAt,
} from "../fluid.mjs";
import { ribbonKinematicsAt } from "../renderer.mjs";
import { currentWeather, OceanField } from "../ocean.mjs";
import { stepVisualTilt, stepVisualYaw, tiltTargetAt, yawTargetAt } from "../orientation.mjs";
import { JellyWorld } from "../world.mjs";

test("ribbon surface kinematics respond to real chain bend and retained velocity", () => {
  const straight = {
    count: 4,
    segmentLength: 5,
    x: new Float32Array([0, 0, 0, 0]),
    y: new Float32Array([0, 5, 10, 15]),
    px: new Float32Array([0, 0, 0, 0]),
    py: new Float32Array([0, 5, 10, 15]),
  };
  const still = ribbonKinematicsAt(straight, 2);
  assert.ok(Math.abs(still.bend) < 1e-8, `straight bend ${still.bend}`);
  assert.equal(still.speed, 0);

  const curved = {
    ...straight,
    x: new Float32Array([0, 0, 2.5, 6]),
    y: new Float32Array([0, 5, 9.3, 12.8]),
    px: new Float32Array([0, 0, 1.1, 4.2]),
    py: new Float32Array([0, 5, 9.9, 13.6]),
  };
  const moving = ribbonKinematicsAt(curved, 2);
  assert.ok(Math.abs(moving.bend) > 0.10, `curved bend ${moving.bend}`);
  assert.ok(moving.speed > 0.40, `moving speed ${moving.speed}`);
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

test("expressive tentacles use broad shape memory without extra angular freedom", () => {
  const world = new JellyWorld(1200, 760, 991);
  const expressive = world.jelly.chains.filter((item) => item.expressiveTentacle);
  assert.equal(expressive.length, 2);
  for (const item of expressive) {
    assert.ok(item.memoryWaves <= 0.53, `memory waves ${item.memoryWaves}`);
    assert.ok(item.memoryStrength <= 2.8 * world.jelly.anatomyScale, `memory ${item.memoryStrength}`);
    assert.ok(Math.abs(item.tipHook) <= 3.3 * world.jelly.anatomyScale, `hook ${item.tipHook}`);
    assert.ok(item.forceScale <= 0.95, `force scale ${item.forceScale}`);
    assert.ok(item.chain.tipDrag >= 0.019, `tip drag ${item.chain.tipDrag}`);
    assert.ok(item.chain.maxTotalTurn <= 2.70, `total turn ${item.chain.maxTotalTurn}`);
    assert.ok(Math.abs(item.expressiveShape) > 0);
  }
});

test("bell tilt follows sustained current with inertia and reverses gradually", () => {
  const world = new JellyWorld(1000, 700, 2026);
  world.ocean.sample = (_x, _y, _time, sensitivity = 1) => ({ x: 18 * sensitivity, y: 0 });
  for (let n = 0; n < 120; n += 1) world.step(1 / 60);
  const rightTilt = world.jelly.tilt;
  assert.ok(rightTilt > 0.025 && rightTilt < 0.115, `right tilt ${rightTilt}`);

  world.ocean.sample = (_x, _y, _time, sensitivity = 1) => ({ x: -18 * sensitivity, y: 0 });
  for (let n = 0; n < 20; n += 1) world.step(1 / 60);
  assert.ok(world.jelly.tilt > -0.005, `tilt reversed too quickly ${world.jelly.tilt}`);
  for (let n = 0; n < 240; n += 1) world.step(1 / 60);
  assert.ok(world.jelly.tilt < -0.025, `left tilt ${world.jelly.tilt}`);
});

test("ambient eddies stay smooth while calm water remains alive", () => {
  const a = ambientEddyAt(0.31, 0.62, 20);
  const near = ambientEddyAt(0.31, 0.62, 20.05);
  const later = ambientEddyAt(0.31, 0.62, 80);
  assert.ok(Math.hypot(a.x, a.y) > 0.5, `ambient magnitude ${Math.hypot(a.x, a.y)}`);
  assert.ok(
    Math.hypot(near.x - a.x, near.y - a.y) < 0.02,
    "ambient field should change smoothly frame to frame",
  );
  assert.ok(
    Math.hypot(later.x - a.x, later.y - a.y) > 0.5,
    "ambient field should evolve over longer periods",
  );
});

test("fluid response follows tissue hierarchy from root to tip", () => {
  const strand = { arm: false, forceScale: 1.0 };
  const ribbon = { arm: true, forceScale: 0.82, lengthBias: 0.8 };

  assert.ok(fluidSensitivityFor(strand, 0) < fluidSensitivityFor(strand, 0.5));
  assert.ok(fluidSensitivityFor(strand, 0.5) < fluidSensitivityFor(strand, 1));
  assert.ok(fluidSensitivityFor(ribbon, 0) < fluidSensitivityFor(ribbon, 0.5));
  assert.ok(fluidSensitivityFor(ribbon, 0.5) < fluidSensitivityFor(ribbon, 1));
  assert.ok(
    fluidSensitivityFor(strand, 1) > fluidSensitivityFor(ribbon, 1),
    "thin strand tips should remain more current-sensitive than broad oral arms",
  );
});

test("oral-arm billow is broad, anchored and persistent", () => {
  const arm = {
    arm: true,
    lengthBias: 0.9,
    phase: 0.4,
    memoryPhase: 1.1,
  };
  assert.ok(Math.abs(oralArmBillowAt(arm, 10, 0, 1)) < 1e-9);
  assert.ok(Math.abs(oralArmBillowAt(arm, 10, 1, 1)) < 1e-9);

  const midA = oralArmBillowAt(arm, 10, 0.5, 1);
  const midB = oralArmBillowAt(arm, 20, 0.5, 1);
  assert.ok(Math.abs(midA) > 1, `mid billow ${midA}`);
  assert.ok(Math.abs(midB - midA) > 2, `billow change ${midB - midA}`);
});

test("ribbon surfaces keep subtle breathing motion at zero chain speed", () => {
  const arm = { lengthBias: 0.8, phase: 0.7 };
  const root = ribbonSurfaceBreathAt(arm, 12, 0.02);
  const midA = ribbonSurfaceBreathAt(arm, 12, 0.55);
  const midB = ribbonSurfaceBreathAt(arm, 24, 0.55);
  assert.ok(Math.abs(root) < 0.002, `root breath ${root}`);
  assert.ok(Math.abs(midA) > 0.01, `mid breath ${midA}`);
  assert.ok(Math.abs(midB - midA) > 0.02, `surface change ${midB - midA}`);
});

test("long oral arms remain guarded without becoming frozen", () => {
  const calmWorld = new JellyWorld(1200, 760, 991);
  const calmArms = calmWorld.jelly.chains.filter((item) => item.arm);
  const longest = [...calmArms].sort((a, b) => {
    const aLength = (a.chain.count - 1) * a.chain.segmentLength;
    const bLength = (b.chain.count - 1) * b.chain.segmentLength;
    return aLength - bLength;
  }).at(-1);

  const mid = Math.floor(longest.chain.count * 0.55);
  const startX = longest.chain.x[mid] - longest.chain.x[0];
  const startY = longest.chain.y[mid] - longest.chain.y[0];
  calmWorld.ocean.sample = () => ({ x: 0, y: 0 });

  let maxDisplacement = 0;
  for (let n = 0; n < 1200; n += 1) {
    calmWorld.step(1 / 60);
    if (n % 120 === 0) {
      const dx = longest.chain.x[mid] - longest.chain.x[0] - startX;
      const dy = longest.chain.y[mid] - longest.chain.y[0] - startY;
      maxDisplacement = Math.max(maxDisplacement, Math.hypot(dx, dy));
    }
  }
  assert.ok(
    maxDisplacement > calmWorld.jelly.anatomyScale * 2.0,
    `long ribbon barely moved ${maxDisplacement}`,
  );

  const currentWorld = new JellyWorld(1200, 760, 991);
  currentWorld.ocean.sample = (_x, _y, _time, sensitivity = 1) => ({
    x: 28 * sensitivity,
    y: -8 * sensitivity,
  });
  for (let n = 0; n < 1800; n += 1) currentWorld.step(1 / 60);
  for (const arm of currentWorld.jelly.chains.filter((item) => item.arm)) {
    assert.ok(arm.chain.maxTurnAngle() < 1.45, `arm turn ${arm.chain.maxTurnAngle()}`);
    assert.ok(Math.abs(arm.chain.signedTurn()) < 4.9, `arm signed turn ${arm.chain.signedTurn()}`);
  }
});


test("ocean starting time varies the entire water field without changing its continuity", () => {
  const baseline = new OceanField(960, 620);
  const offsets = [0, 120, 360, 730, 1400, 2300, 3500];
  const starts = Array.from({ length: 121 }, (_, i) =>
    new OceanField(960, 620, i * 30).weatherAt(0));
  assert.ok(starts.some(flow => flow.x > 8));
  assert.ok(starts.some(flow => flow.x < -8));
  assert.ok(starts.some(flow => flow.strength < 0.25));
  for (const offset of offsets) {
    const ocean = new OceanField(960, 620, offset);
    for (const time of [0, 0.05, 120, 600]) {
      assert.deepEqual(ocean.weatherAt(time), currentWeather(time + offset));
      assert.deepEqual(ocean.sample(310, 210, time), baseline.sample(310, 210, time + offset));
      const a = ocean.weatherAt(time);
      const b = ocean.weatherAt(time + 0.05);
      assert.ok(Math.hypot(b.x - a.x, b.y - a.y) < 0.2);
    }
  }
});

test("world orientation follows the same shifted ocean as the anatomy", () => {
  const offset = 360;
  const world = new JellyWorld(960, 620, 991, offset);
  const same = new JellyWorld(960, 620, 991, offset);
  const other = new JellyWorld(960, 620, 991, 120);
  assert.deepEqual(world.jelly.chains[0].chain.x, other.jelly.chains[0].chain.x);
  assert.notDeepEqual(world.ocean.weatherAt(0), other.ocean.weatherAt(0));
  const dt = 1 / 60;
  for (let i = 0; i < 60; i += 1) {
    const flowX = world.ocean.weatherAt(world.time + dt).x;
    const expected = {
      ...stepVisualYaw(world.orientation, yawTargetAt(world.time + dt, flowX, world.jelly.anatomyPhase), dt),
      ...stepVisualTilt(world.orientation, tiltTargetAt(flowX), dt),
    };
    world.step(dt);
    same.step(dt);
    assert.deepEqual(world.orientation, expected);
    assert.deepEqual(world.orientation, same.orientation);
  }
  assert.deepEqual(world.jelly.chains[0].chain.x, same.jelly.chains[0].chain.x);
  const beforeResize = world.ocean.weatherAt(world.time);
  world.resize(390, 720);
  assert.deepEqual(world.ocean.weatherAt(world.time), beforeResize);
});
