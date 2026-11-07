# Number: 2–20 players online

The frontend stays on GitHub Pages. Choose either backend:

| Backend | Hosting | Persistence |
| --- | --- | --- |
| Cloudflare | Workers + Durable Objects | SQLite-backed Durable Objects |
| Standalone | One Node.js 24 process, optionally Docker | Local SQLite file on persistent disk |

Both use the same game rules, room service, admission rules and wire protocol.
There are no user accounts or external databases. Game state includes private
player tokens, names, join order, host, secret number, range and turn revision.

## Portable structure

- `src/rules.mjs`: pure game state transitions and public views.
- `src/admission.mjs`: room codes, expiry and capacity admission.
- `src/room-service.mjs`: authentication, messages, presence and scheduling.
- `src/index.mjs`: Cloudflare storage, alarm and hibernating socket adapter.
- `src/node-server.mjs`: Node HTTP/WebSockets, SQLite, timers and serial queues.

The room-service port is intentionally small: load/save/remove state, schedule
an alarm, enumerate/accept sockets, and serialize operations. Socket adapters
provide send/close and private attachments. No Cloudflare package is imported by
the shared code or standalone server. A future backend must preserve serialized
admissions/room events and persist state before acknowledging successful moves.

The protocol is unchanged between hosts: `POST /rooms` returns `{room, token}`;
`GET /rooms/<six-digit-code>` upgrades to WebSocket. Clients send `join`, `start`,
`guess`, `leave` and heartbeat messages. Servers send `joined`, `state`, `error`
and `pong`. No deployment credentials are sent to clients.

## Cloudflare setup

1. Create your Cloudflare account. In **Workers & Pages**, finish onboarding
   and choose your `workers.dev` subdomain. Start with Workers Free.
2. Copy your **Account ID**. Create an API token using the **Edit Cloudflare
   Workers** template, scoped to this account only. Do not use the global API key.
3. In GitHub, open this repository → **Settings → Secrets and variables →
   Actions → Secrets**, and add:

   | Secret | Value |
   | --- | --- |
   | `CLOUDFLARE_API_TOKEN` | The API token |
   | `CLOUDFLARE_ACCOUNT_ID` | Your account ID |

   Alternatively store both as environment secrets on the `cloudflare-number`
   environment. The deploy job references that environment. You can restrict
   its deployment branches to `main` and add a required reviewer if desired.
   Never commit either credential, paste it into an issue, or use a `PUBLIC_`
   prefix for credentials.
4. Apply the complete patch to original commit `031b4bd`, commit and push to
   `main`. This patch replaces earlier Number patches; it is not an incremental
   update on top of them. The **Number multiplayer backend** workflow runs
   checks and then deploys. You can also run it manually on `main`.
5. Copy the exact HTTPS `workers.dev` URL printed by the successful deployment
   (no `/rooms` suffix). In GitHub → **Settings → Secrets and variables →
   Actions → Variables**, set the repository variable:

   | Public variable | Value |
   | --- | --- |
   | `PUBLIC_NUMBER_BACKEND_URL` | Your deployed HTTPS Worker URL |

   This URL is public by design. It is not a credential.
6. Run **Deploy to GitHub Pages** again from Actions. Changing a repository
   variable alone does not rebuild the site. The site build reads this variable;
   the Worker deploy job alone does not update the frontend.
7. Open `/games/number/`, enter your name, and choose **Create room**. Share the
   six-digit code or invite link. Guests enter their names and press **Join**.
   The host presses **Start round** with 2–20 connected players.

If the variable is not set, pass-and-play still works and online creation is
unavailable. The existing GitHub Pages workflow does not require Cloudflare
credentials. Backend deployment runs only on main, never on pull requests.

## Standalone Node / Docker setup

Use **one process and one replica** with persistent storage. Multiple replicas
would need shared coordination; do not point multiple processes at this SQLite
file. The 50-room cap applies to one backend deployment, not multiple independent
providers running together.

From `multiplayer/`:

```sh
npm ci --omit=dev
ALLOWED_ORIGINS=https://tiendu.github.io npm start
```

Defaults: bind `127.0.0.1:8787`, save `./data/number.sqlite`, cap 50 rooms.
Supported environment variables: `HOST`, `PORT`, `DATABASE_PATH`,
`ALLOWED_ORIGINS` (comma-separated), `MAX_ROOMS`, `TRUST_PROXY`.
Node 24 provides SQLite; `ws` is the only production npm dependency.

