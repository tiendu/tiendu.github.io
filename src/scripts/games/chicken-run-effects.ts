import type { Feather, Point } from "./chicken-run-renderer";

export type FeatherEffect =
  | "run"
  | "jump"
  | "flap"
  | "land"
  | "crash"
  | "celebrate";

interface FeatherOptions {
  size: number;
  lifetime: number;
  gravity: number;
  drag: number;
  color?: string;
  spread?: number;
  shape?: "feather" | "shell";
}

function pushFeather(
  feathers: Feather[],
  origin: Point,
  velocity: Point,
  options: FeatherOptions,
): void {
  const spread = options.spread ?? 0;
  feathers.push({
    x: origin.x + (Math.random() - 0.5) * spread,
    y: origin.y + (Math.random() - 0.5) * spread,
    vx: velocity.x,
    vy: velocity.y,
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 8,
    age: 0,
    lifetime: options.lifetime,
    size: options.size,
    gravity: options.gravity,
    drag: options.drag,
    color: options.color ?? "#e7ffb0",
    shape: options.shape ?? "feather",
  });
}

export function emitEggShells(
  feathers: Feather[],
  origin: Point,
  reducedMotion: boolean,
): void {
  const count = reducedMotion ? 5 : 14;
  for (let index = 0; index < count; index += 1) {
    const angle = Math.PI * (0.15 + Math.random() * 1.7);
    const velocity = 90 + Math.random() * 170;
    pushFeather(
      feathers,
      origin,
      {
        x: Math.cos(angle) * velocity,
        y: Math.sin(angle) * velocity - 150,
      },
      {
        size: 3 + Math.random() * 4,
        lifetime: 0.8 + Math.random() * 0.75,
        gravity: 220,
        drag: 0.978,
        spread: 12,
        color: index % 3 === 0 ? "#d9805d" : "#e7ffb0",
        shape: "shell",
      },
    );
  }
}

export function emitFeathers(
  feathers: Feather[],
  effect: FeatherEffect,
  origin: Point,
  reducedMotion: boolean,
  boardWidth: number,
  requestedCount?: number,
): void {
  const defaults: Record<FeatherEffect, number> = {
    run: 1,
    jump: 3,
    flap: 8,
    land: 3,
    crash: 28,
    celebrate: 1,
  };
  let count = requestedCount ?? defaults[effect];
  if (reducedMotion) count = Math.min(effect === "crash" ? 5 : 2, count);

  for (let index = 0; index < count; index += 1) {
    if (effect === "celebrate") {
      pushFeather(
        feathers,
        { x: Math.random() * boardWidth, y: -8 },
        { x: -12 + Math.random() * 24, y: 18 + Math.random() * 22 },
        {
          size: 3 + Math.random() * 4,
          lifetime: 2.6 + Math.random() * 1.8,
          gravity: 12,
          drag: 0.995,
          spread: 4,
        },
      );
      continue;
    }

    if (effect === "run") {
      pushFeather(
        feathers,
        origin,
        { x: -35 - Math.random() * 28, y: -18 - Math.random() * 22 },
        {
          size: 2.5 + Math.random() * 2.5,
          lifetime: 0.8 + Math.random() * 0.5,
          gravity: 80,
          drag: 0.988,
          spread: 8,
        },
      );
      continue;
    }

    if (effect === "jump") {
      const angle = Math.PI * (0.92 + Math.random() * 0.28);
      const velocity = 55 + Math.random() * 65;
      pushFeather(
        feathers,
        origin,
        {
          x: Math.cos(angle) * velocity - 25,
          y: Math.sin(angle) * velocity - 45,
        },
        {
          size: 3 + Math.random() * 3,
          lifetime: 0.75 + Math.random() * 0.5,
          gravity: 125,
          drag: 0.985,
          spread: 12,
        },
      );
      continue;
    }

    if (effect === "flap") {
      const angle = Math.PI * (0.66 + Math.random() * 0.7);
      const velocity = 105 + Math.random() * 95;
      pushFeather(
        feathers,
        origin,
        {
          x: Math.cos(angle) * velocity - 18,
          y: Math.sin(angle) * velocity - 90,
        },
        {
          size: 3 + Math.random() * 4,
          lifetime: 0.9 + Math.random() * 0.7,
          gravity: 145,
          drag: 0.983,
          spread: 16,
        },
      );
      continue;
    }

    if (effect === "land") {
      const direction = index % 2 === 0 ? -1 : 1;
      pushFeather(
        feathers,
        origin,
        {
          x: direction * (30 + Math.random() * 50) - 18,
          y: -30 - Math.random() * 45,
        },
        {
          size: 2.5 + Math.random() * 3,
          lifetime: 0.6 + Math.random() * 0.45,
          gravity: 135,
          drag: 0.982,
          spread: 10,
        },
      );
      continue;
    }

    const angle = Math.random() * Math.PI * 2;
    const velocity = 80 + Math.random() * 190;
    pushFeather(
      feathers,
      origin,
      { x: Math.cos(angle) * velocity, y: Math.sin(angle) * velocity - 55 },
      {
        size: 3 + Math.random() * 5,
        lifetime: 1 + Math.random() * 1.1,
        gravity: 160,
        drag: 0.98,
        spread: 18,
      },
    );
  }
}

export function updateFeathers(
  feathers: readonly Feather[],
  delta: number,
  boardWidth: number,
  boardHeight: number,
  wind = 0,
): Feather[] {
  const updated = [...feathers];
  updated.forEach((feather) => {
    feather.age += delta;
    feather.x += feather.vx * delta;
    feather.y += feather.vy * delta;
    feather.vy += feather.gravity * delta;
    feather.vx += wind * 72 * delta;
    feather.vx *= Math.pow(feather.drag, delta * 60);
    feather.rotation += feather.spin * delta;
  });

  return updated.filter(
    (feather) =>
      feather.age < feather.lifetime &&
      feather.y < boardHeight + 40 &&
      feather.x > -60 &&
      feather.x < boardWidth + 60,
  );
}
