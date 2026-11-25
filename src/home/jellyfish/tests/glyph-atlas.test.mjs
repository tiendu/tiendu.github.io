import test from "node:test";
import assert from "node:assert/strict";
import { GlyphAtlas, drawGlyph, glyphModeFor } from "../glyph-atlas.mjs";

function fixture() {
  const pages = [], raster = [], draws = [], native = [];
  const create = () => {
    const page = { width: 0, height: 0, getContext() { return p; } };
    const p = {
      setTransform() {}, clearRect() {}, save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
      fillText(glyph) { raster.push([glyph, this.font, this.fillStyle, this.shadowBlur]); },
    };
    pages.push(page);
    return page;
  };
  const ctx = { fillStyle: "rgba(130, 220, 250, 0.5)", font: "5px monospace", globalAlpha: 0.4,
    drawImage(...args) { draws.push({ args, alpha: this.globalAlpha }); },
    fillText(...args) { native.push(args); },
  };
  return { pages, raster, draws, native, ctx, atlas: new GlyphAtlas(create) };
}

test("atlas reuses glyph rasterization across positions and continuous opacity", () => {
  const f = fixture();
  f.atlas.reset(3);
  const frame = { ctx: f.ctx, atlas: f.atlas };
  drawGlyph(frame, "i", 12, 20);
  f.ctx.fillStyle = "rgba(130, 220, 250, 0.25)";
  drawGlyph(frame, "i", 30, 50);
  assert.equal(f.raster.length, 1);
  assert.equal(f.atlas.hits, 1);
  assert.equal(f.atlas.misses, 1);
  assert.deepEqual(f.draws.map(d => d.alpha), [0.2, 0.1]);
  assert.equal(f.ctx.globalAlpha, 0.4);
  assert.deepEqual(f.draws[0].args.slice(5), [4, 12, 16, 16]);
  assert.equal(f.native.length, 0);
  assert.ok(f.raster[0][3] > 0);
});

test("glow, font and color variants are separate, and DPR releases cached pages", () => {
  const f = fixture();
  f.atlas.reset(3);
  f.atlas.draw(f.ctx, "i", 1, 2, true);
  f.atlas.draw(f.ctx, "i", 1, 2, false);
  f.ctx.font = "6px monospace";
  f.atlas.draw(f.ctx, "i", 1, 2, false);
  f.ctx.fillStyle = "#ff0000";
  f.atlas.draw(f.ctx, "i", 1, 2, false);
  assert.equal(f.raster.length, 4);
  assert.equal(f.raster[1][3], 0);
  f.atlas.reset(3);
  assert.equal(f.atlas.entries.size, 4);
  f.atlas.reset(4);
  assert.equal(f.atlas.entries.size, 0);
  assert.equal(f.pages[0].width, 1);
  f.atlas.draw(f.ctx, "i", 1, 2);
  assert.equal(f.pages.length, 2);
});

test("atlas bounds cache size and falls back when canvas allocation is unavailable", () => {
  const f = fixture();
  f.atlas.reset(4);
  for (let i = 0; i < 1400; i++) {
    f.ctx.font = `${5 + i / 10000}px monospace`;
    f.atlas.draw(f.ctx, "i", 1, 2);
  }
  assert.equal(f.atlas.entries.size, 1024);
  assert.equal(f.pages.length, 4);
  f.atlas.clear();
  assert.ok(f.pages.every(p => p.width === 1 && p.height === 1));
  const unsupported = new GlyphAtlas(() => null);
  drawGlyph({ ctx: f.ctx, atlas: unsupported }, "a", 3, 4);
  drawGlyph({ ctx: f.ctx, atlas: unsupported }, "b", 5, 6);
  assert.ok(unsupported.failed);
  assert.deepEqual(f.native, [["a", 3, 4], ["b", 5, 6]]);
});

test("native text is the default and experimental modes require debug opt-in", () => {
  assert.equal(glyphModeFor(""), "native");
  assert.equal(glyphModeFor("?glyphs=atlas"), "native");
  assert.equal(glyphModeFor("?debug=1"), "native");
  assert.equal(glyphModeFor("?debug=1&glyphs=atlas"), "atlas");
  assert.equal(glyphModeFor("?debug=1&glyphs=shadow"), "shadow");
});
