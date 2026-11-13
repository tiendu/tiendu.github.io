# UNFOLD v1.4 · Foundry Routes

A mechanical road-building game. Each turn the **public six-stop reel** rolls
Deploy / Deploy / Super Deploy / Reclaim / Reclaim / Refold. The steel frame
hangs over black space; each cube unfolds into six connected walkway plates.

## v1.4 — harder Solo and base-connected Co-op

- Solo map choices: **Starter 13×13**, **Standard 15×15 (default)**,
  **Hard 19×19** and **Open 11×11 (no terrain)**. A saved legacy
  `challenge` map is treated as Standard.
- Starter/Standard/Hard add increasing amounts of seeded cargo crates,
  permanent broken cross-rails and complete neutral six-plate modules.
  Standard and Hard force detours through alternating gaps; there is no
  artificial minimum-turn counter.
- The generator first finds a **constructible witness route** using the
  actual 11 cube nets and placement rules, then protects its cells while
  adding terrain. It validates that the full witness still works; it never
  starts a match by placing those witness cubes on the table. The witness
  demonstrates a viable geometric route, not a guarantee of particular
  future reel results.
- Co-op sizes: 2 players **15×15**, 3 **17×17**, 4 **19×19**, with denser
  random terrain, neutral modules and a shared central **★ goal**.
- Co-op placement/reclaim begins from **your own base-connected component**.
  Roads from teammates are usable only after the two networks touch by an
  edge. Once linked, the team can extend from that combined network.
- Victory in Co-op requires **all bases AND ★** to be linked into one
  network. Refold may not sever roads belonging to teammates already linked
  to your base.
- The setup has short mode descriptions, and the Solo map selector defaults
  to Standard. No change to the room API or GitHub Actions variable is needed.

## Guided placement

- A legal contact square is marked when **any** rotation or flip of the assigned
  cube net can legally occupy that contact. The solver checks all 8 pose
  combinations and deduplicates identical six-cell footprints.
- Tap a marked socket to see a valid six-cell preview automatically.
- **NEXT FIT** cycles through distinct legal orientations *at that contact*.
  It never offers an invalid shape or moves the contact. Disabled if there is
  only one legal fit.
- **UNFOLD** commits. Tapping a different marker changes the contact without
  needing Cancel, Rotate, Flip, or a shape inventory.
- Deploy retains one assigned cube net. Super Deploy and Refold can choose among
  11 nets in the compact horizontal selector at the foot of the frame.
- Reclaim/Refold remain optional, and **SKIP** consumes any unused roll.

## Interface

- **GAMES** / **NEW**, public reel, clock, and SKIP are immediately above the
  table on both phone and desktop. No far-away desktop sidebar.
- Board fits the viewport by default; manual Zoom/Fit is still available.
- Only two contextual buttons, NEXT FIT and UNFOLD, appear over the board.
  Their location avoids the preview and other selectable contact markers.
- **NEXT** appears when the game is finished. It creates a new board using the
  same mode, difficulty, and player count with a fresh seed. It does not erase
  the completed board until pressed.
- Original low-resolution (24×24) 8-bit frame, walkway, crate, and scrap
  graphics. Painted steel, dark iron, worn brass, chipped armor and heavy
  hinges; installed plates remain color-coded by player.

## Animation

- Top-down, in place, no automatic zoom or screen movement.
- The cube's exterior armor and interior ribs remain distinct; hinges and
  sidewalls are rendered by physically linked geometry.
- Normal 1.6s / Quick 0.7s / Instant modes. A short rust-grit puff plays on
  locking, and Refold uses the reverse hinge animation.

## Integration

Apply `unfold-v1.4-upgrade.patch` to an existing **v1.3 checkout** (after the
Astro/menu hotfixes, if used), or use the checkout-aware upgrade helper if
`git apply --check` reports a context mismatch:

```sh
git apply --check ~/Downloads/unfold-v1.4-upgrade.patch
git apply ~/Downloads/unfold-v1.4-upgrade.patch
make verify
make dev
```

