import { tryPounce, stepPounce } from "./pounce.mjs";
import { strikeSurface } from "./terrain.mjs";
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

// A level approach gives the player time to see the bale and jump once.
function startCoyote(r, track, eligible) {
  if (r.coyoteUsed || track.version < 5) return false;
  for (const p of eligible) {
    if (!p.onTrail || p.x < track.finish / 2) continue;
    const bale = track.roofs.find(b => b.h <= 30 && b.width >= 65 &&
      b.x - p.x >= 82 && b.x - p.x <= 108);
    if (!bale || track.hills.some(h => h.x < bale.x && h.x + h.width > p.x)) continue;
    r.coyote = { target: p.id, x: p.x - 56, baleX: bale.x, height: bale.h, started: r.time };
    r.coyoteUsed = true;
    return true;
  }
  return false;
}

function chaseWithCoyote(r, dt, catchBird) {
  const c = r.coyote;
  if (c.retreat != null) {
    const age = r.time - c.retreat;
    c.x += (age < 0.7 ? 122 : -62) * dt;
    if (age > 1.8) r.coyote = null;
    return;
  }
  const p = r.runners.find(b => b.id === c.target);
  if (p?.status !== "running" || r.time - c.started > 6) {
    c.retreat = r.time;
    return;
  }
  c.x += (c.evaded ? 156 : 96) * dt;
  if (!p.jumps && p.x >= c.baleX && !p.onTrail && p.y >= c.height) {
    c.evaded = true;
  }
  if (c.evaded && c.x >= p.x + 5) {
    c.retreat = r.time;
  } else if (!c.evaded) {
    for (const bird of r.runners) {
      if (r.courseVersion < 7 && bird !== p) continue;
      if (bird.status === "running" && bird.onTrail && Math.abs(bird.x - c.x) < 12 && !(bird.safeUntil > r.time)) {
        catchBird(bird);
        c.retreat = r.time;
      }
    }
  }
}

export function updatePredators(r, track, climate, dt, catchBird, landings = []) {
  const { phase, cycleIndex } = climate.cycle;
  const night = phase === "night";
  const flying = phase === "day" && !climate.rain && climate.weather.rainIntensity < 0.65;
  if (track.version >= 6 && !r.pounce && landings.length) {
    const hunting = (!r.hawk || flying) && (r.fox == null || (night && r.time < r.chaseEnd));
    if (hunting) tryPounce(r, track, landings);
  }
  if (r.pounce?.kind === "eagle" && !flying) {
    r.hawk.perched = false;
    r.hawk.lift = r.time;
    delete r.pounce;
  }
  if (r.pounce) return stepPounce(r, track, catchBird);
  if (r.coyote) return chaseWithCoyote(r, dt, catchBird);
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
    const gap = target ? target.x - r.fox : 0;
    let escaped = gap > 67;
    if (track.version >= 5) {
      r.foxLeadTime = escaped ? (r.foxLeadTime ?? 0) + dt : 0;
      escaped = r.time - r.foxStarted >= 1.5 && r.foxLeadTime >= 0.6;
    }
    if (!night || target?.status !== "running" || r.time >= r.chaseEnd || escaped) {
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
    for (const bird of r.runners) {
      if (r.courseVersion < 7 && bird !== target) continue;
      const gap = bird.x - r.fox;
      const touching = track.version >= 5 ? Math.abs(gap) < 10 : gap < 10;
      if (bird.status === "running" && bird.onTrail && touching && !(bird.safeUntil > r.time)) {
        catchBird(bird);
        r.foxRetreat = r.time;
      }
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
          const exposed = hawk.surface == null ? p.altitude >= 35 :
            p.y >= hawk.surface - 4 && p.y <= hawk.surface + 28 &&
            p.y >= strikeSurface(track, p.x).height - 4;
          if ((r.courseVersion >= 7 || p.id === hawk.target) && p.status === "running" && !(p.safeUntil > r.time) &&
              exposed && Math.abs(p.x - hawk.x) < 19) catchBird(p);
        }
      }
      if (flying && (hawk.raised || track.version >= 6)) hawk.perched = true;
      hawk.lift = r.time + (hawk.perched ? 0.7 : 0);
    }
    return;
  }
  if (r.time < 3) return;
  const eligible = r.runners.filter(p => p.status === "running" && !(p.safeUntil > r.time));
  if (startCoyote(r, track, eligible)) return;
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
      if (track.version >= 5) {
        r.foxStarted = r.time;
        r.foxLeadTime = 0;
      }
      r.foxTarget = target.id;
      r.foxCycle = cycleIndex;
      r.chaseEnd = r.time + 3.45;
    }
  } else if (flying && r.eagleCycle !== cycleIndex) {
    const impact = raceClimate(track, r.time + 1.35);
    if (impact.cycle.phase !== "day" || impact.rain || impact.weather.rainIntensity >= 0.65) return;
    // Lock the mark on the jogging line. A single sprint clears the strike.
    const target = eligible.find(p => !p.jumps && (track.version >= 5 ? !p.onTrail : p.altitude >= 35))
      ?? eligible.find(p => p.onTrail);
    if (target) {
      r.hawk = { target: target.id, x: target.x + 1.35 * Math.min(target.vx, 76), at: r.time + 1.35 };
      if (track.version >= 5) {
        const { height, raised } = strikeSurface(track, r.hawk.x);
        r.hawk.surface = height;
        r.hawk.raised = raised;
      }
      r.eagleCycle = cycleIndex;
    }
  }
}
