import { cycleStateForElapsed } from "./cycle.ts";
import { weatherStateForElapsed } from "./weather.ts";

export function raceClimate(track, elapsed) {
  const time = Math.max(0, elapsed);
  // Even the shortest course at top sprint speed outlasts a full light cycle.
  const cycle = cycleStateForElapsed(time * (track?.version >= 3 ? 2.5 : 1) + (track?.skyOffset ?? 0));
  const weather = weatherStateForElapsed(time * (track?.weatherRate ?? 1) + (track?.weatherOffset ?? 0));
  if (track?.version >= 4) {
    if (track.snowCourse) {
      return { cycle, weather: { ...weather, rainIntensity: 0, wetness: 0 },
        snowfall: weather.rainIntensity, icy: true, muddy: false, rain: false };
    }
    return { cycle, weather, muddy: weather.wetness >= 0.34,
      rain: weather.phase === "rain" || weather.rainIntensity > 0.05 };
  }
  return { cycle, weather, muddy: weather.rainIntensity >= 0.35 };
}

export function updatePredators(r, track, climate, dt, catchBird) {
  const { phase, cycleIndex } = climate.cycle;
  const night = phase === "night";
  const flying = phase === "day" && !climate.rain && climate.weather.rainIntensity < 0.65;
  if (r.fox !== null) {
    if (r.foxRetreat != null) {
      const age = r.time - r.foxRetreat;
      const turning = age < (r.foxSkid ? 0.6 : 0.25);
      const forwardSpeed = r.foxSkid ? 88 : 22;
      r.fox += (turning ? forwardSpeed : -68) * dt;
      if (age >= 1.55) {
        r.fox = null;
        delete r.foxRetreat;
        delete r.foxSkid;
      }
      return;
    }
    const target = r.runners.find(p => p.id === r.foxTarget);
    if (!night || target?.status !== "running" || r.time >= r.chaseEnd || target.x - r.fox > 67) {
      r.foxRetreat = r.time;
      return;
    }
    const patch = track.version >= 4 && (climate.muddy || climate.icy) &&
      track.mud?.find(m => r.fox >= m.x && r.fox < m.x + m.width);
    if (patch && climate.icy && target.altitude > 12) {
      r.foxRetreat = r.time;
      r.foxSkid = true;
      return;
    }
    r.fox += (patch && climate.muddy ? 55 : 90) * dt;
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
      (track.version >= 4 || !(track.mud ?? []).some(m => m.x + m.width >= p.x && m.x < p.x + 420)))
      .sort((a, b) => a.x - b.x)[0];
    if (target) {
      // Ease in over the first half of the race. Even the shortest warning
      // leaves half a second to react and a full sprint to escape.
      const progress = Math.min(1, target.x / track.finish);
      r.fox = target.x - (track.version >= 4 ? 65 - 10 * progress : 55);
      r.foxTarget = target.id;
      r.foxCycle = cycleIndex;
      r.chaseEnd = r.time + 3.45;
    }
  } else if (flying && r.eagleCycle !== cycleIndex) {
    const impact = raceClimate(track, r.time + 1.35);
    if (impact.cycle.phase !== "day" || impact.rain || impact.weather.rainIntensity >= 0.65) return;
    // Lock the mark on the jogging line. A single sprint clears the strike.
    const target = eligible.find(p => p.jumps === 0 && p.altitude >= 35) ?? eligible.find(p => p.onTrail);
    if (target) {
      r.hawk = { target: target.id, x: target.x + 1.35 * Math.min(target.vx, 76), at: r.time + 1.35 };
      r.eagleCycle = cycleIndex;
    }
  }
}
