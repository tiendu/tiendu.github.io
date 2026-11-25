import { ASCII } from "./config.mjs";
import { ribbonSurfaceBreathAt } from "./fluid.mjs";
import { rootEmergenceScale, tentacleAccentStrength, tentaclePresenceScale } from "./geometry.mjs";
import { densityGlyph, directionGlyph, mixColor, rgba } from "./glyphs.mjs";
import { drawGlyph } from "./glyph-atlas.mjs";
import { ribbonMaterialAt, tissuePresence } from "./material.mjs";
import { clamp, invLerp, lerp, smoothstep, TAU } from "./math.mjs";

// Read motion from the actual Verlet chain instead of animating ribbon faces in
// isolation. Bend rolls the sheet around its centerline; retained velocity lets
// folds open a little as the broad tissue catches up with the water.
export function ribbonKinematicsAt(chain, index) {
  if (!chain || chain.count < 3) return { bend: 0, speed: 0 };
  const i = Math.max(1, Math.min(chain.count - 2, index));
  const ax = chain.x[i] - chain.x[i - 1];
  const ay = chain.y[i] - chain.y[i - 1];
  const bx = chain.x[i + 1] - chain.x[i];
  const by = chain.y[i + 1] - chain.y[i];
  const cross = ax * by - ay * bx;
  const dot = ax * bx + ay * by;
  const bend = Math.atan2(cross, dot);

  const vx = chain.x[i] - chain.px[i];
  const vy = chain.y[i] - chain.py[i];
  const speed = clamp(
    Math.hypot(vx, vy) / Math.max(1, chain.segmentLength * 0.36),
    0,
    1,
  );
  return { bend, speed };
}

function opacityForLayer(item, opacity) {
  const depth = item.layer ?? 0;
  const depthFactor = depth < -0.75 ? 0.44 : depth < -0.2 ? 0.64 : depth > 0.7 ? 1.05 : 0.84;
  return opacity * depthFactor;
}

function tissueGlyph(frame, occlusion, glyph, x, y) {
  if (!occlusion.glyph(x, y, frame.cellH * 0.38)) {
    drawGlyph(frame, glyph, x, y);
  }
}

export function drawTentacle(frame, occlusion, jelly, item, opacity = 1) {
  const { chain } = item;
  const ctx = frame.ctx;
  const layerOpacity = opacityForLayer(item, opacity);
  const presence = tentaclePresenceScale(item);
  const faintLift = lerp(1.16, 1, smoothstep(invLerp(0.40, 1, item.bright * layerOpacity)));
  const baseAlpha = 0.72 * item.bright * layerOpacity * presence
    * (frame.compact ? 1.12 : 1.03) * faintLift;
  ctx.shadowColor = rgba(jelly.palette.tentacleHot, 0.24 * layerOpacity);
  ctx.shadowBlur = (item.layer > 0.6 ? 1.5 : 0.8) * frame.shadowScale;

  for (let i = 0; i < chain.count - 1; i += 1) {
    const x0 = chain.x[i];
    const y0 = chain.y[i];
    const x1 = chain.x[i + 1];
    const y1 = chain.y[i + 1];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const distance = Math.hypot(dx, dy) || 1;
    const along = i / Math.max(1, chain.count - 2);
    const samples = Math.max(1, Math.ceil(distance / (frame.cellH * 0.48)));
    const fadeStart = item.tentacleTier === "extra" ? 0.70 : item.tentacleTier === "long" ? 0.79 : 0.84;
    const tipFade = 1 - smoothstep(invLerp(fadeStart, 1, along));
    const rootFade = rootEmergenceScale(item, along);
    const alpha = baseAlpha * lerp(1, 0.34, along) * tipFade * rootFade * tissuePresence(item, along);
    if (alpha < 0.010) continue;
    const nx = -dy / distance;
    const ny = dx / distance;

    const glyph = directionGlyph(dx, dy);
    const rootGlow = 1 - smoothstep(invLerp(0.0, 0.34, along));
    const tipGlow = smoothstep(invLerp(0.70, 0.95, along)) * 0.14;
    const emission = jelly.light?.rootAt(item, along) ?? 0;
    const color = mixColor(jelly.palette.tentacle, jelly.palette.tentacleHot,
      rootGlow * 0.42 + tipGlow + emission * 0.30, alpha * (1 + emission * 0.28));
    for (let s = 0; s < samples; s += 1) {
      const t = s / samples;
      const x = lerp(x0, x1, t);
      const y = lerp(y0, y1, t);
      ctx.fillStyle = color;
      tissueGlyph(frame, occlusion, glyph, x, y);

      // Punctuation makes the strand taper and break into the darkness. Near
      // the tips it also exaggerates hooks/loops without turning them thick.
      if ((i * 3 + s) % 8 === 0) {
        const side = Math.sin(item.phase + i * 1.31) >= 0 ? 1 : -1;
        const reach = frame.cellW * (along > 0.72 ? 0.92 : 0.58);
        const accent = tentacleAccentStrength(item, along, i);
        ctx.fillStyle = mixColor(
          jelly.palette.tentacleHot,
          jelly.palette.tentacleAccent,
          accent,
          alpha * (along > 0.72 ? 0.34 : 0.22),
        );
        tissueGlyph(frame, occlusion, along > 0.68 ? (i % 2 ? "," : ".") : ":", x + nx * reach * side, y + ny * frame.cellH * 0.12 * side);
      }
    }
  }
}