The upgrade changes the game engine, menu behavior, README and game tests; it
adds `v14.css`. It does not modify MINES/NUMBER, `deploy.yml`, room API
configuration, or the player's GitHub Actions variables.

Run the tests independently without npm:

```sh
node --test scripts/test-unfold.mjs scripts/test-guided.mjs \
  scripts/test-rooms.mjs scripts/test-room-http.mjs
```

## v1.3 online rooms (separate Node room server)

The static GitHub Pages frontend **cannot** host synchronized rooms on its own.
This release includes a dependency-free, server-authoritative Node HTTP service
in `server/unfold/`. It follows the Create Room / Join Room UI convention used
by the other games, but does **not** modify or claim compatibility with their
existing server APIs.

Local play (two terminals):

```sh
make dev
make room-server
```

Open `http://localhost:4321/games/unfold/`. Create Room on one browser; Join
Room with the six-digit code in another. The host starts with 2–4 players.
The room service listens on port 8787, is accessed via HTTP polling about once
a second, and owns **all** random results, map terrain, validations and clocks.

On a LAN, run Astro with `make host`, expose room port 8787 to your LAN, and
set the server's `UNFOLD_ALLOWED_ORIGINS` to include your exact Astro URL,
for example `http://192.168.1.5:4321`.

For a deployed HTTPS site, deploy the Node room service separately on an
always-on host behind HTTPS, set `UNFOLD_ALLOWED_ORIGINS` to the site's origin,
and edit `public/games/unfold/room-config.js` to the **HTTPS origin** of the
room service. GitHub Pages itself cannot execute the server. The room registry
is intentionally in-memory: restarting that process clears existing rooms;
this prototype is not clustered or durable across restarts.

### v1.3 shared map and camera

- Multiplayer boards generate seeded, complete neutral six-panel modules,
  single-cell removable cargo crates, and permanent jammed scrap. Starts keep
  a clear base buffer and require legal opening opportunities for each player.
- Co-op and Competitive may remove an **adjacent crate** with Reclaim;
  permanent scrap stays blocked. Neutral cubes require edge adjacency to the
  player's active connected network before they can be reclaimed.
- Public reel results and move legality are server-authoritative. The 60-second
  multiplayer clock starts only **after** the reel reveal. Expiration passes
  the action; clients cannot dictate its random result.
- The current player's banner uses a color **and** readable name/turn text.
  Zoom-in, zoom-out, Fit, wheel zoom and touch pinch are purely local camera
  actions. The game never auto-zooms during unfolding.
- Host-only NEXT generates a fresh seeded board for the same room after a win.
  Players can resume with a previously issued session token on the same browser.

All network requests carry a private seat token in a POST body; invite links
contain **only** the six-digit room code. Room tokens are stored in localStorage
on the player's device. Rooms currently expire after two hours of inactivity.


## v1.5 Ironworks: permanent frame + reversible canvas animation

- The black sockets and round iron tubes are separate persistent render layers.
  `tubes.mjs` paints the frame only when the board dimensions change, not on
  every animation frame. Sparse hex bolts, collars, rust and grease articulate
  the joints without decorating every socket.
- `canvas.mjs` draws six rigid, thick plates from `foldedFaces()` into the same
  canvas during Unfold and Refold. Exterior armor and inner road surfaces have
  different materials and visible retaining pins / rivets.
- When Refold begins, road tiles remain visible until their panels physically
  lift. They reveal the black sockets progressively; the sealed box moves to its
  next contact before reopening. The static tube frame is never replaced.
- The animation canvas stays in place until the new board is painted, avoiding
  the old blank-frame handoff. The camera does not automatically pan or zoom.
- The existing Solo, Co-op, Competitive, rooms and probabilities are unchanged.
- The old `unfold-v1.4-mobile-unfold-hotfix.patch` is superseded by v1.5.
  Apply v1.5 directly to v1.4, without the earlier experimental hotfix.
