import type { Point, SnakeMode } from "./snake-rules";
import { configureFixedCanvas } from "./shared/canvas";

export const SNAKE_CANVAS_WIDTH = 440;
export const SNAKE_CANVAS_HEIGHT = 444;

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
  mode: SnakeMode | null;
  bonusRemainingMs: number;
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

interface PrismPalette {
  top: string;
  right: string;
  bottom: string;
  outline: string;
  glow?: string;
}

interface Renderable {
  depth: number;
  drawShadow(): void;
  drawObject(): void;
}

const BOARD_X = 16;
const BOARD_Y = 12;
const BOARD_SIZE = 400;
const BOARD_DEPTH = 10;
const CELL_SIZE = 20;
const TAU = Math.PI * 2;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const easeInOut = (value: number): number =>
  value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;

const parseCellKey = (key: string): Point => {
  const [x = 0, y = 0] = key.split(",").map(Number);
  return { x, y };
};

const wrappedDelta = (from: number, to: number, gridSize: number): number => {
  let delta = to - from;

  if (delta > gridSize / 2) {
    delta -= gridSize;
  } else if (delta < -gridSize / 2) {
    delta += gridSize;
  }

  return delta;
};

const interpolatePoint = (
  from: Point,
  to: Point,
  progress: number,
  gridSize: number,
): FloatPoint => ({
  x: from.x + wrappedDelta(from.x, to.x, gridSize) * progress,
  y: from.y + wrappedDelta(from.y, to.y, gridSize) * progress,
});

const wrappedCopies = (point: FloatPoint, gridSize: number): FloatPoint[] => {
  const xOffsets = [0];
  const yOffsets = [0];

  if (point.x < 1) {
    xOffsets.push(gridSize);
  }
  if (point.x > gridSize - 1) {
    xOffsets.push(-gridSize);
  }
  if (point.y < 1) {
    yOffsets.push(gridSize);
  }
  if (point.y > gridSize - 1) {
    yOffsets.push(-gridSize);
  }

  return xOffsets.flatMap((offsetX) =>
    yOffsets.map((offsetY) => ({
      x: point.x + offsetX,
      y: point.y + offsetY,
    })),
  );
};

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height,
  );
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

