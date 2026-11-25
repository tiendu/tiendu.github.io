import test from "node:test";
import assert from "node:assert/strict";
import { fluidSensitivityFor, proceduralMotionWeight } from "../fluid.mjs";
import { TissueFlow } from "../hydrodynamics.mjs";
import { exceedsRelativeMotion, relaxTrail } from "../repair.mjs";

const still = { sample: () => ({ x: 0, y: 0 }) };
const noWake = { sample: () => ({ x: 0, y: 0 }) };

test("water activity suppresses procedural motion without killing quiet-water movement", () => {
  assert.equal(proceduralMotionWeight({ x: 0, y: 0 }), 1);
  const current = proceduralMotionWeight({ x: 8, y: 0, wakeWeight: 0 });
  const combined = proceduralMotionWeight({ x: 8, y: 0, wakeWeight: 0.8 });
  assert.ok(current < 1 && combined < current);
  assert.equal(proceduralMotionWeight({ x: -8, y: 0 }), current);
  assert.ok(proceduralMotionWeight({ x: 100, y: 100, wakeWeight: 1 }) > 0.5);
});

test("water sensitivity remains anchored, graded, and stronger at thin tips", () => {
  const strand = { arm: false, forceScale: 1 };
  const ribbon = { arm: true, forceScale: 0.8, lengthBias: 0.8 };
  assert.equal(fluidSensitivityFor(strand, 0), 0.2);
  assert.equal(fluidSensitivityFor(ribbon, 0), 0.15);
  for (const tissue of [strand, ribbon]) {
    for (let i = 1; i <= 20; i += 1) {
      assert.ok(fluidSensitivityFor(tissue, i / 20) > fluidSensitivityFor(tissue, (i - 1) / 20));
    }
  }
  assert.ok(fluidSensitivityFor(strand, 1) > fluidSensitivityFor(ribbon, 1));
});

test("frozen neighborhood cache preserves bucket order and per-step isolation", () => {
  const chain = { count: 21, segmentLength: 3,
    x: new Float64Array(21), y: Float64Array.from({ length: 21 }, (_, i) => i * 3),
    px: new Float64Array(21), py: Float64Array.from({ length: 21 }, (_, i) => i * 3) };
  const item = { arm: true, width: 4, chain, branches: [] };
  const build = () => new TissueFlow([item], 1 / 60, 1, still, noWake, 0);
  const field = build();
  const expected = [];
  for (let ix = -1; ix <= 1; ix += 1) {
    for (let iy = -1; iy <= 1; iy += 1) {
      expected.push(...(field.grid.get(`${ix},${1 + iy}`) ?? []));
    }
  }
  assert.ok(expected.length > 0);
  const first = field.nearby(0, 1);
  assert.deepEqual(first, expected);
  assert.equal(field.nearby(0, 1), first);
  chain.x.fill(1000);
  assert.deepEqual(field.nearby(0, 1), expected);
  assert.equal(build().nearby(0, 1).length, 0);
});

function recoveryFixture() {
  const beforeX = Float64Array.of(0, 1, 3, 4);
  const beforeY = Float64Array.of(0, 4, 8, 12);
  return { count: 4, segmentLength: 4, hasBefore: true,
    beforeX, beforeY, x: beforeX.slice(), y: beforeY.slice(),
    repairX: beforeX.slice(), repairY: beforeY.slice() };
}

test("motion guard ignores root translation but detects excessive relative displacement", () => {
  const chain = recoveryFixture();
  for (let i = 0; i < chain.count; i += 1) { chain.x[i] += 5; chain.y[i] -= 3; }
  assert.equal(exceedsRelativeMotion(chain, 5, -3, 1.5), false);
  chain.x[3] += 7;
  assert.equal(exceedsRelativeMotion(chain, 5, -3, 1.5), true);
});

test("a stalled recovery candidate can relax locally without moving the root or snapping the tip", () => {
  const chain = recoveryFixture();
  assert.equal(relaxTrail(chain, 0, 0, () => true), true);
  assert.equal(chain.x[0], 0);
  assert.equal(chain.y[0], 0);
  assert.equal(chain.x[3], 4);
  assert.ok(Math.abs(chain.x[1] - chain.beforeX[1]) > 0.003);
  assert.equal(exceedsRelativeMotion(chain, 0, 0, 0.1), false);
  assert.equal(relaxTrail(recoveryFixture(), 0, 0, () => false), false);
});
