# WISP: Single-player + Multiplayer Beta

This branch imports the accepted WISP artwork and latest four-stage procedural gameplay,
including the grounded wildfire, one-button jump/double-jump/hold-to-glide, Cutter,
13 obstacle families, two essence orbs, and polygon disintegration effect.

## Site

- `/games/wisp/` — Astro entry with the game in an accessible full-viewport iframe.
- `/games/wisp/play.html` — self-contained alternative build (all SVGs embedded).
- `/games/wisp/index.html` — edit-friendly standalone build using 93 external SVG assets.
- `src/games/wisp/server` — the new Cloudflare Durable Object room backend.

## Multiplayer

Rooms support 2–4 players with a shared generated course seed, synchronized start,
live positions, individual character selection, independent collectible pickups,
elimination, and last-survivor standings. The DO validates membership and impossible
travel jumps. It **does not yet authoritatively simulate the full Cutter, wildfire,
terrain collisions or orb economy**: browser physics is authoritative for an
individual player's survival in this beta. This must be hardened before prizes or
competitive rankings are introduced. DO tick/snapshot behavior is suitable for a
casual private-room beta; it is not a cheat-proof real-time game server.

Deploy backend with `cd multiplayer && npm run deploy:wisp`. In GitHub Actions,
set repository variable `WISP_BACKEND=cloudflare` and configure the
`cloudflare-wisp` deployment environment and Cloudflare API token/account ID.
Set `PUBLIC_WISP_BACKEND_URL` to the **actual** deployed Worker URL for the
Astro frontend. Until then solo play works; online displays a configurable
Worker URL field.

The game's one-button controls are unchanged: press jump, press again to
second-jump, hold either press while descending to glide.

## Energy economy

- Common +10 essence spawns on safe routes in ~65–82% of chunks depending on stage.
- Greater +25 essence is rare (~29% chance per chunk) and elevated near obstacles.
- Some additional common essence is reachable atop logs, branches and combos.
- At 0% energy, wisps slow down; they **do not die**.
- The generator is seeded, so the whole room sees the same physical terrain.

## Checks

```sh
node --test src/games/wisp/tests/*.test.mjs
cd multiplayer && npx wrangler deploy --config wrangler.wisp.jsonc --dry-run
```
