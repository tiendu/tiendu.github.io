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

The server validates room membership, character claims, and bounds on reported movement and energy. It **does not simulate collisions and survival authoritatively**. Online racing is intended for casual private games, not ranked competitions or prizes.

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
