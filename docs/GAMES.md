# Browser games

The homepage (`/`) runs Blackjack locally in the browser. Its UI, rules, tally
storage, and tests live under `src/games/blackjack/`.

`/games/` lists three standalone games:

- **UNFOLD** — road-building strategy; local game and online rooms
- **MINES** — puzzle; local game and cooperative online rooms
- **NUMBER** — pass-and-play number game, with optional online rooms

Each standalone game's UI and logic live under `src/games/<name>/`. The Astro
routes under `src/pages/games/` are intentionally thin. Shared logic belongs
under `src/games/shared/` only when several games use it.

## Mines

Dig and flag along the shared sides of the revealed area. Clues count all eight
neighbors, including diagonals.

In solo play, the field is 12×12 with 32 mines. Reach the opposite edge from
your pennant. You start without protection; finding the copper fuse lets you
survive one explosion.

Co-op has 2–5 players acting in join order. Players dig or pass on their turn,
while frontier flags and open-clue pings are available between turns. The crew
shares a collectible fuse and must connect every pennant to the exit. A
currently active player has 15 seconds to reconnect; play pauses if fewer than
two participants remain connected.

Set `MINES_BACKEND=cloudflare` and `PUBLIC_MINES_BACKEND_URL` as GitHub Actions
repository variables. Worker deployment requires `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` as secrets. Deploy the Worker, then rebuild GitHub Pages
to apply the public URL. The default backend limit is five rooms with a one-hour
lifetime.

For local online play, use two terminals:

```sh
cd multiplayer
npm ci
npm run dev:mines -- --port 8787 --var ALLOWED_ORIGINS:http://localhost:4321
```

```sh
PUBLIC_MINES_BACKEND_URL=http://localhost:8787 npm run dev
```

## Checks

From the repository root:

```sh
make install
make verify
```

For multiplayer checks, install dependencies under `multiplayer/` and run the
relevant scripts:

```sh
cd multiplayer
npm ci
npm run check:number
npm run check:mines
npm run check:unfold
```

For a source-only release archive, run from the repository root:

```sh
git archive --format=tar.gz --output=site-source.tar.gz HEAD
```

## Deployment compatibility

`multiplayer/` owns the Node/Wrangler deployment wrappers. Do not casually
rename Worker entrypoints, Durable Object classes, namespaces, or migration tags
in a deployed service.

In particular, `multiplayer/wrangler.number.jsonc` still contains the historic
`v3` migration for `ChickenRoom`. The Chicken game has been removed, but the
migration remains part of the deployed Worker's history. Removing that class or
namespace requires an explicit Cloudflare migration, not simply deleting a
configuration entry.
