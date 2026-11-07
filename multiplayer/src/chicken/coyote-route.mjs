import { groundHeight } from "./terrain.mjs";

// Sample the same committed path for collisions, retreat and interpolated frames.
export function coyoteFooting(track, coyote, x) {
  const ground = groundHeight(track.hills, x);
  const trail = { y: ground, reach: 0, rail: null };
  if ((track.version ?? 1) < 8) return trail;
  const index = track.roofs.findIndex(r => r.x === coyote.baleX);
  if (index < 0) return trail;

  const bale = track.roofs[index];
  const end = bale.x + bale.width;
  const next = track.roofs[index + 1];
  const fence = next?.h > bale.h && next.x - end <= 20 ? next : null;
  function bound(from, to, startY, endY, lift) {
    const t = (x - from) / (to - from);
    const arc = 4 * t * (1 - t);
    return { y: startY + (endY - startY) * t + lift * arc, reach: 6 * arc, rail: null };
  }
  const takeoff = bale.x - 40;
  const landing = bale.x + 12;
  if (x < takeoff) return trail;
  if (x < landing) return bound(takeoff, landing, groundHeight(track.hills, takeoff), bale.h, 17);
  if (fence) {
    if (x < end - 25) return { y: bale.h, reach: 0, rail: bale };
    if (x < fence.x + 14) return bound(end - 25, fence.x + 14, bale.h, fence.h, 19);
    if (x < fence.x + fence.width - 10) return { y: fence.h, reach: 0, rail: fence };
  } else if (x < end - 10) return { y: bale.h, reach: 0, rail: bale };
  const last = fence || bale;
  const edge = last.x + last.width;
  if (x < edge + 50) return bound(edge - 10, edge + 50, last.h, groundHeight(track.hills, edge + 50), 21);
  return trail;
}
