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
const terrain = await importTypeScript(
  "../src/scripts/games/chicken-run-terrain.ts",
);
const weather = await importTypeScript(
  "../src/scripts/games/chicken-run-weather.ts",
);
const background = await importTypeScript(
  "../src/scripts/games/chicken-run-background.ts",
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
  rules.availablePatternsForScore(180).some((pattern) => pattern.id === "single-log"),
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



const terrainBaseline = 264;
assert.equal(terrain.terrainHeightAt(0, terrainBaseline), terrainBaseline);
assert.equal(terrain.terrainSegmentAt(450).kind, "flat");

const terrainSamples = Array.from({ length: 401 }, (_, index) =>
  terrain.terrainHeightAt(index * 50, terrainBaseline),
);
assert.ok(Math.max(...terrainSamples) <= terrainBaseline + 25);
assert.ok(Math.min(...terrainSamples) >= terrainBaseline - 25);

const terrainSlopes = Array.from({ length: 401 }, (_, index) =>
  terrain.terrainSlopeAt(index * 50, terrainBaseline),
);
assert.ok(terrainSlopes.some((slope) => slope > 0.025));
assert.ok(terrainSlopes.some((slope) => slope < -0.025));
assert.ok(Math.max(...terrainSlopes.map(Math.abs)) < 0.055);

const terrainSegments = new Map();
for (let worldX = 0; worldX <= 20_000; worldX += 100) {
  const segment = terrain.terrainSegmentAt(worldX);
  terrainSegments.set(`${segment.startX}:${segment.endX}`, segment);
}
const sampledSegments = [...terrainSegments.values()];
assert.ok(sampledSegments.some((segment) => segment.kind === "plateau"));
assert.ok(sampledSegments.some((segment) => segment.kind === "uphill"));
assert.ok(sampledSegments.some((segment) => segment.kind === "downhill"));
assert.ok(
  sampledSegments
    .filter((segment) => segment.kind === "uphill" || segment.kind === "downhill")
    .every((segment) => segment.endX - segment.startX >= 800),
);
assert.ok(
  sampledSegments
    .filter((segment) => segment.kind === "flat" || segment.kind === "plateau")
    .every((segment) => segment.endX - segment.startX >= 320),
);

let terrainDirectionChanges = 0;
let previousDirection = 0;
for (const slope of terrainSlopes) {
  const direction = slope > 0.002 ? 1 : slope < -0.002 ? -1 : 0;
  if (direction !== 0 && previousDirection !== 0 && direction !== previousDirection) {
    terrainDirectionChanges += 1;
  }
  if (direction !== 0) previousDirection = direction;
}
assert.ok(terrainDirectionChanges <= 12);

assert.ok(terrain.terrainSpeedMultiplier(0.06) > 1);
assert.ok(terrain.terrainSpeedMultiplier(-0.06) < 1);
assert.equal(terrain.environmentSpeedMultiplier(1.2, 1.2), 1.1);
assert.equal(terrain.environmentSpeedMultiplier(0.8, 0.8), 0.9);

const safeTerrainStart = terrain.findSafeTerrainStart({
  requestedWorldX: 500,
  span: 132,
  baselineY: terrainBaseline,
  maxSlope: 0.08,
  maxHeightChange: 12,
});
assert.ok(safeTerrainStart >= 500);
assert.ok(
  Math.abs(terrain.terrainSlopeAt(safeTerrainStart, terrainBaseline)) <= 0.081,
);


const backgroundTerrainAt = (worldX) => {
  const zone = Math.floor(worldX / 5_000) % 5;
  if (zone === 0) return { kind: "flat", offset: 0, slope: 0 };
  if (zone === 1) return { kind: "uphill", offset: -12, slope: -0.025 };
  if (zone === 2) return { kind: "plateau", offset: -18, slope: 0 };
  if (zone === 3) return { kind: "downhill", offset: 8, slope: 0.024 };
  return { kind: "valley", offset: 18, slope: 0 };
};
const backgroundWorld = background.createBackgroundWorld(backgroundTerrainAt);
const backgroundChunks = backgroundWorld.chunksInRange(0, 60_000);
assert.ok(backgroundChunks.length >= 20);
assert.ok(
  backgroundChunks.every(
    (chunk) => chunk.endX - chunk.startX >= 1_800 && chunk.endX - chunk.startX <= 3_300,
  ),
);
assert.ok(
  backgroundChunks.every(
    (chunk) => chunk.transitionLength >= 400 && chunk.transitionLength <= 700,
  ),
);
for (let index = 1; index < backgroundChunks.length; index += 1) {
  assert.notEqual(backgroundChunks[index].kind, backgroundChunks[index - 1].kind);
}
const backgroundKinds = new Set(backgroundChunks.map((chunk) => chunk.kind));
assert.ok(backgroundKinds.has("open-field"));
assert.ok(backgroundKinds.has("farmstead"));
assert.ok(backgroundKinds.has("wooded-ridge"));
assert.ok(backgroundKinds.has("high-plateau"));
assert.ok(backgroundKinds.has("wet-valley"));
assert.ok(
  backgroundChunks
    .filter((chunk) => chunk.landmark)
    .every(
      (chunk) =>
        chunk.landmark.worldX > chunk.startX &&
        chunk.landmark.worldX < chunk.endX,
    ),
);
const transitionChunk = backgroundChunks[1];
assert.ok(transitionChunk);
const transitionStart = backgroundWorld.sceneAt(transitionChunk.startX + 1);
const transitionEnd = backgroundWorld.sceneAt(
  transitionChunk.startX + transitionChunk.transitionLength + 1,
);
assert.ok(transitionStart.blend < 0.01);
assert.equal(transitionEnd.blend, 1);
const farProfileSamples = Array.from({ length: 80 }, (_, index) =>
  backgroundWorld.farProfileAt(index * 700),
);
const middleProfileSamples = Array.from({ length: 80 }, (_, index) =>
  backgroundWorld.middleProfileAt(index * 350),
);
assert.ok(Math.max(...farProfileSamples) - Math.min(...farProfileSamples) > 20);
assert.ok(Math.max(...middleProfileSamples) - Math.min(...middleProfileSamples) > 12);

const weatherDurations = weather.weatherDurationsForCycle(0);
const clearWeather = weather.weatherStateForElapsed(0);
const cloudyWeather = weather.weatherStateForElapsed(weatherDurations.clear + 0.5);
const rainWeather = weather.weatherStateForElapsed(
  weatherDurations.clear + weatherDurations.cloudy + weatherDurations.rain * 0.5,
);
const clearingWeather = weather.weatherStateForElapsed(
  weatherDurations.clear +
    weatherDurations.cloudy +
    weatherDurations.rain +
    weatherDurations.clearing * 0.5,
);
assert.equal(clearWeather.phase, "clear");
assert.equal(cloudyWeather.phase, "cloudy");
assert.equal(rainWeather.phase, "rain");
assert.equal(clearingWeather.phase, "clearing");
assert.ok(rainWeather.rainIntensity > 0.9);
assert.ok(rainWeather.cloudFactor >= cloudyWeather.cloudFactor);
assert.ok(weather.courseGapMultiplierForWeather(rainWeather) > 1.08);
assert.ok(
  weather.mudPatternWeightMultiplier(rainWeather) >
    weather.mudPatternWeightMultiplier(clearWeather),
);
assert.ok(
  weather.logPatternWeightMultiplier(rainWeather) >
    weather.logPatternWeightMultiplier(clearWeather),
);
assert.ok(weather.foxWeatherMultiplier(rainWeather) < 1);
assert.equal(cycle.cycleStateForElapsed(21).phase, "day");
assert.equal(weather.weatherStateForElapsed(21).phase, "rain");
assert.equal(cycle.cycleStateForElapsed(30).phase, "night");
assert.equal(weather.weatherStateForElapsed(30).phase, "rain");
assert.ok(clearWeather.speedMultiplier >= 0.94);
assert.ok(clearWeather.speedMultiplier <= 1.055);

const rainyDayPalette = sky.paletteForEnvironment(start, rainWeather);
assert.ok(
  sky.relativeLuminance(rainyDayPalette.sky) <
    sky.relativeLuminance(dayPalette.sky),
);

console.log(
  "Game rules OK: movement, weather, long terrain, terrain-aware background scenes, course patterns, egg reserve, day/night pacing, fox pressure, and fixed sprite contrast.",
);
