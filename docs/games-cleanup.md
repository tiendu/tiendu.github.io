# Game module boundaries

Audit baseline: `f5fb3a955bb79249bf2979998f3a9e1dcf51d0f5` (2026-11-13).

This cleanup is deliberately **behavior-preserving**. It does not implement
construction death, electrical gates, or any combat redesign.

## UNFOLD

- `public/games/unfold/engine.mjs`: sole source of truth for game rules,
  connectivity, scoring and deterministic seeded terrain. Leave the action
  die and save format unchanged during UI-only refactoring.
- `public/games/unfold/app.mjs`: browser-side orchestration, input, rendering,
  animation timing, and multiplayer UI.
- `public/games/unfold/ui/actions.mjs`: availability, target listings, and
  non-gameplay copy. Calls into engine; must not implement its own reclaim rules.
- `public/games/unfold/ui/net-thumbnail.mjs`: pure six-cell SVG previews.
- `public/games/unfold/online/transport.mjs`: room HTTP requests.
- `server/unfold/rooms.mjs`: server authority for rolls, actions, deadlines.
- `public/games/unfold/styles/`: keep foundation, operator, navigation load
  order stable. Do not combine all CSS into another monolith.

Future focused cleanup: split terrain generation from `engine.mjs` *before*
adding electrical gates, and split board rendering/animation from `app.mjs`.
Move code only with corresponding behavioral tests; do not simultaneously
change winning conditions, multiplayer protocol, or game mechanics.

## MINES

The Astro page mounts `src/scripts/games/mines.mjs`; shared deterministic
board logic lives in `multiplayer/src/mines/board.mjs`. Hats and elevator
animations already have separate modules. The component CSS is already split.
Keep those boundaries; no wholesale rewrite is justified by the UNFOLD patch
issue.

## NUMBER

The Astro page mounts `number.ts`; rules, online transport, and counter
are separate modules. Keep TypeScript and existing session/state contracts.
Do not copy NUMBER logic into the Astro component just for consistency.

## Patch discipline

1. Create a patch with `git diff` against a clean, known revision rather than
   constructing hunk headers manually.
2. Apply with `git apply --check` **before** `git apply`.
3. Keep formatting/refactors and gameplay changes in different patches.
4. Run `make check` after each patch; run the game manually for animation/UI
   changes. `make check` includes a cross-game architecture regression test.
5. For rules changes, add both deterministic engine tests and room tests.

If a patch fails, do not force-apply or silently skip a hunk. Regenerate the
diff from the current checkout. A failed hunk is not evidence of a broken game.
