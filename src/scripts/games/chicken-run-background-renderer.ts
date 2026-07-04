import {
  createBackgroundWorld,
  type BackgroundChunk,
  type BackgroundLandmark,
  type BackgroundSceneKind,
} from "./chicken-run-background";
import {
  rgbaCss,
  type ChickenWorldPalette,
} from "./chicken-run-sky";
import {
  drawBackgroundLandmark,
  drawBackgroundTree,
} from "./chicken-run-landmark-renderer";
import {
  terrainHeightAt,
  terrainSegmentAt,
  terrainSlopeAt,
} from "./chicken-run-terrain";
import type { RunWeatherState } from "./chicken-run-weather";

export interface ChickenBackgroundRenderScene {
  width: number;
  height: number;
  groundY: number;
  cameraOffsetY: number;
  distance: number;
  elapsed: number;
  nightFactor: number;
  weather: RunWeatherState;
}

const FAR_PARALLAX = 0.085;
const MIDDLE_PARALLAX = 0.23;

const backgroundWorld = createBackgroundWorld((worldX) => {
  const segment = terrainSegmentAt(worldX);
  return {
    kind: segment.kind,
    offset: terrainHeightAt(worldX, 0),
    slope: terrainSlopeAt(worldX, 0),
  };
});

function hashUnit(index: number, salt: number): number {
  const value = Math.sin((index + 1) * 27.17 + salt * 61.73) * 43758.5453;
  return value - Math.floor(value);
}

function drawLandscapeLayer(
  context: CanvasRenderingContext2D,
  scene: ChickenBackgroundRenderScene,
  palette: ChickenWorldPalette,
  layer: "far" | "middle",
): void {
  const parallax = layer === "far" ? FAR_PARALLAX : MIDDLE_PARALLAX;
  const baseY =
    scene.groundY -
    (layer === "far" ? 92 : 50) +
    scene.cameraOffsetY * (layer === "far" ? 0.12 : 0.25);
  const bottomY = scene.groundY + scene.cameraOffsetY * 0.22;
  const color = layer === "far" ? palette.distant : palette.middle;
  const alpha =
    (layer === "far" ? 0.31 : 0.37) -
    scene.nightFactor * (layer === "far" ? 0.1 : 0.12);
  const profileAt = layer === "far"
    ? backgroundWorld.farProfileAt
    : backgroundWorld.middleProfileAt;

  context.save();
  context.fillStyle = rgbaCss(color, Math.max(0.12, alpha));
  context.beginPath();
  context.moveTo(0, bottomY);
  for (let x = 0; x <= scene.width + 8; x += layer === "far" ? 8 : 6) {
    const worldX = scene.distance + x / parallax;
    const y = baseY + profileAt(worldX);
    if (x === 0) context.lineTo(x, y);
    else context.lineTo(x, y);
  }
  context.lineTo(scene.width, bottomY);
  context.closePath();
  context.fill();
  context.restore();
}

function middleLayerBaseY(
  scene: ChickenBackgroundRenderScene,
  worldX: number,
): number {
  return (
    scene.groundY -
    50 +
    scene.cameraOffsetY * 0.25 +
    backgroundWorld.middleProfileAt(worldX)
  );
}

