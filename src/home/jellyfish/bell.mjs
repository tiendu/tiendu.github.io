import { ASCII } from "./config.mjs";
import { bellCenterShift, bellGridScaleFor, bellPoreThresholdAt, bellProfileAt,
  internalRootOpacityAt, skirtRimAt } from "./geometry.mjs";
import { directionGlyph, mixColor, mixMembraneColor, rgba, setFont } from "./glyphs.mjs";
import { clamp, invLerp, lerp, rotate, smoothstep } from "./math.mjs";

// Pigment belongs to the membrane, not to separate outlined organs or blobs.
// The lower margin has an irregular, vertically varying wash of coral tissue.
export function marginalPigmentAt(u, gap, pulse = 0, phase = 0) {
  if (gap < 0 || gap > 0.25 || Math.abs(u) >= 0.86) return 0;
  const side = 1 - smoothstep(invLerp(0.65, 0.86, Math.abs(u)));
  const warp = Math.sin(u * 8.2 + phase) * 0.028
    + Math.sin(u * 17.7 - phase * 0.8) * 0.018;
  const depth = gap - warp * (0.8 + pulse * 0.2);
  const fadeIn = smoothstep(invLerp(-0.008, 0.035, gap));
  const fadeOut = 1 - smoothstep(invLerp(0.075, 0.205, depth));
  const mottling = 0.5 + 0.5 * Math.sin(u * 18.7 + gap * 38 + phase
    + Math.sin(u * 7.1 - gap * 22) * 0.9);
  const broken = 0.5 + 0.5 * Math.cos(u * 33.1 - gap * 51 + phase * 1.6);
  return side * fadeIn * fadeOut * (0.26 + mottling * 0.49 + broken * 0.22);
}

// Aperiodic tissue grain in anatomical coordinates. Avoid long aligned bands
// without introducing screen-space or per-frame random noise.
export function membraneGrainAt(u, v, phase = 0) {
  const a = Math.sin(u * 83.1 + v * 117.7 + phase
    + Math.sin(u * 39.7 - v * 29.3) * 1.6);
  const b = Math.cos(u * 131.9 - v * 73.3 - phase * 0.7
    + Math.sin(v * 61.1 + u * 17.3) * 1.2);
  return 0.5 + 0.5 * a * b;
}

