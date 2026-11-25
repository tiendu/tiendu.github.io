import test from "node:test";
import assert from "node:assert/strict";
import { drawRibbon, ribbonInteriorAt, ribbonMaskAt } from "../tissue.mjs";
import { JELLY_PALETTE } from "../config.mjs";

const cellW = 3.18;

test("broad faces retain interior marks through the strongest pores", () => {
  let minimum = 1, maximum = 0;
  for (let i = 0; i <= 100; i++) {
    for (let j = 1; j < 7; j++) {
      const { opacity, density } = ribbonInteriorAt(20, cellW, 0.8, i / 100, j / 7, 1.2, 3.4);
      assert.ok(opacity >= 0.4 - 1e-12 && opacity <= 1);
      assert.ok(density >= 0.35 - 1e-12 && density <= 1);
      minimum = Math.min(minimum, opacity);
      maximum = Math.max(maximum, opacity);
    }
  }
  assert.ok(minimum < 0.6 && maximum > 0.95, "pores remain visible without holes");
});

test("folds transmit light continuously instead of losing their entire interior", () => {
  const opacity = (face, span = 10) => ribbonInteriorAt(span, cellW, face, 0.5, 0.5, 1, 2).opacity;
  assert.ok(opacity(0) > 0 && opacity(0) < opacity(0.4));
  assert.ok(Math.abs(opacity(0.1299) - opacity(0.1301)) < 0.002);
  assert.equal(opacity(0.5, 0), 0);
  assert.ok(opacity(0.5, 2) < opacity(0.5, 10));
});

test("mask follows asymmetric edges, fades with coverage and vanishes edge-on", () => {
  const shape = { projected: 8, torsionOffset: 3, leftRuffle: 2, rightRuffle: -1, face: 1 };
  const mask = ribbonMaskAt(shape, cellW, 1);
  assert.equal(mask.center, 4.5);
  assert.ok(mask.center - mask.halfWidth >= -4);
  assert.ok(mask.center + mask.halfWidth <= 13);
  assert.equal(ribbonMaskAt({ ...shape, face: 0 }, cellW, 1).halfWidth, 0);
  assert.equal(ribbonMaskAt(shape, cellW, 0).halfWidth, 0);
  assert.equal(ribbonMaskAt(shape, cellW, 0.5).halfWidth, mask.halfWidth * 0.5);
});

function fixture(layer = 0.8, bright = 1) {
  const count = 31;
  const x = Float64Array.from({ length: count }, (_, i) => 20 + Math.sin(i / 6) * 7);
  const y = Float64Array.from({ length: count }, (_, i) => 20 + i * 4);
  const item = { arm: true, layer, bright, width: 4, phase: 1.2, twistRate: 2.1,
    branches: [], chain: { count, segmentLength: 4, x, y, px: x.slice(), py: y.slice() } };
  const marks = [], fills = [], path = [], stack = [];
  const ctx = {
    globalAlpha: 1, shadowBlur: 0,
    save() { stack.push([this.globalAlpha, this.shadowBlur, this.fillStyle]); },
    restore() { [this.globalAlpha, this.shadowBlur, this.fillStyle] = stack.pop(); },
    beginPath() { path.length = 0; },
    moveTo(x, y) { path.push([x, y]); },
    lineTo(x, y) { path.push([x, y]); },
    closePath() {},
    fill() { fills.push({ path: path.slice(), style: this.fillStyle, blur: this.shadowBlur }); },
    fillText(glyph, x, y) { marks.push({ glyph, x, y, style: this.fillStyle }); },
  };
  return { item, marks, fills, frame: { ctx, compact: true, cellW, cellH: 5.48, shadowScale: 0 },
    jelly: { palette: JELLY_PALETTE, pulse: 0.2 },
    occlusion: { glyph: () => false, stroke: () => false } };
}

test("foreground ribbon masks once, then draws finite, unblurred tissue", () => {
  const f = fixture();
  drawRibbon(f.frame, f.occlusion, f.jelly, f.item, 1, 2);
  assert.equal(f.fills.length, 1);
  assert.ok(f.fills[0].path.length > 0 && f.fills[0].path.flat().every(Number.isFinite));
  assert.equal(f.fills[0].blur, 0);
  assert.ok(f.marks.length > 200);
  assert.ok(f.marks.every(m => m.glyph.trim() && Number.isFinite(m.x + m.y)));
  assert.equal(f.frame.ctx.globalAlpha, 1);
});

test("rear, invisible and bell-occluded ribbons do not leave dark patches", () => {
  const rear = fixture(-0.5);
  drawRibbon(rear.frame, rear.occlusion, rear.jelly, rear.item);
  assert.equal(rear.fills.length, 0);
  assert.ok(rear.marks.length > 0);
  const faint = fixture(0.8, 0);
  drawRibbon(faint.frame, faint.occlusion, faint.jelly, faint.item);
  assert.equal(faint.fills[0].path.length, 0);
  assert.equal(faint.marks.length, 0);
  const hidden = fixture();
  drawRibbon(hidden.frame, { glyph: () => true, stroke: () => true }, hidden.jelly, hidden.item);
  assert.equal(hidden.fills[0].path.length, 0);
  assert.equal(hidden.marks.length, 0);
});