function drawMiddleSceneDetails(
  context: CanvasRenderingContext2D,
  scene: ChickenBackgroundRenderScene,
  palette: ChickenWorldPalette,
): void {
  const cellSize = 360;
  const visibleStart = Math.max(0, scene.distance - 160 / MIDDLE_PARALLAX);
  const visibleEnd = scene.distance + (scene.width + 160) / MIDDLE_PARALLAX;
  const firstCell = Math.floor(visibleStart / cellSize) - 1;
  const lastCell = Math.ceil(visibleEnd / cellSize) + 1;

  context.save();
  for (let cell = firstCell; cell <= lastCell; cell += 1) {
    const worldX = cell * cellSize + hashUnit(cell, 7) * 120;
    const x = (worldX - scene.distance) * MIDDLE_PARALLAX;
    if (x < -120 || x > scene.width + 120) continue;
    const state = backgroundWorld.sceneAt(worldX);
    const baseY = middleLayerBaseY(scene, worldX);
    const alpha = Math.max(0.11, 0.31 - scene.nightFactor * 0.09);

    if (state.kind === "wooded-ridge") {
      context.fillStyle = rgbaCss(palette.middle, alpha + 0.09);
      drawBackgroundTree(context, x, baseY, 0.48 + hashUnit(cell, 11) * 0.16);
      if (hashUnit(cell, 13) < 0.66) {
        drawBackgroundTree(context, x + 22, baseY + 2, 0.38 + hashUnit(cell, 17) * 0.13);
      }
      continue;
    }

    if (state.kind === "wet-valley") {
      context.strokeStyle = rgbaCss(palette.middle, alpha);
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x - 26, baseY - 3);
      context.lineTo(x + 54, baseY - 3);
      context.stroke();
      context.fillStyle = rgbaCss(palette.grass, alpha + 0.04);
      for (let reed = 0; reed < 4; reed += 1) {
        const reedX = x - 12 + reed * 17;
        context.fillRect(reedX, baseY - 11 - (reed % 2) * 4, 2, 11 + (reed % 2) * 4);
      }
      continue;
    }

    if (state.kind === "farmstead") {
      context.fillStyle = rgbaCss(palette.middle, alpha);
      context.fillRect(x - 18, baseY - 18, 3, 18);
      context.fillRect(x + 34, baseY - 16, 3, 16);
      context.fillRect(x - 18, baseY - 13, 55, 2);
      context.fillRect(x - 18, baseY - 6, 55, 2);
      continue;
    }

    if (state.kind === "high-plateau") {
      context.fillStyle = rgbaCss(palette.grass, alpha);
      const bend = Math.round(scene.weather.wind * 2);
      context.fillRect(x + bend, baseY - 12, 2, 12);
      context.fillRect(x + 7 + bend, baseY - 17, 2, 17);
      context.fillRect(x + 14 + bend, baseY - 9, 2, 9);
      continue;
    }

    context.strokeStyle = rgbaCss(palette.middle, alpha * 0.82);
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x - 28, baseY - 7);
    context.lineTo(x + 46, baseY - 1);
    context.stroke();
  }
  context.restore();
}

function landmarkBaseY(
  scene: ChickenBackgroundRenderScene,
  landmark: BackgroundLandmark,
): number {
  const far = landmark.layer === "far";
  const profile = far
    ? backgroundWorld.farProfileAt(landmark.worldX)
    : backgroundWorld.middleProfileAt(landmark.worldX);
  return (
    scene.groundY -
    (far ? 92 : 50) +
    scene.cameraOffsetY * (far ? 0.12 : 0.25) +
    profile +
    3
  );
}

function drawLandmarks(
  context: CanvasRenderingContext2D,
  scene: ChickenBackgroundRenderScene,
  palette: ChickenWorldPalette,
  layer: "far" | "middle",
): void {
  const parallax = layer === "far" ? FAR_PARALLAX : MIDDLE_PARALLAX;
  const visibleEnd = scene.distance + (scene.width + 180) / parallax;
  const visibleStart = Math.max(0, scene.distance - 180 / parallax);
  const chunks = backgroundWorld.chunksInRange(visibleStart, visibleEnd);

  context.save();
  context.fillStyle = rgbaCss(
    layer === "far" ? palette.distant : palette.middle,
    Math.max(0.14, (layer === "far" ? 0.38 : 0.52) - scene.nightFactor * 0.13),
  );
  chunks.forEach((chunk) => {
    const landmark = chunk.landmark;
    if (!landmark || landmark.layer !== layer) return;
    const x = (landmark.worldX - scene.distance) * parallax;
    if (x < -180 || x > scene.width + 180) return;
    drawBackgroundLandmark(context, landmark, x, landmarkBaseY(scene, landmark));
  });
  context.restore();
}

function drawCropRows(
  context: CanvasRenderingContext2D,
  scene: ChickenBackgroundRenderScene,
  palette: ChickenWorldPalette,
): void {
  const first = Math.floor(scene.distance / 150) * 150;
  context.save();
  context.strokeStyle = rgbaCss(palette.middle, 0.18);
  context.lineWidth = 1;
  for (let worldX = first; worldX < scene.distance + scene.width + 180; worldX += 150) {
    const state = backgroundWorld.sceneAt(worldX);
    if (state.kind !== "open-field" && state.kind !== "farmstead") continue;
    const x = worldX - scene.distance;
    const ground = terrainHeightAt(worldX, scene.groundY) + scene.cameraOffsetY;
    context.beginPath();
    context.moveTo(x - 36, ground - 10);
    context.lineTo(x + 48, ground - 2);
    context.stroke();
  }
  context.restore();
}

