// Stable Node entry point and test import for NUMBER's standalone server.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { startServer } from '../../src/games/number/server/node-server.mjs';
export { startServer };
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const app = await startServer();
  console.log(`Number backend listening on ${JSON.stringify(app.server.address())}`);
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => app.close().then(() => process.exit(0)));
}
