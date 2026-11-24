# WISP — maze chase (development)

The former forest runner has been retired. WISP is intentionally absent from the Games catalog until the replacement is playable. Visit `/games/wisp/` directly to review Phase 2. The direct page is public but marked noindex; this is not access control.

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
- Roaming bots are temporary test actors, not strategic AI. Abilities,
  actual tutorial/progression, mode scoring and networking are not implemented.

Parameters are initial tuning values, not final balance.

Run `npm run test:wisp` and `npm run dev`.

## Backend retirement

The old runner server and its automated deployment have been removed. The Wrangler configuration is retained as historical migration metadata only; it is not deployable until a compatible replacement Worker is implemented. Do not discard or change the deployed Durable Object migration history without an explicit migration plan. Removing local files does not delete the previously deployed Cloudflare service.

## Next

Abilities, AI, solo progression, then authoritative multiplayer and team pings. Re-enable the Games entry only when playable.
