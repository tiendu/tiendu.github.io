import { clamp, invLerp, smoothstep } from "./math.mjs";

// Projected radial pigment bands. Their spacing is uneven, and the whole fan
// follows the bell profile rather than the screen or its current orientation.
const CHANNELS = [
  [-0.84, 0.055, 0.66], [-0.65, 0.068, 0.86], [-0.43, 0.060, 0.95],
  [-0.21, 0.073, 0.84], [0.025, 0.063, 1.0], [0.24, 0.055, 0.89],
  [0.45, 0.073, 0.94], [0.65, 0.056, 0.80], [0.84, 0.050, 0.62],
];

export function meridionalStripeAt(u, v, profile, phase = 0) {
  if (profile <= 0 || Math.abs(u) >= profile || v <= -1.07 || v >= 0.095) return 0;
  const t = invLerp(-1.07, 0.035, v);
  const q = u / profile;
  // A common gentle bend keeps the channels ordered; a second, position-
  // dependent warp gives them unequal curves without crossing each other.
  const arch = Math.sin(t * Math.PI);
  const warped = q + arch * (0.035 * Math.sin(t * 4.7 + phase)
    + 0.025 * Math.sin(q * 5.1 + t * 6.0 - phase));
  const grain = 0.88 + 0.12 * Math.sin(q * 23.3 + t * 27.1 + phase);
  const crown = smoothstep(invLerp(-1.07, -0.91, v));
  const skirt = 1 - 0.22 * smoothstep(invLerp(-0.08, 0.075, v));
  const edge = 1 - smoothstep(invLerp(0.91, 1, Math.abs(q)));
  let stripe = 0;
  for (const [center, width, strength] of CHANNELS) {
    const distance = Math.abs(warped - center) / (width * (0.88 + 0.20 * arch));
    if (distance >= 1.45) continue;
    const core = 1 - smoothstep(distance / 1.45);
    stripe = Math.max(stripe, core * strength);
  }
  return clamp(stripe * grain * crown * skirt * edge, 0, 1);
}

// The existing mechanical wave is unchanged; pigment channels emit more
// strongly as it passes. Direct contacts still illuminate the surrounding gel.
export function channelFlashMix(stripe, wave, contact = false) {
  return clamp(wave * (contact ? 0.68 + 0.32 * stripe : 0.12 + 0.83 * stripe), 0, 1);
}