export function createSnakeRenderer(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  gridSize: number,
): SnakeRenderer {
  const reducedMotionQuery = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );

  const configure = (): void => {
    configureFixedCanvas(
      canvas,
      context,
      SNAKE_CANVAS_WIDTH,
      SNAKE_CANVAS_HEIGHT,
    );
  };

  const boardClip = (): void => {
    context.beginPath();
    context.rect(BOARD_X, BOARD_Y, BOARD_SIZE, BOARD_SIZE);
    context.clip();
  };

  const drawBoard = (): void => {
    context.save();
    context.shadowColor = "rgba(0, 0, 0, 0.85)";
    context.shadowBlur = 22;
    context.shadowOffsetX = 7;
    context.shadowOffsetY = 12;
    context.fillStyle = "#010302";
    context.fillRect(BOARD_X + 2, BOARD_Y + 4, BOARD_SIZE, BOARD_SIZE);
    context.restore();

    context.fillStyle = "#101a10";
    context.beginPath();
    context.moveTo(BOARD_X, BOARD_Y + BOARD_SIZE);
    context.lineTo(BOARD_X + BOARD_SIZE, BOARD_Y + BOARD_SIZE);
    context.lineTo(
      BOARD_X + BOARD_SIZE + BOARD_DEPTH,
      BOARD_Y + BOARD_SIZE + BOARD_DEPTH,
    );
    context.lineTo(BOARD_X + BOARD_DEPTH, BOARD_Y + BOARD_SIZE + BOARD_DEPTH);
    context.closePath();
    context.fill();

    context.fillStyle = "#0a120b";
    context.beginPath();
    context.moveTo(BOARD_X + BOARD_SIZE, BOARD_Y);
    context.lineTo(
      BOARD_X + BOARD_SIZE + BOARD_DEPTH,
      BOARD_Y + BOARD_DEPTH,
    );
    context.lineTo(
      BOARD_X + BOARD_SIZE + BOARD_DEPTH,
      BOARD_Y + BOARD_SIZE + BOARD_DEPTH,
    );
    context.lineTo(BOARD_X + BOARD_SIZE, BOARD_Y + BOARD_SIZE);
    context.closePath();
    context.fill();

    const surface = context.createLinearGradient(
      BOARD_X,
      BOARD_Y,
      BOARD_X + BOARD_SIZE,
      BOARD_Y + BOARD_SIZE,
    );
    surface.addColorStop(0, "#061008");
    surface.addColorStop(0.56, "#030905");
    surface.addColorStop(1, "#020604");
    context.fillStyle = surface;
    context.fillRect(BOARD_X, BOARD_Y, BOARD_SIZE, BOARD_SIZE);

    context.save();
    boardClip();
    context.strokeStyle = "rgba(199, 240, 139, 0.055)";
    context.lineWidth = 1;

    for (let index = 1; index < gridSize; index += 1) {
      const x = BOARD_X + index * CELL_SIZE + 0.5;
      const y = BOARD_Y + index * CELL_SIZE + 0.5;

      context.beginPath();
      context.moveTo(x, BOARD_Y);
      context.lineTo(x, BOARD_Y + BOARD_SIZE);
      context.stroke();

      context.beginPath();
      context.moveTo(BOARD_X, y);
      context.lineTo(BOARD_X + BOARD_SIZE, y);
      context.stroke();
    }

    const sheen = context.createLinearGradient(
      BOARD_X,
      BOARD_Y,
      BOARD_X,
      BOARD_Y + BOARD_SIZE,
    );
    sheen.addColorStop(0, "rgba(231, 255, 176, 0.035)");
    sheen.addColorStop(0.35, "rgba(231, 255, 176, 0)");
    sheen.addColorStop(1, "rgba(0, 0, 0, 0.17)");
    context.fillStyle = sheen;
    context.fillRect(BOARD_X, BOARD_Y, BOARD_SIZE, BOARD_SIZE);
    context.restore();

    context.strokeStyle = "rgba(199, 240, 139, 0.24)";
    context.lineWidth = 1;
    context.strokeRect(
      BOARD_X + 0.5,
      BOARD_Y + 0.5,
      BOARD_SIZE - 1,
      BOARD_SIZE - 1,
    );
  };

  const cellRect = (
    point: FloatPoint,
    inset: number,
  ): { x: number; y: number; size: number } => ({
    x: BOARD_X + point.x * CELL_SIZE + inset,
    y: BOARD_Y + point.y * CELL_SIZE + inset,
    size: CELL_SIZE - inset * 2,
  });

  const drawShadow = (
    point: FloatPoint,
    inset: number,
    alpha: number,
    blur: number,
  ): void => {
    const { x, y, size } = cellRect(point, inset);
    context.save();
    context.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    context.shadowColor = `rgba(0, 0, 0, ${Math.min(0.75, alpha + 0.2)})`;
    context.shadowBlur = blur;
    roundedRectPath(context, x + 3, y + 5, size, size, 3);
    context.fill();
    context.restore();
  };

  const drawPrism = (
    point: FloatPoint,
    inset: number,
    elevation: number,
    palette: PrismPalette,
    radius = 2.5,
    scale = 1,
  ): void => {
    const rect = cellRect(point, inset);
    const scaledSize = rect.size * scale;
    const x = rect.x + (rect.size - scaledSize) / 2;
    const topY = rect.y + (rect.size - scaledSize) / 2 - elevation;
    const size = scaledSize;

    context.save();
    if (palette.glow) {
      context.shadowColor = palette.glow;
      context.shadowBlur = 8;
    }

    context.fillStyle = palette.right;
    context.beginPath();
    context.moveTo(x + size, topY);
    context.lineTo(x + size + elevation, topY + elevation);
    context.lineTo(x + size + elevation, topY + size + elevation);
    context.lineTo(x + size, topY + size);
    context.closePath();
    context.fill();

    context.fillStyle = palette.bottom;
    context.beginPath();
    context.moveTo(x, topY + size);
    context.lineTo(x + size, topY + size);
    context.lineTo(x + size + elevation, topY + size + elevation);
    context.lineTo(x + elevation, topY + size + elevation);
    context.closePath();
    context.fill();

    context.fillStyle = palette.top;
    roundedRectPath(context, x, topY, size, size, radius);
    context.fill();

    context.shadowBlur = 0;
    context.strokeStyle = palette.outline;
    context.lineWidth = 1;
    roundedRectPath(context, x + 0.5, topY + 0.5, size - 1, size - 1, radius);
    context.stroke();
    context.restore();
  };

  const drawObstacle = (point: FloatPoint): void => {
    drawPrism(
      point,
      2,
      7,
      {
        top: "#536b3d",
        right: "#26381f",
        bottom: "#344a28",
        outline: "rgba(231, 255, 176, 0.22)",
        glow: "rgba(127, 164, 92, 0.23)",
      },
      2,
    );

    const { x, y, size } = cellRect(point, 2);
    context.save();
    context.strokeStyle = "rgba(231, 255, 176, 0.12)";
    context.lineWidth = 1;
    context.strokeRect(x + 4.5, y - 7 + 4.5, size - 9, size - 9);
    context.restore();
  };

  const strokeSnakeLink = (
    from: FloatPoint,
    to: FloatPoint,
    offsetX: number,
    offsetY: number,
  ): void => {
    const deltaX = wrappedDelta(from.x, to.x, gridSize);
    const deltaY = wrappedDelta(from.y, to.y, gridSize);

    for (const copy of wrappedCopies(from, gridSize)) {
      const startX = BOARD_X + copy.x * CELL_SIZE + CELL_SIZE / 2 + offsetX;
      const startY = BOARD_Y + copy.y * CELL_SIZE + CELL_SIZE / 2 + offsetY;
      const endX =
        BOARD_X + (copy.x + deltaX) * CELL_SIZE + CELL_SIZE / 2 + offsetX;
      const endY =
        BOARD_Y + (copy.y + deltaY) * CELL_SIZE + CELL_SIZE / 2 + offsetY;

      context.beginPath();
      context.moveTo(startX, startY);
      context.lineTo(endX, endY);
      context.stroke();
    }
  };

  const strokeSnakeBody = (
    points: readonly FloatPoint[],
    offsetX: number,
    offsetY: number,
  ): void => {
    for (let index = 0; index < points.length - 1; index += 1) {
      const from = points[index];
      const to = points[index + 1];

      if (from && to) {
        strokeSnakeLink(from, to, offsetX, offsetY);
      }
    }
  };

  const drawSnakeBodyShadow = (points: readonly FloatPoint[]): void => {
    if (points.length < 2) {
      return;
    }

    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 16;
    context.strokeStyle = "rgba(0, 0, 0, 0.42)";
    context.shadowColor = "rgba(0, 0, 0, 0.62)";
    context.shadowBlur = 5;
    strokeSnakeBody(points, 3, 3);
    context.restore();
  };

  const drawSnakeBody = (points: readonly FloatPoint[]): void => {
    if (points.length < 2) {
      return;
    }

    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";

    // Draw each visual layer across the whole body before moving to the next.
    // This keeps internal joints covered instead of outlining every grid cell.
    context.lineWidth = 15;
    context.strokeStyle = "#496c37";
    strokeSnakeBody(points, 3, -1);

    context.lineWidth = 15.5;
    context.strokeStyle = "rgba(231, 255, 176, 0.25)";
    strokeSnakeBody(points, 0, -4);

    context.lineWidth = 14;
    context.strokeStyle = "#9fcf71";
    context.shadowColor = "rgba(199, 240, 139, 0.16)";
    context.shadowBlur = 8;
    strokeSnakeBody(points, 0, -4);
    context.restore();
  };

  const drawSnakeHead = (point: FloatPoint, direction: Point): void => {
    const elevation = 5;
    const inset = 2;

    drawPrism(
      point,
      inset,
      elevation,
      {
        top: "#e7ffb0",
        right: "#769e54",
        bottom: "#8dbd64",
        outline: "rgba(255, 255, 226, 0.68)",
        glow: "rgba(231, 255, 176, 0.5)",
      },
      3,
    );

    const rect = cellRect(point, inset);
    const topY = rect.y - elevation;
    const eyeSize = 2.4;
    let eyes: Array<[number, number]>;

    if (direction.x > 0) {
      eyes = [
        [rect.x + rect.size - 5, topY + 4],
        [rect.x + rect.size - 5, topY + rect.size - 7],
      ];
    } else if (direction.x < 0) {
      eyes = [
        [rect.x + 3, topY + 4],
        [rect.x + 3, topY + rect.size - 7],
      ];
    } else if (direction.y < 0) {
      eyes = [
        [rect.x + 4, topY + 3],
        [rect.x + rect.size - 7, topY + 3],
      ];
    } else {
      eyes = [
        [rect.x + 4, topY + rect.size - 5],
        [rect.x + rect.size - 7, topY + rect.size - 5],
      ];
    }

    context.save();
    context.fillStyle = "#07120b";
    for (const [eyeX, eyeY] of eyes) {
      context.fillRect(eyeX, eyeY, eyeSize, eyeSize);
    }
    context.restore();
  };

  const drawRegularFood = (point: FloatPoint, time: number): void => {
    const reducedMotion = reducedMotionQuery.matches;
    const bob = reducedMotion ? 0 : Math.sin(time / 230) * 1.2;
    const centerX = BOARD_X + point.x * CELL_SIZE + CELL_SIZE / 2;
    const centerY = BOARD_Y + point.y * CELL_SIZE + CELL_SIZE / 2 - 3 - bob;
    const radius = CELL_SIZE * 0.31;

    context.save();
    context.translate(centerX, centerY);
    context.rotate(Math.PI / 4);
    context.shadowColor = "rgba(217, 128, 93, 0.72)";
    context.shadowBlur = 10;
    context.fillStyle = "#6f352c";
    context.fillRect(-radius + 3, -radius + 3, radius * 2, radius * 2);
    context.fillStyle = "#d9805d";
    context.fillRect(-radius, -radius, radius * 2 - 3, radius * 2 - 3);
    context.strokeStyle = "rgba(255, 218, 187, 0.45)";
    context.strokeRect(-radius + 0.5, -radius + 0.5, radius * 2 - 4, radius * 2 - 4);
    context.restore();
  };

  const drawBonusFood = (
    point: FloatPoint,
    time: number,
    remainingMs: number,
  ): void => {
    const reducedMotion = reducedMotionQuery.matches;
    const pulse = reducedMotion ? 1 : 1 + Math.sin(time / 120) * 0.07;
    const flashing =
      remainingMs <= 2000 && Math.floor(remainingMs / 160) % 2 === 0;
    const originX = BOARD_X + point.x * CELL_SIZE;
    const originY = BOARD_Y + point.y * CELL_SIZE - 5;

    context.save();
    context.globalAlpha = flashing ? 0.38 : 1;
    context.translate(
      originX + CELL_SIZE / 2,
      originY + CELL_SIZE / 2,
    );
    context.scale(pulse, pulse);
    context.translate(-CELL_SIZE / 2, -CELL_SIZE / 2);
    context.shadowColor = "rgba(240, 195, 111, 0.88)";
    context.shadowBlur = 14;
    context.fillStyle = "#8d6331";
    context.fillRect(7, 2, 8, 18);
    context.fillRect(2, 7, 18, 8);
    context.fillStyle = "#f0c36f";
    context.fillRect(5, 0, 8, 18);
    context.fillRect(0, 5, 18, 8);
    context.shadowBlur = 0;
    context.fillStyle = "#07120b";
    context.fillRect(7, 7, 4, 4);
    context.restore();
  };

  const drawRing = (
    point: Point,
    progress: number,
    color: string,
    maximumRadius: number,
  ): void => {
    const centerX = BOARD_X + point.x * CELL_SIZE + CELL_SIZE / 2;
    const centerY = BOARD_Y + point.y * CELL_SIZE + CELL_SIZE / 2;
    context.save();
    context.globalAlpha = 1 - progress;
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(centerX, centerY, 4 + progress * maximumRadius, 0, TAU);
    context.stroke();
    context.restore();
  };

  const drawScanlines = (): void => {
    context.save();
    context.globalAlpha = 0.07;
    context.fillStyle = "#000";
    for (let y = BOARD_Y; y < BOARD_Y + BOARD_SIZE; y += 4) {
      context.fillRect(BOARD_X, y, BOARD_SIZE, 1);
    }
    context.restore();
  };

  const draw = (state: SnakeRenderState): void => {
    const reducedMotion = reducedMotionQuery.matches;
    const collisionAge = state.collisionEffect
      ? state.time - state.collisionEffect.startedAt
      : Number.POSITIVE_INFINITY;
    const shakeProgress = clamp(collisionAge / 360, 0, 1);
    const shake =
      !reducedMotion && shakeProgress < 1
        ? Math.sin(collisionAge * 0.18) * (1 - shakeProgress) * 3
        : 0;

    context.clearRect(0, 0, SNAKE_CANVAS_WIDTH, SNAKE_CANVAS_HEIGHT);
    context.fillStyle = "#010302";
    context.fillRect(0, 0, SNAKE_CANVAS_WIDTH, SNAKE_CANVAS_HEIGHT);

    context.save();
    context.translate(shake, -shake * 0.35);
    drawBoard();

    context.save();
    boardClip();

    const progress = reducedMotion
      ? 1
      : easeInOut(clamp(state.movementProgress, 0, 1));
    const renderables: Renderable[] = [];

    if (state.mode === "maze") {
      for (const key of state.obstacles) {
        const point = parseCellKey(key);
        renderables.push({
          depth: point.y + 0.15,
          drawShadow: () => drawShadow(point, 2, 0.42, 5),
          drawObject: () => drawObstacle(point),
        });
      }
    }

    if (state.food) {
      const foodPoint = state.food;
      renderables.push({
        depth: foodPoint.y + 0.35,
        drawShadow: () => drawShadow(foodPoint, 5, 0.3, 4),
        drawObject: () => drawRegularFood(foodPoint, state.time),
      });
    }

    if (state.bonusFood) {
      const bonusPoint = state.bonusFood;
      renderables.push({
        depth: bonusPoint.y + 0.38,
        drawShadow: () => drawShadow(bonusPoint, 4, 0.35, 5),
        drawObject: () =>
          drawBonusFood(bonusPoint, state.time, state.bonusRemainingMs),
      });
    }

    const interpolatedSnake = state.snake.map((segment, index) => {
      const previous =
        state.previousSnake[index] ??
        state.previousSnake[state.previousSnake.length - 1] ??
        segment;

      return interpolatePoint(previous, segment, progress, gridSize);
    });

    const head = interpolatedSnake[0];

    if (head) {
      for (const copy of wrappedCopies(head, gridSize)) {
        if (
          copy.x < -1 ||
          copy.x > gridSize ||
          copy.y < -1 ||
          copy.y > gridSize
        ) {
          continue;
        }

        renderables.push({
          depth: copy.y + 0.6,
          drawShadow: () => drawShadow(copy, 2, 0.36, 5),
          drawObject: () => drawSnakeHead(copy, state.direction),
        });
      }
    }

    drawSnakeBodyShadow(interpolatedSnake);
    renderables.forEach((renderable) => renderable.drawShadow());
    drawSnakeBody(interpolatedSnake);
    renderables
      .sort((left, right) => left.depth - right.depth)
      .forEach((renderable) => renderable.drawObject());

    if (state.eatEffect) {
      const age = state.time - state.eatEffect.startedAt;
      const duration = state.eatEffect.kind === "bonus-food" ? 360 : 260;
      const effectProgress = clamp(age / duration, 0, 1);

      if (effectProgress < 1) {
        drawRing(
          state.eatEffect.point,
          effectProgress,
          state.eatEffect.kind === "bonus-food" ? "#f0c36f" : "#d9805d",
          state.eatEffect.kind === "bonus-food" ? 23 : 17,
        );
      }
    }

    if (state.collisionEffect && shakeProgress < 1) {
      drawRing(
        state.collisionEffect.point,
        shakeProgress,
        "#e7ffb0",
        25,
      );
    }

    drawScanlines();
    context.restore();
    context.restore();

    const vignette = context.createRadialGradient(
      SNAKE_CANVAS_WIDTH / 2,
      SNAKE_CANVAS_HEIGHT / 2,
      90,
      SNAKE_CANVAS_WIDTH / 2,
      SNAKE_CANVAS_HEIGHT / 2,
      290,
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.3)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, SNAKE_CANVAS_WIDTH, SNAKE_CANVAS_HEIGHT);
  };

  return { configure, draw };
}
