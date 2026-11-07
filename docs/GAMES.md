# Arcade games

Open a game at /games/chicken/, /games/number/, or /games/mines/. Its name also works as a homepage terminal command.

## Mines

Choose Play solo for a local 12×12 field with 20 mines and two fuses. Reach the exit to take the win, or uncover every safe tile for a perfect clear. Solo runs in the browser without a room.

Two to five players dig simultaneously from separate pennants. A round uses a fresh square board with 12, 14, 16 or 18 tiles per side. Dig next to any safe tile connected to your pennant, including diagonals. Flag suspected mines or tap a clue to ping it. After the crew connects every pennant to the exit, the host can take the win or play on for a perfect clear. Two explosions exhaust the shared fuses.

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
