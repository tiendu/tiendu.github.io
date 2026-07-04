import type { RunCycleState } from "./chicken-run-cycle";
import { drawChickenCountryside } from "./chicken-run-background-renderer";
import {
  cloudOpacityForEnvironment,
  moonVisual,
  paletteForEnvironment,
  rgbCss,
  rgbaCss,
  sunVisual,
  type ChickenWorldPalette,
} from "./chicken-run-sky";
import { terrainHeightAt, terrainSlopeAt } from "./chicken-run-terrain";
import type { RunWeatherState } from "./chicken-run-weather";

export interface ChickenEnvironmentScene {
  width: number;
  height: number;
  groundY: number;
  cameraOffsetY: number;
  distance: number;
  elapsed: number;
  cycle: RunCycleState;
  weather: RunWeatherState;
}

function screenGroundY(
  scene: ChickenEnvironmentScene,
  worldX: number,
  cameraFactor = 1,
): number {
  return (
    terrainHeightAt(worldX, scene.groundY) +
    scene.cameraOffsetY * cameraFactor
  );
}

function drawSun(
  context: CanvasRenderingContext2D,
  scene: ChickenEnvironmentScene,
  palette: ChickenWorldPalette,
): void {
  const sun = sunVisual(scene.cycle, scene.width, scene.groundY);
  const cover = 1 - scene.weather.cloudFactor * 0.56;
  const alpha = sun.alpha * Math.max(0.22, cover);
  if (alpha <= 0.01) return;

  const x = Math.round(sun.x);
  const y = Math.round(sun.y);
  context.save();
  context.globalAlpha = alpha;
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
  scene: ChickenEnvironmentScene,
  palette: ChickenWorldPalette,
): void {
  const moon = moonVisual(scene.cycle, scene.width, scene.groundY);
  const cover = 1 - scene.weather.cloudFactor * 0.48;
  const alpha = moon.alpha * Math.max(0.28, cover);
  if (alpha <= 0.01) return;

  const x = Math.round(moon.x);
  const y = Math.round(moon.y);
  context.save();
  context.globalAlpha = alpha;
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
  scene: ChickenEnvironmentScene,
  palette: ChickenWorldPalette,
): void {
  if (scene.cycle.nightFactor <= 0.01) return;
  const stars = [
    [45, 34], [104, 62], [172, 28], [245, 51], [316, 24], [388, 68],
    [462, 36], [528, 59], [598, 26], [76, 105], [208, 91], [354, 112],
    [505, 96], [620, 122],
  ] as const;

  context.save();
  context.globalAlpha =
    scene.cycle.nightFactor * (1 - scene.weather.cloudFactor * 0.82) * 0.74;
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
  scene: ChickenEnvironmentScene,
  palette: ChickenWorldPalette,
): void {
  const opacity = cloudOpacityForEnvironment(scene.cycle, scene.weather);
  if (opacity <= 0.02) return;

  const clouds = [
    { y: 36, scale: 0.98, speed: 0.017, offset: 30, spacing: 330 },
    { y: 76, scale: 0.76, speed: 0.027, offset: 210, spacing: 390 },
    { y: 112, scale: 0.6, speed: 0.038, offset: 90, spacing: 470 },
    { y: 55, scale: 0.68, speed: 0.024, offset: 330, spacing: 520 },
  ] as const;

  const windDrift = scene.weather.wind * scene.elapsed * 23;
  clouds.forEach((cloud, layerIndex) => {
    if (layerIndex === 3 && scene.weather.cloudFactor < 0.52) return;
    const drift = scene.elapsed * (3.1 + layerIndex * 0.7) + windDrift;
    const base = -((scene.distance * cloud.speed + drift) % cloud.spacing);
    for (let index = -1; index < 3; index += 1) {
      drawCloudShape(
        context,
        base + cloud.offset + index * cloud.spacing,
        cloud.y,
        cloud.scale,
        palette,
        opacity * (0.82 - layerIndex * 0.11),
      );
    }
  });
}

function pseudoUnit(index: number, salt: number): number {
  const value = Math.sin(index * 91.17 + salt * 17.31) * 43758.5453;
  return value - Math.floor(value);
}

function wrap(value: number, span: number): number {
  return ((value % span) + span) % span;
}

function drawWind(
  context: CanvasRenderingContext2D,
  scene: ChickenEnvironmentScene,
  palette: ChickenWorldPalette,
): void {
  if (scene.weather.windStrength < 0.32) return;
  const direction = scene.weather.wind >= 0 ? 1 : -1;
  const speed = 80 + scene.weather.windStrength * 120;
  context.save();
  context.strokeStyle = rgbaCss(palette.particle, 0.11 + scene.weather.windStrength * 0.16);
  context.lineWidth = 1;
  for (let index = 0; index < 7; index += 1) {
    const length = 18 + pseudoUnit(index, 2) * 28;
    const track = scene.width + 120;
    const travel = (scene.elapsed * speed + index * 103) % track;
    const x = direction > 0 ? travel - 60 : scene.width + 60 - travel;
    const y = 36 + pseudoUnit(index, 4) * (scene.groundY - 88);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x - direction * length, y + direction * 2);
    context.stroke();
  }
  context.restore();
}