Or use Docker Compose from `multiplayer/`:

```sh
docker compose up -d --build
```

Compose binds the published port to localhost and stores SQLite in the persistent
`number-data` volume. Keep that volume across upgrades. The image runs as a
non-root user. Do not use `docker compose down -v` unless discarding all rooms.
For a consistent backup, stop the service and copy the data directory/volume,
including any SQLite WAL files, then restart.

Expose it through an HTTPS reverse proxy that supports WebSocket upgrades. For
example, a host-level Caddy configuration for a domain you control:

```caddyfile
game-api.example.com {
    reverse_proxy 127.0.0.1:8787
}
```

Point that domain's DNS at your server and configure the proxy's certificates.
The public API must be at the origin root (not behind a URL path prefix).
Compose sets `TRUST_PROXY=1`: the proxy must append/overwrite X-Forwarded-For with
its verified client address, and the backend port must remain inaccessible to
untrusted clients. Without a proxy, leave TRUST_PROXY unset. Direct Node mode
ignores forwarded headers by default. Rate counters are in memory and reset on
restart; room capacity is persisted. One-minute connection limits allow groups
sharing a Wi-Fi address.

Set GitHub Actions **variable** `NUMBER_BACKEND=node` to skip automatic Cloudflare
deployment. CI still tests both adapters. Set `PUBLIC_NUMBER_BACKEND_URL` to the
standalone server's HTTPS origin and rebuild GitHub Pages. Cloudflare credentials
are unnecessary for the standalone service.

## Switching providers

1. Deploy and verify the new backend independently.
2. Set repository variable `PUBLIC_NUMBER_BACKEND_URL` to its HTTPS origin.
3. Set `NUMBER_BACKEND=node` for standalone, or `cloudflare` for Cloudflare.
4. Run **Deploy to GitHub Pages** and have players reload before creating rooms.
5. Keep the old backend running briefly if you want already-open sessions to
   finish, then stop it.

Previously this patch used `PUBLIC_NUMBER_WORKER_URL`; rename that repository
variable to `PUBLIC_NUMBER_BACKEND_URL`. The old name is no longer read.

Active rooms and player tokens are **not migrated across providers**. Reloading
onto a different backend requires a new room. Each provider's persistent storage
preserves rooms across its own normal restarts, but switching is not seamless.
For an even simpler future change, use a domain you control for the backend URL
and switch its routing, while allowing for DNS caches and certificate setup.

## What is public / private?

- Public: code, `wrangler.number.jsonc`, origin allowlist, Worker URL, invite link.
- Private: deployment token (GitHub secret); player tokens (browser storage and
  Durable Object storage); target (server only until the round ends).
- Anyone with the room code/link can join an available seat. Six-digit codes are
  convenient invitations, not passwords; they can be guessed. Never share private
  information in names. The server caps each room at 20 seats and rate-limits joins.
- Names are plain-text display names (1–16 Unicode characters), not verified
  identities. Duplicate names are allowed; private tokens distinguish players.
- Player tokens are sent in the initial WebSocket message, never URLs. Reopening
  the link in the same browser restores that seat; clearing browser storage loses
  the identity. Another device joins as a new player. A second tab using the same
  token replaces the previous socket.
- Origin checks restrict browser callers but are not authentication. Private player tokens protect existing seats; room codes permit new joins. Approximate per-IP rate limits
  bound room creation and connections; they do not guarantee protection from
  distributed quota exhaustion.

## Group rules

- Host starts each round with at least two connected players. Turns follow join
  order. Players joining mid-round watch until the host starts the next round.
- Only the current player can guess. A hit reveals the number and named loser
  to everyone; nobody is eliminated. Host presses **Next round**; the previous
  loser starts if connected, otherwise the first connected player starts.
- Disconnects allow 30 seconds after the server observes the close before their
  turns are skipped. Reconnect restores their seat. If fewer than two round
  participants are connected, guessing pauses. Late spectators do not unblock it.
- Host transfers immediately to the first connected player when the host leaves
  or disconnects. If all disconnect, hosting transfers when someone reconnects.
- No timer forces connected players to guess. Anyone can explicitly leave.
- Pending sockets must authenticate within 10 seconds; total sockets per room
  are bounded at 40 to allow reconnect overlap without unlimited pending sockets.

