import type { RunCycleState } from "./chicken-run-cycle";
import { drawChickenEnvironment } from "./chicken-run-environment-renderer";
import type { CrashKind, ObstacleKind } from "./chicken-run-rules";
import {
  CHICKEN_SPRITE_PALETTE,
  rgbCss,
  rgbaCss,
  type ChickenWorldPalette,
} from "./chicken-run-sky";
import { terrainHeightAt } from "./chicken-run-terrain";
import type { RunWeatherState } from "./chicken-run-weather";

export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point {
  width: number;
  height: number;
}

export interface ChickenObstacle extends Rect {
  kind: ObstacleKind;
  worldX: number;
  slope: number;
  passed: boolean;
}

export interface CornKernel extends Point {
  worldX: number;
  heightAboveGround: number;
  groupId: number;
  collected: boolean;
  phase: number;
}

export interface EggPickup extends Point {
  worldX: number;
  heightAboveGround: number;
  phase: number;
}

export interface Feather extends Point {
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  age: number;
  lifetime: number;
  size: number;
  gravity: number;
  drag: number;
  color: string;
  shape: "feather" | "shell";
}

export interface ScoreBurst extends Point {
  text: string;
  age: number;
  lifetime: number;
}

export interface RunNotice {
  text: string;
  age: number;
  lifetime: number;
}

export interface CrashVisual {
  kind: CrashKind;
  elapsed: number;
  x: number;
  y: number;
  rotation: number;
  sink: number;
}

export interface ChickenVisual {
  x: number;
  y: number;
  velocityY: number;
  grounded: boolean;
  flapAvailable: boolean;
  runFrame: number;
  takeoffPulse: number;
  flapPulse: number;
  landingPulse: number;
  rescuePulse: number;
  invulnerable: boolean;
  eggCarried: boolean;
  slope: number;
  crash: CrashVisual | null;
}

export interface FoxVisual {
  visible: boolean;
  x: number;
  pressure: number;
  runFrame: number;
}

export interface ChickenRunScene {
  width: number;
  height: number;
  groundY: number;
  cameraOffsetY: number;
  distance: number;
  elapsed: number;
  obstacles: readonly ChickenObstacle[];
  corn: readonly CornKernel[];
  egg: EggPickup | null;
  feathers: readonly Feather[];
  scoreBursts: readonly ScoreBurst[];
  notice: RunNotice | null;
  cycle: RunCycleState;
  weather: RunWeatherState;
  fox: FoxVisual;
  chicken: ChickenVisual;
}

function drawObstacle(
  context: CanvasRenderingContext2D,
  obstacle: ChickenObstacle,
  nightFactor: number,
  palette: ChickenWorldPalette,
): void {
  const x = Math.round(obstacle.x);
  const y = Math.round(obstacle.y);
  const glow = nightFactor > 0.35;

  context.save();
  if (glow) {
    context.shadowColor = rgbaCss(palette.obstacleHighlight, 0.35);
    context.shadowBlur = 5;
  }

  if (obstacle.kind === "fence") {
    context.fillStyle = rgbCss(palette.obstaclePrimary);
    context.fillRect(x + 5, y, 6, obstacle.height);
    context.fillRect(x + 23, y, 6, obstacle.height);
    context.fillRect(x, y + 14, obstacle.width, 7);
    context.fillRect(x, y + 39, obstacle.width, 7);
    context.fillStyle = rgbaCss(palette.obstacleHighlight, 0.32);
    context.fillRect(x + 7, y + 3, 2, obstacle.height - 7);
    context.restore();
    return;
  }

  if (obstacle.kind === "hay") {
    context.fillStyle = rgbCss(palette.obstacleSecondary);
    context.fillRect(x, y, obstacle.width, obstacle.height);
    context.fillStyle = rgbCss(palette.obstaclePrimary);
    context.fillRect(x + 4, y + 7, obstacle.width - 8, 3);
    context.fillRect(x + 4, y + 26, obstacle.width - 8, 3);
    context.fillRect(x + 18, y, 3, obstacle.height);
    context.fillRect(x + 42, y, 3, obstacle.height);
    context.fillStyle = rgbaCss(palette.obstacleHighlight, 0.35);
    context.fillRect(x + 3, y + 3, obstacle.width - 6, 2);
    context.restore();
    return;
  }

  if (obstacle.kind === "log") {
    context.translate(x + obstacle.width / 2, y + obstacle.height / 2);
    context.rotate(Math.atan(obstacle.slope));
    context.translate(-obstacle.width / 2, -obstacle.height / 2);
    context.fillStyle = rgbCss(palette.obstaclePrimary);
    context.fillRect(3, 5, obstacle.width - 6, obstacle.height - 8);
    context.fillRect(10, 1, obstacle.width - 20, obstacle.height - 2);
    context.fillStyle = rgbCss(palette.obstacleSecondary);
    context.fillRect(8, 7, obstacle.width - 16, 3);
    context.fillRect(15, 15, obstacle.width - 30, 2);
    context.fillStyle = rgbaCss(palette.obstacleHighlight, 0.45);
    context.fillRect(11, 3, obstacle.width - 24, 2);
    context.fillStyle = rgbCss(palette.obstacleSecondary);
    context.fillRect(0, 8, 10, 8);
    context.fillRect(obstacle.width - 10, 8, 10, 8);
    context.restore();
    return;
  }

  context.fillStyle = rgbaCss(palette.mud, 0.88);
  context.fillRect(x, y, obstacle.width, obstacle.height);
  context.fillStyle = rgbaCss(palette.mudDetail, 0.68);
  for (let index = 8; index < obstacle.width - 6; index += 19) {
    context.fillRect(x + index, y + 2, 10, 2);
    context.fillRect(x + index + 5, y + 6, 8, 2);
  }
  context.fillStyle = rgbaCss(palette.mudHighlight, 0.34);
  context.fillRect(x + 8, y + 1, obstacle.width - 19, 1);
  context.restore();
}