function drawFenceSection(
  context: CanvasRenderingContext2D,
  x: number,
  ground: number,
  palette: ChickenWorldPalette,
  alpha: number,
): void {
  context.fillStyle = rgbaCss(palette.middle, alpha);
  context.fillRect(x, ground - 32, 4, 32);
  context.fillRect(x + 52, ground - 27, 4, 27);
  context.fillRect(x, ground - 22, 56, 3);
  context.fillRect(x, ground - 10, 56, 3);
}

function drawShrub(
  context: CanvasRenderingContext2D,
  x: number,
  ground: number,
  palette: ChickenWorldPalette,
  alpha: number,
  scale: number,
): void {
  context.fillStyle = rgbaCss(palette.grass, alpha);
  context.fillRect(x, ground - 8 * scale, 13 * scale, 8 * scale);
  context.fillRect(x + 4 * scale, ground - 13 * scale, 8 * scale, 9 * scale);
  context.fillRect(x + 11 * scale, ground - 6 * scale, 8 * scale, 6 * scale);
}

function drawReeds(
  context: CanvasRenderingContext2D,
  x: number,
  ground: number,
  palette: ChickenWorldPalette,
  alpha: number,
  bend: number,
): void {
  context.fillStyle = rgbaCss(palette.grass, alpha);
  context.fillRect(x + bend, ground - 12, 2, 12);
  context.fillRect(x + 5 + bend, ground - 17, 2, 17);
  context.fillRect(x + 10 + bend, ground - 9, 2, 9);
}

function drawNearScenery(
  context: CanvasRenderingContext2D,
  scene: ChickenBackgroundRenderScene,
  palette: ChickenWorldPalette,
): void {
  const cellSize = 92;
  const firstCell = Math.floor(scene.distance / cellSize) - 2;
  const lastCell = Math.ceil((scene.distance + scene.width) / cellSize) + 2;
  const bend = Math.round(scene.weather.wind * 3);
  drawCropRows(context, scene, palette);

  for (let cell = firstCell; cell <= lastCell; cell += 1) {
    const worldX = cell * cellSize;
    const x = worldX - scene.distance;
    const ground = terrainHeightAt(worldX, scene.groundY) + scene.cameraOffsetY;
    const state = backgroundWorld.sceneAt(worldX);
    const density = hashUnit(cell, 19);

    if (
      (state.kind === "open-field" ||
        state.kind === "farmstead" ||
        state.kind === "high-plateau") &&
      cell % 3 === 0
    ) {
      drawFenceSection(context, x, ground, palette, 0.22 - scene.nightFactor * 0.06);
    }

    if (state.kind === "wooded-ridge" && density < 0.72) {
      drawShrub(
        context,
        x + 10,
        ground,
        palette,
        0.35 - scene.nightFactor * 0.08,
        0.8 + hashUnit(cell, 23) * 0.45,
      );
    } else if (state.kind === "wet-valley" && density < 0.82) {
      drawReeds(
        context,
        x + 13,
        ground,
        palette,
        0.38 - scene.nightFactor * 0.08,
        bend,
      );
    } else if (density < 0.5) {
      drawReeds(
        context,
        x + 18,
        ground,
        palette,
        0.28 - scene.nightFactor * 0.07,
        bend,
      );
    }
  }
}

export function drawChickenCountryside(
  context: CanvasRenderingContext2D,
  scene: ChickenBackgroundRenderScene,
  palette: ChickenWorldPalette,
): void {
  drawLandscapeLayer(context, scene, palette, "far");
  drawLandmarks(context, scene, palette, "far");
  drawLandscapeLayer(context, scene, palette, "middle");
  drawMiddleSceneDetails(context, scene, palette);
  drawLandmarks(context, scene, palette, "middle");
  drawNearScenery(context, scene, palette);
}

export function backgroundSceneKindAt(worldX: number): BackgroundSceneKind {
  return backgroundWorld.sceneAt(worldX).kind;
}

export function visibleBackgroundChunks(
  startWorldX: number,
  endWorldX: number,
): readonly BackgroundChunk[] {
  return backgroundWorld.chunksInRange(startWorldX, endWorldX);
}
