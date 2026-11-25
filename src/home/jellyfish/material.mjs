import { clamp, invLerp, lerp, smoothstep } from "./math.mjs";

// Fixed anatomical variation: broad uneven scallops, with no random changes
// between frames. Gaps in the skirt remain gaps as the bell pulses.
export function skirtLobeAt(u, phase) {
  const envelope = 1 - smoothstep(invLerp(0.68, 0.92, Math.abs(u)));
  const wave = 0.5 + 0.5 * Math.sin(u * 24.1 + phase + Math.sin(u * 7.3) * 0.9);
  const lobe = smoothstep(wave) * envelope;
  return { drop: lobe * 0.022, weight: lobe };
}

// Deliberately uneven prominence: several bright sheets and a few muted
// scraps, rather than a collection of equally legible ribbons or strands.
export function tissuePresence(item, along) {
  const phase = item.phase ?? 0;
  const contrast = smoothstep(0.5 + 0.5 * Math.sin(phase * 2.71 + (item.offset ?? 0) * 8.3));
  const root = 1 - smoothstep(invLerp(0.03, 0.26, along));
  const light = item.arm ? lerp(0.56, 1.23, contrast) : lerp(0.50, 1.10, contrast);
  return lerp(light, item.arm ? 1.05 : 0.78, root);
}

export function ribbonMaterialAt(item, along) {
  const phase = item.phase ?? 0;
  const irregularity = Math.sin(along * 12.3 + phase * 1.7)
    + Math.sin(along * 23.1 - phase) * 0.35;
  const body = smoothstep(invLerp(0.03, 0.20, along));
  const terminal = smoothstep(invLerp(0.62, 1, along));
  return {
    width: clamp(1 + irregularity * 0.20 * body, 0.70, 1.28) * lerp(1, 0.55, terminal),
    fray: lerp(1, 0.12, terminal),
  };
}
