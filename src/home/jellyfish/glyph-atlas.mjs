// Detached, bounded sprite pages: rasterize a glyph and its glow once, then
// composite the sprite in the original drawing order. Alpha stays continuous.
const PAGE_SIZE = 1024;
const MAX_ENTRIES = 1024;
const MAX_PAGES = 4;

function colorOf(style) {
  if (typeof style !== "string") return null;
  if (/^#[\da-f]{6}$/i.test(style)) {
    return [parseInt(style.slice(1, 3), 16), parseInt(style.slice(3, 5), 16),
      parseInt(style.slice(5, 7), 16), 1];
  }
  const match = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(style);
  return match ? [+match[1], +match[2], +match[3], +(match[4] ?? 1)] : null;
}

const bucket = value => Math.min(255, Math.round(value / 32) * 32);

export class GlyphAtlas {
  constructor(createCanvas) {
    this.createCanvas = createCanvas;
    this.entries = new Map();
    this.pages = [];
    this.hits = this.misses = 0;
    this.reset(1);
  }

  reset(ratio) {
    if (ratio === this.ratio) return;
    this.ratio = ratio;
    this.failed = false;
    this.tile = Math.max(1, Math.ceil(16 * ratio));
    this.columns = Math.floor(PAGE_SIZE / this.tile);
    this.perPage = this.columns ** 2;
    this.capacity = Math.min(MAX_ENTRIES, MAX_PAGES * this.perPage);
    this.clear();
  }

  clear() {
    this.entries.clear();
    // Release canvas backing stores on iOS, not just the JS references.
    for (const page of this.pages) page.canvas.width = page.canvas.height = 1;
    this.pages.length = 0;
    this.hits = this.misses = 0;
  }

  #page(index) {
    if (this.pages[index]) return this.pages[index];
    const canvas = this.createCanvas();
    if (!canvas) return null;
    canvas.width = canvas.height = PAGE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) { canvas.width = canvas.height = 1; return null; }
    return this.pages[index] = { canvas, ctx };
  }

  draw(ctx, glyph, x, y, glow = true) {
    if (this.failed) return false;
    const rgba = colorOf(ctx.fillStyle);
    if (!rgba || !ctx.drawImage || !this.capacity) return false;
    const [r, g, b, alpha] = rgba;
    if (!alpha || !ctx.globalAlpha) return true;
    const rgb = `${bucket(r)},${bucket(g)},${bucket(b)}`;
    const font = ctx.font;
    const key = `${font}|${glyph}|${rgb}|${glow ? 1 : 0}`;
    let entry = this.entries.get(key);
    if (entry) {
      this.hits++;
    } else {
      this.misses++;
      let slot = this.entries.size;
      if (slot >= this.capacity) {
        // FIFO keeps the hot path allocation-free on hits; capacity is fixed.
        const oldest = this.entries.keys().next().value;
        slot = this.entries.get(oldest).slot;
        this.entries.delete(oldest);
      }
      let page;
      try { page = this.#page(Math.floor(slot / this.perPage)); } catch { /* native fallback */ }
      if (!page) { this.clear(); this.failed = true; return false; }
      const local = slot % this.perPage;
      const sx = (local % this.columns) * this.tile;
      const sy = Math.floor(local / this.columns) * this.tile;
      const p = page.ctx;
      p.setTransform(1, 0, 0, 1, 0, 0);
      p.clearRect(sx, sy, this.tile, this.tile);
      p.save();
      p.beginPath();
      p.rect(sx, sy, this.tile, this.tile);
      p.clip();
      p.setTransform(this.ratio, 0, 0, this.ratio, sx + this.tile / 2, sy + this.tile / 2);
      p.font = font;
      p.textAlign = "center";
      p.textBaseline = "middle";
      p.fillStyle = `rgb(${rgb})`;
      p.shadowColor = `rgba(${rgb},0.28)`;
      p.shadowBlur = glow ? this.ratio * 0.65 : 0;
      p.fillText(glyph, 0, 0);
      p.restore();
      entry = { slot, page, sx, sy };
      this.entries.set(key, entry);
    }
    const opacity = ctx.globalAlpha;
    const size = this.tile / this.ratio;
    ctx.globalAlpha = opacity * alpha;
    ctx.drawImage(entry.page.canvas, entry.sx, entry.sy, this.tile, this.tile,
      x - size / 2, y - size / 2, size, size);
    ctx.globalAlpha = opacity;
    return true;
  }
}

export function drawGlyph(frame, glyph, x, y, glow = true) {
  if (!frame.atlas?.draw(frame.ctx, glyph, x, y, glow)) frame.ctx.fillText(glyph, x, y);
}

// Native text won the local benchmark. Keep the atlas and original shadow
// renderer available for on-device A/B measurements, never force either.
export function glyphModeFor(search = globalThis.location?.search ?? "") {
  const params = new URLSearchParams(search);
  const mode = params.get("glyphs");
  return params.get("debug") === "1" && (mode === "atlas" || mode === "shadow")
    ? mode : "native";
}
