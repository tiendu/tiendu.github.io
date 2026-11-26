import test from "node:test";
import assert from "node:assert/strict";
import { drawBell, marginalPigmentAt, membraneSampleAt, membraneGlyphAt } from "../bell.mjs";
import { JELLY_PALETTE } from "../config.mjs";
import { bellCenterShift, skirtRimAt } from "../geometry.mjs";
import { MATERIAL_GLYPHS, rgba } from "../glyphs.mjs";
import { rotate } from "../math.mjs";

function captureBell(size, pulse, phase, compact, tilt = 0) {
  const marks = [];
  const ctx = { globalAlpha: 1, fillText(glyph, x, y) {
    marks.push({ glyph, x, y, color: this.fillStyle, alpha: this.globalAlpha, shadow: this.shadowColor, font: this.font });
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
          const membrane = marks.filter(mark => mark.shadow === rgba(JELLY_PALETTE.rim, 0.18));
          const margin = membrane.filter(mark => {
            const local = rotate(mark.x - jelly.x, mark.y - jelly.y, -tilt);
            const v = local.y / jelly.bellHeight();
            const halfW = jelly.bellWidth() * 0.5;
            const u = (local.x - bellCenterShift(v, phase, halfW)) / halfW;
            const gap = skirtRimAt(jelly, u, 20) - v;
            return Math.abs(u) < 0.70 && gap >= 0 && gap < 0.16;
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


test("material samples are deterministic, jittered within cells and use fine glyphs", () => {
  const samples = [];
  for (let row = -12; row < 0; row += 1) {
    for (let col = -12; col < 12; col += 1) {
      const a = membraneSampleAt(col, row, 1.2);
      assert.deepEqual(a, membraneSampleAt(col, row, 1.2));
      assert.ok(a.x > col && a.x < col + 1 && a.y > row && a.y < row + 1);
      samples.push(a);
      for (const density of [0.12, 0.28, 0.45, 0.83]) {
        assert.ok(MATERIAL_GLYPHS.membrane.join("").includes(membraneGlyphAt(density, a.glyph)));
      }
    }
  }
  assert.ok(new Set(samples.map(a => a.y % 1)).size > 250);
  assert.notDeepEqual(membraneSampleAt(1, 2, 1.2), membraneSampleAt(1, 2, 2.3));
});

test("bell marks retain material coordinates through contraction and tilt", () => {
  const coordinates = (pulse, tilt) => {
    const { marks, jelly } = captureBell(190, pulse, 1.2, true, tilt);
    return new Set(marks.filter(mark => mark.shadow === rgba(JELLY_PALETTE.rim, 0.18))
      .map(mark => {
        const local = rotate(mark.x - jelly.x, mark.y - jelly.y, -tilt);
        const v = local.y / jelly.bellHeight();
        const half = jelly.bellWidth() * 0.5;
        const u = (local.x - bellCenterShift(v, 1.2, half)) / half;
        return `${u.toFixed(7)},${v.toFixed(7)}`;
      }));
  };
  const a = coordinates(0, 0), b = coordinates(1, 0.12);
  const shared = [...a].filter(key => b.has(key)).length;
  assert.ok(shared / Math.min(a.size, b.size) > 0.75, `shared ${shared}, ${a.size}/${b.size}`);
});
