import type { Point, SnakeProtocol } from "./snake-rules";
import { cellKey } from "./snake-rules";
import { configureFixedCanvas } from "./shared/canvas";

export const SNAKE_CANVAS_WIDTH = 440;
export const SNAKE_CANVAS_HEIGHT = 480;

export type SnakeEffectKind = "regular-food" | "bonus-food" | "collision";

export interface SnakeVisualEffect {
  kind: SnakeEffectKind;
  point: Point;
  startedAt: number;
}

export interface SnakeRenderState {
  snake: readonly Point[];
  previousSnake: readonly Point[];
  food: Point | null;
  bonusFood: Point | null;
  obstacles: ReadonlySet<string>;
  direction: Point;
  sector: number;
  flow: number;
  activeProtocol: SnakeProtocol | null;
  bonusRemainingMs: number;
  overdriveActive: boolean;
  movementProgress: number;
  time: number;
  eatEffect: SnakeVisualEffect | null;
  collisionEffect: SnakeVisualEffect | null;
}

export interface SnakeRenderer {
  configure(): void;
  draw(state: SnakeRenderState): void;
}

interface FloatPoint {
  x: number;
  y: number;
}

interface ProjectedPoint {
  x: number;
  y: number;
  cellWidth: number;
  cellHeight: number;
}

const TAU = Math.PI * 2;
const BOARD_X = 30;
const BOARD_Y = 42;
const BOARD_SIZE = 380;
const BOARD_DEPTH = 8;
const MAX_PIXEL_RATIO = 1.5;
const BONUS_DURATION_MS = 5500;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const lerp = (from: number, to: number, progress: number): number =>
  from + (to - from) * progress;

const easeOutCubic = (value: number): number => 1 - Math.pow(1 - value, 3);

const interpolatePoint = (
  from: Point,
  to: Point,
  progress: number,
): FloatPoint => ({
  x: lerp(from.x, to.x, progress),
  y: lerp(from.y, to.y, progress),
});

const traceRoundedRect = (
  target: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void => {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  target.beginPath();
  target.moveTo(x + safeRadius, y);
  target.lineTo(x + width - safeRadius, y);
  target.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  target.lineTo(x + width, y + height - safeRadius);
  target.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height,
  );
  target.lineTo(x + safeRadius, y + height);
  target.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  target.lineTo(x, y + safeRadius);
  target.quadraticCurveTo(x, y, x + safeRadius, y);
  target.closePath();
};

const createLayer = (): {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
} => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create Snake renderer layer");
  return { canvas, context };
};

