import test from "node:test";
import assert from "node:assert/strict";
import { canvasPixelRatio } from "../render-quality.mjs";

test("mobile gets native Retina resolution and a bounded zoom boost", () => {
  assert.equal(canvasPixelRatio(390, 700, 3, 1), 3);
  assert.equal(canvasPixelRatio(390, 700, 3, 2), 4);
  assert.equal(canvasPixelRatio(390, 700, 2, 1), 2);
  assert.equal(canvasPixelRatio(390, 700, 2, 1.01), 2);
  assert.equal(canvasPixelRatio(1440, 900, 2, 1), 2);
});

test("large canvases stay within the memory and dimension budgets", () => {
  for (const [w, h] of [[1920, 1080], [3840, 2160], [12000, 3000], [500, 10000]]) {
    const ratio = canvasPixelRatio(w, h, 3, 3);
    assert.ok(ratio > 0 && ratio <= 4);
    assert.ok(w * ratio <= 4096 && h * ratio <= 4096);
    assert.ok(w * h * ratio * ratio <= 8_000_000);
  }
});
