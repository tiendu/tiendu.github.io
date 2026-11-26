import test from "node:test";
import assert from "node:assert/strict";
import { MATERIAL_GLYPHS, materialGlyphAt, glyphSeedAt, fiberGlyphAt } from "../glyphs.mjs";
import { membraneRowsFor, drawBell } from "../bell.mjs";
import { JELLY_PALETTE } from "../config.mjs";
import { rotate } from "../math.mjs";
import { bellCenterShift } from "../geometry.mjs";

test("material families span printable ASCII without spaces or solid blocks", () => {
  const chars = new Set(Object.values(MATERIAL_GLYPHS).flatMap(f => Object.values(f)).join(""));
  assert.ok(chars.size >= 50, `only ${chars.size} characters`);
  for (const c of chars) {
    assert.ok(c.charCodeAt(0) >= 33 && c.charCodeAt(0) <= 126);
    assert.ok(!"#@%&".includes(c));
  }
  for (const name of ["membrane", "pigment", "ribbon"]) {
    for (const [density, family] of [[0.12, 0], [0.30, 1], [0.60, 2]]) {
      const seen = new Set(Array.from({ length: 128 }, (_, i) =>
        materialGlyphAt(density, i / 128, MATERIAL_GLYPHS[name])));
      assert.equal(seen.size, new Set(MATERIAL_GLYPHS[name][family]).size);
    }
  }
});

test("fibers preserve their direction and deterministic segment identity", () => {
  for (const name of ["fiber", "edge", "canal"]) {
    const table = MATERIAL_GLYPHS[name];
    for (const [dx, dy, family] of [[5, 0, "horizontal"], [0, 5, "vertical"],
      [5, -5, "rising"], [5, 5, "falling"]]) {
      for (let i = 0; i < 100; i++) {
        const seed = glyphSeedAt(i, 2, 1.2);
        const glyph = fiberGlyphAt(dx, dy, table, seed);
        assert.ok(table[family].includes(glyph));
        assert.equal(glyph, fiberGlyphAt(dx, dy, table, glyphSeedAt(i, 2, 1.2)));
      }
    }
  }
  assert.ok(new Set(Array.from({ length: 100 }, (_, i) => glyphSeedAt(i, 2, 1.2))).size > 95);
});

test("bell material letters are cached and span distinct tissue families", () => {
  const frame = {};
  const rows = membraneRowsFor(frame, 0.018, 0.026, 1.2);
  const samples = rows.flat();
  assert.ok(new Set(samples.map(s => s.inkGlyph)).size >= 30);
  assert.ok(samples.filter(s => s.crownGlow > 0.75).every(s =>
    MATERIAL_GLYPHS.pigment.join("").includes(s.inkGlyph)));
  assert.equal(membraneRowsFor(frame, 0.018, 0.026, 1.2), rows);
  assert.deepEqual(membraneRowsFor({}, 0.018, 0.026, 1.2).flat().map(s => s.inkGlyph),
    samples.map(s => s.inkGlyph));
});

test("shared membrane samples keep their characters through pulse and tilt", () => {
  const marks = [];
  const ctx = { globalAlpha: 1, fillText(glyph, x, y) { marks.push({ glyph, x, y, shadow: this.shadowColor }); } };
  const frame = { ctx, compact: true, cellW: 3.18, cellH: 5.48, fontSize: 5.4, shadowScale: 0 };
  const jelly = { x: 190, y: 220, phase: 0, pulse: 0, tilt: 0, twist: 1.4, anatomyPhase: 1.2,
    palette: JELLY_PALETTE, bellWidth() { return 220 * (1 - 0.18 * this.pulse); },
    bellHeight() { return 95 * (1 + 0.19 * this.pulse); } };
  const collect = (pulse, tilt) => {
    marks.length = 0;
    Object.assign(jelly, { pulse, tilt });
    drawBell(frame, jelly, 2);
    const halfW = jelly.bellWidth() * 0.5;
    const result = new Map();
    for (const m of marks.filter(m => m.shadow === "rgba(255, 79, 191, 0.18)")) {
      const p = rotate(m.x - jelly.x, m.y - jelly.y, -tilt);
      const v = p.y / jelly.bellHeight();
      const u = (p.x - bellCenterShift(v, jelly.anatomyPhase, halfW)) / halfW;
      result.set(`${u.toFixed(7)},${v.toFixed(7)}`, m.glyph);
    }
    return result;
  };
  const a = collect(0, 0), b = collect(1, 0.12);
  let shared = 0;
  for (const [key, glyph] of a) if (b.has(key)) {
    assert.equal(b.get(key), glyph, key);
    shared++;
  }
  assert.ok(shared > 100);
});
