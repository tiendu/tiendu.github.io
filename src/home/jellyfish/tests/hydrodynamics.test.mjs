import test from "node:test";
import assert from "node:assert/strict";
import { TissueFlow } from "../hydrodynamics.mjs";

const dt = 1 / 60;
const still = { sample: () => ({ x: 0, y: 0 }) };
const current = { sample: (_x, _y, _t, sensitivity = 1) => ({ x: 8 * sensitivity, y: 0 }) };
const noWake = { sample: () => ({ x: 0, y: 0 }) };
function tissue({ arm = false, layer = 0, x = 0, vx = 0, vy = 0 } = {}) {
  const count = 21;
  const chain = { count, segmentLength: 3,
    x: Float64Array.from({ length: count }, () => x),
    y: Float64Array.from({ length: count }, (_, i) => i * 3),
    px: Float64Array.from({ length: count }, () => x - vx * dt),
    py: Float64Array.from({ length: count }, (_, i) => i * 3 - vy * dt) };
  return { arm, layer, width: arm ? 4 : 1, chain, branches: [] };
}
const build = (items, ocean = still, wake = noWake) => new TissueFlow(items, dt, 1, ocean, wake, 0);
const at = (field, item, i = 10, sensitivity = 1) => field.sample(item.chain,
  i / (item.chain.count - 1), item.chain.x[i], item.chain.y[i], sensitivity);

test("still isolated tissue leaves calm water still and protected roots ignore feedback", () => {
  const a = tissue();
  const f = build([a]);
  assert.deepEqual(at(f, a), { x: 0, y: 0, wakeWeight: 0 });
  const ribbon = tissue({ arm: true, vx: 25 });
  const g = build([a, ribbon]);
  assert.deepEqual(at(g, a, 1), { x: 0, y: 0, wakeWeight: 0 });
});

test("a moving ribbon entrains nearby strands more strongly than a thin strand", () => {
  const target = tissue({ x: 3 });
  const ribbon = tissue({ arm: true, vx: 18 });
  const strand = tissue({ vx: 18 });
  const a = at(build([target, ribbon]), target);
  const b = at(build([target, strand]), target);
  assert.ok(a.x > 0.15 && a.x > b.x * 2, `${a.x} vs ${b.x}`);
  assert.equal(a.y, 0);
  const distant = tissue({ x: 80 });
  assert.equal(at(build([distant, ribbon]), distant).x, 0);
});

test("depth and family exclusion prevent false hydrodynamic feedback", () => {
  const target = tissue({ x: 3 });
  const ribbon = tissue({ arm: true, vx: 18, layer: 1 });
  assert.equal(at(build([target, ribbon]), target).x, 0);
  const parent = tissue({ arm: true });
  parent.branches.push(tissue({ arm: true, vx: 18, x: 3 }));
  assert.equal(at(build([parent]), parent).x, 0);
});

test("sheltering follows water direction and is bounded", () => {
  const target = tissue({ x: 5 });
  const ribbon = tissue({ arm: true });
  const f = build([target, ribbon], current);
  const downstream = f.disturbance(target.chain, 5, 30, { x: 8, y: 0 });
  const upstream = f.disturbance(target.chain, 5, 30, { x: -8, y: 0 });
  assert.ok(downstream.shelter > 0 && downstream.shelter <= 0.18);
  assert.equal(upstream.shelter, 0);
});

test("relative drag opposes motion without adding a second ambient acceleration", () => {
  const a = tissue({ vx: 8, vy: -4 });
  const result = at(build([a], current), a);
  assert.ok(result.x < 8 && result.x > 5);
  assert.ok(result.y > 0);
  const stationary = tissue();
  assert.equal(at(build([stationary], current), stationary).x, 8);
  const wake = { sample: () => ({ x: 0, y: 6 }) };
  const b = at(build([stationary], still, wake), stationary);
  assert.equal(b.y, 6);
  assert.equal(b.wakeWeight, 1);
});

test("source positions and velocities remain frozen until the next step", () => {
  const a = tissue({ x: 3 });
  const b = tissue({ arm: true, vx: 18 });
  const f = build([a, b]);
  const before = at(f, a);
  b.chain.x.fill(1000);
  b.chain.px.fill(1000);
  a.chain.px.fill(-1000);
  assert.deepEqual(at(f, a), before);
  assert.notDeepEqual(at(build([a, b]), a), before);
});

test("dense contact and extreme velocity cannot create unbounded feedback", () => {
  const target = tissue({ x: 2, vx: -10000 });
  const items = [target, ...Array.from({ length: 32 }, () => tissue({ arm: true, vx: 10000 }))];
  const f = build(items, current);
  const base = current.sample(0, 0, 0);
  const result = at(f, target);
  assert.ok(Number.isFinite(result.x) && Number.isFinite(result.y));
  assert.ok(Math.hypot(result.x - base.x, result.y - base.y) <= 3 + 1e-9);
  const local = f.disturbance(target.chain, 2, 30, base);
  assert.ok(Math.hypot(local.x, local.y) <= 10 + 1e-9);
});
