# Arcade architecture

The homepage games use a deliberately small separation of concerns:

```text
src/components/games/       Astro markup and accessibility
src/scripts/games/          Game rules, rendering, input, and lifecycle
src/scripts/games/shared/   Small infrastructure helpers only
src/styles/components/      Per-game presentation
```

`src/scripts/games/arcade-controller.ts` owns homepage integration: terminal
commands, mobile pause/restart/exit controls, footer status, and returning to the
profile after a game exits.

## Current games

| Command    | Component              | Logic            | Styles                 |
| ---------- | ---------------------- | ---------------- | ---------------------- |
| `snake`    | `SnakeGame.astro`      | `snake.ts`       | `snake-game.css`       |
| `invaders` | `InvadersGame.astro`   | `invaders.ts`    | `invaders-game.css`    |
| `breakout` | `BreakoutGame.astro`   | `breakout.ts`    | `breakout-game.css`    |
| `chicken`  | `ChickenRunGame.astro` | `chicken-run.ts` | `chicken-run-game.css` |

## Free Range modules

The chicken runner is intentionally split by responsibility rather than kept in
one giant component:

```text
chicken-run.ts             Browser lifecycle, input, and session orchestration
chicken-run-rules.ts       Jump, speed, collision kinds, and obstacle patterns
chicken-run-cycle.ts                 Day/night timing, speed multipliers, egg windows, fox pressure
chicken-run-weather.ts               Clear, cloud, rain, wind, and wetness state
chicken-run-terrain.ts               Long hills, valleys, plateaus, placement safety, and slope speed
chicken-run-background.ts            Terrain-aware countryside chunks, landmarks, and broad profiles
chicken-run-background-renderer.ts   Far, middle, and near parallax scenery
chicken-run-landmark-renderer.ts     Reusable pixel landmarks and tree silhouettes
chicken-run-course.ts                Safe obstacle patterns, corn arcs, and egg placement
chicken-run-effects.ts               Feather and eggshell particles
chicken-run-sky.ts                   Phase palettes, celestial motion, and cloud visibility
chicken-run-environment-renderer.ts  Sky, weather, ground, and countryside composition
chicken-run-renderer.ts              Chicken, fox, pickups, obstacles, and overlays
```

The runner carries at most one egg reserve. Day, sunset, night, and dawn are
calculated from active play time, while terrain and weather remain independent:
rain and wind can overlap any time of day, and long hills continue through every
phase. The renderer uses phase palettes instead of a CSS inversion. The chicken
itself is deliberately excluded from those world palettes: it keeps one bright
white-feather palette and a dark one-pixel silhouette outline throughout the
complete cycle.

The countryside is also world-based rather than a repeating decoration strip.
Long background chunks select open fields, farmsteads, wooded ridges, high
plateaus, or wet valleys from the underlying terrain. Broad far and middle
profiles move at separate parallax rates; rare landmarks stay in world space;
and anti-repetition rules prevent the same farm silhouette from appearing over
and over. Weather and time recolor the active place instead of choosing it.
Night raises the world speed and activates a fox chase; obstacle and corn
performance can create a little breathing room. The game remains silent like
the other arcade games.

## Rules for adding a game

1. Keep the Astro component markup-only. It may import CSS and call one mount
   function, but it must not contain game rules.
2. Keep game-specific physics and rendering in its own TypeScript module.
3. Share infrastructure, not gameplay. Storage, canvas scaling, event names,
   and idempotent mounting are shared; movement and collision rules are not.
4. Register the game once in `arcade-controller.ts`.
5. Use a `tiendu:<game>-start` and `tiendu:<game>-exit` event pair from
   `shared/events.ts`.
6. Run `make verify`. The game architecture check rejects inline game logic and
   untyped escape hatches.

There is intentionally no base game class or general-purpose game engine. The
four games have different rules; a small shared runtime is easier to repair than
an inheritance hierarchy.

## Tests and guardrails

`make games` checks the component/module boundary and runs deterministic tests
for the chicken runner's speed curve, obstacle spacing, coyote time, jump and
flap decisions, day/night boundaries, weather, long terrain, terrain-aware
background chunks, landmark placement, egg offering, fox pressure, world-palette
contrast, fixed chicken-sprite contrast, and celestial visibility. `make verify`
includes those checks before the production build.
