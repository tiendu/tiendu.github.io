import { coyoteFooting } from "./coyote-route.mjs";
import { groundHeight, strikeSurface } from "./terrain.mjs";
import { pouncePose } from "./pounce.mjs";

export function eaglePose(hawk, track, time) {
  const lift = Math.max(0, time - (hawk.lift ?? time));
  const approach = Math.min(1, Math.max(0, hawk.at - (hawk.lift ?? time)) / 1.35);
  const arc = approach * approach * (3 - 2 * approach);
  const horizontal = hawk.surface == null ? approach : Math.max(0, (approach - 0.65) / 0.35);
  const surface = hawk.surface ?? groundHeight(track.hills, hawk.x);
  const clearance = hawk.surface == null ? 52 : 8;
  return {
    x: hawk.x + horizontal * (-38 + 6 * Math.sin(approach * Math.PI * 2)) + 103 * lift,
    y: surface + clearance + arc * (158 - clearance) + 52 * Math.max(0, lift - 0.18) ** 2,
    fold: 1 - arc, lift,
  };
}

// Positions use the same world coordinates as the canvas. For the canids the
// anchor is the feet; for the eagle it is the body beneath the wing roots.
export function predatorPose(r, track, time) {
  const leap = r.pounce && pouncePose(r.pounce, time);
  if (r.hawk) {
    if (!leap) return { kind: "eagle", ...eaglePose(r.hawk, track, time) };
    const surface = r.pounce.rail?.h ?? groundHeight(track.hills, leap.x);
    return { kind: "eagle", x: leap.x, y: surface + 8 + leap.hop - leap.crouch };
  }
  const x = leap?.x ?? r.coyote?.x ?? r.fox;
  if (x == null) return null;
  return { kind: r.coyote ? "coyote" : "fox", x,
    y: (r.coyote ? coyoteFooting(track, r.coyote, x).y : groundHeight(track.hills, x)) + (leap?.hop ?? 0) - (leap?.crouch ?? 0) };
}

export function jumpedInto(p, before, start, end, track) {
  if (!before.airborne || !start || !end || start.kind !== end.kind) return false;
  const eagle = end.kind === "eagle";
  const coyote = end.kind === "coyote";
  const centerX = eagle ? 0 : 3;
  const centerY = eagle ? 0 : coyote ? 17 : 11;
  const radiusX = eagle ? 10 : coyote ? 17 : 15;
  const radiusY = eagle ? 10 : 11;
  const dx = (before.x - start.x - centerX) / radiusX;
  const dy = (before.y + 10 - start.y - centerY) / radiusY;
  const vx = (p.x - end.x - centerX) / radiusX - dx;
  const vy = (p.y + 10 - end.y - centerY) / radiusY - dy;
  const length = vx * vx + vy * vy;
  const t = length ? Math.max(0, Math.min(1, -(dx * vx + dy * vy) / length)) : 0;
  if ((dx + t * vx) ** 2 + (dy + t * vy) ** 2 > 1) return false;
  const x = before.x + t * (p.x - before.x);
  const feet = before.y + t * (p.y - before.y);
  const roof = strikeSurface(track, x);
  if (!roof.raised) return true;
  const enemyY = start.y + t * (end.y - start.y);
  return (feet >= roof.height - 1) === (enemyY >= roof.height - 1);
}
