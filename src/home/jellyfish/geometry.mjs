import { skirtLobeAt } from "./material.mjs";
import { clamp, invLerp, lerp, rotate, smoothstep } from "./math.mjs";

// Keep the bell rounded and organic all the way into the skirt. The visual
// membrane is slightly narrower/taller than its attachment envelope so roots
// stay safely inside the rim without creating architectural side walls.
export function bellProfileAt(v, pulse = 0, phase = 0) {
  if (v < -1.09 || v > 0.06) return 0;
  const t = invLerp(-1.07, 0.035, v);
  const topRound = smoothstep(invLerp(-1.09, -0.965, v));
  const shoulderRise = smoothstep(invLerp(-1.055, -0.34, v));
  const crown = topRound * (0.055 + 0.865 * Math.pow(shoulderRise, 0.39));
  const shoulderSoftening = 1 - smoothstep(invLerp(0.58, 0.86, t)) * 0.028;
  const lowerTuck = 1 - smoothstep(invLerp(0.60, 1, t)) * (0.145 + pulse * 0.030);
  const organic = 1
    + Math.sin(phase * 0.71 + v * 4.5) * 0.010
    + Math.sin(phase * 1.29 - v * 8.4) * 0.0045;
  const profile = crown * shoulderSoftening * lowerTuck * organic;

  // Suppress the one-cell apex that can read like an antenna. The first
  // visible crown row should already have enough width to feel membranous.
  return profile < 0.050 ? 0 : clamp(profile, 0, 0.925);
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

export function bellCenterShift(v, phase, halfW) {
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

// The skirt is a translucent membrane edge, not a continuous neon wire. The
// visibility/intensity pattern is anatomy-stable; only its tiny vertical flutter
// changes with pulse/current so gaps never sparkle randomly frame to frame.
export function skirtMembraneAt(u, pulse = 0, phase = 0, time = 0, tilt = 0) {
  const absU = Math.min(1, Math.abs(u));
  const grain =
    Math.sin((u + 1) * Math.PI * 7.1 + phase * 0.83)
    + Math.sin((u + 0.17) * Math.PI * 15.7 - phase * 1.21) * 0.52;
  const edgeFade = 1 - smoothstep(invLerp(0.76, 0.91, absU));
  const visible = grain > -0.55 && edgeFade > 0.06;
  const intensity = clamp(
    (0.42 + grain * 0.18 + (1 - absU) * 0.08 + pulse * 0.06) * edgeFade,
    0.04,
    0.94,
  );
  const frillSeed =
    Math.sin((u + 0.39) * Math.PI * 9.3 + phase * 1.37)
    + Math.cos((u - 0.21) * Math.PI * 17.5 - phase * 0.53) * 0.40;
  const frill = visible && absU < 0.82 && frillSeed > 0.95;
  const tuck = -pulse * 0.0065 + (1 - pulse) * 0.0025;
  const flutterAmplitude = 0.0022 + Math.abs(tilt) * 0.022;
  const flutter = Math.sin(time * 0.34 + u * 6.2 + phase)
    * flutterAmplitude * (0.55 + absU * 0.45);
  const currentShear = tilt * u * 0.018;
  return {
    visible,
    intensity,
    frill,
    offset: tuck + flutter + currentShear,
    frillSeed,
  };
}

// The skirt, visible anchors and occlusion contour use the same membrane.
export function skirtRimAt(jelly, u, time) {
  const membrane = skirtMembraneAt(u, jelly.pulse, jelly.anatomyPhase, time, jelly.tilt);
  return bellRimAt(u, jelly.pulse, jelly.twist)
    + skirtLobeAt(u, jelly.anatomyPhase).drop + membrane.offset;
}

function bellPoint(jelly, u, v) {
  const halfW = jelly.bellWidth() * 0.5;
  const local = rotate(u * halfW + bellCenterShift(v, jelly.anatomyPhase, halfW),
    v * jelly.bellHeight(), jelly.tilt);
  return { x: jelly.x + local.x, y: jelly.y + local.y };
}

// Only the drawn origin moves. The same translation is applied to the whole
// trail (including branches and masks), so no chain is stretched or bent.
export function visibleAttachmentFor(jelly, item, time) {
  const root = { x: item.chain.x[0], y: item.chain.y[0] };
  const local = rotate(root.x - jelly.x,
    root.y - jelly.y, -jelly.tilt);
  const halfW = jelly.bellWidth() * 0.5;
  const u = item.arm
    ? clamp(local.x / halfW * 0.78, -0.29, 0.29)
    : clamp(local.x / halfW * 0.92, -0.76, 0.76);
  const rim = skirtRimAt(jelly, u, time);
  // Marginal tentacles begin just inside the membrane; oral arms emerge
  // in the central subumbrella rather than from the outer rim.
  const v = rim + (item.arm ? 0.035 : -0.018);
  const point = bellPoint(jelly, u, v);
  return { x: point.x - root.x, y: point.y - root.y,
    rootX: point.x, rootY: point.y, u, v };
}

// A continuous anatomical contour ignores the decorative holes in the ASCII
// membrane. Only the faint embedded-root pass may draw inside it.
export function bellOcclusionContour(jelly, time) {
  const points = [];
  for (const side of [1, -1]) {
    const edge = [];
    for (let i = 0; i <= 64; i += 1) {
      const v = lerp(-1.09, -0.026, i / 64);
      edge.push(bellPoint(jelly, side * bellProfileAt(v, jelly.pulse, jelly.anatomyPhase), v));
    }
    edge.push(bellPoint(jelly, side * 0.90, -0.026));
    if (side === 1) {
      points.push(...edge);
      for (let i = 0; i <= 90; i += 1) {
        const u = lerp(0.90, -0.90, i / 90);
        points.push(bellPoint(jelly, u, Math.max(-0.026, skirtRimAt(jelly, u, time))));
      }
    } else {
      points.push(...edge.reverse());
    }
  }
  return points;
}

export function tentaclePresenceScale(item) {
  if (item.arm) return 1;
  const outer = smoothstep(invLerp(0.58, 0.94, Math.abs(item.offset ?? 0)));
  const long = smoothstep(invLerp(58, 76, item.chain?.count ?? 58));
  return 1 - outer * long * 0.28;
}

// Visible anatomy should emerge from the bell rather than look pinned to a
// single bright point. Rear/mid roots begin faint and resolve over the first
// few segments; foreground anatomy stays more legible.
export function rootEmergenceScale(item, along) {
  const depth = item.layer ?? 0;
  const start = depth < -0.25 ? 0.12 : depth < 0.45 ? 0.22 : 0.50;
  const end = depth < -0.25 ? 0.11 : depth < 0.45 ? 0.13 : 0.075;
  return lerp(start, 1, smoothstep(invLerp(0, end, along)));
}

// The bell is optically thicker near the crown and increasingly transparent
// toward the skirt. This transmission curve is shared by the membrane and the
// ghost anatomy behind it so both materials agree about depth.
export function bellTransmissionAt(v) {
  if (v < -1.09 || v > 0.045) return 0;
  const lower = smoothstep(invLerp(-0.92, 0.02, v));
  return lerp(0.055, 0.245, lower);
}

// Rear/mid roots are visible through the lower bell, but only faintly enough to
// explain where they originate. Foreground anatomy remains in front of it.
export function internalRootOpacityAt(item, v) {
  const depth = item.layer ?? 0;
  if (depth >= 0.45 || v < -0.46 || v > 0.045) return 0;
  const rootWindow = smoothstep(invLerp(-0.46, -0.08, v));
  const depthFactor = depth < -0.25 ? 1 : 0.72;
  const tissueFactor = item.arm ? 1 : 0.68;
  return rootWindow * depthFactor * tissueFactor * bellTransmissionAt(v);
}

// Cyan belongs to occasional thin-tentacle highlights, not a repeating stripe.
// The field is deterministic per strand/segment so accents stay put while the
// chain moves and do not reveal an obvious modulo pattern.
export function tentacleAccentStrength(item, along, segmentIndex) {
  if (along < 0.56) return 0;
  const seed =
    (item.phase ?? 0) * 12.9898
    + ((item.offset ?? 0) + 1.3) * 78.233
    + segmentIndex * 37.719;
  const raw = Math.sin(seed) * 43758.5453;
  const noise = raw - Math.floor(raw);
  const tip = smoothstep(invLerp(0.56, 0.98, along));
  const threshold = lerp(0.88, 0.76, tip);
  if (noise <= threshold) return 0;
  return smoothstep(invLerp(threshold, 1, noise)) * lerp(0.30, 1, tip);
}

// Different skirt fragments sit at slightly different apparent depths. This
// stable field creates bright forward pieces and dim rear pieces without
// changing the actual skirt geometry or introducing frame-to-frame sparkle.
export function skirtDepthLightAt(u, phase = 0) {
  const field =
    Math.sin((u + 0.31) * 9.7 + phase * 1.13)
    + Math.cos((u - 0.17) * 17.3 - phase * 0.71) * 0.55;
  const normalized = clamp((field + 1.55) / 3.10, 0, 1);
  return lerp(0.58, 1.08, smoothstep(normalized));
}
