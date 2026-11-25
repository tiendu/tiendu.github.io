import test from "node:test";
import assert from "node:assert/strict";
import { meridionalStripeAt, channelFlashMix } from "../channels.mjs";

const scan = (v, profile, phase) => Array.from({ length: 801 }, (_, i) =>
  meridionalStripeAt((i / 400 - 1) * profile, v, profile, phase));

test("nine separated soft channels reach from the crown toward the skirt", () => {
  for (const phase of [0, 1.2, 3.7, 6.1]) {
    for (const v of [-0.90, -0.6, -0.25, 0.015]) {
      const values = scan(v, 0.8, phase);
      let peaks = 0;
      for (let i = 1; i < values.length - 1; i += 1) {
        if (values[i] > 0.30 && values[i] >= values[i - 1] && values[i] > values[i + 1]) peaks++;
      }
      assert.equal(peaks, 9, `${phase}/${v}`);
      assert.ok(values.filter(x => x < 0.08).length > 100, "transparent gaps remain");
      assert.ok(values.every(x => x >= 0 && x <= 1));
    }
  }
});

test("channel coordinates scale with the bell and remain deterministic", () => {
  for (const v of [-0.95, -0.5, -0.1, 0.03]) {
    for (let i = -95; i <= 95; i++) {
      const q = i / 100;
      const a = meridionalStripeAt(q * 0.8, v, 0.8, 2.1);
      const b = meridionalStripeAt(q * 0.6, v, 0.6, 2.1);
      assert.ok(Math.abs(a - b) < 1e-12);
      assert.equal(a, meridionalStripeAt(q * 0.8, v, 0.8, 2.1));
    }
  }
});

test("channels fade inside the crown and never escape the membrane", () => {
  assert.equal(meridionalStripeAt(0, -1.08, 0.3), 0);
  assert.equal(meridionalStripeAt(0, 0.095, 0.8), 0);
  assert.equal(meridionalStripeAt(0.8, -0.4, 0.8), 0);
  assert.equal(meridionalStripeAt(0, -0.4, 0), 0);
  assert.ok(Math.max(...scan(-1.04, 0.3, 0)) < 0.15);
});

test("mechanical flashes favor channels while contact lights surrounding tissue", () => {
  assert.equal(channelFlashMix(1, 0), 0);
  assert.ok(channelFlashMix(1, 0.8) > 6 * channelFlashMix(0, 0.8));
  assert.ok(channelFlashMix(0, 1, true) >= 0.65);
  assert.equal(channelFlashMix(1, 1, true), 1);
  for (const stripe of [0, 0.5, 1]) for (const wave of [0, 0.5, 1]) {
    assert.ok(channelFlashMix(stripe, wave) >= 0 && channelFlashMix(stripe, wave) <= 1);
  }
});