function drawCorn(
  context: CanvasRenderingContext2D,
  kernel: CornKernel,
  elapsed: number,
  nightFactor: number,
  palette: ChickenWorldPalette,
): void {
  if (kernel.collected) return;
  const x = Math.round(kernel.x);
  const y = Math.round(kernel.y + Math.sin(elapsed * 4.2 + kernel.phase) * 1.6);

  context.save();
  context.shadowColor = rgbaCss(palette.corn, 0.65);
  context.shadowBlur = 7 + nightFactor * 5;
  context.fillStyle = rgbCss(palette.corn);
  context.fillRect(x - 3, y - 5, 6, 10);
  context.fillStyle = rgbCss(palette.cornHighlight);
  context.fillRect(x - 1, y - 4, 2, 7);
  context.fillStyle = rgbCss(palette.grass);
  context.fillRect(x - 4, y + 2, 3, 3);
  context.restore();
}

function drawEgg(
  context: CanvasRenderingContext2D,
  egg: EggPickup | null,
  elapsed: number,
  palette: ChickenWorldPalette,
): void {
  if (!egg) return;
  const bob = Math.sin(elapsed * 3.6 + egg.phase) * 2.5;
  const x = Math.round(egg.x);
  const y = Math.round(egg.y + bob);

  context.save();
  context.shadowColor = rgbaCss(palette.egg, 0.78);
  context.shadowBlur = 13;
  context.fillStyle = rgbCss(palette.egg);
  context.fillRect(x - 7, y - 10, 14, 18);
  context.fillRect(x - 9, y - 5, 18, 9);
  context.fillStyle = rgbCss(palette.eggAccent);
  context.fillRect(x - 3, y - 6, 4, 10);
  context.fillStyle = rgbCss(CHICKEN_SPRITE_PALETTE.accent);
  context.fillRect(x + 2, y + 2, 3, 3);
  context.restore();
}

