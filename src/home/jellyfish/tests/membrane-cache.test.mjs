import test from "node:test";
import assert from "node:assert/strict";
import { drawBell, membraneRowsFor } from "../bell.mjs";
import { JELLY_PALETTE } from "../config.mjs";
import { Bioluminescence } from "../bioluminescence.mjs";

test("material samples survive motion and invalidate on specimen or grid changes", () => {
  const frame = {};
  const first = membraneRowsFor(frame, 0.02, 0.03, 1.2);
  assert.equal(membraneRowsFor(frame, 0.02 + 1e-16, 0.03, 1.2), first);
  assert.notEqual(membraneRowsFor(frame, 0.021, 0.03, 1.2), first);
  const second = membraneRowsFor(frame, 0.021, 0.03, 2.1);
  assert.notEqual(second, first);
  assert.notEqual(membraneRowsFor({}, 0.021, 0.03, 2.1), second);
});

test("cached bell marks match fresh rendering during movement, contraction and flashes", () => {
  const marks = [];
  const ctx = { globalAlpha: 1, fillText(glyph, x, y) {
    marks.push([glyph, x, y, this.fillStyle, this.globalAlpha]);
  } };
  const frame = { ctx, compact: true, cellW: 3.18, cellH: 5.48, fontSize: 5.4, shadowScale: 0 };
  const jelly = { x: 190, y: 220, pulse: 0, phase: 0, anatomyPhase: 1.2, twist: 0, tilt: 0,
    palette: JELLY_PALETTE, light: new Bioluminescence(),
    bellWidth() { return 190 * 1.16 * (1 - 0.18 * this.pulse); },
    bellHeight() { return 190 * (0.50 + 0.095 * this.pulse); } };
  for (const [i, pulse] of [0, 0, 0.2, 0.9, 1, 0.5, 0, 0].entries()) {
    jelly.pulse = pulse;
    jelly.phase = i * 0.08;
    jelly.x += 0.8;
    jelly.twist = i * 0.1;
    jelly.tilt = i * 0.01;
    jelly.light.flash = i > 3 ? { u: 0, v: -0.9, age: (i - 3) * 0.1, strength: 1, contact: true } : null;
    marks.length = 0;
    drawBell(frame, jelly, i * 0.1);
    const cached = marks.slice();
    marks.length = 0;
    drawBell({ ...frame }, jelly, i * 0.1);
    assert.equal(cached.length, marks.length);
    for (let j = 0; j < cached.length; j++) {
      const a = cached[j], b = marks[j];
      assert.equal(a[0], b[0]);
      assert.ok(Math.abs(a[1] - b[1]) < 1e-9 && Math.abs(a[2] - b[2]) < 1e-9);
      // Roundoff in relaxed material coordinates can alter the last digits of alpha.
      const rgba = str => str.match(/[\d.]+/g).map(Number);
      const ca = rgba(a[3]), cb = rgba(b[3]);
      assert.deepEqual(ca.slice(0, 3), cb.slice(0, 3));
      assert.ok(Math.abs(ca[3] - cb[3]) < 1e-9 && Math.abs(a[4] - b[4]) < 1e-9);
    }
  }
});
