# WISP — maze chase (development)

The former forest runner has been retired. WISP is intentionally absent from the Games catalog until the replacement is playable. Visit `/games/wisp/` directly to play the solo game and test online transport. The direct page is public but marked noindex; this is not access control.

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

## Phase 5 — solo

Choose any Wisp or hunter. Level 1 is the randomized tutorial (Easy AI,
more pickups, no Stalker); skip it to start at Level 2. Stalker starts at
Level 2 automatically. Levels 2–5 use Normal AI; levels 6+ use Hard, with no
stat inflation. Every level generates a fresh deterministic maze, resets
energy and cooldowns, and retains the normal-level team composition. The
tutorial may have a different roster because Stalker is excluded.

A human Wisp death ends the run immediately; escaping lets you spectate
until team results are ready. A solo hunter advances only if all four Wisps
are eliminated. Advance with Next level. The local per-character record
counts actual levels cleared, not levels skipped. No account is required.
Solo pauses in a hidden tab; online matches do not.

## Phase 6 — authoritative WebSockets

`core/session.mjs` provides the same fixed-tick path for solo and server,
including AI decisions. `src/games/wisp/server/room.mjs` owns room rules,
sequence validation, bot takeover, snapshots and teammate-only pings.
`server/worker.mjs` is the Cloudflare adapter. The browser connects over
native WebSocket, not HTTP polling, and sends only direction/ability intents.
The server owns all positions, energy, hits, abilities, portal and results.
Remote actors interpolate between snapshots; local movement has bounded
visual-only prediction (100 ms) and authoritative corrections. No client
predictions of combat or energy are accepted. The wire protocol is now v3 (Phase 7).

The online panel creates six-digit rooms for 2–4 human players; bots fill both
sides to 4 vs 4. Choose a mode when creating a room, and select unique characters
before joining. All humans must be connected and ready before the host starts.
Transient
network loss permits bot takeover and reconnect with the same private
session token. The same tab can reload and join its saved room code; explicit
leave releases the seat. Host migrates to a connected player. The lobby
and finished result persist, but a Worker restart aborts an active match.
No fabricated win on server restart. A room lasts at most one hour; five
concurrent room leases are allowed, and explicit final leave releases the
lease. Origin allowlisting and input size/rate limits reduce accidental abuse;
they are not authentication against arbitrary public HTTP clients. Keep an
eye on public room admission and Cloudflare usage before release.

The retained `WispRooms` class, `WISP_ROOMS` binding, Worker name and
`v1-wisp-rooms` migration are unchanged. New object names and storage keys
(`maze-v3:` / `maze-v3-*`) avoid interpreting retired runner state as new
rooms. Active matches run a 20 Hz timer; idle lobbies use hibernatable
WebSockets. Active simulation duration and network traffic may incur costs.

### Local test

```sh
cd multiplayer
npm ci
npm run dev:wisp -- --local --port 8787
```

In another terminal:

```sh
npm run dev
```

Visit `http://localhost:4321/games/wisp/` in two separate browser tabs or
profiles. Select distinct characters, create a room, join using the code,
mark both players ready, and start from the host. Choose opposite factions for
competitive or the same faction for co-op. If Astro uses another port, configure the Worker
`WISP_ALLOWED_ORIGINS` accordingly. Default local backend is
`http://127.0.0.1:8787`; `PUBLIC_WISP_BACKEND_URL` overrides it.

```sh
npm run test:wisp
cd multiplayer
npm run check:wisp      # tests and Wrangler dry-run bundle
npm run smoke:wisp      # real WebSocket create/join/input/reconnect, local Worker required
```

### Deployment

Existing GitHub Actions repository variables:

- `WISP_BACKEND=cloudflare`
- `PUBLIC_WISP_BACKEND_URL=https://wisp-multiplayer.tiendu107.workers.dev`

The existing deployment environment `cloudflare-wisp` (or repository secrets)
must provide `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. These credentials
are never sent to the browser. The GitHub Pages workflow passes only the public
backend URL. The Wisp Worker workflow checks, bundles and smoke-tests locally
before deploying to the existing Worker on main if `WISP_BACKEND=cloudflare`.
Confirm both deployments succeed before testing the hosted preview. `/v3/health`
reports the protocol version. Solo works even without a backend URL.

## Phase 7 — Multiplayer modes

- Co-op: all human seats share a faction. Wisp co-op advances if at least one
  reserved human seat escapes; hunter co-op advances if all four Wisps are
  eliminated. A disconnected reserved seat is controlled by AI; an explicit
  leaver's seat no longer counts toward Wisp co-op success. Level 1 is the
  tutorial unless a human selects Stalker (then start at level 2). Later levels
  follow the solo difficulty schedule. Each cleared level increments the
  remaining players' co-op clear counters.
- Competitive: humans must occupy both factions at match start. Five rounds,
  each escape scores one Wisp point and each elimination scores one hunter
  point. A tied cumulative score after round five requires another round;
  the first non-tied cumulative result from then on wins. Each remaining
  player on the winning faction gets one lobby win, not one win per round.
- Every round generates a fresh seeded maze; energy and cooldowns reset.
  Human character selection is locked through the series. Bots retain their
  composition except for the tutorial's Stalker exclusion.
- Host advances after results, or returns to the lobby. Rematches reset
  readiness and series scores, not lifetime-of-room win and clear counters.
  The host can switch modes in the lobby; co-op requires a common faction.
  Offline reservations can be removed by the host in the lobby.
- Room results and counters are persisted in Durable Object storage. A server
  restart during active play aborts that series without awarding a match win.
  An intermission or completed series can be resumed after hibernation.
- v3 intentionally isolates v2 rooms and clients; deploy both Worker and site.
  Existing Cloudflare binding/class/migration, public URL and secrets are
  unchanged. Old leases are not migrated. The live smoke test now checks v3
  and ready gating. Local solo record storage is unchanged.

## Next

Phase 8: balance, sound, animation, mobile playtesting and release. WISP stays
absent from the Games catalog throughout development.
