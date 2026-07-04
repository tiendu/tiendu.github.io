import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

async function importTypeScript(relativePath) {
  const sourceUrl = new URL(relativePath, import.meta.url);
  const source = await readFile(sourceUrl, "utf8");
  const { outputText, diagnostics } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      strict: true,
    },
    reportDiagnostics: true,
  });

  if (diagnostics?.length) {
    diagnostics.forEach((diagnostic) => {
      console.error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
    });
    process.exit(1);
  }

  const encoded = Buffer.from(outputText).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

const rules = await importTypeScript(
  "../src/scripts/games/chicken-run-rules.ts",
);
const cycle = await importTypeScript(
  "../src/scripts/games/chicken-run-cycle.ts",
);
const sky = await importTypeScript(
  "../src/scripts/games/chicken-run-sky.ts",
);

assert.equal(rules.speedForScore(0), 220);
assert.equal(rules.speedForScore(179), 220);
assert.equal(rules.speedForScore(180), 238);
assert.equal(rules.speedForScore(-50), 220);
assert.equal(rules.speedForScore(100_000), 430);
assert.equal(rules.speedLevelForScore(0), 1);
assert.equal(rules.speedLevelForScore(100_000), 12);
assert.equal(rules.speedLevelForVelocity(220), 1);
assert.equal(rules.speedLevelForVelocity(545), 19);

assert.equal(rules.minimumObstacleGap(0), 250);
assert.equal(rules.minimumObstacleGap(220), 250);
assert.equal(rules.minimumObstacleGap(430), 395.6);
assert.equal(rules.obstacleSpacing(220, -1), 310);
assert.equal(rules.obstacleSpacing(220, 0), 310);
assert.equal(rules.obstacleSpacing(220, 1), 490);
assert.equal(rules.obstacleSpacing(220, 2), 490);

const earlyPatterns = rules.availablePatternsForScore(0);
assert.deepEqual(
  earlyPatterns.map((pattern) => pattern.id),
  ["single-hay", "single-fence"],
);
assert.equal(
  rules.availablePatternsForScore(120).some((pattern) => pattern.id === "single-mud"),
  true,
);
assert.equal(
  rules.availablePatternsForScore(859).some((pattern) => pattern.id === "hay-trio"),
  false,
);
assert.equal(
  rules.availablePatternsForScore(860).some((pattern) => pattern.id === "hay-trio"),
  true,
);
assert.equal(rules.selectPatternForScore(0, 0).id, "single-hay");
assert.equal(rules.selectPatternForScore(0, 1).id, "single-fence");

const hayPair = rules.RUN_PATTERNS.find((pattern) => pattern.id === "hay-pair");
assert.ok(hayPair);
assert.equal(rules.patternSpan(hayPair), 184);
assert.equal(rules.patternTravelDistance(220, hayPair, 0), 514);
assert.equal(rules.patternTravelDistance(220, hayPair, 1), 624);
assert.ok(
  rules.patternTravelDistance(430, hayPair, 0) >
    rules.patternTravelDistance(220, hayPair, 0),
);

assert.deepEqual(
  rules.jumpControlForState({
    gameOver: true,
    crashing: true,
    paused: false,
    started: false,
    grounded: false,
    flapAvailable: false,
  }),
  { label: "RETRY", disabled: false, ariaLabel: "Restart Free Range" },
);
assert.equal(
  rules.jumpControlForState({
    gameOver: false,
    crashing: false,
    paused: false,
    started: true,
    grounded: false,
    flapAvailable: true,
  }).label,
  "FLAP",
);
assert.equal(
  rules.jumpControlForState({
    gameOver: false,
    crashing: false,
    paused: false,
    started: true,
    grounded: false,
    flapAvailable: false,
  }).disabled,
  true,
);

