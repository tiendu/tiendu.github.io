import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const outputDirectory = fileURLToPath(new URL("../dist/", import.meta.url));

async function findHtmlRouteDirectories(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const matches = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const path = join(directory, entry.name);
    matches.push(...await findHtmlRouteDirectories(path));

    if (entry.name.endsWith(".html")) {
      matches.push(path);
    }
  }

  return matches;
}

for (const directory of await findHtmlRouteDirectories(outputDirectory)) {
  const indexFile = join(directory, "index.html");
  const html = await readFile(indexFile);

  await rm(directory, { recursive: true, force: true });
  await writeFile(directory, html);
}