function ribbonSample(frame, item, along, time, widthScale = 1, motion = { bend: 0, speed: 0 }) {
  const lengthBias = clamp(item.lengthBias ?? 0, 0, 1);
  const motionEnvelope = smoothstep(invLerp(0.08, 0.92, along));
  const terminal = smoothstep(invLerp(0.68, 1, along));
  const foldEnvelope = 0.70 + 0.48 * Math.sin(Math.PI * clamp(along * 1.12, 0, 1));

  // Short ribbons keep the old silhouette. Long ribbons hold their broad
  // body through the middle, then dissolve into a much thinner terminal
  // section so a large turn does not become a bright doubled strap.
  const bodyTaper = lerp(
    1,
    lerp(0.74, 0.60, lengthBias),
    smoothstep(invLerp(0.32, 0.78, along)),
  );
  const tipTaper = lerp(
    1,
    lerp(0.38, 0.20, lengthBias),
    smoothstep(invLerp(0.76, 1, along)),
  );
  const taper = bodyTaper * tipTaper;
  const material = ribbonMaterialAt(item, along);
  const baseWidth = frame.cellW * (item.width ?? 2.4) * foldEnvelope * taper * widthScale
    * material.width;

  const surfaceBreath = ribbonSurfaceBreathAt(item, time, along);
  const motionRoll =
    motion.bend
      * (0.72 + along * 0.78)
      * (1 - lengthBias * terminal * 0.24)
    + Math.sin(time * 0.16 + (item.phase ?? 0) + along * 5.1)
      * motion.speed
      * 0.62
      * motionEnvelope
      * (1 - lengthBias * terminal * 0.32)
    + surfaceBreath;

  // Long sheets twist normally near the root/middle, then stop accumulating
  // extra rotations toward the tip. The progress correction stays monotonic.
  const twistRate = (item.twistRate ?? 3.4) * lerp(0.82, 0.70, lengthBias);
  const twistProgress =
    along - lengthBias * 0.08 * smoothstep(invLerp(0.62, 1, along));
  const twistAngle = (item.twistPhase ?? item.phase ?? 0)
    + twistProgress * twistRate * TAU
    + Math.sin(time * 0.10 + (item.phase ?? 0)) * 0.24
    + motionRoll;
  const face = Math.cos(twistAngle);
  const projected = baseWidth * (0.22 + Math.abs(face) * 0.78)
    * (1 + motion.speed * lerp(0.12, 0.09, lengthBias) * motionEnvelope);
  const torsionOffset = Math.sin(twistAngle) * baseWidth * 0.24;
  const ruffleEnvelope = (0.24 + smoothstep(along) * 0.76)
    * (1 + motion.speed * lerp(0.32, 0.23, lengthBias) * motionEnvelope)
    * (1 - lengthBias * terminal * 0.30) * material.fray;
  const leftRuffle = Math.sin((item.edgePhaseLeft ?? item.phase ?? 0) + along * 29.0 + time * 0.29)
    * frame.cellW * (item.ruffleLeft ?? 1) * ruffleEnvelope;
  const rightRuffle = Math.sin((item.edgePhaseRight ?? (item.phase ?? 0) + 1.7) + along * 33.0 - time * 0.26)
    * frame.cellW * (item.ruffleRight ?? 1) * ruffleEnvelope;
  return {
    projected,
    torsionOffset,
    leftRuffle: clamp(leftRuffle, -projected * 0.65, projected * 0.85),
    rightRuffle: clamp(rightRuffle, -projected * 0.65, projected * 0.85),
    face,
    fray: material.fray,
  };
}

