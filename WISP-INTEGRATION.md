# WISP — maze chase (development)

The former forest runner has been retired. WISP is intentionally absent from the Games catalog until the replacement is playable. Visit `/games/wisp/` directly to review Phase 1. The direct page is public but marked noindex; this is not access control.

## Phase 1

- Twelve geometric characters, drawn from shared vector definitions.
- Seeded 13 × 19 braided mazes, with a more open tutorial variant.
- Four Wisps and four hunters; select any character in the preview.
- Rotate the display without changing simulation coordinates; click a cell to preview a location ping.
- No real-time movement, combat, energy economy, AI, portal, or multiplayer yet.

Run `npm run test:wisp` and `npm run dev`.

## Backend retirement

The old runner server and its automated deployment have been removed. The Wrangler configuration is retained as historical migration metadata only; it is not deployable until a compatible replacement Worker is implemented. Do not discard or change the deployed Durable Object migration history without an explicit migration plan. Removing local files does not delete the previously deployed Cloudflare service.

## Next

Movement and collision, energy and portals, abilities, AI, solo progression, then authoritative multiplayer and team pings. Re-enable the Games entry only when playable.