assert.equal(
  rules.chooseJumpAction({
    grounded: true,
    millisecondsSinceGrounded: 999,
    flapAvailable: false,
  }),
  "jump",
);
assert.equal(
  rules.chooseJumpAction({
    grounded: false,
    millisecondsSinceGrounded: rules.COYOTE_TIME_MS,
    flapAvailable: false,
  }),
  "jump",
);
assert.equal(
  rules.chooseJumpAction({
    grounded: false,
    millisecondsSinceGrounded: rules.COYOTE_TIME_MS + 1,
    flapAvailable: true,
  }),
  "flap",
);
assert.equal(
  rules.chooseJumpAction({
    grounded: false,
    millisecondsSinceGrounded: rules.COYOTE_TIME_MS + 1,
    flapAvailable: false,
  }),
  null,
);

const start = cycle.cycleStateForElapsed(0);
assert.equal(start.phase, "day");
assert.equal(start.cycleIndex, 0);
assert.equal(start.speedMultiplier, 1);
assert.equal(start.nightFactor, 0);

const sunset = cycle.cycleStateForElapsed(23);
assert.equal(sunset.phase, "sunset");
assert.ok(sunset.nightFactor > 0);
assert.ok(sunset.speedMultiplier > 1);

const night = cycle.cycleStateForElapsed(28);
assert.equal(night.phase, "night");
assert.equal(night.nightFactor, 1);
assert.ok(night.speedMultiplier >= 1.18);

const dawn = cycle.cycleStateForElapsed(45);
assert.equal(dawn.phase, "dawn");
assert.ok(dawn.nightFactor <= 1);

const secondCycle = cycle.cycleStateForElapsed(
  cycle.cycleDurationForIndex(0) + 0.1,
);
assert.equal(secondCycle.phase, "day");
assert.equal(secondCycle.cycleIndex, 1);
assert.ok(cycle.nightDurationForCycle(2) > cycle.nightDurationForCycle(0));
assert.ok(cycle.foxStartingPressure(4) > cycle.foxStartingPressure(0));
assert.ok(cycle.foxApproachPerSecond(4) > cycle.foxApproachPerSecond(0));
assert.equal(cycle.foxXForPressure(0), -58);
assert.equal(cycle.foxXForPressure(1), 52);

const dayPalette = sky.paletteForCycle(start);
const nightPalette = sky.paletteForCycle(night);
assert.ok(
  sky.relativeLuminance(dayPalette.sky) >
    sky.relativeLuminance(nightPalette.sky) + 0.55,
);
const chickenPalette = sky.CHICKEN_SPRITE_PALETTE;
assert.ok(sky.relativeLuminance(chickenPalette.body) > 0.82);
assert.ok(sky.relativeLuminance(chickenPalette.outline) < 0.09);
assert.ok(
  sky.relativeLuminance(chickenPalette.body) -
    sky.relativeLuminance(chickenPalette.outline) >
    0.75,
);
assert.ok(
  Math.abs(
    sky.relativeLuminance(chickenPalette.body) -
      sky.relativeLuminance(dayPalette.sky),
  ) < 0.2,
);
assert.equal(sky.sunVisual(start, 640, 264).alpha, 1);
assert.equal(sky.moonVisual(start, 640, 264).alpha, 0);
assert.equal(sky.sunVisual(night, 640, 264).alpha, 0);
assert.equal(sky.moonVisual(night, 640, 264).alpha, 1);
assert.ok(sky.cloudOpacityForCycle(start) > sky.cloudOpacityForCycle(night));
assert.ok(sky.sunVisual(sunset, 640, 264).x > 500);
assert.ok(sky.moonVisual(dawn, 640, 264).alpha < 1);

const eggWindow = cycle.cycleStateForElapsed(14);
assert.equal(
  cycle.shouldOfferEgg({
    state: eggWindow,
    hasEgg: false,
    activeEgg: false,
    offeredCycle: -1,
  }),
  true,
);
assert.equal(
  cycle.shouldOfferEgg({
    state: eggWindow,
    hasEgg: true,
    activeEgg: false,
    offeredCycle: -1,
  }),
  false,
);
assert.equal(
  cycle.shouldOfferEgg({
    state: eggWindow,
    hasEgg: false,
    activeEgg: false,
    offeredCycle: eggWindow.cycleIndex,
  }),
  false,
);

console.log(
  "Game rules OK: movement, course patterns, egg reserve, day/night pacing, fox pressure, phase palettes, and the fixed chicken sprite palette.",
);
