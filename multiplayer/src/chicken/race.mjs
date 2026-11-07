// World units are pixels. The server advances the race in 50 ms steps.
export const finish = 4250;
export const birds = [
  { name: "Sunrise", color: "#dc6540", shape: "rooster", speed: 1.06, jumpHeight: 0.95, trait: "Fast runner" },
  { name: "Pepper", color: "#393744", shape: "hen", speed: 1, jumpHeight: 1, trait: "All-rounder" },
  { name: "Pearl", color: "#f7edcf", shape: "round", speed: 0.95, jumpHeight: 1.08, trait: "Highest jump" },
  { name: "Mango", color: "#ffcf48", shape: "chick", speed: 0.97, jumpHeight: 1.05, trait: "Light jumper" },
  { name: "Indigo", color: "#687ad5", shape: "bantam", speed: 1.03, jumpHeight: 0.98, trait: "Quick runner" },
];

export function course(seed) {
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
  return { roofs, corn };
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
    stamina: 3,
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
  if (key === "down" && !p.burstLeft && p.stamina >= 1) p.burstLeft = 1;
}
export function move(p, dt, roofs) {
  const surface = roofs.find(
    (r) => p.x >= r.x && p.x <= r.x + r.width && p.y === r.h,
  );
  const grounded = p.jumps === 0 && (p.y === 0 || surface);
  const fast = p.burstLeft > 0;
  p.burstLeft = Math.max(0, (p.burstLeft ?? 0) - dt);
  const targetSpeed = (fast ? 128 : 72) * birds[p.bird ?? 1].speed;
  if (grounded)
    p.vx +=
      Math.sign(targetSpeed - p.vx) *
      Math.min(Math.abs(targetSpeed - p.vx), 160 * dt);
  p.stamina = Math.max(0, Math.min(3, p.stamina + (fast ? -dt : dt / 2)));
  p.x += p.vx * dt;
  const oldY = p.y;
  p.vy -= 400 * dt;
  p.y += p.vy * dt;
  let floor = 0;
  for (const r of roofs)
    if (p.x >= r.x && p.x <= r.x + r.width && oldY >= r.h && p.y <= r.h)
      floor = Math.max(floor, r.h);
  if (p.y <= floor && p.vy <= 0) {
    p.y = floor;
    p.vy = 0;
    p.jumps = 0;
  } else if (!p.jumps) p.jumps = 1;
}
export function newRace(players, seed) {
  return {
    seed,
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
  for (const p of active) {
    move(p, dt, track.roofs);
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
    if (p.x >= finish) p.status = "home";
  }
  const cycle = (r.time + 6) % 15;
  if (r.time > 8 && cycle < 5) {
    const ground = active
      .filter(
        (p) => p.status === "running" && p.y < 25 && !(p.safeUntil > r.time),
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
        p.y >= 35 &&
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
    const target = active.find((p) => p.status === "running" && p.y >= 35);
    if (target) r.hawk = { x: target.x + 83, at: r.time + 1 };
  }
  r.over = r.runners.every((p) => p.status !== "running");
}
