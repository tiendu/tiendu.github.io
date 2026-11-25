import { clamp, rotate } from "./math.mjs";

export const MAX_VISUAL_YAW = 0.78;
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

// Undo the added visual rotation around an appendage's own root, in the
// yaw-projected frame. The root follows the bell; its trail retains the same
// projected direction and length. Masks and branches share this transform.
export function keepTrailDirection(ctx, jelly, item, yaw, extraTilt) {
  if (extraTilt === 0) return;
  const x = item.chain.x[0];
  const y = item.chain.y[0];
  const scale = bellScaleFor(yaw);
  ctx.translate(x, y);
  ctx.rotate(jelly.tilt);
  ctx.scale(1 / scale, 1);
  ctx.rotate(-extraTilt);
  ctx.scale(scale, 1);
  ctx.rotate(-jelly.tilt);
  ctx.translate(-x, -y);
}

// Orientation follows the large-scale water, not transient pointer impulses.
// The slow drift is deterministic and consumes no simulation random numbers.
export function yawTargetAt(time, flowX, phase = 0) {
  const drift = Math.sin(time * 0.013 + phase) * 0.17
    + Math.sin(time * 0.0047 + phase * 1.73) * 0.10;
  return clamp(flowX / 18 * 0.68 + drift, -MAX_VISUAL_YAW, MAX_VISUAL_YAW);
}

export function stepVisualYaw(state, target, dt) {
  const h = clamp(dt, 0, 0.05);
  const velocity = clamp(
    (state.velocity + (clamp(target, -MAX_VISUAL_YAW, MAX_VISUAL_YAW) - state.yaw) * 0.028 * h)
      * Math.exp(-0.32 * h),
    -0.06, 0.06,
  );
  const yaw = clamp(state.yaw + velocity * h, -MAX_VISUAL_YAW, MAX_VISUAL_YAW);
  return { yaw, velocity: Math.abs(yaw) === MAX_VISUAL_YAW && yaw * velocity > 0 ? 0 : velocity };
}

// A medusa is approximately radial; its silhouette should not flatten like
// a rotating card. Most of the turn is conveyed by internal parallax.
export function bellScaleFor(yaw) {
  return 1 - (1 - Math.cos(clamp(yaw, -MAX_VISUAL_YAW, MAX_VISUAL_YAW))) * 0.38;
}

export function visualDepthFor(item, yaw) {
  return (item.layer ?? 0) * Math.cos(yaw) + (item.offset ?? 0) * Math.sin(yaw);
}

export function bellSideLightAt(u, yaw) {
  return clamp(1 + u * Math.sin(yaw) * 0.24, 0.80, 1.20);
}

// A common transform covers the bell and all tissue. Each appendage receives
// a small additional displacement in bell-local coordinates. Outermost roots
// have less room to move; branches share their parent's displacement.
export function appendageProjectionFor(jelly, item, yaw) {
  const depth = item.layer ?? 0;
  const side = item.offset ?? 0;
  const localRoot = rotate(item.chain.x[0] - jelly.x, item.chain.y[0] - jelly.y, -jelly.tilt);
  const half = jelly.bellWidth() * 0.5;
  const maxShift = Math.max(0, half * 0.88 - Math.abs(localRoot.x));
  const shift = clamp(-depth * Math.sin(yaw) * half * 0.18, -maxShift, maxShift);
  const projectedDepth = visualDepthFor(item, yaw);
  const delta = projectedDepth - depth;
  const facing = Math.sin(yaw) * side;
  return {
    ...rotate(shift, 0, jelly.tilt),
    depth: projectedDepth,
    light: clamp(1 + delta * 0.30, 0.73, 1.24),
    width: clamp(1 + facing * 0.20, 0.82, 1.18),
  };
}
