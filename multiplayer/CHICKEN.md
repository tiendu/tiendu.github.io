# Chicken multiplayer on Cloudflare

Chicken deploys as `chicken-multiplayer` using `wrangler.chicken.jsonc`. It owns its lobby, race rooms, and rate limits. The Cloudflare configuration reserves five rooms for Chicken and 45 for Number. The Node adapter continues to serve both games from one process.

1. In GitHub Settings → Secrets and variables → Actions → Variables, set repository variable `CHICKEN_BACKEND` to `cloudflare`. Set `PUBLIC_CHICKEN_BACKEND_URL` to the Chicken Worker's HTTPS origin (for this site, `https://chicken-multiplayer.tiendu107.workers.dev`).
2. Under Settings → Environments, create `cloudflare-chicken`. Make the Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` available to this environment. Existing repository secrets are inherited. Secrets scoped to `cloudflare-number` must be supplied separately to `cloudflare-chicken`.
3. Push the patch to main or run **Chicken multiplayer backend** from Actions on main. Wrangler creates the Worker and SQLite Durable Object namespaces on the first deployment. Run **Deploy to GitHub Pages** again if the public URL was set after the Pages build.
4. Open Chicken, create a room, and join from two other browsers. The create request should go to the Chicken origin at `/chicken/rooms`. Invite links created with the former combined backend do not migrate.

For local Worker development, run `npx wrangler dev --config wrangler.chicken.jsonc --var ALLOWED_ORIGINS:http://localhost:4321` from this directory and point the frontend's Chicken URL at the local Worker.
