import { hypot2 } from "./math.mjs";

// Relative displacement excludes the movement of the attachment itself.
export function exceedsRelativeMotion(chain, anchorX, anchorY, limit) {
  if (!chain.hasBefore) return false;
  const dx = anchorX - chain.beforeX[0], dy = anchorY - chain.beforeY[0];
  const threshold = chain.segmentLength * limit;
  for (let i = 1; i < chain.count; i += 1) {
    if (hypot2(chain.x[i] - chain.beforeX[i] - dx, chain.y[i] - chain.beforeY[i] - dy) > threshold) return true;
  }
  return false;
}

// Recovery candidates always originate in the last pose, never in a
// partially repaired one. The caller certifies each candidate and retains
// velocity only after accepting it.
export function relaxTrail(chain, anchorX, anchorY, valid) {
  const dx = anchorX - chain.beforeX[0], dy = anchorY - chain.beforeY[0];
  const proposedX = chain.repairX, proposedY = chain.repairY;
  const limit = chain.segmentLength * 0.65;
  // Strong angular projections can reject every candidate at a limit.
  // Try a uniform, small unprojected step from the previous valid pose;
  // certify it with the same curvature and envelope checks before keeping it.
  let largest = 0;
  for (let i = 1; i < chain.count; i += 1) {
    largest = Math.max(largest, hypot2(proposedX[i] - chain.beforeX[i] - dx,
      proposedY[i] - chain.beforeY[i] - dy));
  }
  if (Number.isFinite(largest)) {
    const cap = Math.min(1, limit / (largest || 1));
    for (const fraction of [1, 0.5, 0.25, 0.125, 0.0625, 0.03125, 0.015625]) {
      const blend = cap * fraction;
      if (largest * blend < 0.003) continue;
      for (let i = 0; i < chain.count; i += 1) {
        const x = chain.beforeX[i] + dx, y = chain.beforeY[i] + dy;
        chain.x[i] = blend ? x + (proposedX[i] - x) * blend : x;
        chain.y[i] = blend ? y + (proposedY[i] - y) * blend : y;
      }
      if (!valid()) continue;
      return true;
    }
  }
  // A local Laplacian relaxation of the prior pose eases kinks without
  // a downstream reset. The envelope is convex in these local coordinates;
  // averaging adjacent nodes usually moves a boundary kink inward.
  for (const weight of [0.08, 0.04, 0.02, 0.01]) {
    chain.x[0] = anchorX;
    chain.y[0] = anchorY;
    for (let i = 1; i < chain.count; i += 1) {
      const x = chain.beforeX[i] + dx, y = chain.beforeY[i] + dy;
      const j = Math.min(i + 1, chain.count - 1);
      const k = i - 1;
      const sx = i === j ? 0 : (chain.beforeX[j] + chain.beforeX[k]) * 0.5 - chain.beforeX[i];
      const sy = i === j ? 0 : (chain.beforeY[j] + chain.beforeY[k]) * 0.5 - chain.beforeY[i];
      chain.x[i] = x + sx * weight;
      chain.y[i] = y + sy * weight;
    }
    if (!valid()) continue;
    return true;
  }
  // A previous pose on both a bend and an envelope limit can reject even
  // a tiny step toward the new candidate. Ease it inward by a very small
  // amount instead of accepting a stationary pose forever. The old pose
  // is retained if no safe relaxation exists.
  let reach = 0;
  for (let i = 1; i < chain.count; i += 1) {
    reach = Math.max(reach, hypot2(chain.beforeX[i] - chain.beforeX[0],
      chain.beforeY[i] - chain.beforeY[0] - i * chain.segmentLength));
  }
  const ease = Math.min(0.015, chain.segmentLength * 0.035 / (reach || 1));
  for (const fraction of [1, 0.5, 0.25, 0]) {
    const blend = ease * fraction;
    for (let i = 0; i < chain.count; i += 1) {
      const x = chain.beforeX[i] + dx, y = chain.beforeY[i] + dy;
      chain.x[i] = x + (anchorX - x) * blend;
      chain.y[i] = y + (anchorY + i * chain.segmentLength - y) * blend;
    }
    if (!valid()) continue;
    return true;
  }
  return false;
}