// Share projected geometry between depth masking and visible tissue.
function ribbonOffsets(g) {
  return [g.torsionOffset + g.projected + g.leftRuffle,
    g.torsionOffset - g.projected - g.rightRuffle];
}

export function ribbonInteriorAt(span, cellW, face, along, q, phase, edgePhase) {
  const facing = smoothstep(invLerp(0.04, 0.32, Math.abs(face)));
  const width = smoothstep(invLerp(cellW * 0.35, cellW * 1.6, span));
  // Porosity is a material field, not a binary segment-sized tear.
  const tear = Math.sin(along * 46 + q * 9.7 + phase)
    + Math.cos(along * 29 + q * 8.1 + edgePhase);
  const pore = smoothstep(invLerp(1.15, 1.95, tear))
    * smoothstep(invLerp(0.14, 0.24, along));
  return { opacity: width * lerp(0.12, 1, facing) * (1 - pore * 0.60),
    density: 1 - pore * 0.65 };
}

export function ribbonMaskAt(g, cellW, coverage) {
  const [left, right] = ribbonOffsets(g);
  const span = Math.max(0, left - right);
  const face = smoothstep(invLerp(0.13, 0.65, Math.abs(g.face)));
  const width = smoothstep(invLerp(cellW, cellW * 2.6, span));
  return { center: (left + right) * 0.5,
    halfWidth: span * 0.32 * face * width * clamp(coverage, 0, 1) };
}

function ribbonAlphaAt(frame, jelly, item, opacity, along, branch) {
  const base = (branch ? 0.71 : 0.85) * (item.bright ?? 0.9)
    * opacityForLayer(item, opacity) * (frame.compact ? 1.10 : 1.02);
  const tipFade = 1 - smoothstep(invLerp(branch ? 0.75 : 0.84, 1, along));
  const rootFade = branch ? 1 : rootEmergenceScale(item, along);
  const pulseLift = branch ? 1 : 1 + jelly.pulse * (1 - along) * 0.055;
  const emission = branch ? 0 : (jelly.light?.rootAt(item, along) ?? 0);
  return base * lerp(1, branch ? 0.32 : 0.45, along) * tipFade
    * rootFade * pulseLift * tissuePresence(item, along) * (1 + emission * 0.24);
}

