import test from "node:test";
import assert from "node:assert/strict";
import { buildContactForces } from "../interaction.mjs";
import { TissueFlow } from "../hydrodynamics.mjs";
import { VerletChain } from "../physics.mjs";
import { SimulationWorkspace } from "../simulation-workspace.mjs";
import { SimulationProfile } from "../performance.mjs";

const dt = 1 / 60;
const still = { sample: () => ({ x: 0, y: 0 }) };
const noWake = { sample: () => ({ x: 0, y: 0 }) };
function tissue(x, arm = false) {
  const chain = new VerletChain({ anchorX: x, anchorY: 0, segments: 20, segmentLength: 3 });
  return { chain, arm, layer: 0, width: arm ? 4 : 1, branches: [] };
}
const at = (field, item) => field.sample(item.chain, 0.5, item.chain.x[10], item.chain.y[10], 1);

test("reusable contact buffers match independent snapshots and clear stale forces", () => {
  const items = [tissue(2), tissue(0, true), tissue(4)];
  const workspace = {};
  const pooled = buildContactForces(items, 1, workspace);
  const buffer = pooled.get(items[0].chain).x;
  for (let i = 0; i < 12; i++) {
    items[1].chain.translate(i === 6 ? 200 : 0.3, 0.1);
    const actual = buildContactForces(items, 1, workspace);
    const expected = buildContactForces(items, 1);
    assert.equal(actual, pooled);
    assert.equal(actual.get(items[0].chain).x, buffer);
    for (const item of items) {
      assert.deepEqual(actual.get(item.chain).x, expected.get(item.chain).x);
      assert.deepEqual(actual.get(item.chain).y, expected.get(item.chain).y);
    }
  }
  assert.notEqual(buildContactForces(items, 0.7, workspace), pooled);
});

test("reused water field keeps ambient flow and drag live and never skips twice", () => {
  const a = tissue(2), b = tissue(0, true), items = [a, b];
  const field = new TissueFlow(items, dt, 1, still, noWake, 0);
  const body = field.bodies.get(a.chain);
  a.chain.px[10] -= 0.1;
  const current = { sample: () => ({ x: 5, y: 0 }) };
  field.update(items, dt, 1, current, noWake, dt, true);
  assert.equal(field.rebuilt, false);
  assert.equal(field.bodies.get(a.chain), body);
  assert.ok(body.vx[10] > 5);
  assert.ok(at(field, a).x > 2);
  field.update(items, dt, 1, current, noWake, 2 * dt, true);
  assert.equal(field.rebuilt, true);
  b.chain.px[10] -= 4;
  field.update(items, dt, 1, current, noWake, 3 * dt, true);
  assert.equal(field.rebuilt, true, "rapid movement forces refresh");
  field.update(items, 0, 1, current, noWake, 3 * dt);
  field.update(items, dt, 1, current, noWake, 4 * dt);
  assert.ok(Number.isFinite(at(field, a).x));
});

test("workspace refreshes on input and profiles actual step counters", () => {
  const items = [tissue(0), tissue(3, true)];
  const workspace = new SimulationWorkspace();
  const profile = new SimulationProfile();
  const ocean = { ...still, pointer: { strength: 0 } };
  const advance = (time, pulseDelta = 0) => {
    workspace.prepare(items, dt, 1, ocean, noWake, time, pulseDelta, { x: 0, y: 0 }, profile);
    workspace.finish(profile);
    return workspace.water.rebuilt;
  };
  assert.equal(advance(0), true);
  assert.equal(advance(dt), false);
  assert.equal(advance(2 * dt), true);
  ocean.pointer.strength = 0.4;
  assert.equal(advance(3 * dt), true);
  ocean.pointer.strength = 0;
  assert.equal(advance(4 * dt, 0.05), true);
  assert.equal(profile.steps, 5);
  assert.equal(profile.take().rebuilt, 0.8);
});

test("converged straight chains omit distance-only passes, while strained chains stay guarded", () => {
  const chain = new VerletChain({ anchorX: 0, anchorY: 0, segments: 20, segmentLength: 3,
    gravity: 0, maxBendAngle: 1.2, maxTotalTurn: 2.5 });
  const zero = () => ({ x: 0, y: 0 });
  chain.x.fill(0); chain.px.fill(0);
  chain.y.forEach((_, i) => { chain.y[i] = chain.py[i] = i * 3; });
  chain.step(dt, 0, 0, zero, 6);
  assert.equal(chain.lastSkipped, 3);
  chain.clipTrailEnvelope(0, 0);
  assert.equal(chain.lastRepair, false);
  chain.x[10] += 4;
  chain.step(dt, 0, 0, zero, 6);
  assert.equal(chain.lastSkipped, 0);
  chain.clipTrailEnvelope(0, 0);
  assert.ok(chain.maxConstraintError() < 0.8);
  assert.ok(chain.maxTurnAngle() < chain.maxBendAngle + 0.16);
});
