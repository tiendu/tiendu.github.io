import { clamp } from "./math.mjs";

export const MAX_VISUAL_TILT = 0.31;

// The crown leans upstream while water pulls the hanging tissue downstream.
// Use the broad weather, not pointer impulses or rapidly varying local eddies.
export function tiltTargetAt(flowX) {
  return -MAX_VISUAL_TILT * Math.tanh(flowX / 10.5);
}

// Angular momentum lets the bell carry its old attitude through a reversal.
// This is a visual state only, independent of the physical attachment angle.
export function stepVisualTilt(state, target, dt) {
  const h = clamp(dt, 0, 0.05);
  const tilt = state.tilt ?? 0;
  const goal = clamp(target, -MAX_VISUAL_TILT, MAX_VISUAL_TILT);
  const velocity = clamp(
    ((state.tiltVelocity ?? 0) + (goal - tilt) * 0.24 * h) * Math.exp(-0.86 * h),
    -0.085, 0.085,
  );
  const next = clamp(tilt + velocity * h, -MAX_VISUAL_TILT, MAX_VISUAL_TILT);
  return {
    tilt: next,
    tiltVelocity: Math.abs(next) === MAX_VISUAL_TILT && next * velocity > 0 ? 0 : velocity,
  };
}

// Rotate the visible root with the bell, but keep the trail in world space.
export function keepTrailDirection(ctx, item, extraTilt) {
  if (extraTilt === 0) return;
  const x = item.chain.x[0], y = item.chain.y[0];
  ctx.translate(x, y);
  ctx.rotate(-extraTilt);
  ctx.translate(-x, -y);
}
