import { clamp, lerp } from "./math.mjs";

// Interleave length classes, not a progression across the bell.
const TIERS = [
  "short", "medium", "long", "medium", "extra", "short", "long", "medium",
  "short", "long", "medium", "long", "extra", "medium", "short", "medium",
  "long", "short", "medium", "extra", "long", "short", "medium", "long",
];
export const TENTACLE_COUNT = TIERS.length;
export const EXTRA_TENTACLE_OFFSETS = Object.freeze([
  -0.72, 0.79, -0.34, 0.39, -0.90, 0.12, -0.16, 0.55, -0.57,
]);
const PROFILES = {
  short: { min: 0.8, max: 1.2, segments: 42, brightness: 0.94, response: 1 },
  medium: { min: 1.2, max: 1.8, segments: 54, brightness: 0.96, response: 1 },
  long: { min: 1.8, max: 2.5, segments: 66, brightness: 0.84, response: 0.97 },
  extra: { min: 2.5, max: 3.2, segments: 82, brightness: 0.72, response: 0.94 },
};

export function tentaclePlanAt(index, lengthVariation, resolutionVariation) {
  const tier = TIERS[index];
  const p = PROFILES[tier];
  return {
    tier,
    ratio: lerp(p.min, p.max, clamp(lengthVariation, 0, 1)),
    segments: p.segments + Math.round(8 * clamp(resolutionVariation, 0, 1)) - 4,
    brightness: p.brightness,
    response: p.response,
  };
}

// The preferred lengths are relative to the relaxed bell. Fit them into the
// stage without changing the specimen's size, collapsing tiers to one cap,
// or changing length with every contraction. Recalculate only on resize.
export function tentacleLengthFor(size, aspect, height, homeY, ratio) {
  const clearance = clamp(height * 0.055, 18, 56);
  const crownSafeY = size * (0.595 + 0.07 * aspect) + clearance;
  const room = Math.max(18, height - Math.max(homeY, crownSafeY));
  const budget = room * 0.94 * (0.30 + 0.70 * ratio / 3.2);
  return Math.min(size * aspect * ratio, budget);
}
