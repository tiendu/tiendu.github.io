import test from "node:test";
import assert from "node:assert/strict";
import { addContactForce, buildContactForces } from "../interaction.mjs";

function body(x, { arm = false, layer = 0, width = 4, start = 0 } = {}) {
  const count = 21;
  return { arm, layer, width, branches: [], chain: {
    count, x: Float64Array.from({ length: count }, () => x),
    y: Float64Array.from({ length: count }, (_, i) => start + i * 2),
  } };
}

function peak(force) {
  return Math.max(...force.x.map((x, i) => Math.hypot(x, force.y[i])));
}

test("same-depth contact deflects strands and gives heavier ribbons a weaker reaction", () => {
  const strand = body(2);
  const ribbon = body(0, { arm: true });
  const before = [...strand.chain.x];
  const forces = buildContactForces([strand, ribbon]);
  const a = forces.get(strand.chain), b = forces.get(ribbon.chain);
  assert.ok(a.x[10] > 2);
  assert.ok(b.x[10] < 0);
  assert.ok(Math.abs(b.x[10]) < a.x[10]);
  assert.equal(a.x[0], 0);
  assert.equal(b.x[0], 0);
  assert.equal(a.x[1], 0);
  assert.deepEqual([...strand.chain.x], before);
  assert.ok(peak(a) <= 14 + 1e-9 && peak(b) <= 4.5 + 1e-9);
  assert.ok(addContactForce({ x: 1, y: 2 }, forces, strand.chain, 0.5).x > 3);
});

test("different depths, separated tissue, and a branch's own parent do not repel", () => {
  const strand = body(2);
  const distant = body(0, { arm: true, layer: 0.9 });
  const far = body(30, { arm: true });
  const ribbon = body(0, { arm: true });
  const branch = body(2, { arm: true });
  ribbon.branches.push(branch);
  for (const items of [[strand, distant], [strand, far], [ribbon]]) {
    for (const force of buildContactForces(items).values()) assert.equal(peak(force), 0);
  }
  const other = body(3, { layer: 0 });
  const forces = buildContactForces([ribbon, other]);
  assert.ok(peak(forces.get(branch.chain)) > 0, "branch contacts unrelated tissue");
});

test("ribbon pairs displace gently and thin strand pairs exert much less resistance", () => {
  const a = body(0), b = body(0.5);
  const thin = buildContactForces([a, b]);
  const c = body(0, { arm: true }), d = body(1, { arm: true });
  const thick = buildContactForces([c, d]);
  const mixed = buildContactForces([a, d]);
  assert.ok(thin.get(a.chain).x[10] < 0 && thin.get(b.chain).x[10] > 0);
  assert.ok(thick.get(c.chain).x[10] < 0 && thick.get(d.chain).x[10] > 0);
  assert.ok(peak(thin.get(a.chain)) < peak(mixed.get(a.chain)));
});

test("dense and coincident tissue stays finite, bounded and independent of integration order", () => {
  const items = Array.from({ length: 24 }, (_, i) => body((i % 5) * 0.4, {
    arm: i % 4 === 0, layer: (i % 3) * 0.10,
  }));
  const first = buildContactForces(items, 0.75);
  const reverse = buildContactForces([...items].reverse(), 0.75);
  for (const item of items) {
    const a = first.get(item.chain), b = reverse.get(item.chain);
    assert.ok(peak(a) <= (item.arm ? 4.5 : 14) * 0.75 + 1e-9);
    for (let i = 0; i < item.chain.count; i += 1) {
      assert.ok(Number.isFinite(a.x[i]) && Number.isFinite(a.y[i]));
      assert.ok(Math.abs(a.x[i] - b.x[i]) < 1e-8);
      assert.ok(Math.abs(a.y[i] - b.y[i]) < 1e-8);
    }
  }
  const item = items[0], stored = [...first.get(item.chain).x];
  item.chain.x.fill(1000);
  assert.deepEqual([...first.get(item.chain).x], stored);
});

test("contact falls continuously to zero at the depth and distance boundaries", () => {
  const strand = body(2);
  const ribbon = body(0, { arm: true });
  const force = () => peak(buildContactForces([strand, ribbon]).get(strand.chain));
  const close = force();
  ribbon.layer = 0.3;
  const middle = force();
  ribbon.layer = 0.499;
  const edge = force();
  ribbon.layer = 0.5;
  assert.ok(close > middle && middle > edge && edge < 0.001);
  assert.equal(force(), 0);
  ribbon.layer = 0;
  strand.chain.x.fill(5.65);
  assert.ok(force() < 0.001);
  strand.chain.x.fill(6);
  assert.equal(force(), 0);
});

test("invalid or grossly stretched segments cannot explode the spatial grid", () => {
  const strand = body(2);
  const ribbon = body(0, { arm: true });
  ribbon.chain.x[10] = 1e15;
  ribbon.chain.x[11] = NaN;
  for (const force of buildContactForces([strand, ribbon]).values()) {
    assert.ok(Number.isFinite(peak(force)));
  }
});
