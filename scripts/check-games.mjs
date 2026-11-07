import { readFile, readdir } from "node:fs/promises";

const componentDirectory = new URL("../src/components/games/", import.meta.url);
const scriptDirectory = new URL("../src/scripts/games/", import.meta.url);

const expectedGames = [
  ["ChickenRunGame.astro", "chicken-run.ts"],
];

const requiredModules = [
  "chicken-run-rules.ts",
  "chicken-run-course.ts",
  "chicken-run-effects.ts",
  "chicken-run-renderer.ts",
  "chicken-run-cycle.ts",
  "chicken-run-sky.ts",
  "chicken-run-terrain.ts",
  "chicken-run-weather.ts",
  "chicken-run-environment-renderer.ts",
  "chicken-run-background.ts",
  "chicken-run-background-renderer.ts",
  "chicken-run-landmark-renderer.ts",
];

const failures = [];
const componentNames = await readdir(componentDirectory);
const scriptNames = await readdir(scriptDirectory);

for (const moduleName of requiredModules) {
  if (!scriptNames.includes(moduleName))
    failures.push(`missing game module: ${moduleName}`);
}

for (const [componentName, scriptName] of expectedGames) {
  if (!componentNames.includes(componentName)) {
    failures.push(`missing game component: ${componentName}`);
    continue;
  }
  if (!scriptNames.includes(scriptName)) {
    failures.push(`missing game script: ${scriptName}`);
    continue;
  }

  const component = await readFile(
    new URL(`../src/components/games/${componentName}`, import.meta.url),
    "utf8",
  );
  const script = await readFile(
    new URL(`../src/scripts/games/${scriptName}`, import.meta.url),
    "utf8",
  );
  if (component.includes("<script"))
    failures.push(`${componentName} eagerly loads game JavaScript`);
  if (component.split("\n").length > 180)
    failures.push(`${componentName} is too large for a markup-only component`);
  if (script.includes("@ts-nocheck"))
    failures.push(`${scriptName} disables TypeScript checking`);
  if (!component.includes("<ResumePicker "))
    failures.push(
      `${componentName} does not expose an in-game Continue / New Run prompt`,
    );
  if (!script.includes("readStoredSession"))
    failures.push(`${scriptName} does not restore saved sessions`);
  if (!script.includes("writeStoredSession"))
    failures.push(`${scriptName} does not persist saved sessions`);
  if (!script.includes("SESSION_VERSION"))
    failures.push(`${scriptName} does not version its save format`);
}

for (const retired of [
  "SnakeGame.astro", "CraneGame.astro", "snake.ts", "crane.ts",
  "InvadersGame.astro",
  "BreakoutGame.astro",
  "LiftLoadGame.astro",
  "invaders.ts",
  "breakout.ts",
  "lift-load.ts",
  "lift-load-rules.ts",
  "lift-load-renderer.ts",
  "SudokuGame.astro",
  "sudoku.ts",
  "sudoku-generator.ts",
  "sudoku-rules.ts",
]) {
  if (componentNames.includes(retired) || scriptNames.includes(retired))
    failures.push(`retired game file still exists: ${retired}`);
}

const homePage = await readFile(
  new URL("../src/pages/index.astro", import.meta.url),
  "utf8",
);
for (const [scriptName, eventName] of [
  ["chicken-run.ts", "GAME_EVENTS.chicken.status"],
]) {
  const script = await readFile(
    new URL(`../src/scripts/games/${scriptName}`, import.meta.url),
    "utf8",
  );
  if (!script.includes(eventName))
    failures.push(`${scriptName} does not publish explicit game status`);
  if (!script.includes("readGameCommand"))
    failures.push(`${scriptName} does not consume typed game commands`);
}
for (const [slug, component, mount] of [
  ["chicken", "ChickenRunGame", "mountChickenRunGames"],
  ["mines", "MinesGame", "mountMines"],
  ["number", "NumberGame", "mountNumberGames"],
]) {
  const page = await readFile(new URL(`../src/pages/games/${slug}.astro`, import.meta.url), "utf8");
  if (!page.includes(`<${component} />`) || !page.includes(`${mount}()`))
    failures.push(`/games/${slug}/ must render and mount its game`);
  if (homePage.includes(`href="/games/${slug}/"`))
    failures.push(`homepage unexpectedly shows the ${slug} game link`);
}

if (failures.length > 0) {
  console.error("Game architecture check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    `Game architecture OK: ${expectedGames.length} games, typed external logic, retired games removed.`,
  );
}