function drawFox(
  context: CanvasRenderingContext2D,
  fox: FoxVisual,
  scene: ChickenRunScene,
  palette: ChickenWorldPalette,
): void {
  if (!fox.visible) return;
  const x = Math.round(fox.x);
  const y = terrainHeightAt(scene.distance + fox.x + 20, scene.groundY) - 35;
  const legPhase = Math.floor(fox.runFrame) % 2;

  context.save();
  context.globalAlpha = 0.48 + Math.min(0.45, fox.pressure * 0.45);
  context.fillStyle = rgbCss(palette.fox);
  context.shadowColor = rgbaCss(palette.fox, 0.32);
  context.shadowBlur = 5;
  context.fillRect(x + 9, y + 12, 28, 17);
  context.fillRect(x + 29, y + 6, 17, 15);
  context.fillRect(x + 42, y + 12, 9, 6);
  context.fillRect(x + 31, y + 1, 5, 8);
  context.fillRect(x + 40, y + 2, 5, 7);
  context.fillRect(x, y + 15, 15, 8);
  context.fillRect(x - 5, y + 11, 10, 5);

  context.fillStyle = rgbCss(palette.foxDetail);
  context.fillRect(x + 39, y + 9, 3, 3);
  context.fillStyle = rgbCss(palette.egg);
  context.fillRect(x + 40, y + 9, 1, 1);

  context.fillStyle = rgbCss(palette.foxDetail);
  context.fillRect(x + (legPhase ? 15 : 11), y + 28, 4, 7);
  context.fillRect(x + (legPhase ? 31 : 35), y + 28, 4, 7);
  context.fillRect(x + (legPhase ? 11 : 15), y + 33, 9, 2);
  context.fillRect(x + (legPhase ? 29 : 33), y + 33, 9, 2);
  context.restore();
}

interface ChickenPose {
  headBob: number;
  mudCrash: boolean;
  flapFrame: number;
  franticFrame: number;
  legPhase: number;
}

const CHICKEN_OUTLINE_OFFSETS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;

function fillChickenWing(
  context: CanvasRenderingContext2D,
  chicken: ChickenVisual,
  pose: ChickenPose,
): void {
  if (pose.mudCrash || pose.flapFrame >= 0) {
    const raised = pose.mudCrash
      ? pose.franticFrame === 0
      : pose.flapFrame !== 1;
    if (raised) {
      context.fillRect(1, 5, 11, 5);
      context.fillRect(0, 9, 8, 5);
      context.fillRect(4, 14, 7, 4);
    } else {
      context.fillRect(3, 20, 14, 6);
      context.fillRect(6, 26, 10, 4);
    }
  } else if (!chicken.grounded && chicken.flapAvailable) {
    context.fillRect(3, 12, 13, 7);
    context.fillRect(6, 19, 11, 5);
  } else {
    context.fillRect(5, 17, 13, 11);
  }
}

function fillChickenLegs(
  context: CanvasRenderingContext2D,
  chicken: ChickenVisual,
  pose: ChickenPose,
): void {
  if (chicken.grounded && !chicken.crash) {
    context.fillRect(pose.legPhase ? 14 : 18, 35, 3, 7);
    context.fillRect(pose.legPhase ? 27 : 23, 35, 3, 7);
    context.fillRect(pose.legPhase ? 11 : 17, 40, 8, 2);
    context.fillRect(pose.legPhase ? 25 : 21, 40, 8, 2);
  } else if (!pose.mudCrash) {
    context.fillRect(13, 34, 7, 3);
    context.fillRect(24, 35, 7, 3);
  }
}

function fillChickenSilhouette(
  context: CanvasRenderingContext2D,
  chicken: ChickenVisual,
  pose: ChickenPose,
): void {
  context.fillRect(8, 12, 27, 23);
  context.fillRect(22, 5 + pose.headBob, 17, 17);
  context.fillRect(36, 12 + pose.headBob, 8, 5);
  context.fillRect(4, 17, 7, 12);
  context.fillRect(24, 1 + pose.headBob, 4, 6);
  context.fillRect(30, 2 + pose.headBob, 4, 5);
  context.fillRect(39, 14 + pose.headBob, 6, 4);
  fillChickenWing(context, chicken, pose);
  fillChickenLegs(context, chicken, pose);
}

function drawChickenOutline(
  context: CanvasRenderingContext2D,
  chicken: ChickenVisual,
  pose: ChickenPose,
): void {
  context.fillStyle = rgbCss(CHICKEN_SPRITE_PALETTE.outline);
  CHICKEN_OUTLINE_OFFSETS.forEach(([offsetX, offsetY]) => {
    context.save();
    context.translate(offsetX, offsetY);
    fillChickenSilhouette(context, chicken, pose);
    context.restore();
  });
}

function drawCarriedEgg(
  context: CanvasRenderingContext2D,
  palette: ChickenWorldPalette,
): void {
  context.fillStyle = rgbCss(CHICKEN_SPRITE_PALETTE.outline);
  CHICKEN_OUTLINE_OFFSETS.forEach(([offsetX, offsetY]) => {
    context.fillRect(3 + offsetX, 29 + offsetY, 8, 10);
    context.fillRect(1 + offsetX, 32 + offsetY, 12, 5);
  });
  context.fillStyle = rgbCss(palette.egg);
  context.fillRect(3, 29, 8, 10);
  context.fillRect(1, 32, 12, 5);
  context.fillStyle = rgbCss(palette.eggAccent);
  context.fillRect(6, 33, 2, 3);
}

