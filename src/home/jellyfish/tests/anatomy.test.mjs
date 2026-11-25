import test from "node:test";
import assert from "node:assert/strict";
import { drawBell, marginalPigmentAt } from "../bell.mjs";
import { JELLY_PALETTE } from "../config.mjs";
import { bellCenterShift, bellGridScaleFor, skirtRimAt } from "../geometry.mjs";
import { rotate } from "../math.mjs";

function captureBell(size, pulse, phase, compact, tilt = 0) {
  const marks = [];
  const ctx = { globalAlpha: 1, fillText(glyph, x, y) {
    marks.push({ glyph, x, y, color: this.fillStyle, alpha: this.globalAlpha });
  } };
  const jelly = { x: 240, y: 230, pulse, anatomyPhase: phase, twist: 1.3, tilt,
    bellWidth: () => size * 1.16 * (1 - 0.18 * pulse),
    bellHeight: () => size * (0.50 + 0.095 * pulse), palette: JELLY_PALETTE };
  const frame = { ctx, compact, cellW: compact ? 3.45 : 3.18,
    cellH: compact ? 5.90 : 5.48, fontSize: 5.5, shadowScale: compact ? 0 : 1 };
  drawBell(frame, jelly, 20);
  return { marks, frame, jelly };
}

test("marginal pigment is bounded, diffuse, irregular and fades into the bell", () => {
  for (const phase of [0, 1.2, 3.7, 6.1]) {
    for (const pulse of [0, 0.5, 1]) {
      const samples = Array.from({ length: 121 }, (_, i) => {
        const u = -0.75 + i * 1.5 / 120;
        const values = [0.02, 0.06, 0.10, 0.14].map(gap => marginalPigmentAt(u, gap, pulse, phase));
        assert.ok(values.every(value => value >= 0 && value <= 1));
        assert.equal(marginalPigmentAt(u, -0.01, pulse, phase), 0);
        assert.equal(marginalPigmentAt(u, 0.25, pulse, phase), 0);
        return values;
      });
      const middle = samples.map(values => values[1]);
      assert.ok(Math.max(...middle) - Math.min(...middle) > 0.30);
      assert.ok(samples.some(values => values[2] > values[1]));
      assert.ok(samples.some(values => values[2] < values[1]));
      assert.equal(marginalPigmentAt(0.9, 0.06, pulse, phase), 0);
    }
  }
});

test("full bell keeps warm porous tissue inside the shared rim at multiple sizes and pulses", () => {
  for (const [size, compact] of [[110, true], [190, true], [280, false]]) {
    for (const pulse of [0, 0.5, 1]) {
      for (const phase of [0, 1.2, 3.7]) {
        for (const tilt of [-0.12, 0.12]) {
          const { marks, jelly, frame } = captureBell(size, pulse, phase, compact, tilt);
          const grid = bellGridScaleFor(compact);
          const cellW = frame.cellW * grid.x;
          const cellH = frame.cellH * grid.y;
          const onGrid = (value, cell) => Math.abs(value / cell - 0.5 - Math.round(value / cell - 0.5)) < 1e-7;
          const margin = marks.filter(mark => {
            const local = rotate(mark.x - jelly.x, mark.y - jelly.y, -tilt);
            const v = local.y / jelly.bellHeight();
            const halfW = jelly.bellWidth() * 0.5;
            const u = (local.x - bellCenterShift(v, phase, halfW)) / halfW;
            const gap = skirtRimAt(jelly, u, 20) - v;
            return onGrid(mark.x, cellW) && onGrid(mark.y, cellH)
              && Math.abs(u) < 0.70 && gap >= 0 && gap < 0.16;
          });
          const warm = margin.filter(mark => {
            const [r, , b] = mark.color.match(/[\d.]+/g).map(Number);
            return r > b && mark.glyph !== " ";
          });
          assert.ok(marks.length > 100);
          assert.ok(margin.length >= 6, `missing margin at ${size}/${pulse}/${phase}/${tilt}`);
          assert.ok(warm.length >= 2, `missing pigment at ${size}/${pulse}/${phase}/${tilt}`);
          assert.ok(marks.every(mark => Number.isFinite(mark.x) && Number.isFinite(mark.y)));
          assert.ok(margin.every(mark => !"~|/\\".includes(mark.glyph)), "margin must be tissue, not traced lines");
        }
      }
    }
  }
});
