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

    // A restrained halo gives translucent ASCII enough separation from true
    // black without turning the page into an aquarium backdrop.
    const glow = ctx.createRadialGradient(
      jelly.x,
      jelly.y + jelly.bellHeight() * 0.65,
      0,
      jelly.x,
      jelly.y + jelly.bellHeight() * 1.45,
      Math.max(jelly.baseSize * 2.3, 280),
    );
    glow.addColorStop(0, "rgba(94,72,190,0.105)");
    glow.addColorStop(0.36, "rgba(48,45,130,0.060)");
    glow.addColorStop(0.72, "rgba(16,28,54,0.025)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.width, this.height);

    // Barely visible slow luminance breathing around the bell.
    ctx.save();
    ctx.globalAlpha = 0.018 + (Math.sin(time * 0.19) * 0.5 + 0.5) * 0.010;
    ctx.fillStyle = "#ff7dca";
    ctx.beginPath();
    ctx.ellipse(jelly.x, jelly.y - jelly.bellHeight() * 0.35, jelly.bellWidth() * 0.62, jelly.bellHeight() * 0.78, jelly.tilt, 0, TAU);
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
    const cellW = this.cellW;
    const cellH = this.cellH;
    const xMin = jelly.x - halfW - cellW * 2;
    const xMax = jelly.x + halfW + cellW * 2;
    const yMin = jelly.y - height - cellH;
    const yMax = jelly.y + height * 0.105 + cellH;
    const startX = Math.floor(xMin / cellW) * cellW + cellW * 0.5;
    const startY = Math.floor(yMin / cellH) * cellH + cellH * 0.5;

    ctx.shadowColor = rgba(jelly.palette.rim, 0.28);
    ctx.shadowBlur = 1.2 * this.shadowScale;

    for (let py = startY; py <= yMax; py += cellH) {
      for (let px = startX; px <= xMax; px += cellW) {
        const local = rotate(px - jelly.x, py - jelly.y, -jelly.tilt);
        const u = local.x / halfW;
        const v = local.y / height;
        const ellipse = u * u + ((v + 0.018) / 1.018) ** 2;
        const insideDome = v <= 0.018 && v >= -1.03 && ellipse <= 1;
        const scallop = 0.028 + Math.sin((u + 1) * Math.PI * 8 + jelly.twist) * 0.018
          + Math.sin((u + 1) * Math.PI * 15 + jelly.anatomyPhase) * 0.006;
        const insideSkirt = Math.abs(u) <= 0.95 && v > -0.025 && v <= scallop;
        if (!insideDome && !insideSkirt) continue;

        const radial = Math.sqrt(Math.max(0, ellipse));
        const edgeDistance = insideDome ? 1 - radial : clamp((scallop - v) / 0.07, 0, 1);
        const boundary = insideDome && edgeDistance < 0.034;
        const lowerEdge = insideSkirt && v > scallop - 0.010;
        const angle = Math.atan2(u * 0.98, -(v + 0.02));
        const warmZone = smoothstep(invLerp(-0.16, -0.94, v));
        const underside = smoothstep(invLerp(-0.34, 0.02, v));
        const centerGlow = Math.max(0, 1 - Math.abs(u) * 0.90) * Math.max(0, 1 - Math.abs(v + 0.42) * 0.96);
        const grain = 0.5 + 0.5 * Math.sin(u * 29 + v * 21 + jelly.anatomyPhase)
          * Math.cos(u * 13 - v * 37 + jelly.twist);
        const veinA = Math.abs(Math.sin(angle * 9.0 + jelly.anatomyPhase + v * 1.9)) < (0.115 + warmZone * 0.035);
        const veinB = Math.abs(Math.sin(angle * 18.0 + jelly.twist - v * 2.4)) < 0.045 && v < -0.18;
        const ringCanal = Math.abs(radial - 0.69) < 0.014 || Math.abs(radial - 0.46) < 0.010;
        const lobeDistance = lobeField(u, v);
        const lobe = lobeDistance < 1;
        const lobeEdge = lobeDistance > 0.62 && lobeDistance < 1.04;
        const pulseGlow = jelly.pulse * smoothstep(invLerp(-0.50, 0.02, v));
        const density = clamp(
          0.13 + edgeDistance * 0.46 + centerGlow * 0.15 + grain * 0.13 + pulseGlow * 0.12
            + (veinA ? 0.10 : 0) + (ringCanal ? 0.10 : 0) + (lobe ? 0.08 : 0),
          0.045,
          0.96,
        );

        let glyph;
        let color;
        let alpha = 0.52 + density * 0.34;

        if (boundary) {
          const nx = u;
          const ny = (v + 0.018) / 1.018;
          glyph = directionGlyph(-ny, nx);
          color = mixColor(jelly.palette.bellSoft, jelly.palette.rimHot, underside * 0.62, 0.94);
        } else if (lowerEdge) {
          glyph = Math.abs(Math.sin(u * Math.PI * 8 + jelly.twist)) > 0.62 ? "_" : "~";
          color = rgba(jelly.palette.rimHot, 0.96);
        } else if (lobeEdge) {
          glyph = densityGlyph(0.52 + (1 - lobeDistance) * 0.22, ASCII.tissue);
          color = mixColor(jelly.palette.bellCool, jelly.palette.armHot, 0.44, 0.82);
        } else if (ringCanal) {
          glyph = Math.abs(u) > 0.72 ? "." : "-";
          color = mixColor(jelly.palette.rim, jelly.palette.rimHot, 0.35 + pulseGlow * 0.5, 0.78);
        } else if (veinA || veinB) {
          glyph = directionGlyph(Math.sin(angle), -Math.cos(angle));
          const hot = veinB ? 0.48 : 0.72;
          color = mixColor(jelly.palette.bellWarm, jelly.palette.bellHot, hot, 0.76 + warmZone * 0.14);
        } else {
          glyph = densityGlyph(density, ASCII.tissue);
          if (underside > 0.58) {
            color = mixColor(jelly.palette.bellCool, jelly.palette.rim, underside * 0.48 + grain * 0.10, alpha);
          } else if (warmZone > 0.24) {
            const warmth = clamp(0.50 + warmZone * 0.43 + grain * 0.10, 0, 0.98);
            color = mixColor(jelly.palette.bellSoft, jelly.palette.bellWarm, warmth, alpha);
          } else {
            color = mixColor(jelly.palette.bellShadow, jelly.palette.bellSoft, 0.50 + centerGlow * 0.36, alpha);
          }
        }

        ctx.fillStyle = color;
        ctx.fillText(glyph, px, py);
      }
    }

    // Layered scalloped skirt: three close text bands make the rim feel thick,
    // folded and luminous rather than a single vector-like curve.
    const steps = Math.max(34, Math.floor((halfW * 1.88) / (cellW * 0.72)));
    for (let row = 0; row < 3; row += 1) {
      const rowAlpha = [0.92, 0.62, 0.34][row];
      const rowOffset = row * cellH * 0.52;
      ctx.fillStyle = rgba(row === 0 ? jelly.palette.rimHot : jelly.palette.rim, rowAlpha);
      ctx.shadowBlur = (row === 0 ? 2.4 : 1.2) * this.shadowScale;
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const x = lerp(-halfW * 0.93, halfW * 0.93, t);
        const wave = Math.sin(t * Math.PI * 8 + jelly.twist) * height * 0.022
          + Math.sin(t * Math.PI * 17 + jelly.anatomyPhase) * height * 0.006;
        const local = rotate(x, height * 0.026 + wave + rowOffset, jelly.tilt);
        const glyph = i % 7 === 0 ? "_" : i % 3 === 0 ? "~" : ".";
        ctx.fillText(glyph, jelly.x + local.x, jelly.y + local.y);
      }
    }

    // Inner subumbrella/mouth structure just below the rim. This bridges the
    // detailed bell into the oral-arm mass so the animal does not look like a
    // dome with strings glued on.
    ctx.shadowBlur = 1.4 * this.shadowScale;
    for (let row = 0; row < 13; row += 1) {
      const y = jelly.y + height * 0.045 + row * cellH * 0.72;
      const taper = lerp(0.34, 0.18, row / 12);
      const half = halfW * taper * (0.88 + 0.12 * Math.sin(row * 1.3 + jelly.twist));
      for (let x = -half; x <= half; x += cellW * 1.05) {
        const hole = Math.sin(x * 0.17 + row * 2.7 + jelly.anatomyPhase) > 0.82;
        if (hole && row > 2) continue;
        const local = rotate(x, y - jelly.y, jelly.tilt);
        const center = 1 - Math.abs(x) / Math.max(1, half);
        const glyph = densityGlyph(0.22 + center * 0.48 + (row % 3) * 0.06, ASCII.ribbon);
        ctx.fillStyle = mixColor(jelly.palette.armDark, jelly.palette.armHot, center * 0.58, 0.54 + center * 0.24);
        ctx.fillText(glyph, jelly.x + local.x, jelly.y + local.y);
      }
    }

    // A narrow contraction ring flashes through the translucent bell during
    // the squeeze and then fades back into the tissue.
    const ringY = jelly.y - height * (0.18 + jelly.pulse * 0.08);
    const ringHalf = halfW * (0.60 - jelly.pulse * 0.09);
    ctx.shadowBlur = 2.2 * this.shadowScale;
    ctx.fillStyle = rgba(jelly.palette.white, 0.12 + jelly.pulse * 0.42);
    const ringSteps = Math.max(16, Math.floor((ringHalf * 2) / (cellW * 0.85)));
    for (let i = 0; i <= ringSteps; i += 1) {
      const t = i / ringSteps;
      const x = lerp(-ringHalf, ringHalf, t);
      const arc = 1 - (x / ringHalf) ** 2;
      const local = rotate(x, -Math.sqrt(Math.max(0, arc)) * height * 0.07, jelly.tilt);
      ctx.fillText(t < 0.06 || t > 0.94 ? "." : "-", jelly.x + local.x, ringY + local.y);
    }
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
