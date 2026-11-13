# UNFOLD multiplayer — Cloudflare Worker

UNFOLD uses the same **multiplayer/** npm/Wrangler toolchain and Actions pattern
as MINES and NUMBER. It has a dedicated Durable Object class/namespace.

## Backend configuration

- GitHub repository variables:
  - `UNFOLD_BACKEND=cloudflare`
  - `PUBLIC_UNFOLD_BACKEND_URL=https://unfold-multiplayer.tiendu107.workers.dev`
- Repository or `cloudflare-unfold` environment secrets:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
- The Cloudflare account's `workers.dev` subdomain must be `tiendu107`.
- Worker name: `unfold-multiplayer`. Deployment uses `wrangler.unfold.jsonc`.
- Durable Object binding: `UNFOLD_ROOMS`, class: `UnfoldRooms`.
- Durable Object migration tag `v1-unfold-rooms` is carried over from the
  earlier standalone `wrangler.unfold.toml`, if it was ever deployed.

## Development

From the repository root:

```bash
cd multiplayer
npm ci
npm run check:unfold
npm run dev:unfold
```

From another terminal run the Astro site with `make dev`. The Worker defaults
its API to `/api/unfold/{create,join,state,start,action,pass,next,leave}`.

## Deployment

On `main`, modifications to the Worker/room source or its package trigger
`.github/workflows/unfold-worker.yml`: test first, deploy second. Pull requests
run the checks only. `workflow_dispatch` supports manual deployments.

The job uses the `cloudflare-unfold` GitHub environment. Make sure its rules
allow deployment and the two Cloudflare secrets are accessible (repository or
environment secrets). If you use a different environment name, update the job.

On the site build workflow, the build step should receive:

```yaml
env:
  PUBLIC_UNFOLD_BACKEND_URL: ${{ vars.PUBLIC_UNFOLD_BACKEND_URL }}
```

The generation script adds this to an unambiguous GitHub Pages build step if
found; otherwise it reports that the build workflow needs manual review.

Before first deployment to an existing Worker name, review your current Durable
Object migrations and bindings in Cloudflare. Replacing an incompatible Worker
can interrupt or orphan rooms already in progress.

After deployment:

```bash
python3 scripts/check-unfold-deployment.py --smoke
```

Test the deployed site on **two different browsers/devices** (create, join,
start, make a move, reconnect). Automated Node tests are not a substitute for
Cloudflare runtime or real-device testing.

## Implementation

`multiplayer/src/unfold-worker.mjs` re-exports the authoritative implementation
from `server/unfold/worker.mjs`, which imports `server/unfold/rooms.mjs` and the
shared game engine. No duplicate gameplay logic. The global coordinator DO
serializes room operations; suitable for a small game, not high-scale sharding.
The frontend's legacy `window.UNFOLD_ROOM_API` is only a browser-side bridge;
**the public repository/build variable is `PUBLIC_UNFOLD_BACKEND_URL`**.
