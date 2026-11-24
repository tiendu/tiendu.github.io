import { ASCII } from "./config.mjs";
import { clamp, invLerp, lerp, rotate, smoothstep, TAU } from "./math.mjs";

function rgb(hex) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function rgba(hex, alpha) {
  const c = rgb(hex);
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${clamp(alpha, 0, 1)})`;
}

function mixColor(a, b, t, alpha = 1) {
  const ca = rgb(a);
  const cb = rgb(b);
  const k = clamp(t, 0, 1);
  return `rgba(${Math.round(lerp(ca.r, cb.r, k))}, ${Math.round(lerp(ca.g, cb.g, k))}, ${Math.round(lerp(ca.b, cb.b, k))}, ${clamp(alpha, 0, 1)})`;
}

function directionGlyph(dx, dy, table = ASCII.edge) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ay < ax * 0.42) return table.horizontal;
  if (ax < ay * 0.42) return table.vertical;
  return dx * dy < 0 ? table.rising : table.falling;
}

function densityGlyph(value, ramp = ASCII.density) {
  const t = clamp(value, 0, 0.9999);
  const index = Math.floor(t * ramp.length);
  return ramp[Math.min(index, ramp.length - 1)];
}

function lobeField(u, v) {
  const lobes = [
    [-0.27, -0.30, 0.17, 0.15],
    [0.27, -0.30, 0.17, 0.15],
    [-0.20, -0.09, 0.15, 0.11],
    [0.20, -0.09, 0.15, 0.11],
  ];
  let best = Infinity;
  for (const [x, y, rx, ry] of lobes) {
    const dx = (u - x) / rx;
    const dy = (v - y) / ry;
    best = Math.min(best, dx * dx + dy * dy);
  }
  return best;
}

// V4.4 bell material. The geometry stays broad enough to feel like the same
// specimen, but the sides now keep curving all the way into the skirt instead
// of settling into architectural side walls. The visual bell is also a little
// narrower/taller than V4.3; tentacle roots still sit safely inside the rim.
export function bellProfileAt(v, pulse = 0, phase = 0) {
  if (v < -1.09 || v > 0.06) return 0;
  const t = invLerp(-1.07, 0.035, v);
  const topRound = smoothstep(invLerp(-1.09, -0.965, v));
  const shoulderRise = smoothstep(invLerp(-1.055, -0.34, v));
  const crown = topRound * (0.055 + 0.865 * Math.pow(shoulderRise, 0.39));
  const shoulderSoftening = 1 - smoothstep(invLerp(0.58, 0.86, t)) * 0.028;
  const lowerTuck = 1 - smoothstep(invLerp(0.64, 1, t)) * (0.105 + pulse * 0.026);
  const organic = 1
    + Math.sin(phase * 0.71 + v * 4.5) * 0.010
    + Math.sin(phase * 1.29 - v * 8.4) * 0.0045;
  return clamp(crown * shoulderSoftening * lowerTuck * organic, 0, 0.925);
}

export function bellRimAt(u, pulse = 0, phase = 0) {
  const absU = Math.min(1, Math.abs(u));
  const sideFade = 0.42 + (1 - absU) * 0.58;
  // A shallow underbelly makes the lower membrane visibly organic even before
  // the local scallops are added. The center hangs slightly lower than sides.
  const underbelly = 0.010 + (1 - absU * absU) * (0.020 + pulse * 0.004);
  const broad = Math.sin((u + 1) * Math.PI * 5.55 + phase * 0.80)
    * (0.021 + pulse * 0.007) * sideFade;
  const fine = Math.sin((u + 1) * Math.PI * 13.1 + phase * 1.41) * 0.0057 * sideFade;
  const irregular = Math.sin((u + 0.29) * Math.PI * 2.7 - phase * 0.48) * 0.0041;
  return underbelly + broad + fine + irregular;
}

export function bellPoreThresholdAt(v, tissueDensity = 0.4, crownGlow = 0) {
  const lowerThird = smoothstep(invLerp(-0.42, 0.035, v));
  // Lower values mean more cells become true holes. The lower third is the most
  // transparent so oral-arm tissue can visibly sit behind the membrane.
  return clamp(0.49 + tissueDensity * 0.27 + crownGlow * 0.055 - lowerThird * 0.14, 0.37, 0.78);
}

function bellCenterShift(v, phase, halfW) {
  const t = invLerp(-1, 0, v);
  return halfW * (
    Math.sin(phase * 0.91 + v * 3.4) * 0.011
    + Math.sin(phase * 1.47 - v * 7.2) * 0.0045
  ) * smoothstep(t);
}

// The bell gets its own denser text lattice. Ribbons and tentacles stay on the
// normal scene grid so extra detail is spent only on the translucent membrane.
export function bellGridScaleFor(compact = false) {
  return compact ? { x: 0.78, y: 0.82 } : { x: 0.62, y: 0.66 };
}

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
    this.#setFont(this.fontSize);
  }

  #setFont(fontSize) {
    this.ctx.font = `${fontSize}px "Source Code Pro Variable", "Source Code Pro", ui-monospace, monospace`;
  }

  #background(jelly, time) {
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
    glow.addColorStop(0, "rgba(117,82,207,0.075)");
    glow.addColorStop(0.42, "rgba(62,46,145,0.038)");
    glow.addColorStop(0.76, "rgba(25,24,70,0.014)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.globalAlpha = 0.010 + (Math.sin(time * 0.19) * 0.5 + 0.5) * 0.007;
    ctx.fillStyle = "#ff72c8";
    ctx.beginPath();
    ctx.ellipse(
      jelly.x,
      jelly.y - jelly.bellHeight() * 0.37,
      jelly.bellWidth() * 0.49,
      jelly.bellHeight() * 0.63,
      jelly.tilt,
      0,
      TAU,
    );
    ctx.fill();
    ctx.restore();
  }

  #drawSnow(snow) {
    const ctx = this.ctx;
    this.#setFont(Math.max(5.2, this.fontSize * 0.92));
    ctx.save();
    ctx.shadowBlur = 0;
    for (const p of snow.items) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.depth > 0.72 ? "#a8a9c2" : "#626a7d";
      ctx.fillText(p.glyph, p.x, p.y);
    }
    ctx.restore();
  }

  #layerOpacity(item, opacity) {
    const depth = item.layer ?? 0;
    const depthFactor = depth < -0.75 ? 0.44 : depth < -0.2 ? 0.64 : depth > 0.7 ? 1.05 : 0.84;
    return opacity * depthFactor;
  }

  #drawTentacle(jelly, item, opacity = 1) {
    const { chain } = item;
    const ctx = this.ctx;
    const layerOpacity = this.#layerOpacity(item, opacity);
    const baseAlpha = 0.66 * item.bright * layerOpacity;
    ctx.shadowColor = rgba(jelly.palette.tentacleHot, 0.24 * layerOpacity);
    ctx.shadowBlur = (item.layer > 0.6 ? 1.5 : 0.8) * this.shadowScale;

    for (let i = 0; i < chain.count - 1; i += 1) {
      const x0 = chain.x[i];
      const y0 = chain.y[i];
      const x1 = chain.x[i + 1];
      const y1 = chain.y[i + 1];
      const dx = x1 - x0;
      const dy = y1 - y0;
      const distance = Math.hypot(dx, dy) || 1;
      const along = i / Math.max(1, chain.count - 2);
      const samples = Math.max(1, Math.ceil(distance / (this.cellH * 0.48)));
      const tipFade = 1 - smoothstep(invLerp(0.84, 1, along));
      const alpha = baseAlpha * lerp(1, 0.34, along) * tipFade;
      if (alpha < 0.010) continue;
      const nx = -dy / distance;
      const ny = dx / distance;

      for (let s = 0; s < samples; s += 1) {
        const t = s / samples;
        const x = lerp(x0, x1, t);
        const y = lerp(y0, y1, t);
        const glyph = directionGlyph(dx, dy);
        const rootGlow = 1 - smoothstep(invLerp(0.0, 0.34, along));
        const tipGlow = smoothstep(invLerp(0.70, 0.95, along)) * 0.14;
        ctx.fillStyle = mixColor(
          jelly.palette.tentacle,
          jelly.palette.tentacleHot,
          rootGlow * 0.42 + tipGlow,
          alpha,
        );
        ctx.fillText(glyph, x, y);

        // Punctuation makes the strand taper and break into the darkness. Near
        // the tips it also exaggerates hooks/loops without turning them thick.
        if ((i * 3 + s) % 8 === 0) {
          const side = Math.sin(item.phase + i * 1.31) >= 0 ? 1 : -1;
          const reach = this.cellW * (along > 0.72 ? 0.92 : 0.58);
          ctx.fillStyle = rgba(jelly.palette.tentacleHot, alpha * (along > 0.72 ? 0.34 : 0.22));
          ctx.fillText(along > 0.68 ? (i % 2 ? "," : ".") : ":", x + nx * reach * side, y + ny * this.cellH * 0.12 * side);
        }
      }
    }
  }

  #ribbonSample(item, along, time, widthScale = 1) {
    const foldEnvelope = 0.70 + 0.48 * Math.sin(Math.PI * clamp(along * 1.12, 0, 1));
    const taper = lerp(1, 0.28, along);
    const baseWidth = this.cellW * (item.width ?? 2.4) * foldEnvelope * taper * widthScale;
    const twistAngle = (item.twistPhase ?? item.phase ?? 0)
      + along * (item.twistRate ?? 3.4) * TAU
      + Math.sin(time * 0.10 + (item.phase ?? 0)) * 0.34;
    const face = Math.cos(twistAngle);
    const projected = baseWidth * (0.10 + Math.abs(face) * 0.90);
    const torsionOffset = Math.sin(twistAngle) * baseWidth * 0.24;
    const ruffleEnvelope = 0.24 + smoothstep(along) * 0.76;
    const leftRuffle = Math.sin((item.edgePhaseLeft ?? item.phase ?? 0) + along * 29.0 + time * 0.24)
      * this.cellW * (item.ruffleLeft ?? 1) * ruffleEnvelope;
    const rightRuffle = Math.sin((item.edgePhaseRight ?? (item.phase ?? 0) + 1.7) + along * 33.0 - time * 0.21)
      * this.cellW * (item.ruffleRight ?? 1) * ruffleEnvelope;
    return {
      baseWidth,
      projected,
      torsionOffset,
      leftRuffle,
      rightRuffle,
      face,
    };
  }

  #maskRibbon(item, opacity, time, widthScale = 1) {
    if ((item.layer ?? 0) < 0.25 || opacity < 0.5) return;
    const { chain } = item;
    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = `rgba(0, 2, 4, ${clamp(0.24 + (item.layer ?? 0) * 0.16, 0.22, 0.52)})`;
    for (let i = 2; i < chain.count - 1; i += 1) {
      const along = i / Math.max(1, chain.count - 2);
      const geometry = this.#ribbonSample(item, along, time, widthScale);
      ctx.lineWidth = Math.max(this.cellW * 1.4, geometry.projected * 1.45);
      ctx.beginPath();
      ctx.moveTo(chain.x[i - 1], chain.y[i - 1]);
      ctx.lineTo(chain.x[i], chain.y[i]);
      ctx.stroke();
    }
    ctx.restore();
  }

  #drawRibbonStructure(jelly, item, opacity, time, widthScale = 1, branch = false) {
    const { chain } = item;
    const ctx = this.ctx;
    const layerOpacity = this.#layerOpacity(item, opacity);
    const baseAlpha = (branch ? 0.66 : 0.79) * (item.bright ?? 0.9) * layerOpacity;
    ctx.shadowColor = rgba(jelly.palette.armHot, 0.24 * layerOpacity);
    ctx.shadowBlur = ((item.layer ?? 0) > 0.5 ? 1.8 : 1.0) * this.shadowScale;

    for (let i = 0; i < chain.count - 1; i += 1) {
      const x0 = chain.x[i];
      const y0 = chain.y[i];
      const x1 = chain.x[i + 1];
      const y1 = chain.y[i + 1];
      const dx = x1 - x0;
      const dy = y1 - y0;
      const distance = Math.hypot(dx, dy) || 1;
      const segmentAlong = i / Math.max(1, chain.count - 2);
      const samples = Math.max(1, Math.ceil(distance / (this.cellH * 0.40)));
      const nx = -dy / distance;
      const ny = dx / distance;
      const tipFade = 1 - smoothstep(invLerp(branch ? 0.75 : 0.84, 1, segmentAlong));
      const alpha = baseAlpha * lerp(1, branch ? 0.32 : 0.45, segmentAlong) * tipFade;
      if (alpha < 0.012) continue;

      for (let s = 0; s < samples; s += 1) {
        const t = s / samples;
        const along = clamp((i + t) / Math.max(1, chain.count - 1), 0, 1);
        const centerX = lerp(x0, x1, t);
        const centerY = lerp(y0, y1, t);
        const g = this.#ribbonSample(item, along, time, widthScale);
        const leftOffset = g.torsionOffset + g.projected + g.leftRuffle;
        const rightOffset = g.torsionOffset - g.projected - g.rightRuffle;
        const leftX = centerX + nx * leftOffset;
        const leftY = centerY + ny * leftOffset;
        const rightX = centerX + nx * rightOffset;
        const rightY = centerY + ny * rightOffset;
        const face = Math.abs(g.face);

        // Two independent edges are always rendered. One becomes brighter as
        // the ribbon twists toward us, while the opposite edge falls away.
        const leftFront = g.face >= 0;
        const edgeGlyph = directionGlyph(dx, dy, ASCII.arm);
        ctx.fillStyle = mixColor(
          jelly.palette.arm,
          jelly.palette.armHot,
          leftFront ? 0.78 : 0.38,
          alpha * (leftFront ? 1 : 0.66),
        );
        ctx.fillText(edgeGlyph, leftX, leftY);
        ctx.fillStyle = mixColor(
          jelly.palette.armDark,
          jelly.palette.armHot,
          leftFront ? 0.34 : 0.72,
          alpha * (leftFront ? 0.62 : 0.96),
        );
        ctx.fillText(edgeGlyph, rightX, rightY);

        // Broad faces get translucent tissue between the edges. When the
        // ribbon turns edge-on the fill collapses naturally to almost nothing.
        const span = Math.hypot(leftX - rightX, leftY - rightY);
        const bands = face < 0.16 ? 0 : Math.min(6, Math.max(1, Math.floor(span / (this.cellW * 1.05))));
        for (let band = 1; band < bands; band += 1) {
          const q = band / bands;
          const tear = Math.sin((i + 1) * 2.21 + q * 9.7 + (item.phase ?? 0))
            + Math.cos((i + band + 3) * 1.47 + (item.edgePhaseLeft ?? 0));
          if (tear > 1.46 && along > 0.14) continue;
          const x = lerp(rightX, leftX, q);
          const y = lerp(rightY, leftY, q);
          const middle = 1 - Math.abs(q - 0.5) * 2;
          const foldHighlight = Math.max(0, Math.sin((item.phase ?? 0) + along * 14.4 + q * 3.1));
          const density = clamp(0.10 + middle * 0.38 + foldHighlight * 0.24 + face * 0.16, 0.04, 0.90);
          ctx.fillStyle = mixColor(
            jelly.palette.armDark,
            jelly.palette.armHot,
            0.18 + foldHighlight * 0.48 + face * 0.12,
            alpha * (0.42 + middle * 0.25),
          );
          ctx.fillText(densityGlyph(density, ASCII.ribbon), x, y);
        }

        // Ruffled lace protrudes independently from each edge, rather than as
        // mirrored hairs. This is what makes the oral arms look torn/leafy.
        if ((i + s) % (branch ? 5 : 4) === 0 && along > 0.10 && along < 0.88) {
          const leftFray = this.cellW * (0.7 + (item.ruffleLeft ?? 1) * 0.75);
          const rightFray = this.cellW * (0.7 + (item.ruffleRight ?? 1) * 0.75);
          ctx.fillStyle = rgba(jelly.palette.rim, alpha * 0.30);
          ctx.fillText(i % 2 ? "/" : "~", leftX + nx * leftFray, leftY + ny * leftFray * 0.25);
          if ((i + s) % 7 === 0) {
            ctx.fillStyle = rgba(jelly.palette.armHot, alpha * 0.26);
            ctx.fillText(i % 3 ? "\\" : ".", rightX - nx * rightFray, rightY - ny * rightFray * 0.20);
          }
        }
      }
    }
  }

  #drawRibbon(jelly, item, opacity = 1, time = 0) {
    this.#maskRibbon(item, opacity, time, 1);
    this.#drawRibbonStructure(jelly, item, opacity, time, 1, false);
    for (const branch of item.branches ?? []) {
      this.#maskRibbon(branch, opacity * 0.86, time, 0.8);
      this.#drawRibbonStructure(jelly, branch, opacity * 0.86, time, 0.8, true);
    }
  }

  #drawBell(jelly, time) {
    const ctx = this.ctx;
    const width = jelly.bellWidth();
    const height = jelly.bellHeight();
    const halfW = width * 0.5;

    const bellGrid = bellGridScaleFor(this.compact);
    const cellW = this.cellW * bellGrid.x;
    const cellH = this.cellH * bellGrid.y;
    const bellFont = cellH * 0.97;
    const xMin = jelly.x - halfW - cellW * 2;
    const xMax = jelly.x + halfW + cellW * 2;
    const yMin = jelly.y - height * 1.10 - cellH;
    const yMax = jelly.y + height * 0.105 + cellH;
    const startX = Math.floor(xMin / cellW) * cellW + cellW * 0.5;
    const startY = Math.floor(yMin / cellH) * cellH + cellH * 0.5;

    this.#setFont(bellFont);
    ctx.shadowColor = rgba(jelly.palette.rim, 0.24);
    ctx.shadowBlur = 1.0 * this.shadowScale;

    for (let py = startY; py <= yMax; py += cellH) {
      for (let px = startX; px <= xMax; px += cellW) {
        const raw = rotate(px - jelly.x, py - jelly.y, -jelly.tilt);
        const v = raw.y / height;
        if (v < -1.09 || v > 0.095) continue;
        const shift = bellCenterShift(v, jelly.anatomyPhase, halfW);
        const u = (raw.x - shift) / halfW;
        const absU = Math.abs(u);
        const profile = bellProfileAt(v, jelly.pulse, jelly.anatomyPhase);
        const rimV = bellRimAt(u, jelly.pulse, jelly.twist);
        const insideDome = v <= 0.020 && profile > 0 && absU <= profile;
        const insideSkirt = absU <= 0.90 && v > -0.026 && v <= rimV;
        if (!insideDome && !insideSkirt) continue;

        const t = invLerp(-1.07, 0.035, v);
        const profileGap = profile > 0 ? profile - absU : 0;
        const boundaryThreshold = Math.max(0.009, (cellW / Math.max(1, halfW)) * 1.16);
        const boundary = insideDome && profileGap >= 0 && profileGap < boundaryThreshold;
        const lowerEdge = insideSkirt && v > rimV - Math.max(0.008, cellH / height * 0.62);
        const membraneDepth = insideDome
          ? clamp(profileGap / Math.max(0.075, profile * 0.68), 0, 1)
          : clamp((rimV - v) / 0.068, 0, 1);

        const crownDistance = Math.hypot(u / 0.46, (v + 0.78) / 0.30);
        const crownGlow = 1 - smoothstep(invLerp(0.18, 1.04, crownDistance));
        const warmZone = 1 - smoothstep(invLerp(-0.66, -0.19, v));
        const coolZone = smoothstep(invLerp(-0.45, 0.035, v));
        const lowerGlass = smoothstep(invLerp(-0.46, 0.025, v));
        const centerGlass = Math.max(0, 1 - Math.abs(u) / Math.max(0.17, profile))
          * (0.28 + 0.72 * Math.sin(Math.PI * clamp(t, 0, 1)));

        const theta = Math.atan2(u * 0.93, -(v + 1.055));
        const canalPrimary = Math.abs(Math.sin(theta * 6.5 + jelly.anatomyPhase + t * 1.31))
          < (0.057 + t * 0.017)
          && t > 0.08 && t < 0.82;
        const canalFine = Math.abs(Math.sin(theta * 12.7 - jelly.twist * 0.57 - t * 1.73)) < 0.022
          && t > 0.14 && t < 0.68;
        const flamePhase = u * 11.7 + t * 3.4
          + Math.sin(t * 7.4 + jelly.anatomyPhase) * 0.44
          + jelly.twist * 0.31;
        const flameStreak = t > 0.09 && t < 0.60
          && Math.abs(Math.sin(flamePhase)) < (0.075 + (1 - t) * 0.018);

        // Only tiny broken arc remnants remain. V4.3's full rings were one of
        // the things making the bell look engineered rather than gelatinous.
        const arcBand = Math.abs(t - (0.60 + Math.sin(u * 4.9 + jelly.anatomyPhase) * 0.010)) < 0.006;
        const arcFragment = arcBand && Math.sin(u * 24 + jelly.twist) > 0.52;

        const lobeDistance = lobeField(u, v);
        const lobe = lobeDistance < 1;
        const lobeEdge = lobeDistance > 0.66 && lobeDistance < 1.025;
        const pulseGlow = jelly.pulse * smoothstep(invLerp(-0.44, 0.02, v));

        const grainA = 0.5 + 0.5 * Math.sin(u * 29 + v * 19 + jelly.anatomyPhase)
          * Math.cos(u * 15 - v * 35 + jelly.twist);
        const grainB = 0.5 + 0.5 * Math.sin(u * 61 - v * 47 + jelly.twist * 0.7)
          * Math.cos(u * 41 + v * 31 - jelly.anatomyPhase * 1.3);

        // V4.4 deliberately has less membrane ink. Bright anatomy should appear
        // suspended inside a transparent envelope, not printed onto a wall.
        const tissueDensity = clamp(
          0.040
          + membraneDepth * 0.215
          + crownGlow * 0.19
          + centerGlass * 0.045
          + grainA * 0.070
          + pulseGlow * 0.050
          + (canalPrimary ? 0.095 : 0)
          + (lobe ? 0.045 : 0),
          0.020,
          0.83,
        );

        const structural = boundary || lowerEdge || canalPrimary || canalFine || flameStreak || arcFragment || lobeEdge;
        if (!structural && grainB > bellPoreThresholdAt(v, tissueDensity, crownGlow)) continue;

        let glyph;
        let color;
        const alpha = (0.23 + tissueDensity * 0.42) * lerp(1, 0.78, lowerGlass);

        if (boundary) {
          const probe = 0.012;
          const upper = bellProfileAt(v - probe, jelly.pulse, jelly.anatomyPhase);
          const lower = bellProfileAt(v + probe, jelly.pulse, jelly.anatomyPhase);
          const dWidth = (lower - upper) / (probe * 2);
          const side = u < 0 ? -1 : 1;
          glyph = directionGlyph(side * dWidth, 1);
          const lowerMix = smoothstep(invLerp(-0.48, 0.02, v));
          color = lowerMix > 0.44
            ? mixColor(jelly.palette.bellGlass, jelly.palette.rimHot, lowerMix, 0.82)
            : mixColor(jelly.palette.bellCrown, jelly.palette.bellSoft, t * 0.74, 0.80);
        } else if (lowerEdge) {
          const slopeProbe = 0.012;
          const dy = bellRimAt(clamp(u + slopeProbe, -1, 1), jelly.pulse, jelly.twist)
            - bellRimAt(clamp(u - slopeProbe, -1, 1), jelly.pulse, jelly.twist);
          glyph = directionGlyph(slopeProbe * 2, dy * height / Math.max(1, halfW));
          color = rgba(jelly.palette.rimHot, 0.92);
        } else if (lobeEdge) {
          glyph = densityGlyph(0.40 + (1 - lobeDistance) * 0.20, ASCII.tissue);
          color = mixColor(jelly.palette.bellCool, jelly.palette.armHot, 0.42, 0.56);
        } else if (arcFragment) {
          glyph = ".";
          color = mixColor(jelly.palette.bellCoral, jelly.palette.rimHot, 0.35, 0.38);
        } else if (flameStreak) {
          glyph = Math.abs(u) < 0.17 ? "|" : (u < 0 ? "/" : "\\");
          color = mixColor(jelly.palette.bellCoral, jelly.palette.bellHot, 0.60 + crownGlow * 0.32, 0.84 + crownGlow * 0.10);
        } else if (canalPrimary || canalFine) {
          const radialDx = Math.sin(theta);
          const radialDy = -Math.cos(theta);
          glyph = directionGlyph(radialDx, radialDy);
          const canalHeat = clamp(crownGlow * 0.60 + warmZone * 0.36 + (canalFine ? 0.06 : 0.18), 0, 1);
          color = canalFine
            ? mixColor(jelly.palette.bellSoft, jelly.palette.bellCoral, canalHeat, 0.48)
            : mixColor(jelly.palette.bellCoral, jelly.palette.bellHot, canalHeat, 0.75 + crownGlow * 0.16);
        } else {
          glyph = densityGlyph(tissueDensity, ASCII.tissue);
          if (crownGlow > 0.23) {
            color = mixColor(jelly.palette.bellWarm, jelly.palette.bellCrown, 0.42 + crownGlow * 0.52, alpha + 0.09);
          } else if (warmZone > 0.25 && coolZone < 0.58) {
            const coral = clamp(0.22 + t * 0.40 + grainA * 0.11, 0, 0.84);
            color = mixColor(jelly.palette.bellGlass, jelly.palette.bellCoral, coral, alpha);
          } else if (coolZone > 0.42) {
            color = mixColor(jelly.palette.bellCool, jelly.palette.rim, coolZone * 0.34 + grainA * 0.06, alpha);
          } else {
            color = mixColor(jelly.palette.bellShadow, jelly.palette.bellSoft, 0.40 + centerGlass * 0.30, alpha);
          }
        }

        ctx.fillStyle = color;
        ctx.fillText(glyph, px, py);
      }
    }

    // Irregular internal canals. Each one has its own start/end, wander and
    // occasional fork so the anatomy cannot be read as evenly spaced spokes.
    ctx.shadowColor = rgba(jelly.palette.bellHot, 0.36);
    ctx.shadowBlur = 1.8 * this.shadowScale;
    const rays = [
      { x: -0.82, start: -0.88, end: -0.23, bend: 0.020 },
      { x: -0.62, start: -0.91, end: -0.38, bend: -0.015, fork: -0.49 },
      { x: -0.44, start: -0.84, end: -0.18, bend: 0.026 },
      { x: -0.23, start: -0.94, end: -0.31, bend: -0.020 },
      { x: -0.07, start: -0.90, end: -0.13, bend: 0.012, fork: -0.43 },
      { x: 0.16, start: -0.86, end: -0.26, bend: -0.018 },
      { x: 0.36, start: -0.93, end: -0.35, bend: 0.024 },
      { x: 0.57, start: -0.85, end: -0.17, bend: -0.014, fork: -0.45 },
      { x: 0.79, start: -0.90, end: -0.30, bend: 0.018 },
    ];
    const drawCanal = (ray, rayIndex, branchOffset = 0, branchStart = null) => {
      const steps = 17;
      let previous = null;
      for (let step = 0; step <= steps; step += 1) {
        const q = step / steps;
        const v = lerp(branchStart ?? ray.start, ray.end, q);
        if ((step + rayIndex * 3 + (branchOffset ? 2 : 0)) % 8 === 0 && step > 2) {
          previous = null;
          continue;
        }
        const profile = bellProfileAt(v, jelly.pulse, jelly.anatomyPhase);
        const progress = invLerp(ray.start, ray.end, v);
        const spread = lerp(0.24, 0.94, clamp(progress, 0, 1));
        const wander = Math.sin(q * (5.4 + rayIndex * 0.17) + rayIndex * 1.33 + jelly.anatomyPhase)
          * (0.012 + Math.abs(ray.bend) * 0.36);
        const u = (ray.x + ray.bend * q * q + wander + branchOffset * smoothstep(q)) * profile * spread;
        const shift = bellCenterShift(v, jelly.anatomyPhase, halfW);
        const local = rotate(u * halfW + shift, v * height, jelly.tilt);
        const point = { x: jelly.x + local.x, y: jelly.y + local.y };
        if (previous) {
          const dx = point.x - previous.x;
          const dy = point.y - previous.y;
          const fade = 1 - smoothstep(invLerp(0.62, 1, q));
          ctx.fillStyle = mixColor(
            jelly.palette.bellCoral,
            jelly.palette.bellHot,
            0.30 + (1 - q) * 0.58,
            (branchOffset ? 0.30 : 0.44) * (0.62 + fade * 0.38),
          );
          ctx.fillText(directionGlyph(dx, dy), point.x, point.y);
        }
        previous = point;
      }
    };
    for (let rayIndex = 0; rayIndex < rays.length; rayIndex += 1) {
      const ray = rays[rayIndex];
      drawCanal(ray, rayIndex);
      if (ray.fork != null) {
        const side = rayIndex % 2 === 0 ? 1 : -1;
        drawCanal(ray, rayIndex, side * 0.075, ray.fork);
      }
    }

    // Thin two-layer skirt. The underbelly curve comes from bellRimAt itself;
    // local scallops merely fray the fluorescent membrane rather than drawing
    // a ruler-straight baseline across the creature.
    const steps = Math.max(36, Math.floor((halfW * 1.80) / (cellW * 0.72)));
    for (let row = 0; row < 2; row += 1) {
      const rowAlpha = row === 0 ? 0.90 : 0.36;
      const rowOffset = row * cellH * 0.38;
      ctx.fillStyle = rgba(row === 0 ? jelly.palette.rimHot : jelly.palette.rim, rowAlpha);
      ctx.shadowColor = rgba(jelly.palette.rim, 0.36);
      ctx.shadowBlur = (row === 0 ? 2.2 : 1.0) * this.shadowScale;
      for (let i = 0; i <= steps; i += 1) {
        const q = i / steps;
        const u = lerp(-0.89, 0.89, q);
        const rim = bellRimAt(u, jelly.pulse, jelly.twist);
        const nextU = clamp(u + 0.012, -0.89, 0.89);
        const dy = bellRimAt(nextU, jelly.pulse, jelly.twist) - rim;
        const shift = bellCenterShift(rim, jelly.anatomyPhase, halfW);
        const local = rotate(u * halfW + shift, rim * height + rowOffset, jelly.tilt);
        const glyph = row === 0
          ? directionGlyph(nextU - u, dy * height / Math.max(1, halfW))
          : (i % 6 === 0 ? "." : "~");
        ctx.fillText(glyph, jelly.x + local.x, jelly.y + local.y);

        const broadLow = Math.sin((u + 1) * Math.PI * 5.55 + jelly.twist * 0.80) < -0.84;
        if (row === 0 && broadLow && i % 4 === 0) {
          ctx.fillStyle = rgba(jelly.palette.rim, 0.38);
          ctx.fillText(i % 2 ? ":" : "'", jelly.x + local.x, jelly.y + local.y + cellH * 0.72);
          ctx.fillStyle = rgba(jelly.palette.rimHot, rowAlpha);
        }
      }
    }

    // Ghostly subumbrella only. The lower bell should reveal the existing oral
    // arms rather than hide them behind a second dense plug of text.
    ctx.shadowColor = rgba(jelly.palette.armHot, 0.14);
    ctx.shadowBlur = 0.9 * this.shadowScale;
    for (let row = 0; row < 10; row += 1) {
      const y = jelly.y + height * 0.050 + row * cellH * 0.70;
      const taper = lerp(0.27, 0.13, row / 9);
      const half = halfW * taper * (0.86 + 0.14 * Math.sin(row * 1.23 + jelly.twist));
      for (let x = -half; x <= half; x += cellW * 1.20) {
        const hole = Math.sin(x * 0.19 + row * 2.8 + jelly.anatomyPhase) > 0.48;
        if (hole && row > 0) continue;
        const local = rotate(x, y - jelly.y, jelly.tilt);
        const center = 1 - Math.abs(x) / Math.max(1, half);
        const glyph = densityGlyph(0.12 + center * 0.30 + (row % 3) * 0.035, ASCII.ribbon);
        ctx.fillStyle = mixColor(jelly.palette.armDark, jelly.palette.armHot, center * 0.48, 0.24 + center * 0.18);
        ctx.fillText(glyph, jelly.x + local.x, jelly.y + local.y);
      }
    }

    // No full contraction ring in V4.4. Pulse is communicated by geometry,
    // fluorescence and motion; a horizontal ring was visually too architectural.
    this.#setFont(this.fontSize);
  }

  render({ time, jelly, snow }) {
    const ctx = this.ctx;
    if (!jelly) return;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    this.#setFont(this.fontSize);
    this.#background(jelly, time);
    this.#drawSnow(snow);

    const back = jelly.chains.filter((item) => item.layer < -0.25).sort((a, b) => a.layer - b.layer);
    const middle = jelly.chains.filter((item) => item.layer >= -0.25 && item.layer < 0.45).sort((a, b) => a.layer - b.layer);
    const front = jelly.chains.filter((item) => item.layer >= 0.45).sort((a, b) => a.layer - b.layer);

    // Rear anatomy disappears under the bell exactly as it would in a photo.
    for (const item of back) {
      if (item.arm) this.#drawRibbon(jelly, item, 0.76, time);
      else this.#drawTentacle(jelly, item, 0.70);
    }

    this.#drawBell(jelly, time);

    // Mid and foreground layers are progressively brighter. Foreground ribbons
    // lay a small dark mask before their ASCII, producing real occlusion of
    // strands behind them without painting any visible non-ASCII surface.
    for (const item of middle) {
      if (item.arm) this.#drawRibbon(jelly, item, 0.90, time);
      else this.#drawTentacle(jelly, item, 0.86);
    }
    for (const item of front) {
      if (item.arm) this.#drawRibbon(jelly, item, 1, time);
      else this.#drawTentacle(jelly, item, 0.98);
    }

    ctx.restore();
  }

}