function drawChickenBody(
  context: CanvasRenderingContext2D,
  chicken: ChickenVisual,
  elapsed: number,
  nightFactor: number,
  palette: ChickenWorldPalette,
): void {
  const crash = chicken.crash;
  const x = crash?.x ?? chicken.x;
  const y = crash?.y ?? chicken.y;
  const shocked = crash !== null;
  const mudCrash = crash?.kind === "mud";
  const legPhase = Math.floor(chicken.runFrame) % 2;
  const headBob = chicken.grounded && !crash ? (legPhase ? 1 : 0) : 0;

  let scaleX = 1;
  let scaleY = 1;
  if (chicken.landingPulse > 0) {
    const amount = Math.min(1, chicken.landingPulse / 0.14);
    scaleX = 1 + amount * 0.13;
    scaleY = 1 - amount * 0.16;
  } else if (chicken.takeoffPulse > 0) {
    const amount = Math.min(1, chicken.takeoffPulse / 0.13);
    scaleX = 1 - amount * 0.08;
    scaleY = 1 + amount * 0.12;
  } else if (!chicken.grounded && chicken.velocityY > 100) {
    scaleX = 0.94;
    scaleY = 1.08;
  } else if (!chicken.grounded) {
    scaleX = 1.04;
    scaleY = 0.97;
  }

  const pose: ChickenPose = {
    headBob,
    mudCrash,
    flapFrame: chicken.flapPulse > 0
      ? Math.floor(chicken.flapPulse * 42) % 3
      : -1,
    franticFrame: mudCrash ? Math.floor(crash.elapsed * 18) % 2 : 0,
    legPhase,
  };

  context.save();
  const flash = chicken.invulnerable && Math.floor(elapsed * 12) % 2 === 0;
  if (flash) context.globalAlpha = 0.5;
  context.translate(Math.round(x + 21), Math.round(y + 42));
  if (!crash && chicken.grounded) {
    context.rotate(Math.atan(chicken.slope) * 0.58);
  }
  if (crash) context.rotate(crash.rotation);
  context.scale(scaleX, scaleY);
  context.translate(-21, -42 + (mudCrash ? crash.sink : 0));

  if (nightFactor > 0.25 || chicken.rescuePulse > 0) {
    context.shadowColor = chicken.rescuePulse > 0
      ? rgbaCss(palette.egg, 0.95)
      : rgbaCss(CHICKEN_SPRITE_PALETTE.body, 0.45);
    context.shadowBlur = 8 + chicken.rescuePulse * 14;
  }

  drawChickenOutline(context, chicken, pose);
  context.shadowBlur = 0;

  context.fillStyle = rgbCss(CHICKEN_SPRITE_PALETTE.body);
  context.fillRect(8, 12, 27, 23);
  context.fillRect(22, 5 + headBob, 17, 17);
  context.fillRect(36, 12 + headBob, 8, 5);
  context.fillRect(4, 17, 7, 12);

  context.fillStyle = rgbCss(CHICKEN_SPRITE_PALETTE.accent);
  context.fillRect(24, 1 + headBob, 4, 6);
  context.fillRect(30, 2 + headBob, 4, 5);
  context.fillRect(39, 14 + headBob, 6, 4);

  context.fillStyle = rgbCss(CHICKEN_SPRITE_PALETTE.wing);
  fillChickenWing(context, chicken, pose);

  context.fillStyle = rgbCss(CHICKEN_SPRITE_PALETTE.ink);
  if (shocked) {
    context.fillRect(31, 8 + headBob, 5, 6);
    context.fillStyle = rgbCss(CHICKEN_SPRITE_PALETTE.body);
    context.fillRect(33, 9 + headBob, 1, 2);
  } else {
    context.fillRect(33, 9 + headBob, 3, 3);
  }

  context.fillStyle = rgbCss(CHICKEN_SPRITE_PALETTE.accent);
  fillChickenLegs(context, chicken, pose);

  if (chicken.eggCarried && !crash) {
    drawCarriedEgg(context, palette);
  }

  context.restore();
}

