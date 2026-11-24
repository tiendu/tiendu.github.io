# WISP

A 4 vs 4 maze chase at `/games/wisp/`. One to four humans; bots fill the remaining slots.

## Gameplay

- Solo and co-op are endless. Level 1 is the tutorial; Stalker starts at level 2.
  Solo Wisps must escape personally; co-op Wisps need at least one reserved human
  seat to escape. Hunters need all four Wisps eliminated. Co-op requires all humans
  on one faction.
- Competitive requires humans on both factions. Each escape/elimination scores one
  point for its faction. Five rounds, then extra rounds if tied. Winners earn one
  lobby win; co-op clears are tracked separately. Rematches retain these counters.
- Each round has a new seeded 13 × 19 maze, 3 seconds of preparation, 45 seconds of
  survival, then at least 20 seconds to escape. Energy and cooldowns reset each round.
- WASD/arrows, swipe or direction buttons move; Space or the ability button casts.
  Tap a corridor to ping teammates. Screen rotation changes only the view and input
  mapping. Sound is optional; reduced-motion preference disables cosmetic bursts.
- All characters move at 3 tiles/s before temporary ability modifiers. Wisps start
  with 100 energy, lose 2/s and collect 5/15/30 energy particles. Hunters have no energy
  drain. All unresolved Wisps are eliminated when the portal closes.

## Abilities

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

## Code

`public/games/wisp/core/` holds the deterministic simulation, character definitions,
maze generation, abilities, navigation, bots and session progression. `game.mjs`
connects the browser UI to this core; `client/` owns rendering, input, sound,
feedback and WebSocket transport. There are no image/audio asset packs or game engines.

`src/games/wisp/server/room.mjs` owns room rules and `worker.mjs` adapts them to
Cloudflare Durable Objects. Both server and browser use the same 20 Hz tick path.
The server accepts intents, not positions; remote actors interpolate and local
movement has bounded visual prediction. Bots follow the same movement/ability rules.

## Rooms

Two to four humans, unique characters, ready checks, host-only start/advance.
Disconnected players retain a seat with bot takeover; a reconnect token restores it.
Explicit leave releases a seat. Host migrates to a connected player. Active matches
are aborted without awarding a win if the Worker restarts; intermission and lobby
state are persisted. Maximum five rooms, one hour per room. Origin allowlisting,
message size/rate limits and room capacity are not full abuse prevention.

The Worker name, `WispRooms` class, `WISP_ROOMS` binding and `v1-wisp-rooms` migration
are retained. Protocol v3 uses `maze-v3:` object names and separate storage keys.
Active matches use a 20 Hz timer; idle lobbies use hibernatable WebSockets. Active
simulation and network traffic may incur costs.

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
Confirm both deployments succeed before testing the hosted game. `/v3/health`
reports the protocol version. Solo works even without a backend URL.
