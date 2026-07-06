# Homepage arcade architecture

The homepage arcade keeps game markup, typed game logic, rendering, and shared
browser utilities separate. Each game mounts itself from a small Astro component,
while `arcade-controller.ts` handles terminal commands and restoring the profile.

| Command   | Component              | Runtime                                     | Styles                 |
| --------- | ---------------------- | ------------------------------------------- | ---------------------- |
| `snake`   | `SnakeGame.astro`      | `snake.ts` + rules + renderer               | `snake-game.css`       |
| `crane`   | `CraneGame.astro`      | `crane.ts` + rules + renderer               | `crane-game.css`       |
| `chicken` | `ChickenRunGame.astro` | `chicken-run.ts` and focused helper modules | `chicken-run-game.css` |

## Stack Trace

Stack Trace is an endless crane-stacking game. One tap drops the hanging cargo.
Off-centre loads permanently change the tower's centre of mass, impacts create
sway, later loads can counterbalance earlier mistakes, and tall towers become
more sensitive to predictable wind phases.

Three precise drops or a height milestone pauses the run and presents two bonus
choices directly over the crane scene. The selected bonus is applied immediately:
Stabilize calms sway, Mag-Lock protects the next marginal landing, Wide Load
widens the next container, and Windbreak cancels wind for two drops. There is no
inventory or second activation step, and no permanent stat upgrade invalidates
high scores.

## Snake

Snake is one evolving Neon Run with a fixed top-down 2.5D arena, absolute
four-direction steering, a transparent block-built snake, Flow scoring,
deterministic sectors, solid arena walls, and recovery-or-risk protocol choices.
After six cores, a physical wall gate opens; the next sector begins only after
the snake reaches it. The arena and obstacles are cached, while the high-DPI
render scale is capped to keep the game responsive on ordinary laptops and
phones.

## Free Range

Free Range is the scrolling chicken runner. Its rules, world cycle, weather,
terrain, effects, and renderers are split into focused modules.

## Saved sessions

Each game stores one versioned resume checkpoint in `localStorage` and presents
`Continue` / `New Run` inside the game when a saved session exists. High scores
remain separate from active-run saves.

- Snake checkpoints after each completed grid step.
- Stack Trace checkpoints only after a stable landing or bonus choice, so a tab
  closed during a falling load resumes from the previous stable tower.
- Free Range checkpoints while the chicken is safely grounded, so a tab closed
  mid-jump resumes from the latest safe footing rather than inside a collision.

A completed, collapsed, or explicitly restarted run clears its resume checkpoint.
Save formats carry a schema version; invalid or incompatible data is discarded
instead of being guessed at.

## Runtime integration contract

The terminal shell does not inspect overlay text or synthesize keyboard events.
Each game publishes a typed status event and consumes typed command events from
`shared/events.ts`.

```text
terminal button / command
        |
        v
typed game command event
        |
        v
game runtime
        |
        v
typed status event
        |
        +--> footer status
        +--> pause/resume label
```

This keeps keyboard bindings, touch controls, the terminal footer, and game
internals independent. Visual copy can change without silently changing state
recognition in the shared controller.

## Session safety

Saved sessions expire after 30 days. Validators check nested obstacle, pickup,
crate, gate, direction, and coordinate data before restoring. Invalid, expired,
future-dated, or incompatible sessions are removed instead of partially loaded.

## Release archives

Run:

```sh
make package
```

Set a custom output path with `ARCHIVE=/path/to/file.tar.gz`. The packaging
script verifies the project first and excludes `.git`, `node_modules`, build
output, Astro caches, and macOS metadata files.