function drawFeathers(
  context: CanvasRenderingContext2D,
  feathers: readonly Feather[],
  palette: ChickenWorldPalette,
): void {
  feathers.forEach((feather) => {
    const alpha = Math.max(0, 1 - feather.age / feather.lifetime);
    context.save();
    context.globalAlpha = alpha;
    context.translate(feather.x, feather.y);
    context.rotate(feather.rotation);
    context.fillStyle = feather.shape === "shell"
      ? feather.color === "#d9805d"
        ? rgbCss(palette.eggAccent)
        : rgbCss(palette.egg)
      : rgbCss(palette.particle);
    if (feather.shape === "shell") {
      context.fillRect(-feather.size / 2, -feather.size / 2, feather.size, feather.size);
      context.fillStyle = rgbCss(CHICKEN_SPRITE_PALETTE.ink);
      context.fillRect(0, -feather.size / 2, 1, feather.size / 2);
    } else {
      context.fillRect(-feather.size / 2, -1, feather.size, 2);
      context.fillRect(0, -feather.size / 2, 1, feather.size);
    }
    context.restore();
  });
}

function drawScoreBursts(
  context: CanvasRenderingContext2D,
  bursts: readonly ScoreBurst[],
  palette: ChickenWorldPalette,
): void {
  context.save();
  context.font = '12px "Source Code Pro", monospace';
  context.textAlign = "center";
  context.textBaseline = "middle";
  bursts.forEach((burst) => {
    const alpha = Math.max(0, 1 - burst.age / burst.lifetime);
    context.globalAlpha = alpha;
    context.fillStyle = rgbCss(palette.corn);
    context.fillText(burst.text, burst.x, burst.y - burst.age * 18);
  });
  context.restore();
}

function drawNotice(
  context: CanvasRenderingContext2D,
  notice: RunNotice | null,
  width: number,
  palette: ChickenWorldPalette,
): void {
  if (!notice) return;
  const fadeIn = Math.min(1, notice.age / 0.12);
  const fadeOut = Math.min(1, (notice.lifetime - notice.age) / 0.2);
  const alpha = Math.max(0, Math.min(fadeIn, fadeOut));

  context.save();
  context.globalAlpha = alpha;
  context.font = '18px "Source Code Pro", monospace';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = rgbCss(palette.text);
  context.shadowColor = rgbaCss(palette.text, 0.45);
  context.shadowBlur = 8;
  context.fillText(notice.text, width / 2, 66);
  context.restore();
}

function drawCycleBadge(
  context: CanvasRenderingContext2D,
  cycle: RunCycleState,
  weather: RunWeatherState,
  palette: ChickenWorldPalette,
): void {
  context.save();
  context.font = '11px "Source Code Pro", monospace';
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillStyle = rgbCss(cycle.phase === "night" ? palette.text : palette.dim);
  context.globalAlpha = 0.8;
  const weatherLabel = weather.phase === "clear"
    ? Math.abs(weather.wind) > 0.55 ? "WIND" : "CLEAR"
    : weather.phase.toUpperCase();
  context.fillText(`${cycle.phase.toUpperCase()} · ${weatherLabel}`, 12, 11);
  context.restore();
}

export function drawChickenRunScene(
  context: CanvasRenderingContext2D,
  scene: ChickenRunScene,
): void {
  const palette = drawChickenEnvironment(context, scene);

  context.save();
  context.translate(0, scene.cameraOffsetY);
  drawFox(context, scene.fox, scene, palette);
  scene.corn.forEach((kernel) =>
    drawCorn(
      context,
      kernel,
      scene.elapsed,
      scene.cycle.nightFactor,
      palette,
    ),
  );
  drawEgg(context, scene.egg, scene.elapsed, palette);
  scene.obstacles.forEach((obstacle) =>
    drawObstacle(context, obstacle, scene.cycle.nightFactor, palette),
  );
  drawChickenBody(
    context,
    scene.chicken,
    scene.elapsed,
    scene.cycle.nightFactor,
    palette,
  );
  drawFeathers(context, scene.feathers, palette);
  drawScoreBursts(context, scene.scoreBursts, palette);
  context.restore();

  drawNotice(context, scene.notice, scene.width, palette);
  drawCycleBadge(context, scene.cycle, scene.weather, palette);
}
