import { readFile, readdir } from "node:fs/promises";

const componentDirectory = new URL("../src/components/games/", import.meta.url);
const scriptDirectory = new URL("../src/scripts/games/", import.meta.url);

const expectedGames = [
  ["SnakeGame.astro", "snake.ts"],
  ["CraneGame.astro", "crane.ts"],
  ["ChickenRunGame.astro", "chicken-run.ts"],
];

const requiredModules = [
  "snake-rules.ts",
  "snake-renderer.ts",
  "crane-rules.ts",
  "crane-renderer.ts",
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
  if (!scriptNames.includes(moduleName)) failures.push(`missing game module: ${moduleName}`);
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

  const component = await readFile(new URL(`../src/components/games/${componentName}`, import.meta.url), "utf8");
  const script = await readFile(new URL(`../src/scripts/games/${scriptName}`, import.meta.url), "utf8");
  if (component.includes("<script")) failures.push(`${componentName} eagerly loads game JavaScript`);
  if (component.split("\n").length > 180) failures.push(`${componentName} is too large for a markup-only component`);
  if (script.includes("@ts-nocheck")) failures.push(`${scriptName} disables TypeScript checking`);
  if (!component.includes("resume-picker")) failures.push(`${componentName} does not expose an in-game Continue / New Run prompt`);
  if (!script.includes("readStoredSession")) failures.push(`${scriptName} does not restore saved sessions`);
  if (!script.includes("writeStoredSession")) failures.push(`${scriptName} does not persist saved sessions`);
  if (!script.includes("SESSION_VERSION")) failures.push(`${scriptName} does not version its save format`);
}

for (const retired of [
  "InvadersGame.astro",
  "BreakoutGame.astro",
  "LiftLoadGame.astro",
  "invaders.ts",
  "breakout.ts",
  "lift-load.ts",
  "lift-load-rules.ts",
  "lift-load-renderer.ts",
]) {
  if (componentNames.includes(retired) || scriptNames.includes(retired)) failures.push(`retired game file still exists: ${retired}`);
}

const homePage = await readFile(new URL("../src/pages/index.astro", import.meta.url), "utf8");
const controller = await readFile(new URL("../src/scripts/games/arcade-controller.ts", import.meta.url), "utf8");
const craneRenderer = await readFile(new URL("../src/scripts/games/crane-renderer.ts", import.meta.url), "utf8");
for (const name of ["SnakeGame", "CraneGame", "ChickenRunGame"]) {
  if (!homePage.includes(name)) failures.push(`homepage does not render ${name}`);
}
if (homePage.includes("InvadersGame") || homePage.includes("BreakoutGame") || homePage.includes("LiftLoadGame")) failures.push("homepage still renders a retired game");
for (const id of ["snake", "crane", "chicken"]) {
  if (!controller.includes(`id: "${id}"`)) failures.push(`arcade controller does not register ${id}`);
}
if (!controller.includes('aliases: ["crane"')) failures.push("arcade controller does not expose the crane command");
if (craneRenderer.includes("drawDropGuide") || craneRenderer.includes("setLineDash")) failures.push("crane renderer still exposes a landing guide");
if (controller.includes(".observe(root, {")) failures.push("arcade controller broadly observes a whole game subtree and can create mutation feedback loops");
if (!controller.includes("button.textContent !== label")) failures.push("pause-button synchronization is not idempotent");
for (const [moduleName, mountName] of [
  ["./snake", "mountSnakeGames"],
  ["./crane", "mountCraneGames"],
  ["./chicken-run", "mountChickenRunGames"],
]) {
  if (!controller.includes(`import("${moduleName}")`)) failures.push(`arcade controller does not lazy-load ${moduleName}`);
  if (!controller.includes(mountName)) failures.push(`arcade controller does not mount ${moduleName}`);
}

if (failures.length > 0) {
  console.error("Game architecture check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Game architecture OK: ${expectedGames.length} games, typed external logic, retired games removed.`);
}
