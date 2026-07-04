import type { BackgroundLandmark } from "./chicken-run-background";

function drawBarn(
  context: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  scale = 1,
): void {
  context.save();
  context.translate(Math.round(x), Math.round(baseY));
  context.scale(scale, scale);
  context.fillRect(8, -35, 54, 35);
  context.fillRect(14, -43, 42, 8);
  context.fillRect(20, -49, 30, 6);
  context.restore();
}

function drawSilo(
  context: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  scale = 1,
): void {
  context.save();
  context.translate(Math.round(x), Math.round(baseY));
  context.scale(scale, scale);
  context.fillRect(10, -48, 26, 48);
  context.fillRect(13, -54, 20, 6);
  context.fillRect(17, -58, 12, 4);
  context.restore();
}

function drawWindmill(
  context: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  scale = 1,
): void {
  context.save();
  context.translate(Math.round(x), Math.round(baseY));
  context.scale(scale, scale);
  context.fillRect(23, -48, 4, 48);
  context.fillRect(16, -3, 18, 3);
  context.fillRect(11, -45, 28, 3);
  context.fillRect(23, -58, 3, 28);
  context.fillRect(14, -54, 3, 21);
  context.fillRect(33, -54, 3, 21);
  context.restore();
}

function drawFarmhouse(
  context: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  scale = 1,
): void {
  context.save();
  context.translate(Math.round(x), Math.round(baseY));
  context.scale(scale, scale);
  context.fillRect(6, -31, 48, 31);
  context.fillRect(12, -39, 36, 8);
  context.fillRect(18, -45, 24, 6);
  context.fillRect(46, -48, 4, 17);
  context.restore();
}

function drawWaterTower(
  context: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  scale = 1,
): void {
  context.save();
  context.translate(Math.round(x), Math.round(baseY));
  context.scale(scale, scale);
  context.fillRect(10, -63, 34, 16);
  context.fillRect(14, -69, 26, 6);
  context.fillRect(18, -47, 3, 47);
  context.fillRect(34, -47, 3, 47);
  context.fillRect(19, -30, 18, 3);
  context.fillRect(14, -3, 28, 3);
  context.restore();
}

function drawScarecrow(
  context: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  scale = 1,
): void {
  context.save();
  context.translate(Math.round(x), Math.round(baseY));
  context.scale(scale, scale);
  context.fillRect(18, -39, 4, 39);
  context.fillRect(7, -29, 26, 4);
  context.fillRect(13, -45, 14, 10);
  context.fillRect(10, -49, 20, 4);
  context.fillRect(10, -3, 9, 3);
  context.fillRect(21, -3, 9, 3);
  context.restore();
}

function drawBridge(
  context: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  scale = 1,
): void {
  context.save();
  context.translate(Math.round(x), Math.round(baseY));
  context.scale(scale, scale);
  context.fillRect(0, -12, 74, 6);
  context.fillRect(6, -20, 4, 20);
  context.fillRect(64, -20, 4, 20);
  context.fillRect(8, -19, 58, 3);
  for (let rail = 13; rail < 63; rail += 10) {
    context.fillRect(rail, -17, 2, 11);
  }
  context.restore();
}

export function drawBackgroundTree(
  context: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  scale = 1,
): void {
  context.save();
  context.translate(Math.round(x), Math.round(baseY));
  context.scale(scale, scale);
  context.fillRect(13, -31, 5, 31);
  context.fillRect(3, -39, 25, 14);
  context.fillRect(8, -49, 17, 16);
  context.fillRect(12, -56, 10, 12);
  context.restore();
}

function drawTreeGrove(
  context: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  scale = 1,
): void {
  drawBackgroundTree(context, x, baseY, scale * 0.92);
  drawBackgroundTree(
    context,
    x + 25 * scale,
    baseY + 2 * scale,
    scale * 1.08,
  );
  drawBackgroundTree(
    context,
    x + 56 * scale,
    baseY + scale,
    scale * 0.82,
  );
}

export function drawBackgroundLandmark(
  context: CanvasRenderingContext2D,
  landmark: BackgroundLandmark,
  x: number,
  baseY: number,
): void {
  if (landmark.kind === "barn-cluster") {
    drawBarn(context, x, baseY, landmark.scale);
    drawSilo(context, x + 58 * landmark.scale, baseY, landmark.scale * 0.82);
  } else if (landmark.kind === "farmhouse") {
    drawFarmhouse(context, x, baseY, landmark.scale);
  } else if (landmark.kind === "windmill") {
    drawWindmill(context, x, baseY, landmark.scale);
  } else if (landmark.kind === "water-tower") {
    drawWaterTower(context, x, baseY, landmark.scale);
  } else if (landmark.kind === "scarecrow") {
    drawScarecrow(context, x, baseY, landmark.scale);
  } else if (landmark.kind === "wooden-bridge") {
    drawBridge(context, x, baseY, landmark.scale);
  } else {
    drawTreeGrove(context, x, baseY, landmark.scale);
  }
}