export function createSnakeRenderer(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  gridSize: number,
): SnakeRenderer {
  const reducedMotionQuery = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  const staticLayer = createLayer();
  const obstacleLayer = createLayer();

  let configured = false;
  let cachedObstacleSignature = "";

  const configureLayer = (
    layer: { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D },
    ratio: number,
  ): void => {
    layer.canvas.width = Math.round(SNAKE_CANVAS_WIDTH * ratio);
    layer.canvas.height = Math.round(SNAKE_CANVAS_HEIGHT * ratio);
    layer.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    layer.context.imageSmoothingEnabled = true;
  };

  const projectBoardPoint = (
    point: FloatPoint,
    elevation = 0,
  ): ProjectedPoint => {
    const cellSize = BOARD_SIZE / gridSize;
    return {
      x: BOARD_X + point.x * cellSize,
      y: BOARD_Y + point.y * cellSize - elevation,
      cellWidth: cellSize,
      cellHeight: cellSize,
    };
  };

  const projectCellCenter = (point: Point, elevation = 0): ProjectedPoint =>
    projectBoardPoint({ x: point.x + 0.5, y: point.y + 0.5 }, elevation);

  const drawStaticLayer = (): void => {
    const target = staticLayer.context;
    target.clearRect(0, 0, SNAKE_CANVAS_WIDTH, SNAKE_CANVAS_HEIGHT);

    const background = target.createLinearGradient(
      0,
      0,
      0,
      SNAKE_CANVAS_HEIGHT,
    );
    background.addColorStop(0, "#010503");
    background.addColorStop(0.44, "#06140f");
    background.addColorStop(1, "#010403");
    target.fillStyle = background;
    target.fillRect(0, 0, SNAKE_CANVAS_WIDTH, SNAKE_CANVAS_HEIGHT);

    target.save();
    target.shadowColor = "rgba(0, 0, 0, 0.9)";
    target.shadowBlur = 22;
    target.fillStyle = "rgba(0, 0, 0, 0.65)";
    traceRoundedRect(
      target,
      BOARD_X - 8,
      BOARD_Y - 8,
      BOARD_SIZE + 16,
      BOARD_SIZE + 18,
      8,
    );
    target.fill();
    target.restore();

    target.fillStyle = "#06150f";
    target.fillRect(BOARD_X, BOARD_Y, BOARD_SIZE, BOARD_SIZE);

    const floorGlow = target.createRadialGradient(
      BOARD_X + BOARD_SIZE / 2,
      BOARD_Y + BOARD_SIZE / 2,
      30,
      BOARD_X + BOARD_SIZE / 2,
      BOARD_Y + BOARD_SIZE / 2,
      BOARD_SIZE * 0.7,
    );
    floorGlow.addColorStop(0, "rgba(67, 169, 119, 0.08)");
    floorGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    target.fillStyle = floorGlow;
    target.fillRect(BOARD_X, BOARD_Y, BOARD_SIZE, BOARD_SIZE);

    const cellSize = BOARD_SIZE / gridSize;
    for (let y = 0; y < gridSize; y += 1) {
      for (let x = 0; x < gridSize; x += 1) {
        if ((x + y) % 2 !== 0) continue;
        target.fillStyle = "rgba(184, 236, 151, 0.015)";
        target.fillRect(
          BOARD_X + x * cellSize,
          BOARD_Y + y * cellSize,
          cellSize,
          cellSize,
        );
      }
    }

    target.strokeStyle = "rgba(104, 186, 128, 0.13)";
    target.lineWidth = 0.7;
    for (let coordinate = 0; coordinate <= gridSize; coordinate += 1) {
      const offset = coordinate * cellSize;
      target.beginPath();
      target.moveTo(BOARD_X + offset, BOARD_Y);
      target.lineTo(BOARD_X + offset, BOARD_Y + BOARD_SIZE);
      target.stroke();

      target.beginPath();
      target.moveTo(BOARD_X, BOARD_Y + offset);
      target.lineTo(BOARD_X + BOARD_SIZE, BOARD_Y + offset);
      target.stroke();
    }

    target.fillStyle = "#020906";
    target.beginPath();
    target.moveTo(BOARD_X, BOARD_Y + BOARD_SIZE);
    target.lineTo(BOARD_X + BOARD_SIZE, BOARD_Y + BOARD_SIZE);
    target.lineTo(
      BOARD_X + BOARD_SIZE - BOARD_DEPTH,
      BOARD_Y + BOARD_SIZE + BOARD_DEPTH,
    );
    target.lineTo(BOARD_X + BOARD_DEPTH, BOARD_Y + BOARD_SIZE + BOARD_DEPTH);
    target.closePath();
    target.fill();

    target.fillStyle = "#04100b";
    target.beginPath();
    target.moveTo(BOARD_X + BOARD_SIZE, BOARD_Y);
    target.lineTo(BOARD_X + BOARD_SIZE + BOARD_DEPTH, BOARD_Y + BOARD_DEPTH);
    target.lineTo(
      BOARD_X + BOARD_SIZE + BOARD_DEPTH,
      BOARD_Y + BOARD_SIZE,
    );
    target.lineTo(BOARD_X + BOARD_SIZE, BOARD_Y + BOARD_SIZE);
    target.closePath();
    target.fill();

    target.strokeStyle = "rgba(199, 240, 139, 0.42)";
    target.lineWidth = 1.5;
    traceRoundedRect(
      target,
      BOARD_X - 1,
      BOARD_Y - 1,
      BOARD_SIZE + 2,
      BOARD_SIZE + 2,
      2,
    );
    target.stroke();

    target.strokeStyle = "rgba(88, 226, 207, 0.17)";
    target.lineWidth = 3;
    target.beginPath();
    target.moveTo(BOARD_X + 18, BOARD_Y - 5);
    target.lineTo(BOARD_X + BOARD_SIZE - 18, BOARD_Y - 5);
    target.stroke();

    const vignette = target.createRadialGradient(
      SNAKE_CANVAS_WIDTH / 2,
      SNAKE_CANVAS_HEIGHT / 2,
      145,
      SNAKE_CANVAS_WIDTH / 2,
      SNAKE_CANVAS_HEIGHT / 2,
      340,
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.48)");
    target.fillStyle = vignette;
    target.fillRect(0, 0, SNAKE_CANVAS_WIDTH, SNAKE_CANVAS_HEIGHT);

    target.fillStyle = "rgba(185, 232, 148, 0.022)";
    for (let y = 0; y < SNAKE_CANVAS_HEIGHT; y += 5) {
      target.fillRect(0, y, SNAKE_CANVAS_WIDTH, 1);
    }
  };

  const configure = (): void => {
    const ratio = configureFixedCanvas(
      canvas,
      context,
      SNAKE_CANVAS_WIDTH,
      SNAKE_CANVAS_HEIGHT,
      MAX_PIXEL_RATIO,
    );
    context.imageSmoothingEnabled = true;
    configureLayer(staticLayer, ratio);
    configureLayer(obstacleLayer, ratio);
    cachedObstacleSignature = "";
    drawStaticLayer();
    configured = true;
  };

  const drawRaisedObstacle = (
    target: CanvasRenderingContext2D,
    point: Point,
    index: number,
  ): void => {
    const center = projectCellCenter(point);
    const size = center.cellWidth * 0.74;
    const half = size / 2;
    const elevation = 4 + (index % 2);
    const left = center.x - half;
    const top = center.y - half - elevation;
    const right = center.x + half;
    const bottom = center.y + half - elevation;

    target.fillStyle = "rgba(0, 0, 0, 0.42)";
    target.fillRect(left + 3, top + elevation + 5, size, size * 0.56);

    target.fillStyle = index % 2 === 0 ? "#0b1b15" : "#0e2119";
    target.beginPath();
    target.moveTo(left, bottom);
    target.lineTo(right, bottom);
    target.lineTo(right, bottom + elevation);
    target.lineTo(left, bottom + elevation);
    target.closePath();
    target.fill();

    target.fillStyle = "#10271e";
    target.beginPath();
    target.moveTo(right, top);
    target.lineTo(right + elevation, top + elevation);
    target.lineTo(right + elevation, bottom + elevation);
    target.lineTo(right, bottom);
    target.closePath();
    target.fill();

    const obstacleGradient = target.createLinearGradient(left, top, right, bottom);
    obstacleGradient.addColorStop(0, "#1a382b");
    obstacleGradient.addColorStop(1, "#0d1e17");
    target.fillStyle = obstacleGradient;
    target.strokeStyle = "rgba(190, 235, 146, 0.42)";
    target.lineWidth = 1;
    traceRoundedRect(target, left, top, size, size, 2);
    target.fill();
    target.stroke();

    target.fillStyle = "rgba(88, 226, 207, 0.62)";
    target.fillRect(
      center.x - size * 0.18,
      bottom - size * 0.16,
      size * 0.36,
      1.5,
    );
  };

  const refreshObstacleLayer = (obstacles: ReadonlySet<string>): void => {
    const signature = [...obstacles].sort().join("|");
    if (signature === cachedObstacleSignature) return;
    cachedObstacleSignature = signature;

    const target = obstacleLayer.context;
    target.clearRect(0, 0, SNAKE_CANVAS_WIDTH, SNAKE_CANVAS_HEIGHT);
    const points = [...obstacles]
      .map((key) => {
        const [x = 0, y = 0] = key.split(",").map(Number);
        return { x, y };
      })
      .sort((left, right) => left.y - right.y || left.x - right.x);
    points.forEach((point, index) => drawRaisedObstacle(target, point, index));
  };

  const drawGlassBlock = (
    center: ProjectedPoint,
    size: number,
    color: string,
    fillAlpha: number,
    elevation: number,
    glow: number,
  ): void => {
    const half = size / 2;
    const left = center.x - half;
    const top = center.y - half - elevation;
    const right = center.x + half;
    const bottom = center.y + half - elevation;

    context.save();
    context.fillStyle = "rgba(0, 0, 0, 0.32)";
    context.fillRect(left + 2.5, center.y - half + 4, size, size * 0.7);

    context.fillStyle = "rgba(4, 17, 13, 0.46)";
    context.beginPath();
    context.moveTo(left, bottom);
    context.lineTo(right, bottom);
    context.lineTo(right, bottom + elevation);
    context.lineTo(left, bottom + elevation);
    context.closePath();
    context.fill();

    context.fillStyle = "rgba(7, 26, 20, 0.42)";
    context.beginPath();
    context.moveTo(right, top);
    context.lineTo(right + elevation, top + elevation);
    context.lineTo(right + elevation, bottom + elevation);
    context.lineTo(right, bottom);
    context.closePath();
    context.fill();

    context.shadowColor = color;
    context.shadowBlur = glow;
    context.fillStyle = color;
    context.globalAlpha = fillAlpha;
    traceRoundedRect(context, left, top, size, size, 2.2);
    context.fill();

    context.globalAlpha = 0.82;
    context.strokeStyle = color;
    context.lineWidth = 1.15;
    traceRoundedRect(context, left, top, size, size, 2.2);
    context.stroke();

    context.globalAlpha = 0.28;
    context.fillStyle = "#eaffdf";
    context.fillRect(left + 2, top + 2, size * 0.52, 1);
    context.fillRect(left + 2, top + 2, 1, size * 0.52);

    context.globalAlpha = 0.18;
    context.strokeStyle = "#eaffdf";
    context.lineWidth = 0.8;
    traceRoundedRect(
      context,
      left + size * 0.2,
      top + size * 0.2,
      size * 0.6,
      size * 0.6,
      1,
    );
    context.stroke();
    context.restore();
  };

  const interpolatedSnake = (state: SnakeRenderState): FloatPoint[] =>
    state.snake.map((segment, index) => {
      const previous = state.previousSnake[index] ?? segment;
      return interpolatePoint(previous, segment, state.movementProgress);
    });

  const drawGlassSnakeSegment = (
    point: FloatPoint,
    index: number,
    length: number,
    flow: number,
    overdrive: boolean,
    danger: boolean,
    time: number,
  ): void => {
    const center = projectBoardPoint({ x: point.x + 0.5, y: point.y + 0.5 });
    const tailProgress = length <= 1 ? 0 : index / (length - 1);
    const size = center.cellWidth * lerp(0.69, 0.57, tailProgress);
    const pulseIndex = reducedMotionQuery.matches
      ? -1
      : Math.floor((time / (overdrive ? 65 : 105)) % Math.max(1, length));
    const pulsing = index === pulseIndex;
    const color =
      danger && index < 3
        ? "#f0c36f"
        : overdrive
          ? "#58e2cf"
          : "#72e7d1";
    const alpha = clamp(0.2 - tailProgress * 0.08 + flow * 0.008, 0.13, 0.3);
    drawGlassBlock(
      center,
      size,
      color,
      pulsing ? alpha + 0.12 : alpha,
      3,
      pulsing || overdrive ? 9 : 3,
    );

    context.save();
    context.fillStyle = pulsing ? "#e8fff7" : color;
    context.globalAlpha = lerp(0.66, 0.24, tailProgress);
    context.shadowColor = color;
    context.shadowBlur = pulsing ? 9 : 3;
    context.fillRect(center.x - 1.2, center.y - 4.4, 2.4, 2.4);
    context.restore();
  };

  const drawGlassSnakeHead = (
    head: FloatPoint,
    direction: Point,
    flow: number,
    overdrive: boolean,
    danger: boolean,
  ): void => {
    const center = projectBoardPoint({ x: head.x + 0.5, y: head.y + 0.5 });
    const size = center.cellWidth * 0.91;
    const color = danger ? "#f0c36f" : overdrive ? "#58e2cf" : "#9cf3df";
    drawGlassBlock(
      center,
      size,
      color,
      overdrive ? 0.37 : 0.29 + flow * 0.01,
      4,
      danger || overdrive || flow >= 4 ? 11 : 6,
    );

    const perpendicular = { x: -direction.y, y: direction.x };
    const frontDistance = size * 0.23;
    const sideDistance = size * 0.18;
    const eyeYCorrection = -4;

    context.save();
    context.strokeStyle = color;
    context.fillStyle = "#effff8";
    context.lineWidth = 1;
    context.shadowColor = color;
    context.shadowBlur = 8;
    for (const side of [-1, 1] as const) {
      const baseX =
        center.x +
        direction.x * frontDistance +
        perpendicular.x * sideDistance * side;
      const baseY =
        center.y +
        direction.y * frontDistance +
        perpendicular.y * sideDistance * side +
        eyeYCorrection;
      const tipX = baseX + direction.x * 2.6;
      const tipY = baseY + direction.y * 2.6 - 1.5;
      context.beginPath();
      context.moveTo(baseX, baseY);
      context.lineTo(tipX, tipY);
      context.stroke();
      context.beginPath();
      context.arc(tipX, tipY, 1.7, 0, TAU);
      context.fill();
    }
    context.restore();
  };

  const drawPickupFrame = (
    point: Point,
    time: number,
    bonus: boolean,
    remainingMs: number,
  ): void => {
    const center = projectCellCenter(point);
    const pulse = reducedMotionQuery.matches
      ? 1
      : 1 + Math.sin(time / (bonus ? 120 : 190)) * 0.06;
    const frameSize = center.cellWidth * (bonus ? 0.86 : 0.78) * pulse;
    const half = frameSize / 2;
    const color = bonus ? "#f0c36f" : "#b5f58f";

    context.save();
    context.fillStyle = bonus
      ? "rgba(240, 195, 111, 0.08)"
      : "rgba(181, 245, 143, 0.08)";
    context.beginPath();
    context.arc(center.x, center.y, frameSize * 0.65, 0, TAU);
    context.fill();

    context.strokeStyle = color;
    context.lineWidth = 1.35;
    context.shadowColor = color;
    context.shadowBlur = bonus ? 11 : 7;
    const corner = frameSize * 0.24;
    for (const [x, y, horizontal, vertical] of [
      [center.x - half, center.y - half, 1, 1],
      [center.x + half, center.y - half, -1, 1],
      [center.x + half, center.y + half, -1, -1],
      [center.x - half, center.y + half, 1, -1],
    ] as const) {
      context.beginPath();
      context.moveTo(x + horizontal * corner, y);
      context.lineTo(x, y);
      context.lineTo(x, y + vertical * corner);
      context.stroke();
    }

    // Pickups are deliberately flat and symmetrical. The previous raised
    // glass block had a mathematically centred anchor but still looked high
    // because its bright top face dominated the darker extrusion. Drawing the
    // energy core around the exact cell centre keeps regular and bonus items
    // optically centred as well as geometrically centred.
    const coreSize = center.cellWidth * (bonus ? 0.42 : 0.34);
    const coreHalf = coreSize / 2;
    const coreLeft = center.x - coreHalf;
    const coreTop = center.y - coreHalf;

    context.fillStyle = color;
    context.globalAlpha = bonus ? 0.34 : 0.27;
    traceRoundedRect(context, coreLeft, coreTop, coreSize, coreSize, 1.8);
    context.fill();

    context.globalAlpha = 0.92;
    context.strokeStyle = color;
    context.lineWidth = 1.15;
    traceRoundedRect(context, coreLeft, coreTop, coreSize, coreSize, 1.8);
    context.stroke();

    context.globalAlpha = bonus ? 0.76 : 0.58;
    context.strokeStyle = "#efffe7";
    context.lineWidth = 0.9;
    context.beginPath();
    context.moveTo(center.x, center.y - coreSize * 0.27);
    context.lineTo(center.x + coreSize * 0.27, center.y);
    context.lineTo(center.x, center.y + coreSize * 0.27);
    context.lineTo(center.x - coreSize * 0.27, center.y);
    context.closePath();
    context.stroke();

    context.globalAlpha = bonus ? 0.9 : 0.72;
    context.fillStyle = "#efffe7";
    context.beginPath();
    context.arc(center.x, center.y, bonus ? 1.7 : 1.35, 0, TAU);
    context.fill();

    if (bonus) {
      const expiry = clamp(remainingMs / BONUS_DURATION_MS, 0, 1);
      context.strokeStyle = color;
      context.globalAlpha = 0.78;
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(
        center.x,
        center.y,
        frameSize * 0.58,
        -Math.PI / 2,
        -Math.PI / 2 + TAU * expiry,
      );
      context.stroke();
    }
    context.restore();
  };

  const nextCellIsDangerous = (state: SnakeRenderState): boolean => {
    const head = state.snake[0];
    if (!head) return false;
    const next = {
      x: head.x + state.direction.x,
      y: head.y + state.direction.y,
    };
    if (next.x < 0 || next.x >= gridSize || next.y < 0 || next.y >= gridSize) {
      return true;
    }
    if (state.obstacles.has(cellKey(next.x, next.y))) return true;
    return state.snake
      .slice(0, -1)
      .some((point) => point.x === next.x && point.y === next.y);
  };

  const drawDangerCell = (state: SnakeRenderState): void => {
    if (!nextCellIsDangerous(state)) return;
    const head = state.snake[0];
    if (!head) return;
    const next = {
      x: head.x + state.direction.x,
      y: head.y + state.direction.y,
    };
    if (next.x < 0 || next.x >= gridSize || next.y < 0 || next.y >= gridSize) {
      return;
    }

    const cellSize = BOARD_SIZE / gridSize;
    context.save();
    context.fillStyle = "rgba(240, 195, 111, 0.09)";
    context.strokeStyle = "rgba(240, 195, 111, 0.7)";
    context.lineWidth = 1.4;
    context.shadowColor = "rgba(240, 195, 111, 0.45)";
    context.shadowBlur = 7;
    context.fillRect(
      BOARD_X + next.x * cellSize + 2,
      BOARD_Y + next.y * cellSize + 2,
      cellSize - 4,
      cellSize - 4,
    );
    context.strokeRect(
      BOARD_X + next.x * cellSize + 2,
      BOARD_Y + next.y * cellSize + 2,
      cellSize - 4,
      cellSize - 4,
    );
    context.restore();
  };

  const drawEffect = (effect: SnakeVisualEffect | null, time: number): void => {
    if (!effect) return;
    const age = time - effect.startedAt;
    const duration = effect.kind === "collision" ? 650 : 380;
    if (age < 0 || age > duration) return;

    const progress = age / duration;
    const projected = projectCellCenter(effect.point, 3);
    const color =
      effect.kind === "regular-food"
        ? "#b5f58f"
        : effect.kind === "bonus-food"
          ? "#f0c36f"
          : "#ef7d68";
    const count = effect.kind === "collision" ? 12 : 7;

    context.save();
    context.fillStyle = color;
    context.strokeStyle = color;
    context.globalAlpha = 1 - progress;
    context.shadowColor = color;
    context.shadowBlur = 6;
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * TAU + index * 0.29;
      const distance =
        easeOutCubic(progress) * (effect.kind === "collision" ? 27 : 16);
      const x = projected.x + Math.cos(angle) * distance;
      const y = projected.y + Math.sin(angle) * distance;
      context.fillRect(x - 1, y - 1, 2, 2);
    }
    context.beginPath();
    context.arc(projected.x, projected.y, 3 + progress * 15, 0, TAU);
    context.stroke();
    context.restore();
  };

  const drawProtocolMarker = (protocol: SnakeProtocol | null): void => {
    if (!protocol) return;
    const label =
      protocol === "stabilize"
        ? "STABLE"
        : protocol === "dense-grid"
          ? "DENSE"
          : protocol === "tail-pressure"
            ? "TAIL+"
            : "CLOCK+";
    context.save();
    context.font = "9px monospace";
    context.textAlign = "left";
    context.fillStyle = "rgba(199, 240, 139, 0.5)";
    context.fillText(label, 18, SNAKE_CANVAS_HEIGHT - 13);
    context.restore();
  };

  const drawArenaStatus = (state: SnakeRenderState): void => {
    context.save();
    const pulse = reducedMotionQuery.matches
      ? 0.42
      : 0.4 + Math.sin(state.time / 780) * 0.06;
    context.strokeStyle = `rgba(199, 240, 139, ${pulse})`;
    context.lineWidth = 1.3;
    context.strokeRect(BOARD_X, BOARD_Y, BOARD_SIZE, BOARD_SIZE);

    context.font = "10px monospace";
    context.textAlign = "center";
    context.fillStyle = "rgba(197, 239, 151, 0.44)";
    context.fillText(
      `SECTOR ${String(state.sector).padStart(2, "0")}`,
      SNAKE_CANVAS_WIDTH / 2,
      BOARD_Y - 14,
    );
    context.restore();
  };

  const draw = (state: SnakeRenderState): void => {
    if (!configured) configure();
    refreshObstacleLayer(state.obstacles);

    context.clearRect(0, 0, SNAKE_CANVAS_WIDTH, SNAKE_CANVAS_HEIGHT);
    context.drawImage(
      staticLayer.canvas,
      0,
      0,
      staticLayer.canvas.width,
      staticLayer.canvas.height,
      0,
      0,
      SNAKE_CANVAS_WIDTH,
      SNAKE_CANVAS_HEIGHT,
    );
    context.drawImage(
      obstacleLayer.canvas,
      0,
      0,
      obstacleLayer.canvas.width,
      obstacleLayer.canvas.height,
      0,
      0,
      SNAKE_CANVAS_WIDTH,
      SNAKE_CANVAS_HEIGHT,
    );

    drawArenaStatus(state);
    drawDangerCell(state);
    if (state.food) drawPickupFrame(state.food, state.time, false, 0);
    if (state.bonusFood) {
      drawPickupFrame(
        state.bonusFood,
        state.time,
        true,
        state.bonusRemainingMs,
      );
    }

    const snakePoints = interpolatedSnake(state);
    const danger = nextCellIsDangerous(state);
    for (let index = snakePoints.length - 1; index >= 1; index -= 1) {
      const point = snakePoints[index];
      if (!point) continue;
      drawGlassSnakeSegment(
        point,
        index,
        snakePoints.length,
        state.flow,
        state.overdriveActive,
        danger,
        state.time,
      );
    }

    const head = snakePoints[0];
    if (head) {
      drawGlassSnakeHead(
        head,
        state.direction,
        state.flow,
        state.overdriveActive,
        danger,
      );
    }

    drawEffect(state.eatEffect, state.time);
    drawEffect(state.collisionEffect, state.time);
    drawProtocolMarker(state.activeProtocol);
  };

  return { configure, draw };
}
