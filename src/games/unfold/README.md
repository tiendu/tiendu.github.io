# UNFOLD

The frontend is under `client/`, the deterministic rules are under `core/`,
and authoritative room services are under `server/`. The game uses Astro's
asset pipeline and is published at `/games/unfold/`.

- Local game: `client/app.mjs` + `core/engine.mjs`
- Online rooms: `server/rooms.mjs`, `server/worker.mjs`, `server/server.mjs`
- UI styles: `styles/`
- Visual assets: `assets/`
- Node tests: `tests/`

The Cloudflare entrypoint is `multiplayer/src/unfold-worker.mjs`. Keep deployed
Durable Object class names and migration tags compatible. Changes to stored
`unfold-v05` games, `unfold-room-v13` sessions, or HTTP room endpoints require
an explicit compatibility plan.

The public backend URL is set with `PUBLIC_UNFOLD_BACKEND_URL`; the existing
production fallback remains in `Game.astro`.
