import type { RunCycleState } from "./chicken-run-cycle";
import type { CrashKind, ObstacleKind } from "./chicken-run-rules";
import {
  CHICKEN_SPRITE_PALETTE,
  cloudOpacityForCycle,
  moonVisual,
  paletteForCycle,
  rgbCss,
  rgbaCss,
  sunVisual,
  type ChickenWorldPalette,
} from "./chicken-run-sky";

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
  passed: boolean;
}

export interface CornKernel extends Point {
  groupId: number;
  collected: boolean;
  phase: number;
}

export interface EggPickup extends Point {
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
  distance: number;
  elapsed: number;
  obstacles: readonly ChickenObstacle[];
  corn: readonly CornKernel[];
  egg: EggPickup | null;
  feathers: readonly Feather[];
  scoreBursts: readonly ScoreBurst[];
  notice: RunNotice | null;
  cycle: RunCycleState;
  fox: FoxVisual;
  chicken: ChickenVisual;
}

function drawBarn(
  context: CanvasRenderingContext2D,
  x: number,
  baseY: number,
): void {
  context.fillRect(x + 8, baseY - 35, 54, 35);
  context.fillRect(x + 14, baseY - 43, 42, 8);
  context.fillRect(x + 20, baseY - 49, 30, 6);
  context.fillRect(x + 29, baseY - 22, 13, 22);
  context.fillRect(x + 12, baseY - 26, 9, 10);
  context.fillRect(x + 49, baseY - 26, 9, 10);
}

function drawSilo(
  context: CanvasRenderingContext2D,
  x: number,
  baseY: number,
): void {
  context.fillRect(x + 10, baseY - 48, 26, 48);
  context.fillRect(x + 13, baseY - 54, 20, 6);
  context.fillRect(x + 17, baseY - 58, 12, 4);
  context.fillRect(x + 18, baseY - 31, 9, 12);
}

function drawWindmill(
  context: CanvasRenderingContext2D,
  x: number,
  baseY: number,
): void {
  context.fillRect(x + 23, baseY - 48, 4, 48);
  context.fillRect(x + 16, baseY - 3, 18, 3);
  context.fillRect(x + 11, baseY - 45, 28, 3);
  context.fillRect(x + 23, baseY - 58, 3, 28);
  context.fillRect(x + 14, baseY - 54, 3, 21);
  context.fillRect(x + 33, baseY - 54, 3, 21);
}

function drawSun(
  context: CanvasRenderingContext2D,
  scene: ChickenRunScene,
  palette: ChickenWorldPalette,
): void {
  const sun = sunVisual(scene.cycle, scene.width, scene.groundY);
  if (sun.alpha <= 0.01) return;

  const x = Math.round(sun.x);
  const y = Math.round(sun.y);
  context.save();
  context.globalAlpha = sun.alpha;
  context.fillStyle = rgbCss(palette.sun);
  context.shadowColor = rgbaCss(palette.sun, 0.42);
  context.shadowBlur = 10;
  context.fillRect(x - 9, y - 9, 18, 18);
  context.fillRect(x - 13, y - 5, 26, 10);
  context.fillRect(x - 5, y - 13, 10, 26);
  context.shadowBlur = 0;
  context.fillRect(x - 2, y - 20, 4, 5);
  context.fillRect(x - 2, y + 15, 4, 5);
  context.fillRect(x - 20, y - 2, 5, 4);
  context.fillRect(x + 15, y - 2, 5, 4);
  context.restore();
}

function drawMoon(
  context: CanvasRenderingContext2D,
  scene: ChickenRunScene,
  palette: ChickenWorldPalette,
): void {
  const moon = moonVisual(scene.cycle, scene.width, scene.groundY);
  if (moon.alpha <= 0.01) return;

  const x = Math.round(moon.x);
  const y = Math.round(moon.y);
  context.save();
  context.globalAlpha = moon.alpha;
  context.fillStyle = rgbCss(palette.moon);
  context.shadowColor = rgbaCss(palette.moon, 0.38);
  context.shadowBlur = 8;
  context.fillRect(x - 10, y - 10, 20, 20);
  context.fillRect(x - 13, y - 6, 26, 12);
  context.shadowBlur = 0;
  context.fillStyle = rgbCss(palette.sky);
  context.fillRect(x - 2, y - 13, 15, 23);
  context.fillRect(x + 4, y - 9, 11, 17);
  context.restore();
}

function drawStars(
  context: CanvasRenderingContext2D,
  scene: ChickenRunScene,
  palette: ChickenWorldPalette,
): void {
  if (scene.cycle.nightFactor <= 0.01) return;

  const stars = [
    [45, 34], [104, 62], [172, 28], [245, 51], [316, 24], [388, 68],
    [462, 36], [528, 59], [598, 26], [76, 105], [208, 91], [354, 112],
    [505, 96], [620, 122],
  ] as const;

  context.save();
  context.globalAlpha = scene.cycle.nightFactor * 0.74;
  context.fillStyle = rgbCss(palette.star);
  stars.forEach(([x, y], index) => {
    const twinkle = Math.sin(scene.elapsed * 2.1 + index * 1.7) > 0.25 ? 2 : 1;
    context.fillRect(x, y, twinkle, twinkle);
  });
  context.restore();
}

