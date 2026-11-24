# WISP — maze chase (development)

The former forest runner has been retired. WISP is intentionally absent from the Games catalog until the replacement is playable. Visit `/games/wisp/` directly to review Phase 4. The direct page is public but marked noindex; this is not access control.

## Phase 1

- Twelve geometric characters, drawn from shared vector definitions.
- Seeded 13 × 19 braided mazes, with a more open tutorial variant.
- Four Wisps and four hunters; select any character in the preview.
- Rotate the display without changing simulation coordinates; click a cell to preview a location ping.

## Phase 2 — simulation lab

- Pure, serializable simulation under `public/games/wisp/core/`, fixed 20 Hz;
  browser rendering interpolates ticks and caches maze walls.
- Continuous cardinal motion, buffered corners, immediate reversal, equal base
  speed (3 tiles/s), eight distinct spawns separated by maze distance.
- Shared energy particles (5/15/30), 2 energy/s drain, delayed randomized respawn;
  full-energy Wisps do not consume particles.
- Contact damage, hunter recovery, Wisp immunity and separation before re-hit.
  Stalker contact is lethal; no Stalker in the tutorial roster.
- Three-second preparation, 45-second survival phase, then randomized portal.
  Escape window is at least 20 seconds and covers the longest shortest route
  plus three seconds. Hunters cannot enter the portal. All unresolved Wisps
  are eliminated at closing; all resolved Wisps end the round early.
- Select a character, press Start, move with WASD/arrows, swipe, or direction
  buttons; tap/click to preview pings. Replay uses the same seed; New maze
  generates a new seed. Switching character resets the lab. Hidden tabs pause.
- The arena is a single-round test lab. Actual tutorial/progression, mode
  scoring and networking are not implemented.

## Phase 3 — abilities

Space or the ability button activates the selected character's ability on the
next fixed tick. Aim Phase, Lockdown and Lunge with movement direction. Phase
uses the nearest corridor center and crosses exactly one wall; invalid casts
cost nothing. Wisps need more energy than the cost, so casting cannot itself
eliminate a Wisp. All actors have cooldowns; durations are simulation ticks.

| Character | Ability | Cost | Cooldown | Effect |
| --- | --- | --- | --- | --- |
| Orb | Repulse | 20 | 8s | Push nearby hunters 1 tile and stun 1s, range 2 |
| Prism | Phase | 25 | 8s | Cross one wall |
| Ember | Surge | 20 | 8s | 2x speed, 2s |
| Rune | Barrier | 30 | 12s | Absorb one contact within 8s, including lethal; grants immunity |
| Nova | Echo | 20 | 10s | Moving decoy, 3s; hunter contact consumes recovery, no score |
| Hex | Stasis | 25 | 12s | 50% hunter speed, 3s, range 3 |
| Stalker | Lunge | — | 18s | .25s charge, then straight 2.5x speed for up to 1s |
| Interceptor | Lockdown | — | 12s | Wisp-only block, 3s; no disconnected routes or new dead ends |
| Wanderer | Phase | — | 6s | Cross one wall; cannot land at active portal |
| Warden | Devour | — | 10s | Consume particles within 2 walking tiles; normal respawn |
| Leech | Drain | — | 12s | 5 energy/s for 3s while within 2 walking tiles |
| Sentinel | Silence | — | 15s | Prevent new Wisp casts for 3s, range 2 |

Ranges are measured along corridors, not through walls. Stun prevents motion,
contact damage and new casts. Repulse interrupts a lunge. Silence does not
cancel active effects. Barrier protects from contact, not passive drain.
Lockdown cannot occupy the active portal or a Wisp's current movement edge;
its temporary cells do not mutate the original maze. Echo uses the original
character appearance and does not collect resources or count toward a result.
The simulation accepts ability intents with `step(state, characterIds)` in
stable roster order; the renderer consumes status timers and transient events.
The Phase 4 bots use the same direction and cast intents as humans.

Parameters are initial tuning values, not final balance.

Run `npm run test:wisp` and `npm run dev`.

## Phase 4 — bots

`core/navigation.mjs` builds small canonical-coordinate graphs, with independent
Wisp and hunter traversal rules. BFS provides distance maps; weighted shortest
paths let Wisps trade travel distance against visible danger. Lockdown and the
portal affect the appropriate faction graph without changing maze geometry.

`core/bots.mjs` is a deterministic intent planner. `createBotBrain(difficulty)`
creates a JSON-serializable brain (memory and last observation); `planBots(state,
brain)` returns direction/ability intents without changing round state. Apply
those intents through `setDirection` and `step`. Save the brain alongside the
round when replaying or resuming AI decisions. It never drives human-controlled
characters. Bots obey the same collision, energy, speed, cooldown, and ability
rules as players. No browser APIs or dependencies are used in the planner.

- Wisps avoid danger, seek energy based on need, distance, value and teammate
  competition, and route to the revealed portal. Orb and Hex can position for
  a nearby teammate rescue when they have energy to spare. Urgent escapes favor shortest
  routes; critical energy can justify a short refill detour. Recent cells and
  reversal hysteresis help prevent oscillation.
- Hunters distribute pursuit targets, predict motion, intercept escape routes,
  and use character-specific tactics. Warden targets resources near prey;
  Wanderer seeks useful wall shortcuts; Stalker checks the pursuit line.
- All twelve abilities are usable by bots. Echo is considered as another
  visible candidate, not excluded based on its owner. Opponent exact energy
  and private ability readiness are not used in target selection. Ability
  eligibility and aimed destinations reuse the existing simulation rules.
- Easy, Normal and Hard differ in observation/reaction cadence (300/150/50 ms),
  ability reconsideration, prediction, coordination and route scoring, not
  stats. The tutorial toggle selects Easy and the normal maze selects Normal.
  The lab difficulty selector resets the round, allowing manual comparison.
- This is bounded, heuristic AI, not optimal adversarial search. Bot-vs-bot
  balance is a diagnostic, not a measure of actual human difficulty.

Optional deterministic balance probe (30 rounds per profile by default):

```sh
node src/games/wisp/tests/benchmark-bots.mjs 100
```

It reports escape distributions, elimination reasons, ability casts and mean
headless tick time. Easy includes the tutorial maze/roster; Normal and Hard use
standard rounds, so the three escape rates are not a controlled difficulty
comparison. No browser, network, or assets are required.

## Backend retirement

The old runner server and its automated deployment have been removed. The Wrangler configuration is retained as historical migration metadata only; it is not deployable until a compatible replacement Worker is implemented. Do not discard or change the deployed Durable Object migration history without an explicit migration plan. Removing local files does not delete the previously deployed Cloudflare service.

## Next

Solo progression, then authoritative multiplayer and team pings. Re-enable the Games entry only when playable.
