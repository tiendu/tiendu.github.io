import test from "node:test";
import assert from "node:assert/strict";
import { TENTACLE_COUNT, tentacleLengthFor, tentaclePlanAt } from "../tentacles.mjs";

test("24 tentacles retain varied lengths within a bounded simulation budget", () => {
  const counts = { short: 0, medium: 0, long: 0, extra: 0 };
  let nodes = 0;
  for (let i = 0; i < TENTACLE_COUNT; i += 1) {
    const plan = tentaclePlanAt(i, 0.5, 1);
    counts[plan.tier] += 1;
    nodes += plan.segments + 1;
    assert.ok(plan.brightness > 0 && plan.brightness <= 1);
    assert.ok(plan.response >= 0.9 && plan.response <= 1);
  }
  assert.deepEqual(counts, { short: 6, medium: 8, long: 7, extra: 3 });
  assert.ok(nodes < 1600, `tentacle nodes ${nodes}`);
});

test("long filaments retain staggered lengths even on short viewports", () => {
  for (const [size, height, homeY] of [[68.4, 180, 61.2], [150, 420, 130],
    [183, 700, 217], [270, 760, 266], [296, 1100, 385]]) {
    const lengths = [1, 1.5, 2.15, 3.0].map(ratio =>
      tentacleLengthFor(size, 1.16, height, homeY, ratio));
    assert.ok(lengths.every(Number.isFinite));
    assert.ok(lengths.every((value, i) => i === 0 || value > lengths[i - 1]));
    assert.ok(lengths[3] < height - homeY);
    assert.ok(lengths[3] > lengths[0] * 1.4);
  }
});