function maskRibbon(frame, occlusion, jelly, item, opacity, time, widthScale, branch) {
  if ((item.layer ?? 0) < 0.25) return null;
  const { chain } = item;
  const ctx = frame.ctx;
  const rows = [];
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = clamp(opacity, 0, 1);
  ctx.fillStyle = `rgba(0, 2, 4, ${clamp(0.12 + (item.layer ?? 0) * 0.12, 0.12, 0.24)})`;
  // A single fill avoids stacking dark round-capped strokes at each joint.
  // Reuse the sampled shapes in the glyph pass, rather than recalculate them.
  ctx.beginPath();
  for (let i = 0; i < chain.count - 1; i += 1) {
    const x0 = chain.x[i], y0 = chain.y[i];
    const x1 = chain.x[i + 1], y1 = chain.y[i + 1];
    const dx = x1 - x0, dy = y1 - y0;
    const distance = Math.hypot(dx, dy) || 1;
    const nx = -dy / distance, ny = dx / distance;
    const samples = Math.max(1, Math.ceil(distance / (frame.cellH * 0.40)));
    const alpha = ribbonAlphaAt(frame, jelly, item, opacity, i / Math.max(1, chain.count - 2), branch);
    if (alpha < 0.012) continue;
    const coverage = smoothstep(invLerp(0.012, 0.30, alpha));
    const motion = ribbonKinematicsAt(chain, i);
    const geometry = [];
    rows[i] = { alpha, geometry };
    let previous;
    for (let s = 0; s <= samples; s += 1) {
      const t = s / samples;
      const g = ribbonSample(frame, item, (i + t) / Math.max(1, chain.count - 1), time, widthScale, motion);
      if (s < samples) geometry.push(g);
      const mask = ribbonMaskAt(g, frame.cellW, coverage);
      const x = lerp(x0, x1, t) + nx * mask.center;
      const y = lerp(y0, y1, t) + ny * mask.center;
      const w = mask.halfWidth;
      if (previous && (previous.w > 0 || w > 0)
        && !occlusion.stroke(previous.x, previous.y, x, y, Math.max(previous.w, w))) {
        ctx.moveTo(previous.x + nx * previous.w, previous.y + ny * previous.w);
        ctx.lineTo(x + nx * w, y + ny * w);
        ctx.lineTo(x - nx * w, y - ny * w);
        ctx.lineTo(previous.x - nx * previous.w, previous.y - ny * previous.w);
        ctx.closePath();
      }
      previous = { x, y, w };
    }
  }
  ctx.fill();
  ctx.restore();
  return rows;
}

