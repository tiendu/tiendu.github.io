import { raceClimate, updatePredators } from "./encounters.mjs";
// World units are pixels. The server advances the race in 50 ms steps.
const classicFinish = 4250;
export const birds = [
  { name: "Sunrise", color: "#dc6540", shape: "rooster", speed: 1.06, jumpHeight: 0.95, trait: "Fast runner" },
  { name: "Pepper", color: "#393744", shape: "hen", speed: 1, jumpHeight: 1, trait: "All-rounder" },
  { name: "Pearl", color: "#f7edcf", shape: "round", speed: 0.95, jumpHeight: 1.08, trait: "Highest jump" },
  { name: "Mango", color: "#ffcf48", shape: "chick", speed: 0.97, jumpHeight: 1.05, trait: "Light jumper" },
  { name: "Indigo", color: "#687ad5", shape: "bantam", speed: 1.03, jumpHeight: 0.98, trait: "Quick runner" },
];

function classicCourse(seed) {
  const roofs = [],
    corn = [];
  for (let i = 0; i < 7; i++) {
    const x = 315 + i * 550 + (seed % 63);
    roofs.push(
      { x, width: 65, h: 28 },
      { x: x + 80, width: 165, h: 60 },
      { x: x + 280, width: 110, h: 60 },
    );
    corn.push({ x: x + 135, h: 60 }, { x: x + 320, h: 0 });
  }
  return { roofs, corn, hills: [], finish: classicFinish, weatherOffset: 0, weatherRate: 1, skyOffset: 0 };
}

// A seed is enough for the host, guests and saved runs to rebuild this track.
export function course(seed, version = 4) {
  if (version === 1) return classicCourse(seed);
  let state = seed >>> 0;
  const roll = (low, high) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return low + Math.floor((state / 4294967296) * (high - low + 1));
  };
  const finish = roll(32, 48) * 100;
  const hills = [], roofs = [], corn = [];
  for (let x = roll(205, 330); x < finish - 550;) {
    const low = { x, width: roll(65, 90), h: roll(20, 30) };
    const high = { x: x + low.width + roll(4, 15), width: roll(95, 165), h: low.h + roll(20, 32) };
    roofs.push(low, high);
    const hill = { x: high.x + high.width + 25, width: roll(140, 220), h: roll(12, 42) };
    hills.push(hill);
    corn.push({ x: high.x + high.width / 2, h: high.h },
      { x: hill.x + hill.width / 2, h: hill.h });
    x = hill.x + hill.width + roll(55, 185);
  }
  const mud = version >= 3 ? hills.filter((_, i) => i % 2 === seed % 2).map(h => ({ x: h.x - (version >= 4 ? 50 : 22), width: version >= 4 ? 42 : 20 })) : [];
  return { finish, hills, roofs, corn, mud, version, snowCourse: version >= 4 && (seed >>> 8) % 3 === 1, weatherOffset: roll(0, 150),
    weatherRate: roll(80, 125) / 100, skyOffset: roll(0, 48) };
}

