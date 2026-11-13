# UNFOLD — Ironworks

A dependency-free, retro-industrial cube-net puzzle game embedded in Astro.
The game installs six hinged metal plates onto a tube frame. Its 11 cube nets,
base connectivity, public six-stop action reel, and server-authoritative online
rooms are gameplay contracts; a UI cleanup must not change them.

## Layout (v1.9)

```text
src/pages/games/unfold/index.astro   Astro route and stylesheet entry
public/games/unfold/
  app.mjs                            Orchestrates state and interaction
  engine.mjs, nets.mjs, guided.mjs   Pure rules, nets and legal placements
  fold.mjs                          Reversible fold geometry
  render/                           Canvas, steel tubes, plate latches
  ui/                               Camera, reel, buttons, saves, safe text
  online/transport.mjs              Room HTTP requests only
  styles/foundation.css             Board and base controls
  styles/operator.css               Iron console overrides
  assets/                            Retro pixel sprites
  room-config.js                    Optional public room API URL
server/unfold/                      Authoritative Node room service
scripts/test-*.mjs                  Node test suites
```

The old top-level `canvas.mjs`, `tubes.mjs`, and `latches.mjs` paths remain as
compatibility exports for existing tests and integrations. New imports should
use `render/`. We do **not** move `engine.mjs`, `nets.mjs`, `fold.mjs`, or
`guided.mjs` while the room server and test imports rely on those paths.

## Development

```sh
make dev          # Astro at http://127.0.0.1:4321
make host         # Expose development site to the LAN
make room-server  # Online-room backend at :8787 (separate terminal)
make check        # Existing site checks + all UNFOLD tests
make verify       # Check + production Astro build
```

`src/pages/games/unfold/index.astro` loads two consolidated stylesheets in
cascade order. Don't add another `vXX.css` file or insert CSS from `app.mjs`.
Keep layout/visual changes in the named sheets. URLs inside those CSS files
are relative to `styles/`, so asset references use `../assets/...`.

### Modes and rules

- **Solo**: connect your base to the goal. Starter 13×13, Standard 15×15,
  Hard 19×19, and Open field 11×11. No timer.
- **Co-op**: each player must initially build from their own base. Connected
  allied roads form a shared network, and every base must reach the goal.
- **Competitive**: capture adjacent rival/neutral cubes and rival bases.
- One public action reel per turn: Deploy ×2, Super Deploy ×1, Reclaim ×2,
  Refold ×1. One action or Skip; no action inventory.
- Normal cube animation 1.6 seconds, Quick 0.7 seconds or Instant.
- Players can zoom/scroll independently; the camera never auto-zooms.

### Compatibility to preserve

- Local save key: `unfold-v05`, including existing cube numbering migration.
- Online seat key: `unfold-room-v13`, reconnect token and server protocol.
- HTTP room API: `POST /api/unfold/<operation>` at `window.UNFOLD_ROOM_API`.
- Server controls action rolls, seeded maps, move validation and clock.
- Multiplayer timer: 60 seconds starting after the public reel reveal.
- All 11 cube nets and unchanged geometry/ownership logic.

### Room server

Static GitHub Pages cannot host the Node room server. For production, run the
backend separately behind HTTPS, allow your site's origin, and set
`window.UNFOLD_ROOM_API` to the backend URL in `room-config.js` (or via the
site's build/config pipeline). The registry is in memory; restarting it
clears sessions. Do not put credentials in public frontend configuration.

### Test commands

```sh
node --test scripts/test-unfold.mjs scripts/test-guided.mjs \
  scripts/test-rooms.mjs scripts/test-room-http.mjs \
  scripts/test-difficulty.mjs scripts/test-render.mjs \
  scripts/test-maintenance.mjs
```

After changing `app.mjs`, run an interactive browser smoke test in addition to
unit tests: Solo launch, one Deploy, Refold, and two synchronized room clients.
Use an actual phone for the final iOS rendering check.
