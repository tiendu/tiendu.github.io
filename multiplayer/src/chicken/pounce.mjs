import { groundHeight, strikeSurface } from "./terrain.mjs";

const windup = 0.12;
const flight = 0.23;

// Both the canvas and the collision check sample this committed arc.
export function pouncePose(attack, time) {
  const age = Math.max(0, time - attack.start);
  const progress = Math.min(1, Math.max(0, (age - windup) / flight));
  return {
    x: attack.from + (attack.to - attack.from) * progress,
    hop: 7 * Math.sin(Math.PI * progress),
    crouch: age < windup ? Math.sin(Math.PI * age / windup) * 3 : 0,
    moving: progress > 0,
    done: progress === 1,
  };
}

function onSurface(p, track, rail, kind) {
  if (rail) return p.x >= rail.x && p.x <= rail.x + rail.width && Math.abs(p.y - rail.h) < 2;
  if (kind === "eagle" && strikeSurface(track, p.x).raised) return false;
  return p.onTrail && Math.abs(p.y - groundHeight(track.hills, p.x)) < 2;
}

export function tryPounce(r, track, landings) {
  let kind, from, rail;
  if (r.coyote && !r.coyote.evaded && r.coyote.retreat == null) {
    kind = "coyote";
    from = r.coyote.x;
  } else if (r.fox != null && r.foxRetreat == null) {
    kind = "fox";
    from = r.fox;
  } else if (r.hawk?.perched && r.time < r.hawk.lift) {
    kind = "eagle";
    from = r.hawk.x;
    if (r.hawk.raised) {
      rail = track.roofs.find(b => from >= b.x && from <= b.x + b.width && b.h === r.hawk.surface);
      if (!rail) return;
    }
  } else return;

  const prey = landings.filter(p => p.status === "running" && !(p.safeUntil > r.time) &&
    p.x >= from - 7 && p.x <= from + 23 && onSurface(p, track, rail, kind))
    .sort((a, b) => Math.abs(a.x - from) - Math.abs(b.x - from))[0];
  if (!prey) return;
  const to = Math.min(from + 44, prey.x + 22, rail ? rail.x + rail.width : track.finish);
  r.pounce = { kind, target: prey.id, start: r.time, from, to, rail };
}

export function stepPounce(r, track, catchBird) {
  const attack = r.pounce;
  const pose = pouncePose(attack, r.time);
  if (attack.kind === "fox") r.fox = pose.x;
  else if (attack.kind === "coyote") r.coyote.x = pose.x;
  else r.hawk.x = pose.x;
  if (pose.moving && !attack.hit) {
    for (const prey of r.runners) {
      if (r.courseVersion < 7 && prey.id !== attack.target) continue;
      if (prey.status === "running" && !(prey.safeUntil > r.time) && Math.abs(prey.x - pose.x) <= 9 &&
          onSurface(prey, track, attack.rail, attack.kind)) {
        catchBird(prey);
        attack.hit = true;
      }
    }
  }
  if (!pose.done) return;
  if (attack.kind === "fox") {
    r.foxRetreat = r.time;
  } else if (attack.kind === "coyote") {
    r.coyote.retreat = r.time;
  } else {
    r.hawk.lift = r.time;
    r.hawk.perched = false;
    if (!attack.rail) r.hawk.surface = groundHeight(track.hills, attack.to);
  }
  delete r.pounce;
}
