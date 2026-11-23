# WISP

WISP is a browser-based forest survival runner with solo play and private online races.

## Structure

- `src/pages/games/wisp/index.astro` provides the public `/games/wisp/` route.
- `public/games/wisp/play.html` is the game page loaded by that route. It embeds the Cutter and wildfire SVG layers, but loads JavaScript and other SVG assets from adjacent files. It is **not** an offline, self-contained build.
- `public/games/wisp/game.js`, `procedural.js`, `projectile.js`, and `cutter-motion.js` run the game.
- `public/games/wisp/menu.js` and `online.js` handle the menu, room UI, and client transport.
- `src/games/wisp/server/` contains the Cloudflare Worker and Durable Object room registry.

## Multiplayer

A private room holds two to five racers, with one player per Wisp. Nicknames are optional. All racers receive the same course seed; the host can start a race or request a rematch after it ends.

The server validates membership, character claims, movement limits and energy reports. It now simulates a shared Cutter, wildfire, storm and moving hazards and checks their collisions against reported player positions. The browser still owns responsive jump physics, static terrain contacts and collectible verification, so racing remains a casual private beta rather than a cheat-proof competitive mode.

Deploy the room Worker from the `multiplayer/` directory:

```sh
npm run check:wisp
npm run deploy:wisp
```

Set `PUBLIC_WISP_BACKEND_URL` for the Astro deployment if the Worker URL differs from the default. Cloudflare deployment credentials are configured separately.

## Verify

From the repository root:

```sh
make verify
```

## Shared-world multiplayer (Phase 6)

A WISP room now owns one world clock, a shared Cutter, one wildfire front,
weather/regrowth milestones and moving obstacle states. The Worker accepts
WebSocket streaming at `/api/wisp/stream` and retains HTTP `/sync` as fallback.
All players see the same world events; each player controls their own Wisp and
collects Essence independently. The UI interpolates remote racers; the server
checks Cutter/wildfire/moving hazard contacts and room membership. Local terrain
collisions are still reported by clients and require future full
server-side physics validation before competitive/prize play.

Do not stream SVG assets or individual rain particles: only world state and
player inputs go over the connection. Deployment requires updating both the
static site and `multiplayer` Cloudflare Worker.
