import { readFile, readdir } from "node:fs/promises";
const componentDirectory = new URL("../src/components/games/", import.meta.url);
const scriptDirectory = new URL("../src/scripts/games/", import.meta.url);

const expectedGames = [
  ["SnakeGame.astro", "snake.ts"],
  ["InvadersGame.astro", "invaders.ts"],
  ["BreakoutGame.astro", "breakout.ts"],
  ["ChickenRunGame.astro", "chicken-run.ts"],
];

const chickenModules = [
  "chicken-run-rules.ts",
  "chicken-run-course.ts",
  "chicken-run-effects.ts",
  "chicken-run-renderer.ts",
  "chicken-run-cycle.ts",
  "chicken-run-sky.ts",
];

const failures = [];
const componentNames = await readdir(componentDirectory);
const scriptNames = await readdir(scriptDirectory);

for (const moduleName of chickenModules) {
  if (!scriptNames.includes(moduleName)) {
    failures.push(`missing chicken game module: ${moduleName}`);
  }
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

  if (component.includes("<script is:inline")) {
    failures.push(`${componentName} contains inline game logic`);
  }
  if (!component.includes("mount") || !component.includes("scripts/games")) {
    failures.push(`${componentName} does not mount its external game module`);
  }
  if (component.split("\n").length > 180) {
    failures.push(`${componentName} is too large for a markup-only component`);
  }
  if (script.includes("@ts-nocheck")) {
    failures.push(`${scriptName} disables TypeScript checking`);
  }
}

const homePage = await readFile(
  new URL("../src/pages/index.astro", import.meta.url),
  "utf8",
);
const controller = await readFile(
  new URL("../src/scripts/games/arcade-controller.ts", import.meta.url),
  "utf8",
);

if (!homePage.includes("ChickenRunGame")) {
  failures.push("homepage does not render ChickenRunGame");
}
if (!controller.includes('id: "chicken"')) {
  failures.push("arcade controller does not register the chicken game");
}
if (!controller.includes('aliases: ["chicken"')) {
  failures.push("arcade controller does not expose the chicken command");
}

if (failures.length > 0) {
  console.error("Game architecture check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    `Game architecture OK: ${expectedGames.length} markup components, external typed logic, shared controller.`,
  );
}