// A deterministic jittered lattice in the relaxed bell's material space.
// Positions and glyph seeds are stable across translation, tilt and pulse.
function grainSeed(col, row, salt) {
  let h = Math.imul(col, 374761393) ^ Math.imul(row, 668265263) ^ salt;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function membraneSampleAt(col, row, phase = 0) {
  const salt = Math.round(phase * 4096);
  return {
    x: col + 0.5 + (grainSeed(col, row, salt) - 0.5) * 0.78,
    y: row + 0.5 + (grainSeed(col, row, salt ^ 0x54e31c97) - 0.5) * 0.78,
    grain: grainSeed(col, row, salt ^ 0x6ac690c5),
    glyph: grainSeed(col, row, salt ^ 0x28d91f37),
  };
}

// Small marks and mixed silhouettes read as suspended granules and short
// fibres instead of rows of equally wide blocks. No bars or solid glyphs.
export function membraneGlyphAt(density, grain) {
  const family = density < 0.23 ? ".,'`:i" : density < 0.38 ? ":;iirsov" : "irsovxac";
  return family[Math.min(family.length - 1, Math.floor(clamp(grain, 0, 0.9999) * family.length))];
}

function internalPigmentAt(u, v, phase) {
  const window = smoothstep(invLerp(-0.82, -0.48, v))
    * (1 - smoothstep(invLerp(-0.15, 0.03, v)));
  const field = 0.5 + 0.5 * Math.sin(u * 5.6 + v * 7.3 + phase
    + Math.sin(v * 12.1 - u * 3.2) * 0.65);
  return window * field;
}

// Let the silhouette emerge from sparse membrane glyphs, not a drawn border.
// The glints are fixed in anatomical coordinates and fade into the tissue.
export function bellEdgeOpacityAt(gap, u, v, phase = 0) {
  const depth = smoothstep(gap / 0.14);
  if (depth === 1) return 1;
  const grain = Math.sin(v * 21 + u * 5 + phase)
    + Math.sin(v * 43 - u * 13 - phase * 0.7) * 0.45;
  const glint = smoothstep(invLerp(0.30, 1.25, grain));
  const lighting = 0.5 + 0.5 * Math.sin(u * 2.4 + phase * 0.8);
  return lerp(0.10 + glint * (0.18 + lighting * 0.16), 1, depth);
}

export function drawEmbeddedRoots(frame, jelly, items, time) {
  const ctx = frame.ctx;
  const width = jelly.bellWidth();
  const height = jelly.bellHeight();
  const halfW = width * 0.5;
  setFont(ctx, frame.fontSize * 0.92);
  ctx.shadowBlur = 0;

  for (const item of items) {
    if ((item.layer ?? 0) >= 0.45 || !item.chain || item.chain.count < 2) continue;
    const projection = frame.attachments.get(item);
    const rootX = projection.rootX;
    const rootY = projection.rootY;
    const targetLocal = {
      x: projection.u * halfW * (item.arm ? 0.65 : 0.78),
      y: -height * (item.arm ? 0.30 : 0.19),
    };
    const target = rotate(targetLocal.x, targetLocal.y, jelly.tilt);
    const targetX = jelly.x + target.x;
    const targetY = jelly.y + target.y;
    const steps = item.arm ? 9 : 7;
    let previous = null;

    for (let step = 0; step <= steps; step += 1) {
      const q = step / steps;
      const curve = Math.sin(q * Math.PI)
        * Math.sin((item.phase ?? 0) + (item.offset ?? 0) * 4.7)
        * width * (item.arm ? 0.010 : 0.006);
      const x = lerp(targetX, rootX, q) + curve;
      const y = lerp(targetY, rootY, q);
      const raw = rotate(x - jelly.x, y - jelly.y, -jelly.tilt);
      const v = raw.y / height;
      const shift = bellCenterShift(v, jelly.anatomyPhase, halfW);
      const u = (raw.x - shift) / halfW;
      const profile = bellProfileAt(v, jelly.pulse, jelly.anatomyPhase);
      const opacity = internalRootOpacityAt(item, v);
      if (!(profile > 0 && Math.abs(u) < profile * 0.92
        && v <= skirtRimAt(jelly, u, time) && opacity > 0.004)) {
        previous = null;
        continue;
      }

      if (previous) {
        const dx = x - previous.x;
        const dy = y - previous.y;
        const filtered = item.arm
          ? mixColor(jelly.palette.bellCool, jelly.palette.armHot, 0.34, opacity)
          : mixColor(jelly.palette.bellCool, jelly.palette.tentacleHot, 0.28, opacity);
        ctx.fillStyle = filtered;
        ctx.fillText(
          item.arm ? directionGlyph(dx, dy, ASCII.arm) : directionGlyph(dx, dy),
          x,
          y,
        );

        if (item.arm && step % 3 === 0) {
          ctx.fillStyle = rgba(jelly.palette.bellSoft, opacity * 0.42);
          ctx.fillText(".", x + frame.cellW * 0.55, y);
        }
      }
      previous = { x, y };
    }
  }

  setFont(ctx, frame.fontSize);
}

export function drawBell(frame, jelly, time) {
  const ctx = frame.ctx;
  const width = jelly.bellWidth();
  const height = jelly.bellHeight();
  const halfW = width * 0.5;

  const bellGrid = bellGridScaleFor(frame.compact);
  // Use a slightly finer lattice, but smaller marks and less shadow overlap.
  // The reference dimensions remove the pulse-dependent scale so the same
  // material samples move with the membrane instead of being resampled.
  const cellW = frame.cellW * bellGrid.x * 0.88;
  const cellH = frame.cellH * bellGrid.y * 0.86;
  const bellFont = cellH * 0.99;
  const relaxedHalfW = halfW / (1 - 0.18 * jelly.pulse);
  const relaxedH = height / (1 + 0.19 * jelly.pulse);
  const stepU = cellW / relaxedHalfW;
  const stepV = cellH / relaxedH;
  const colMin = Math.floor(-1 / stepU) - 1;
  const colMax = Math.ceil(1 / stepU);
  const rowMin = Math.floor(-1.09 / stepV) - 1;
  const rowMax = Math.ceil(0.095 / stepV);

  setFont(ctx, bellFont);
  ctx.shadowColor = rgba(jelly.palette.rim, 0.18);
  ctx.shadowBlur = 0.65 * frame.shadowScale;

  for (let row = rowMin; row <= rowMax; row += 1) {
    for (let col = colMin; col <= colMax; col += 1) {
      const sample = membraneSampleAt(col, row, jelly.anatomyPhase);
      const v = sample.y * stepV;
      if (v < -1.09 || v > 0.095) continue;
      const u = sample.x * stepU;
      const absU = Math.abs(u);
      const profile = bellProfileAt(v, jelly.pulse, jelly.anatomyPhase);
      // One continuous envelope. Avoid a wider, detached skirt below the dome.
      const nearMargin = v > -0.28;
      const rimV = nearMargin ? skirtRimAt(jelly, u, time) : 0;
      const marginWidth = bellProfileAt(Math.min(v, 0.020), jelly.pulse, jelly.anatomyPhase);
      const silhouette = nearMargin
        ? lerp(profile, Math.max(0.78, marginWidth), smoothstep(invLerp(-0.16, -0.025, v)))
        : profile;
      if (silhouette <= 0 || absU > silhouette || (nearMargin && v > rimV)) continue;

      const t = invLerp(-1.07, 0.035, v);
      const profileGap = silhouette - absU;
      const rimGap = nearMargin ? rimV - v : 1;
      const pigment = marginalPigmentAt(u, rimGap, jelly.pulse, jelly.anatomyPhase);
      const membraneDepth = clamp(profileGap / Math.max(0.075, silhouette * 0.68), 0, 1);

      const crownDistance = Math.hypot(u / 0.46, (v + 0.78) / 0.30);
      const crownGlow = 1 - smoothstep(invLerp(0.18, 1.04, crownDistance));
      const warmZone = 1 - smoothstep(invLerp(-0.66, -0.19, v));
      const lowerGlass = smoothstep(invLerp(-0.46, 0.025, v));
      const centerGlass = Math.max(0, 1 - Math.abs(u) / Math.max(0.17, profile))
        * (0.28 + 0.72 * Math.sin(Math.PI * clamp(t, 0, 1)));

      const internal = internalPigmentAt(u, v, jelly.anatomyPhase);
      const pulseGlow = jelly.pulse * smoothstep(invLerp(-0.44, 0.02, v));

      const grainA = 0.5 + 0.5 * Math.sin(u * 29 + v * 19 + jelly.anatomyPhase)
        * Math.cos(u * 15 - v * 35 + jelly.twist);
      const fineGrain = membraneGrainAt(u, v, jelly.anatomyPhase);

      // Keep membrane ink sparse so bright anatomy appears suspended inside
      // a transparent envelope rather than printed onto a wall.
      const tissueDensity = clamp(
        0.040
        + membraneDepth * 0.215
        + crownGlow * 0.19
        + centerGlass * 0.045
        + grainA * 0.055
        + fineGrain * 0.030
        + pulseGlow * 0.050
        + internal * 0.055
        + pigment * 0.27,
        0.020,
        0.83,
      );

      const sideOpacity = bellEdgeOpacityAt(profileGap, u, v, jelly.anatomyPhase);
      const lipOpacity = nearMargin ? lerp(0.26, 1, smoothstep(rimGap / 0.038)) : 1;
      const edgeOpacity = sideOpacity * lipOpacity;
      const poreThreshold = clamp(bellPoreThresholdAt(v, tissueDensity, crownGlow)
        + pigment * 0.26, 0, 0.82) * lerp(0.48, 1, edgeOpacity);
      // Mix independent micro-pores with the broader tissue field. The lower
      // glass stays porous, while crown highlights remain softly granular.
      if (lerp(sample.grain, fineGrain, 0.32) > poreThreshold) continue;

      const materialOpacity = lerp(1.08, 0.70, lowerGlass);
      const pulseLight = 1 + jelly.pulse * (1 - lowerGlass) * 0.06;
      const alpha =
        (0.29 + tissueDensity * 0.49)
        * (frame.compact ? 1.62 : 1.49)
        * materialOpacity
        * pulseLight;

      const glyph = membraneGlyphAt(tissueDensity, sample.glyph);
      // Blend the zones continuously rather than cutting across the tissue
      // at a hard colour boundary. The skirt remains integrated pigment.
      const coral = clamp(0.18 + warmZone * 0.36 + internal * 0.12 + pigment * 0.88, 0, 0.94);
      const warmth = smoothstep(clamp(warmZone * 0.9 + pigment * 1.22, 0, 1));
      const crown = crownGlow * (0.65 + sample.glyph * 0.35);
      const color = mixMembraneColor(jelly.palette, 0.32 + centerGlass * 0.38,
        coral, warmth, crown * 0.88, alpha + pigment * 0.28 + crown * 0.09);
      ctx.globalAlpha = edgeOpacity;
      ctx.fillStyle = color;
      const local = rotate(u * halfW + bellCenterShift(v, jelly.anatomyPhase, halfW), v * height, jelly.tilt);
      ctx.fillText(glyph, jelly.x + local.x, jelly.y + local.y);
    }
  }

  ctx.globalAlpha = 1;
  setFont(ctx, cellH * 0.96);
  // Irregular internal canals. Each one has its own start/end, wander and
  // occasional fork so the anatomy cannot be read as evenly spaced spokes.
  ctx.shadowColor = rgba(jelly.palette.bellHot, 0.36);
  ctx.shadowBlur = 0.7 * frame.shadowScale;
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
      const u = clamp(
        (ray.x + ray.bend * q * q + wander + branchOffset * smoothstep(q)) * profile * spread,
        -profile * 0.96, profile * 0.96,
      );
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
          (branchOffset ? 0.15 : 0.23) * (0.62 + fade * 0.38),
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

  // A small asymmetric mass of tissue obscures the individual root origins.
  // It dissolves into the existing oral arms rather than ending in a line.
  ctx.shadowColor = rgba(jelly.palette.armHot, 0.14);
  ctx.shadowBlur = 0.9 * frame.shadowScale;
  setFont(ctx, bellFont);
  const rows = Math.max(5, Math.ceil(height * 0.23 / cellH));
  for (let row = 0; row < rows; row += 1) {
    const t = row / rows;
    const half = halfW * lerp(0.31, 0.14, smoothstep(t));
    const drift = halfW * Math.sin(t * 3.5 + jelly.anatomyPhase) * 0.065 * t;
    for (let x = -half; x <= half; x += cellW * 1.2) {
      const center = 1 - Math.abs(x) / Math.max(1, half);
      const grain = Math.sin(x * 0.32 + row * 2.1 + jelly.anatomyPhase)
        + Math.cos(x * 0.19 - row * 1.8);
      if (grain > 0.36 + center * 0.65 - t * 0.6) continue;
      const local = rotate(x + drift, height * (0.025 + t * 0.23), jelly.tilt);
      const alpha = (0.14 + center * 0.29) * (1 - smoothstep(t));
      ctx.fillStyle = mixColor(jelly.palette.arm, jelly.palette.bellGlass, center * 0.45, alpha);
      ctx.fillText(membraneGlyphAt(0.16 + center * 0.30,
        grainSeed(Math.round(x / cellW), row, 0x50a8f)), jelly.x + local.x, jelly.y + local.y);
    }
  }

  // Pulse is communicated by geometry, fluorescence and motion. A full
  // horizontal contraction ring would make the bell too architectural.
  setFont(ctx, frame.fontSize);
}
