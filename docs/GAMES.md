# Arcade games

Open a game at /games/chicken/, /games/number/, or /games/mines/. Its name also works as a homepage terminal command.

## Mines

Solo runs locally on a 12×12 field with 32 mines. Dig from your pennant to the opposite edge. A marked copper fuse lies off to one side. Dig it up to absorb one explosion. You start without protection.

In co-op, 2–5 players take turns in join order. Dig once or pass. Between turns, flag tiles along your own frontier or ping an open clue. The crew shares the collectible fuse. Connect every pennant to the exit to secure the win, then finish or pursue a perfect clear. Late arrivals watch until the next round. A disconnected active player gets 15 seconds to reconnect. Play pauses below two connected participants. If explicit departures leave fewer than two seats in the round, the room returns to the lobby.

Set the GitHub Actions repository variables MINES_BACKEND to cloudflare and PUBLIC_MINES_BACKEND_URL to the dedicated worker URL. The mines-worker workflow uses CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID from repository secrets or the cloudflare-mines environment. Run the backend workflow and rebuild Pages after setting the URL. The default limit is five rooms with a one-hour lifetime.

For local play, run npm ci in multiplayer, then npm run dev:mines -- --port 8787 --var ALLOWED_ORIGINS:http://localhost:4321. From the site root run PUBLIC_MINES_BACKEND_URL=http://localhost:8787 npm run dev and open /games/mines/ in separate browser sessions.

## Chicken Run

Solo and multiplayer use the same seeded race, movement rules, hazards and coop
finish (3,200–4,800 steps per new race) in `multiplayer/src/chicken/race.mjs`. Solo advances it locally in 50 ms
steps. Online rooms advance it on the server. Both use the same course canvas
with hills, platforms, weather and daylight generated from the shared seed.
The progress bar tracks your distance to the coop. Sprint gives a one-second burst
and can be used again immediately after the burst ends. Eagles mark a daytime
strike with a shadow and climb away after one pass. Heavy rain cancels the dive
and turns some ground patches muddy. Foxes chase at night and turn back after
a short pursuit. Sunrise and sunset give the flock time between attacks.

## Release archives

Run:

```sh
make package
```

Set a custom output path with `ARCHIVE=/path/to/file.tar.gz`. The packaging
script verifies the project first and excludes `.git`, `node_modules`, build
output, Astro caches, and macOS metadata files.