function drawRain(
  context: CanvasRenderingContext2D,
  scene: ChickenEnvironmentScene,
  palette: ChickenWorldPalette,
): void {
  const intensity = scene.weather.rainIntensity;
  if (intensity <= 0.01) return;

  const count = Math.round(24 + intensity * 58);
  const slant = 4 + scene.weather.wind * 10;
  const fallSpeed = 270 + intensity * 180;
  context.save();
  context.strokeStyle = rgbaCss(palette.particle, 0.22 + intensity * 0.27);
  context.lineWidth = 1;

  for (let index = 0; index < count; index += 1) {
    const xSeed = pseudoUnit(index, 7) * (scene.width + 100);
    const ySeed = pseudoUnit(index, 11) * scene.groundY;
    const x = wrap(
      xSeed + scene.elapsed * scene.weather.wind * 92,
      scene.width + 100,
    ) - 50;
    const y = wrap(ySeed + scene.elapsed * fallSpeed + index * 13, scene.groundY);
    const length = 6 + pseudoUnit(index, 13) * 8;
    const ground = screenGroundY(scene, scene.distance + x) - 2;
    if (y >= ground) continue;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x - slant, Math.min(ground, y + length));
    context.stroke();
  }
  context.restore();
}

function drawBackground(
  context: CanvasRenderingContext2D,
  scene: ChickenEnvironmentScene,
  palette: ChickenWorldPalette,
): void {
  context.fillStyle = rgbCss(palette.sky);
  context.fillRect(0, 0, scene.width, scene.height);
  drawStars(context, scene, palette);
  drawMoon(context, scene, palette);
  drawSun(context, scene, palette);
  drawClouds(context, scene, palette);
  drawWind(context, scene, palette);

  drawChickenCountryside(
    context,
    {
      width: scene.width,
      height: scene.height,
      groundY: scene.groundY,
      cameraOffsetY: scene.cameraOffsetY,
      distance: scene.distance,
      elapsed: scene.elapsed,
      nightFactor: scene.cycle.nightFactor,
      weather: scene.weather,
    },
    palette,
  );
}

function drawGround(
  context: CanvasRenderingContext2D,
  scene: ChickenEnvironmentScene,
  palette: ChickenWorldPalette,
): void {
  context.fillStyle = rgbCss(palette.ground);
  context.beginPath();
  context.moveTo(0, scene.height);
  context.lineTo(0, screenGroundY(scene, scene.distance));
  for (let x = 0; x <= scene.width; x += 4) {
    context.lineTo(x, screenGroundY(scene, scene.distance + x));
  }
  context.lineTo(scene.width, scene.height);
  context.closePath();
  context.fill();

  context.strokeStyle = rgbaCss(palette.groundLine, 0.72);
  context.lineWidth = 2;
  context.beginPath();
  for (let x = 0; x <= scene.width; x += 4) {
    const y = screenGroundY(scene, scene.distance + x) + 0.5;
    if (x === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();

  const firstWorldMark = Math.floor(scene.distance / 34) * 34;
  context.fillStyle = rgbaCss(palette.groundMark, 0.5);
  for (let worldX = firstWorldMark; worldX < scene.distance + scene.width + 40; worldX += 34) {
    const x = worldX - scene.distance;
    const y = screenGroundY(scene, worldX) + 15;
    const angle = Math.atan(terrainSlopeAt(worldX, scene.groundY));
    context.save();
    context.translate(Math.round(x), Math.round(y));
    context.rotate(angle);
    context.fillRect(0, 0, 13, 2);
    context.restore();
  }

  if (scene.weather.rainIntensity > 0.08) {
    const splashCount = Math.round(5 + scene.weather.rainIntensity * 10);
    context.strokeStyle = rgbaCss(palette.particle, 0.22 + scene.weather.rainIntensity * 0.18);
    context.lineWidth = 1;
    for (let index = 0; index < splashCount; index += 1) {
      const travel = (scene.elapsed * (115 + index * 3) + index * 89) % (scene.width + 60);
      const x = travel - 30;
      const y = screenGroundY(scene, scene.distance + x) + 2;
      context.beginPath();
      context.moveTo(x - 3, y);
      context.lineTo(x, y - 2);
      context.lineTo(x + 3, y);
      context.stroke();
    }
  }
}

export function drawChickenEnvironment(
  context: CanvasRenderingContext2D,
  scene: ChickenEnvironmentScene,
): ChickenWorldPalette {
  const palette = paletteForEnvironment(scene.cycle, scene.weather);
  drawBackground(context, scene, palette);
  drawGround(context, scene, palette);
  drawRain(context, scene, palette);
  return palette;
}