function drawCloudShape(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  palette: ChickenWorldPalette,
  alpha: number,
): void {
  context.save();
  context.globalAlpha = alpha;
  context.translate(Math.round(x), Math.round(y));
  context.scale(scale, scale);
  context.fillStyle = rgbCss(palette.cloudShadow);
  context.fillRect(5, 10, 42, 9);
  context.fillRect(13, 6, 28, 11);
  context.fillStyle = rgbCss(palette.cloud);
  context.fillRect(2, 7, 43, 9);
  context.fillRect(10, 3, 28, 11);
  context.fillRect(17, 0, 13, 10);
  context.restore();
}

function drawClouds(
  context: CanvasRenderingContext2D,
  scene: ChickenRunScene,
  palette: ChickenWorldPalette,
): void {
  const opacity = cloudOpacityForCycle(scene.cycle);
  if (opacity <= 0.02) return;

  const clouds = [
    { y: 41, scale: 0.92, speed: 0.018, offset: 30, spacing: 360 },
    { y: 78, scale: 0.72, speed: 0.028, offset: 210, spacing: 430 },
    { y: 112, scale: 0.58, speed: 0.038, offset: 90, spacing: 510 },
  ] as const;

  clouds.forEach((cloud, layerIndex) => {
    const drift = scene.elapsed * (3.4 + layerIndex * 0.8);
    const base = -((scene.distance * cloud.speed + drift) % cloud.spacing);
    for (let index = -1; index < 3; index += 1) {
      drawCloudShape(
        context,
        base + cloud.offset + index * cloud.spacing,
        cloud.y,
        cloud.scale,
        palette,
        opacity * (0.74 - layerIndex * 0.12),
      );
    }
  });
}

function drawBackground(
  context: CanvasRenderingContext2D,
  scene: ChickenRunScene,
  palette: ChickenWorldPalette,
): void {
  context.fillStyle = rgbCss(palette.sky);
  context.fillRect(0, 0, scene.width, scene.height);
  drawStars(context, scene, palette);
  drawMoon(context, scene, palette);
  drawSun(context, scene, palette);
  drawClouds(context, scene, palette);

  const farBaseY = scene.groundY - 70;
  const farOffset = -((scene.distance * 0.035) % 360);
  const farAlpha = 0.25 - scene.cycle.nightFactor * 0.11;
  context.fillStyle = rgbaCss(palette.distant, Math.max(0.09, farAlpha));
  for (let index = -1; index < 4; index += 1) {
    const x = farOffset + index * 360;
    const variant = ((index % 3) + 3) % 3;
    if (variant === 0) drawBarn(context, x + 24, farBaseY);
    else if (variant === 1) drawSilo(context, x + 72, farBaseY);
    else drawWindmill(context, x + 46, farBaseY);
  }

  const middleOffset = -((scene.distance * 0.13) % 92);
  context.fillStyle = rgbaCss(
    palette.middle,
    0.29 - scene.cycle.nightFactor * 0.1,
  );
  for (let x = middleOffset - 20; x < scene.width + 100; x += 92) {
    context.fillRect(x, scene.groundY - 37, 4, 37);
    context.fillRect(x + 42, scene.groundY - 30, 4, 30);
    context.fillRect(x, scene.groundY - 25, 46, 3);
    context.fillRect(x, scene.groundY - 12, 46, 3);
  }

  const grassOffset = -((scene.distance * 0.24) % 57);
  context.fillStyle = rgbaCss(
    palette.grass,
    0.38 - scene.cycle.nightFactor * 0.12,
  );
  for (let x = grassOffset - 10; x < scene.width + 60; x += 57) {
    const wobble = Math.sin(scene.elapsed * 1.7 + x * 0.03) > 0 ? 1 : 0;
    context.fillRect(x, scene.groundY - 5, 2, 5);
    context.fillRect(x + 3, scene.groundY - 7 - wobble, 2, 7 + wobble);
    context.fillRect(x + 6, scene.groundY - 4, 2, 4);
  }
}

function drawGround(
  context: CanvasRenderingContext2D,
  scene: ChickenRunScene,
  palette: ChickenWorldPalette,
): void {
  context.fillStyle = rgbCss(palette.ground);
  context.fillRect(
    0,
    scene.groundY,
    scene.width,
    scene.height - scene.groundY,
  );
  context.strokeStyle = rgbaCss(palette.groundLine, 0.68);
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, scene.groundY + 0.5);
  context.lineTo(scene.width, scene.groundY + 0.5);
  context.stroke();

  const offset = -((scene.distance * 0.52) % 34);
  context.fillStyle = rgbaCss(palette.groundMark, 0.52);
  for (let x = offset; x < scene.width + 34; x += 34) {
    context.fillRect(x, scene.groundY + 14, 13, 2);
    context.fillRect(x + 18, scene.groundY + 31, 7, 2);
  }
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
  groundY: number,
  palette: ChickenWorldPalette,
): void {
  if (!fox.visible) return;
  const x = Math.round(fox.x);
  const y = groundY - 35;
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
  palette: ChickenWorldPalette,
): void {
  context.save();
  context.font = '11px "Source Code Pro", monospace';
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillStyle = rgbCss(cycle.phase === "night" ? palette.text : palette.dim);
  context.globalAlpha = 0.8;
  context.fillText(cycle.phase.toUpperCase(), 12, 11);
  context.restore();
}

export function drawChickenRunScene(
  context: CanvasRenderingContext2D,
  scene: ChickenRunScene,
): void {
  const palette = paletteForCycle(scene.cycle);
  drawBackground(context, scene, palette);
  drawGround(context, scene, palette);
  drawFox(context, scene.fox, scene.groundY, palette);
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
  drawNotice(context, scene.notice, scene.width, palette);
  drawCycleBadge(context, scene.cycle, palette);
}