export function groundHeight(hills, x) {
  const hill = hills?.find(h => x > h.x && x < h.x + h.width);
  if (!hill) return 0;
  const phase = (x - hill.x) / hill.width;
  return hill.h * (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

export function runner(id, bird = 1) {
  return {
    id, bird,
    x: 0,
    y: 0,
    vy: 0,
    vx: 72 * birds[bird].speed,
    jumps: 0,
    burstLeft: 0,
    corn: 0,
    status: "running",
  };
}
export function input(p, key) {
  if (!p || p.status !== "running") return;
  if (key === "jump" && p.jumps < 2) {
    p.vy = (p.jumps === 0 ? 220 : 175) * Math.sqrt(birds[p.bird ?? 1].jumpHeight);
    p.jumps++;
  }
  if (key === "down" && !p.burstLeft) p.burstLeft = 1;
}
export function move(p, dt, roofs, hills, wetPatches, icy = false) {
  const surface = roofs.find(
    (r) => p.x >= r.x && p.x <= r.x + r.width && p.y === r.h,
  );
  const onGround = !p.jumps && p.y === groundHeight(hills, p.x);
  const grounded = onGround || (!p.jumps && surface);
  const fast = p.burstLeft > 0;
  p.burstLeft = Math.max(0, (p.burstLeft ?? 0) - dt);
  const inMud = onGround && wetPatches?.some(patch => p.x >= patch.x && p.x < patch.x + patch.width);
  const traction = inMud && !icy ? 0.72 : 1;
  const targetSpeed = traction * (fast ? 128 : 72) * birds[p.bird ?? 1].speed;
  if (grounded)
    p.vx +=
      Math.sign(targetSpeed - p.vx) *
      Math.min(Math.abs(targetSpeed - p.vx), (icy && inMud && p.vx > targetSpeed ? 24 : 160) * dt);
  p.x += p.vx * dt;
  const oldY = p.y;
  p.vy -= 400 * dt;
  p.y += p.vy * dt;
  let floor = groundHeight(hills, p.x);
  for (const r of roofs)
    if (p.x >= r.x && p.x <= r.x + r.width && oldY >= r.h && p.y <= r.h)
      floor = Math.max(floor, r.h);
  if ((onGround || p.y <= floor) && p.vy <= 0) {
    p.y = floor;
    p.vy = 0;
    p.jumps = 0;
  } else if (!p.jumps) p.jumps = 1;
}
export function newRace(players, seed, courseVersion = 4) {
  return {
    seed, courseVersion,
    time: -3,
    runners: players.map((player) => typeof player === "string" ? runner(player) : runner(player.id, player.bird)),
    picked: [],
    rescued: false,
    fox: null,
    hawk: null,
    over: false,
  };
}
export function step(r, track, dt = 0.05) {
  r.time += dt;
  if (r.time < 0 || r.over) return;
  const active = r.runners.filter((p) => p.status === "running");
  function catchBird(p) {
    if (r.picked.length >= 3 && !r.rescued) {
      r.rescued = true;
      p.safeUntil = r.time + 3;
      p.vy = 200;
      p.jumps = 1;
    } else p.status = "caught";
  }
  const climate = r.courseVersion >= 3 ? raceClimate(track, r.time) : null;
  for (const p of active) {
    move(p, dt, track.roofs, track.hills, climate?.muddy || climate?.icy ? track.mud : null, climate?.icy);
    if (climate) {
      p.altitude = p.y - groundHeight(track.hills, p.x);
      p.onTrail = !p.jumps && p.altitude < 1;
    }
    track.corn.forEach((c, i) => {
      if (
        Math.abs(p.x - c.x) < 13 &&
        Math.abs(p.y - c.h) < 16 &&
        !r.picked.includes(i)
      ) {
        r.picked.push(i);
        p.corn++;
      }
    });
    if (p.x >= track.finish) {
      p.x = track.finish;
      p.status = "home";
    }
  }
  if (climate) updatePredators(r, track, climate, dt, catchBird);
  else classicPredators(r, track, active, dt, catchBird);
  r.over = r.runners.every(p => p.status !== "running");
}

function classicPredators(r, track, active, dt, catchBird) {
  const cycle = (r.time + 6) % 15;
  if (r.time > 8 && cycle < 5) {
    const ground = active
      .filter(
        (p) => p.status === "running" && p.y - groundHeight(track.hills, p.x) < 25 && !(p.safeUntil > r.time),
      )
      .sort((a, b) => a.x - b.x);
    if (r.fox === null && ground.length) r.fox = ground[0].x - 65;
    if (r.fox !== null) {
      r.fox += 94 * dt;
      if (ground.length && Math.abs(ground[0].x - r.fox) < 10) {
        catchBird(ground[0]);
        r.fox -= 45;
      }
    }
  } else r.fox = null;
  if (r.hawk && r.time >= r.hawk.at) {
    for (const p of active)
      if (
        p.status === "running" &&
        !(p.safeUntil > r.time) &&
        p.y - groundHeight(track.hills, p.x) >= 35 &&
        Math.abs(p.x - r.hawk.x) < 24
      )
        catchBird(p);
    r.hawk = null;
  }
  if (
    !r.hawk &&
    r.time > 5 &&
    cycle >= 6 && cycle <= 13 &&
    Math.floor(r.time / 3) !== Math.floor((r.time - dt) / 3)
  ) {
    const target = active.find((p) => p.status === "running" && p.y - groundHeight(track.hills, p.x) >= 35);
    if (target) r.hawk = { x: target.x + 83, at: r.time + 1 };
  }
}
