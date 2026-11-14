# Chicken Run — Neon Wilds (first playable overhaul)

This patch introduces a **new, standalone Neon Wilds endless solo runner** at `/games/chicken/` and puts Chicken Run back on `/games/`. It does not overwrite the older runner engine or the Cloudflare room protocol: the existing game is kept at `/games/chicken-classic/` so current online play remains reachable while the multiplayer simulation is redesigned.

## Gameplay

- One gameplay button: **JUMP** (Space, Up, W, or touch). A second midair press fires a short, corn-powered jetpack boost. No sprint.
- Five chickens, each with different run speed, jump strength, jet power and corn efficiency. The characters have shared, glowing exosuit artwork, with distinct body silhouettes/colors.
- Corn restores fuel. Starvation reduces speed and disables jetpack boosting, but retains a limited emergency jump.
- Fox pressure, coyote ambushes and eagle swoops. Barriers, gaps, overhead beams, corrupted ground, timed crushers, plasma hazards.
- Disaster system begins after three minutes: EMP, grid collapse, plasma rain, gravity surge; time-based frequency increases. Events are deterministic given a seed.
- Desktop landscape canvas; mobile portrait UI with forward hazard warnings and **no rotation requirement**. Character-specific personal survival records.

## Apply

From your checkout (base main `33d95c0`), run the generator supplied in the ZIP:

```sh
python3 ~/Downloads/chicken-neon-patch/apply-chicken-neon.py
# creates: chicken-neon-wilds.patch
git apply --check chicken-neon-wilds.patch
git apply chicken-neon-wilds.patch
make verify
```

After applying, run the focused simulation checks:

```sh
node --test scripts/test-chicken-neon.mjs
make dev
```

Open `http://127.0.0.1:4321/games/chicken/` and test the menu, run, jump, boost, energy, death/retry, and narrow phone viewports. The prototype has been Node syntax-checked and its simulation tests executed; a complete Astro build and browser run require your repo. The game parameters are starting values for playtesting.

## Multiplayer migration

The **new** online Last Chicken Running mode is **not implemented in this patch**. The Classic online race remains at `/games/chicken-classic/`; it retains its existing sprint rules, old course, legacy room contract and server. Converting it safely requires matching server/client physics and shared endless survival-time ranking, which should be a separate coordinated server + client patch. Do not market Classic as Neon Wilds multiplayer.

## Compatibility

- No changes to `multiplayer/` or any old game-state protocol.
- No modification of existing Chicken Run save keys; Neon Wilds saves *only* best records under `chicken-neon-v1-records`.
- No changes to UNFOLD, MINES, NUMBER, the home page or server routes.
- New code: `public/games/chicken-neon/{engine,render,app}.mjs`.
- New UI: `src/pages/games/chicken.astro`, `src/styles/components/chicken-neon.css`.
- Existing Chicken Run page preserved verbatim as `src/pages/games/chicken-classic.astro`.
- `scripts/check-games.mjs` updated so old game architecture is checked via Classic, and new Neon page has its own contract.