## Lifetime and free usage

The Number Worker allows **45 rooms** with **20 seats** each (900 possible seats). Chicken has its own five-room limit. Change `MAX_ROOMS` in `wrangler.number.jsonc` and redeploy
(valid range 1–1000). Admissions are serialized, so simultaneous requests cannot
exceed the cap. Lowering the limit preserves existing rooms and blocks new ones
until capacity is available. Full capacity returns HTTP 503 with Retry-After;
the page offers local play. Unknown room IDs are rejected before room allocation.

Rooms expire **one hour after creation**, including rematches. This fixed lease
keeps the coordinator and room expiry in sync; activity cannot hold slots forever.
Slots are reclaimed on expiry even if cleanup alarms are delayed. Initialization
failures conservatively reserve a slot until expiry to prevent overbooking.
Explicit **Leave room** releases your player seat. Closing a tab/disconnecting
retains your seat and token until room expiry, allowing reconnect. The room itself
retains its global slot until expiry, including when empty.
The alarm closes sockets and deletes server state. Heartbeat messages do not
extend room lifetime. Client player tokens remain in that browser's local storage.
WebSocket auto-responses allow the room to hibernate between turns. No polling or
continuous simulation runs on the server. Rate limits are 10 creates and 120
connections per minute per IP. Cloudflare limits are approximate and per location; Node limits are
per process. Namespace IDs 1001/1002 in wrangler.number.jsonc should be changed if
already used for other Cloudflare rate-limit policies in your account.

SQLite-backed Durable Objects are available on Workers Free, subject to request,
compute and storage quotas. Free is not unlimited; watch the dashboard after
launch. No paid plan upgrade is configured by this code.

## Development and checks

Both Workers use the Wrangler installation in this directory. Run these commands from `multiplayer/` with Node 24.

| Game | Config | Local development | Deployment |
| --- | --- | --- | --- |
| Number | `wrangler.number.jsonc` | `npm run dev:number` | `npm run deploy:number` |
| Chicken | `wrangler.chicken.jsonc` | `npm run dev:chicken` | `npm run deploy:chicken` |

The original `dev`, `check`, and `deploy` scripts are aliases for Number.

```sh
cd multiplayer
npm ci
npm run check:number      # handler/rules tests and deployment dry run; no secrets
npm run test:integration  # shared 20-player contract against Cloudflare/workerd
npm run test:node         # same contract against Node + SQLite restart test
npm run dev:number -- --port 8787 --var ALLOWED_ORIGINS:http://localhost:4321
```

In another terminal from the repo root:

```sh
PUBLIC_NUMBER_BACKEND_URL=http://localhost:8787 npm run dev
```

Use exactly `http://localhost:4321` for local frontend testing; if you use a
LAN host or another port, explicitly add that origin to the local Worker
allowlist. Production defaults to `https://tiendu.github.io` only. A custom
site domain must be added to `ALLOWED_ORIGINS` before deploying the Worker.

GitHub checks require the same real WebSocket integration scenario against both
backends, plus shared unit tests and a Docker image build. The scenario covers
20-seat admission, secrecy, host-only start, reconnect, room capacity, late
arrivals, next-round order, host transfer and heartbeat. A separate Node test
checks concurrent admission, persisted turns/range and tokens across restart.

Locally, the Node integration and restart tests passed, along with shared tests,
site verification and a Cloudflare deployment dry-run. This environment cannot
start workerd (network-interface enumeration error) and has no Docker executable.
Cloudflare transport and Docker image verification therefore remain CI checks.
Live deployment and real multi-device verification remain required after setup.

The authoritative state changes are serialized in the Durable Object. Every
move includes a revision; replayed or concurrent stale commands cannot count
as extra guesses. All clients render the same public state. Online state is
never saved in the pass-and-play slot.

## Troubleshooting

- Missing credentials: set the two secrets, then rerun the backend workflow.
- Worker deploy fails on permissions: verify the token's account scope and the
  Edit Cloudflare Workers template permissions.
- Online button unavailable: set the public URL variable and rebuild Pages.
- Connection fails: check the exact Worker URL, `workers.dev` onboarding,
  allowed origin, rate limits, and Free-plan quotas.
- Room full / expired / connected elsewhere: leave the room and create a new
  invite, or return to the browser holding the original player token.
- Never include secrets or player tokens in troubleshooting logs/screenshots.

References:
- https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
