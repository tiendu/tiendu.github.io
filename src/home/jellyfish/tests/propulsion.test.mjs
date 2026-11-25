import test from "node:test";
import assert from "node:assert/strict";
import { PropulsionWake, appendageFlow } from "../propulsion.mjs";

const calm = { sample: () => ({ x: 0, y: 0 }) };
const makeBell = () => ({ x: 100, y: 100, tilt: 0, baseSize: 250, bellWidth: () => 200 });
const dt = 1 / 60;
const advance = (wake, bell, seconds, delta = 0, ocean = calm) => {
  for (let i = 0; i < Math.round(seconds / dt); i += 1) wake.step(dt, bell, delta, ocean, i * dt);
};

test("bell contraction expels water; relaxation draws it back", () => {
  const wake = new PropulsionWake(), bell = makeBell();
  wake.step(dt, bell, 0.035, calm, 0);
  assert.ok(wake.sample(100, 137).y > 5);
  assert.ok(wake.sample(130, 137).x > 0);
  assert.ok(wake.sample(70, 137).x < 0);
  assert.deepEqual(wake.sample(100, 30), { x: 0, y: 0 });
  wake.step(dt, bell, -0.035, calm, dt);
  assert.ok(wake.sample(100, 137).y < -2);
  assert.ok(wake.sample(130, 137).x < 0);
});

test("the local outflow follows the bell axis", () => {
  const wake = new PropulsionWake(), bell = makeBell();
  bell.tilt = 0.25;
  wake.step(dt, bell, 0.04, calm, 0);
  const force = wake.sample(bell.x - Math.sin(bell.tilt) * 37, bell.y + Math.cos(bell.tilt) * 37);
  assert.ok(force.x < -1 && force.y > 5);
  assert.ok(Math.abs(force.x / force.y + Math.tan(bell.tilt)) < 1e-6);
});

test("shed wake persists, moves downstream and is not attached to the bell", () => {
  const wake = new PropulsionWake(), bell = makeBell();
  advance(wake, bell, 0.5, 1 / 30);
  assert.equal(wake.packets.length, 5);
  const packet = wake.packets[0];
  const oldY = packet.y;
  const oldX = packet.x;
  bell.x += 500;
  advance(wake, bell, 0.5);
  assert.ok(packet.y > oldY + 50);
  assert.equal(packet.x, oldX);
  assert.ok(wake.sample(packet.x, packet.y).y > 0.5);
  assert.deepEqual(wake.sample(bell.x, bell.y + 37), { x: 0, y: 0 });
  advance(wake, bell, 4);
  assert.equal(wake.packets.length, 0);
  assert.deepEqual(wake.sample(packet.x, packet.y), { x: 0, y: 0 });
});

test("ambient advection is bounded and release sheds weaker opposing circulation", () => {
  const wake = new PropulsionWake(), bell = makeBell();
  const current = { sample: () => ({ x: 12, y: 0 }) };
  advance(wake, bell, 0.5, 1 / 30, current);
  const packet = wake.packets[0];
  const x = packet.x;
  advance(wake, bell, 0.5, 0, current);
  assert.ok(Math.abs(packet.x - x - 5.1) < 1e-6);
  advance(wake, bell, 0.6, -1 / 36, current);
  assert.equal(wake.packets.filter(p => p.strength < 0).length, 3);
  assert.ok(wake.packets.every(p => Math.abs(p.strength) <= 6.5));
});

test("packet emission depends on pulse displacement rather than step count", () => {
  const bell = makeBell();
  for (const hz of [30, 60, 120]) {
    const wake = new PropulsionWake();
    for (let i = 0; i < hz; i++) wake.step(1 / hz, bell, 1 / hz, calm, i / hz);
    assert.equal(wake.packets.length, 5);
  }
});

test("repeated pulses, overlapping wakes and reset remain bounded", () => {
  const wake = new PropulsionWake(), bell = makeBell();
  for (let i = 0; i < 1200; i++) {
    wake.step(dt, bell, i % 60 < 30 ? 1 / 30 : -1 / 30, calm, i * dt);
    assert.ok(wake.packets.length <= 12);
    for (const x of [50, 100, 150]) for (const y of [100, 150, 250, 400]) {
      const f = wake.sample(x, y);
      assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y));
      assert.ok(Math.hypot(f.x, f.y) <= 12 + 1e-9);
    }
  }
  wake.reset();
  assert.equal(wake.packets.length, 0);
  assert.deepEqual(wake.sample(100, 137), { x: 0, y: 0 });
});

test("appendage response respects the existing tissue sensitivity", () => {
  const wake = new PropulsionWake(), bell = makeBell();
  wake.step(dt, bell, 0.035, calm, 0);
  const full = appendageFlow(calm, wake, 100, 137, 0, 1);
  const half = appendageFlow(calm, wake, 100, 137, 0, 0.5);
  assert.equal(half.y, full.y * 0.5);
  assert.ok(half.wakeWeight < full.wakeWeight);
});
