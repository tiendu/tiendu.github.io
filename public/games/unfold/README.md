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

## Cloudflare multiplayer (1.9.2)

Public GitHub variable: `PUBLIC_UNFOLD_BACKEND_URL=https://unfold-multiplayer.tiendu107.workers.dev`.
The Astro page reads it at build time, then exposes a browser-side
URL for the existing room client. GitHub Actions must forward this public
repository variable into the build environment. The original `room-config.js`
is preserved as-is, and no secret is embedded in the frontend.

The authoritative API is implemented for both Node (`server/unfold/server.mjs`)
and Cloudflare (`server/unfold/worker.mjs`) using the shared `RoomRegistry`.
On Cloudflare, one SQLite-backed Durable Object serializes requests and saves
room data; sessions and game rules remain unchanged. This is a small-game design
and is not intended for unlimited rooms/requests.

Deploy manually from repository root (requires access to the Cloudflare account):

```sh
npx wrangler@4 deploy --config wrangler.unfold.toml
```

Or use the **Deploy UNFOLD room Worker** workflow in GitHub Actions after
setting the secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
That workflow is manual (`workflow_dispatch`) to avoid inadvertently replacing
another Worker at the existing URL. If an existing Durable Object class was
already deployed under this Worker name, inspect its migrations before applying
this new `v1-unfold-rooms` migration. Deploying replaces the existing Worker
code; existing in-memory rooms from a previous implementation won't migrate.

Smoke check after deployment:

```sh
python3 scripts/check-unfold-deployment.py
python3 scripts/check-unfold-deployment.py --smoke
```

Cloudflare 1010 from older Python-urllib checks can be caused by the default
User-Agent on workers.dev; the updated checker sends a descriptive application
User-Agent. A 1010 is not, by itself, evidence that the room service failed.

The `RoomRegistry` continues to auto-advance turns when room requests arrive.
Its room lifetime and reconnect mechanism are unchanged. CORS is restricted to
`https://tiendu.github.io` and local Astro development origins by default.
