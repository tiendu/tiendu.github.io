import { drawBell, drawEmbeddedRoots } from "./bell.mjs";
import { bellOcclusionContour, visibleAttachmentFor } from "./geometry.mjs";
import { setFont } from "./glyphs.mjs";
import { buildOcclusionSpans, projectedBellPoint, trailOcclusionFor } from "./occlusion.mjs";
import { keepTrailDirection, MAX_VISUAL_TILT } from "./orientation.mjs";
import { clamp } from "./math.mjs";
import { drawRibbon, drawTentacle } from "./tissue.mjs";

export class AsciiRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.cellW = 3.2;
    this.cellH = 5.5;
    this.fontSize = 5.4;
    this.compact = false;
    this.shadowScale = 1;
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const compact = this.width < 620 || this.height < 500;
    this.compact = compact;
    this.shadowScale = compact ? 0 : 1;
    this.cellW = compact ? 3.45 : 3.18;
    this.cellH = compact ? 5.90 : 5.48;
    this.fontSize = this.cellH * 0.98;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    setFont(this.ctx, this.fontSize);
  }

  #background(jelly) {
    const ctx = this.ctx;
    ctx.fillStyle = "#000204";
    ctx.fillRect(0, 0, this.width, this.height);

    // Keep fluorescence around the animal but make the halo small enough that
    // the eye sees light, not the boundary of a giant violet ellipse.
    const glow = ctx.createRadialGradient(
      jelly.x,
      jelly.y + jelly.bellHeight() * 0.28,
      0,
      jelly.x,
      jelly.y + jelly.bellHeight() * 0.58,
      Math.max(jelly.baseSize * 1.72, 210),
    );
    glow.addColorStop(0, "rgba(151,91,255,0.090)");
    glow.addColorStop(0.42, "rgba(134,56,164,0.045)");
    glow.addColorStop(0.76, "rgba(51,78,150,0.018)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  #drawSnow(snow) {
    const ctx = this.ctx;
    setFont(ctx, Math.max(5.2, this.fontSize * 0.92));
    ctx.save();
    ctx.shadowBlur = 0;
    for (const p of snow.items) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.depth > 0.72 ? "#a8a9c2" : "#626a7d";
      ctx.fillText(p.glyph, p.x, p.y);
    }
    ctx.restore();
  }

  #drawProjectedItem(jelly, item, opacity, time) {
    const projection = this.attachments.get(item);
    const ctx = this.ctx;
    const occlusion = trailOcclusionFor(jelly, item, projection,
      jelly.tilt + this.extraTilt, this.bellOcclusion);
    ctx.save();
    ctx.translate(projection.x, projection.y);
    keepTrailDirection(ctx, item, this.extraTilt);
    if (item.arm) drawRibbon(this, occlusion, jelly, item, opacity, time);
    else drawTentacle(this, occlusion, jelly, item, opacity);
    ctx.restore();
  }

  render({ time, jelly, snow, orientation }) {
    const ctx = this.ctx;
    if (!jelly) return;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    setFont(this.ctx, this.fontSize);
    const visualTilt = clamp(orientation?.tilt ?? jelly.tilt, -MAX_VISUAL_TILT, MAX_VISUAL_TILT);
    this.extraTilt = visualTilt - jelly.tilt;
    this.#background(jelly);
    this.#drawSnow(snow);
    // Bell, skirt and embedded roots share the visible attitude. External
    // appendages keep their fluid direction via root-relative compensation.
    ctx.translate(jelly.x, jelly.y);
    ctx.rotate(visualTilt);
    ctx.rotate(-jelly.tilt);
    ctx.translate(-jelly.x, -jelly.y);
    this.attachments = new Map(jelly.chains.map(item =>
      [item, visibleAttachmentFor(jelly, item, time)]));
    this.bellOcclusion = buildOcclusionSpans(bellOcclusionContour(jelly, time).map(point =>
      projectedBellPoint(jelly, point, visualTilt)));
    // Layers are assigned once when a specimen is built.
    if (this.depthChains !== jelly.chains) {
      this.depthChains = jelly.chains;
      const sorted = [...jelly.chains].sort((a, b) => a.layer - b.layer);
      this.back = sorted.filter(item => item.layer < -0.25);
      this.middle = sorted.filter(item => item.layer >= -0.25 && item.layer < 0.45);
      this.front = sorted.filter(item => item.layer >= 0.45);
      this.embedded = [...this.back, ...this.middle];
    }
    const { back, middle, front } = this;

    // External tissue is culled against one shared projected contour.
    for (const item of back) {
      this.#drawProjectedItem(jelly, item, item.arm ? 0.76 : 0.70, time);
    }

    // A faint continuation of rear/mid anatomy is drawn before the bell so
    // membrane glyphs naturally sit on top of it. This visually connects roots
    // to the subumbrella without changing any physics anchors.
    drawEmbeddedRoots(this, jelly, this.embedded, time);
    drawBell(this, jelly, time);

    // Mid and foreground layers are progressively brighter. Foreground ribbons
    // lay a small dark mask before their ASCII, producing real occlusion of
    // strands behind them without painting any visible non-ASCII surface.
    for (const item of middle) {
      this.#drawProjectedItem(jelly, item, item.arm ? 0.90 : 0.86, time);
    }
    for (const item of front) {
      this.#drawProjectedItem(jelly, item, item.arm ? 1 : 0.98, time);
    }
    ctx.restore();
  }

}
