import { clamp, smoothstep } from "./math.mjs";

// Fast squeeze, slower elastic release, then a long drift.  The asymmetry is
// intentional: a sine wave looks like machinery; jellyfish do not.
export function pulseEnvelope(phase) {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.18) return smoothstep(p / 0.18);
  if (p < 0.62) {
    const release = (p - 0.18) / 0.44;
    const eased = release * smoothstep(release / 0.10);
    const tail = 1 - smoothstep((release - 0.80) / 0.20);
    return Math.exp(-3.1 * eased) * (1 - 0.08 * Math.sin(eased * Math.PI)) * tail;
  }
  return 0;
}

export function pulseVelocity(previous, current) {
  return clamp(current - previous, -1, 1);
}
