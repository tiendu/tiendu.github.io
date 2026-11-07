import { cycleStateForElapsed } from "./cycle.ts";
import { weatherStateForElapsed } from "./weather.ts";

export function raceClimate(track, elapsed) {
  const time = Math.max(0, elapsed);
  // Even the shortest course at top sprint speed outlasts a full light cycle.
  const cycle = cycleStateForElapsed(time * (track?.version >= 3 ? 2.5 : 1) + (track?.skyOffset ?? 0));
  const weather = weatherStateForElapsed(time * (track?.weatherRate ?? 1) + (track?.weatherOffset ?? 0));
  return { cycle, weather, muddy: weather.rainIntensity >= 0.35 };
}

export function updatePredators(r, track, climate, dt, catchBird) {
  const { phase, cycleIndex } = climate.cycle;
  const night = phase === "night";
  const flying = phase === "day" && climate.weather.rainIntensity < 0.65;
  if (r.fox !== null) {
    if (r.foxRetreat != null) {
      const age = r.time - r.foxRetreat;
      r.fox += (age < 0.25 ? 22 : -68) * dt;
      if (age >= 1.55) {
        r.fox = null;
        delete r.foxRetreat;
      }
      return;
    }
    const target = r.runners.find(p => p.id === r.foxTarget);
    if (!night || target?.status !== "running" || r.time >= r.chaseEnd || target.x - r.fox > 67) {
      r.foxRetreat = r.time;
      return;
    }
    r.fox += 90 * dt;
    // A roof is safe. Ground height comes from the shared movement simulation.
    if (target.onTrail && target.x - r.fox < 10 && !(target.safeUntil > r.time)) {
      catchBird(target);
      r.foxRetreat = r.time;
    }
    return;
  }
  if (r.hawk) {
    const hawk = r.hawk;
    if (hawk.lift != null) {
      if (r.time - hawk.lift > 1.2) r.hawk = null;
    } else if (!flying || r.time >= hawk.at) {
      if (flying) {
        for (const p of r.runners) {
          if (p.id === hawk.target && p.status === "running" && !(p.safeUntil > r.time) &&
              p.altitude >= 35 && Math.abs(p.x - hawk.x) < 19) catchBird(p);
        }
      }
      hawk.lift = r.time;
    }
    return;
  }
  if (r.time < 3) return;
  const eligible = r.runners.filter(p => p.status === "running" && !(p.safeUntil > r.time));
  if (night && r.foxCycle !== cycleIndex) {
    if (raceClimate(track, r.time + 3.45).cycle.phase !== "night") return;
    const target = eligible.filter(p => p.onTrail &&
      !(track.mud ?? []).some(m => m.x + m.width >= p.x && m.x < p.x + 420))
      .sort((a, b) => a.x - b.x)[0];
    if (target) {
      r.fox = target.x - 55;
      r.foxTarget = target.id;
      r.foxCycle = cycleIndex;
      r.chaseEnd = r.time + 3.45;
    }
  } else if (flying && r.eagleCycle !== cycleIndex) {
    const impact = raceClimate(track, r.time + 1.35);
    if (impact.cycle.phase !== "day" || impact.weather.rainIntensity >= 0.65) return;
    // Lock the mark on the jogging line. A single sprint clears the strike.
    const target = eligible.find(p => p.jumps === 0 && p.altitude >= 35) ?? eligible.find(p => p.onTrail);
    if (target) {
      r.hawk = { target: target.id, x: target.x + 1.35 * Math.min(target.vx, 76), at: r.time + 1.35 };
      r.eagleCycle = cycleIndex;
    }
  }
}