function drawRibbonStructure(frame, occlusion, jelly, item, opacity, time, widthScale = 1, branch = false) {
  const rows = maskRibbon(frame, occlusion, jelly, item, opacity, time, widthScale, branch);
  const { chain } = item;
  const ctx = frame.ctx;
  const layerOpacity = opacityForLayer(item, opacity);
  ctx.shadowColor = rgba(jelly.palette.armHot, 0.24 * layerOpacity);
  ctx.shadowBlur = ((item.layer ?? 0) > 0.5 ? 1.8 : 1.0) * frame.shadowScale;

  for (let i = 0; i < chain.count - 1; i += 1) {
    const x0 = chain.x[i];
    const y0 = chain.y[i];
    const x1 = chain.x[i + 1];
    const y1 = chain.y[i + 1];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const distance = Math.hypot(dx, dy) || 1;
    const segmentAlong = i / Math.max(1, chain.count - 2);
    const samples = Math.max(1, Math.ceil(distance / (frame.cellH * 0.40)));
    const nx = -dy / distance;
    const ny = dx / distance;
    const row = rows?.[i];
    const alpha = row?.alpha ?? ribbonAlphaAt(frame, jelly, item, opacity, segmentAlong, branch);
    if (alpha < 0.012) continue;
    const motion = row ? null : ribbonKinematicsAt(chain, i);

    for (let s = 0; s < samples; s += 1) {
      const t = s / samples;
      const along = clamp((i + t) / Math.max(1, chain.count - 1), 0, 1);
      const centerX = lerp(x0, x1, t);
      const centerY = lerp(y0, y1, t);
      const g = row?.geometry[s] ?? ribbonSample(frame, item, along, time, widthScale, motion);
      const [leftOffset, rightOffset] = ribbonOffsets(g);
      const leftX = centerX + nx * leftOffset;
      const leftY = centerY + ny * leftOffset;
      const rightX = centerX + nx * rightOffset;
      const rightY = centerY + ny * rightOffset;
      const face = Math.abs(g.face);

      // Two independent edges are always rendered. One becomes brighter as
      // the ribbon twists toward us, while the opposite edge falls away.
      const leftFront = smoothstep(invLerp(-0.24, 0.24, g.face));
      const edgeGlyph = directionGlyph(dx, dy, ASCII.arm);
      ctx.fillStyle = mixColor(
        jelly.palette.arm,
        jelly.palette.armHot,
        lerp(0.38, 0.78, leftFront),
        alpha * lerp(0.40, 0.90, leftFront),
      );
      tissueGlyph(frame, occlusion, edgeGlyph, leftX, leftY);
      ctx.fillStyle = mixColor(
        jelly.palette.armDark,
        jelly.palette.armHot,
        lerp(0.72, 0.34, leftFront),
        alpha * lerp(0.90, 0.36, leftFront),
      );
      tissueGlyph(frame, occlusion, edgeGlyph, rightX, rightY);

      // Preserve the broad-face band budget, adding at most one central
      // mark for narrow folds. Its opacity fades rather than switching off.
      const span = Math.hypot(leftX - rightX, leftY - rightY);
      const bands = Math.min(7, Math.max(2, Math.floor(span / (frame.cellW * 0.90))));
      for (let band = 1; band < bands; band += 1) {
        const q = band / bands;
        const interior = ribbonInteriorAt(span, frame.cellW, face, along, q,
          item.phase ?? 0, item.edgePhaseLeft ?? 0);
        if (interior.opacity === 0) continue;
        const x = lerp(rightX, leftX, q);
        const y = lerp(rightY, leftY, q);
        const middle = 1 - Math.abs(q - 0.5) * 2;
        const foldHighlight = Math.max(
          0,
          Math.sin((item.phase ?? 0) + along * 14.4 + q * 3.1),
        );
        const foldAccent =
          smoothstep(invLerp(0.58, 0.96, foldHighlight))
          * smoothstep(invLerp(0.22, 0.86, face));
        const density = clamp(
          0.10 + middle * 0.38 + foldHighlight * 0.24 + face * 0.16,
          0.04,
          0.90,
        );
        const proximal = 1 - smoothstep(invLerp(0.04, 0.33, along));
        const foldColor = proximal * foldHighlight > 0.40
          ? jelly.palette.bellGlass
          : foldAccent > 0.24 ? jelly.palette.armAccent : jelly.palette.armHot;
        ctx.fillStyle = mixColor(
          jelly.palette.armDark,
          foldColor,
          0.16 + foldHighlight * 0.44 + face * 0.12,
          alpha * (0.44 + middle * 0.34 + face * 0.08) * interior.opacity,
        );
        tissueGlyph(frame, occlusion, densityGlyph(density * interior.density, ASCII.ribbon), x, y);
      }

      // Ruffled lace protrudes independently from each edge, rather than as
      // mirrored hairs. This is what makes the oral arms look torn/leafy.
      if ((i + s) % (branch ? 5 : 4) === 0 && along > 0.10 && along < 0.88) {
        const fray = g.fray;
        const leftFray = Math.min(g.projected, frame.cellW * (0.7 + (item.ruffleLeft ?? 1) * 0.75)) * fray;
        const rightFray = Math.min(g.projected, frame.cellW * (0.7 + (item.ruffleRight ?? 1) * 0.75)) * fray;
        ctx.fillStyle = rgba(jelly.palette.rim, alpha * 0.30);
        tissueGlyph(frame, occlusion, i % 2 ? "/" : "~", leftX + nx * leftFray, leftY + ny * leftFray * 0.25);
        if ((i + s) % 7 === 0) {
          ctx.fillStyle = rgba(jelly.palette.armHot, alpha * 0.26);
          tissueGlyph(frame, occlusion, i % 3 ? "\\" : ".", rightX - nx * rightFray, rightY - ny * rightFray * 0.20);
        }
      }
    }
  }
}

export function drawRibbon(frame, occlusion, jelly, item, opacity = 1, time = 0, widthScale = 1) {
  drawRibbonStructure(frame, occlusion, jelly, item, opacity, time, widthScale, false);
  for (const branch of item.branches ?? []) {
    drawRibbonStructure(frame, occlusion, jelly, branch, opacity * 0.86, time, widthScale * 0.8, true);
  }
}
