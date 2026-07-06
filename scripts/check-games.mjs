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
  if (!component.includes("resume-picker"))
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
  "InvadersGame.astro",
  "BreakoutGame.astro",
  "LiftLoadGame.astro",
  "invaders.ts",
  "breakout.ts",
  "lift-load.ts",
  "lift-load-rules.ts",
  "lift-load-renderer.ts",
]) {
  if (componentNames.includes(retired) || scriptNames.includes(retired))
    failures.push(`retired game file still exists: ${retired}`);
}

const homePage = await readFile(
  new URL("../src/pages/index.astro", import.meta.url),
  "utf8",
);
const controller = await readFile(
  new URL("../src/scripts/games/arcade-controller.ts", import.meta.url),
  "utf8",
);
const craneRenderer = await readFile(
  new URL("../src/scripts/games/crane-renderer.ts", import.meta.url),
  "utf8",
);
const snakeRenderer = await readFile(
  new URL("../src/scripts/games/snake-renderer.ts", import.meta.url),
  "utf8",
);
const snakeComponent = await readFile(
  new URL("../src/components/games/SnakeGame.astro", import.meta.url),
  "utf8",
);
const snakeScript = await readFile(
  new URL("../src/scripts/games/snake.ts", import.meta.url),
  "utf8",
);
const craneComponent = await readFile(
  new URL("../src/components/games/CraneGame.astro", import.meta.url),
  "utf8",
);
const craneScript = await readFile(
  new URL("../src/scripts/games/crane.ts", import.meta.url),
  "utf8",
);
for (const name of ["SnakeGame", "CraneGame", "ChickenRunGame"]) {
  if (!homePage.includes(name))
    failures.push(`homepage does not render ${name}`);
}
if (
  homePage.includes("InvadersGame") ||
  homePage.includes("BreakoutGame") ||
  homePage.includes("LiftLoadGame")
)
  failures.push("homepage still renders a retired game");
for (const id of ["snake", "crane", "chicken"]) {
  if (!controller.includes(`id: "${id}"`))
    failures.push(`arcade controller does not register ${id}`);
}
if (!controller.includes('aliases: ["crane"'))
  failures.push("arcade controller does not expose the crane command");
if (
  craneRenderer.includes("drawDropGuide") ||
  craneRenderer.includes("setLineDash")
)
  failures.push("crane renderer still exposes a landing guide");
if (
  !snakeRenderer.includes("drawGlassSnakeSegment") ||
  !snakeRenderer.includes("drawGlassSnakeHead")
)
  failures.push("snake renderer does not use the transparent block snake design");
if (
  !snakeRenderer.includes("projectBoardPoint") ||
  snakeRenderer.includes("CameraState")
)
  failures.push("snake renderer is not using the fixed top-down 2.5D arena projection");
if (
  snakeRenderer.includes("sampleSnakeCenterline") ||
  snakeRenderer.includes("drawContinuousSnakeBody")
)
  failures.push("snake renderer still contains the expensive spline body renderer");
if (!snakeRenderer.includes("MAX_PIXEL_RATIO = 1.5"))
  failures.push("snake renderer does not cap high-DPI rendering for performance");
if (!snakeRenderer.includes("staticLayer") || !snakeRenderer.includes("obstacleLayer"))
  failures.push("snake renderer does not cache static arena layers");
if (!snakeRenderer.includes("drawArenaWalls") || !snakeRenderer.includes("drawSectorGate"))
  failures.push("snake renderer does not expose solid walls and the wall exit");
if (!snakeRenderer.includes("drawCollisionWarning"))
  failures.push("snake renderer does not show the exact imminent collision");
if (!snakeScript.includes("chooseSectorGate") || !snakeScript.includes("openSectorGate"))
  failures.push("snake sectors still advance without reaching a wall exit");
if (
  snakeComponent.includes("DRIVE") ||
  snakeComponent.includes("data-snake-overdrive") ||
  snakeScript.includes("startOverdrive") ||
  snakeScript.includes("overdriveActive")
)
  failures.push("snake still exposes the removed overdrive mechanic");
if (!craneComponent.includes("data-crane-confirm"))
  failures.push(
    "crane does not expose an in-game destructive-action confirmation",
  );
for (const label of ["PAUSE", "RESTART", "EXIT"]) {
  if (!craneComponent.includes(`>${label}</button>`))
    failures.push(`crane toolbar does not expose the ${label} label`);
}
if (!craneScript.includes("requestRestart"))
  failures.push("crane restart bypasses confirmation handling");
if (!craneScript.includes("requestNewRun"))
  failures.push(
    "crane new-run action bypasses saved-run confirmation handling",
  );
if (controller.includes(".observe(root, {"))
  failures.push(
    "arcade controller broadly observes a whole game subtree and can create mutation feedback loops",
  );
if (!controller.includes("button.textContent !== label"))
  failures.push("pause-button synchronization is not idempotent");

if (!controller.includes("dispatchGameCommand"))
  failures.push("arcade controller does not use typed game commands");
if (!controller.includes("statusEvent"))
  failures.push("arcade controller does not consume explicit game status events");
if (controller.includes("new KeyboardEvent"))
  failures.push("arcade controller still controls games through synthetic keyboard events");
if (homePage.includes("HOLD DRIVE") || controller.includes("SPACE DRIVE"))
  failures.push("retired Snake Drive instructions are still visible");
for (const [scriptName, eventName] of [
  ["snake.ts", "GAME_EVENTS.snake.status"],
  ["crane.ts", "GAME_EVENTS.crane.status"],
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
for (const [moduleName, mountName] of [
  ["./snake", "mountSnakeGames"],
  ["./crane", "mountCraneGames"],
  ["./chicken-run", "mountChickenRunGames"],
]) {
  if (!controller.includes(`import("${moduleName}")`))
    failures.push(`arcade controller does not lazy-load ${moduleName}`);
  if (!controller.includes(mountName))
    failures.push(`arcade controller does not mount ${moduleName}`);
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
