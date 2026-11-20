import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceRoot = join(projectRoot, "src");
const stylesRoot = join(sourceRoot, "styles");
const maxStylesheetLines = 500;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }

  return files;
}

function localCssImports(source) {
  const imports = new Set();
  const patterns = [
    /\bimport\s+["']([^"']+\.css)["']/g,
    /@import\s+(?:url\()?\s*["']([^"']+\.css)["']/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1].startsWith(".")) imports.add(match[1]);
    }
  }

  return [...imports];
}

const sourceFiles = await walk(sourceRoot);
const astroFiles = sourceFiles.filter((path) => extname(path) === ".astro");
const cssFiles = sourceFiles.filter((path) => extname(path) === ".css");
const failures = [];

for (const path of astroFiles) {
  const source = await readFile(path, "utf8");
  const displayPath = relative(projectRoot, path);

  if (/<style(?:\s|>)/i.test(source)) {
    failures.push(`${displayPath}: embedded <style> block; move it under src/styles`);
  }

  if (/\sstyle\s*=/i.test(source)) {
    failures.push(`${displayPath}: inline style attribute; use a named CSS class`);
  }
}

const reachable = new Set();
const queue = [];

for (const path of sourceFiles.filter((path) => extname(path) !== ".css")) {
  const source = await readFile(path, "utf8");
  for (const specifier of localCssImports(source)) {
    queue.push(resolve(dirname(path), specifier));
  }
}

while (queue.length > 0) {
  const path = queue.shift();
  if (reachable.has(path)) continue;

  try {
    if (!(await stat(path)).isFile()) throw new Error("not a file");
  } catch {
    failures.push(`Missing stylesheet import: ${relative(projectRoot, path)}`);
    continue;
  }

  reachable.add(path);
  const source = await readFile(path, "utf8");

  if (source.includes(":global(")) {
    failures.push(
      `${relative(projectRoot, path)}: Astro :global() syntax is invalid in external CSS`,
    );
  }

  const lineCount = source.split("\n").length;
  if (lineCount > maxStylesheetLines) {
    failures.push(
      `${relative(projectRoot, path)}: ${lineCount} lines; split files above ${maxStylesheetLines} lines`,
    );
  }

  for (const specifier of localCssImports(source)) {
    queue.push(resolve(dirname(path), specifier));
  }
}

for (const path of cssFiles) {
  if (!path.startsWith(stylesRoot)) continue;
  if (!reachable.has(path)) {
    failures.push(`Orphan stylesheet: ${relative(projectRoot, path)}`);
  }
}

if (failures.length > 0) {
  console.error("Style architecture check failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Style architecture OK: ${cssFiles.length} stylesheets, ${astroFiles.length} Astro files, no embedded or orphaned CSS.`,
  );
}
