export interface Point {
  x: number;
  y: number;
}

export type SnakeMode = "free" | "maze";

export interface MazeLayout {
  obstacles: Set<string>;
  reachableCells: Point[];
}

export type SnakeStepKind =
  | "move"
  | "regular-food"
  | "bonus-food"
  | "collision";

export interface SnakeStepResult {
  kind: SnakeStepKind;
  snake: Point[];
  head: Point;
  collision?: "obstacle" | "self";
}

interface SnakeStepOptions {
  snake: Point[];
  direction: Point;
  food: Point | null;
  bonusFood: Point | null;
  obstacles: ReadonlySet<string>;
  gridSize: number;
}

interface SpawnCellOptions {
  candidates: readonly Point[];
  snake: readonly Point[];
  obstacles: ReadonlySet<string>;
  food: Point | null;
  bonusFood: Point | null;
}

const DEFAULT_MAZE_SEGMENTS = 7;
const DEFAULT_MIN_REACHABLE_RATIO = 0.72;

export const cellKey = (x: number, y: number): string => `${x},${y}`;

export const samePoint = (left: Point | null, right: Point | null): boolean =>
  Boolean(left && right && left.x === right.x && left.y === right.y);

export const isInsideBoard = (
  point: Point,
  gridSize: number,
): boolean =>
  point.x >= 0 &&
  point.x < gridSize &&
  point.y >= 0 &&
  point.y < gridSize;

export const wrapPoint = (point: Point, gridSize: number): Point => ({
  x: (point.x + gridSize) % gridSize,
  y: (point.y + gridSize) % gridSize,
});

export const isOppositeDirection = (
  current: Point,
  next: Point,
): boolean => current.x + next.x === 0 && current.y + next.y === 0;

export const startingSnake = (): Point[] => [
  { x: 9, y: 10 },
  { x: 8, y: 10 },
  { x: 7, y: 10 },
  { x: 6, y: 10 },
];

export const allBoardCells = (gridSize: number): Point[] =>
  Array.from({ length: gridSize * gridSize }, (_, index) => ({
    x: index % gridSize,
    y: Math.floor(index / gridSize),
  }));

export function reachableCells(
  blockedCells: ReadonlySet<string>,
  gridSize: number,
  start: Point,
): Set<string> {
  const wrappedStart = wrapPoint(start, gridSize);
  const startKey = cellKey(wrappedStart.x, wrappedStart.y);

  if (blockedCells.has(startKey)) {
    return new Set();
  }

  const visited = new Set([startKey]);
  const queue = [wrappedStart];
  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const current = queue[queueIndex];
    queueIndex += 1;

    if (!current) {
      continue;
    }

    const neighbors = [
      wrapPoint({ x: current.x + 1, y: current.y }, gridSize),
      wrapPoint({ x: current.x - 1, y: current.y }, gridSize),
      wrapPoint({ x: current.x, y: current.y + 1 }, gridSize),
      wrapPoint({ x: current.x, y: current.y - 1 }, gridSize),
    ];

    for (const neighbor of neighbors) {
      const key = cellKey(neighbor.x, neighbor.y);

      if (blockedCells.has(key) || visited.has(key)) {
        continue;
      }

      visited.add(key);
      queue.push(neighbor);
    }
  }

  return visited;
}

const isReservedStartCell = (point: Point): boolean =>
  point.x >= 4 && point.x <= 13 && point.y >= 8 && point.y <= 12;

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const fallbackMaze = (gridSize: number): MazeLayout => {
  const fallbackSegments = [
    [
      { x: 2, y: 4 },
      { x: 3, y: 4 },
      { x: 4, y: 4 },
      { x: 5, y: 4 },
    ],
    [
      { x: 14, y: 3 },
      { x: 14, y: 4 },
      { x: 14, y: 5 },
      { x: 14, y: 6 },
    ],
    [
      { x: 3, y: 15 },
      { x: 4, y: 15 },
      { x: 5, y: 15 },
      { x: 6, y: 15 },
    ],
    [
      { x: 15, y: 14 },
      { x: 16, y: 14 },
      { x: 17, y: 14 },
    ],
    [
      { x: 11, y: 17 },
      { x: 11, y: 18 },
    ],
  ];

  const obstacles = new Set(
    fallbackSegments
      .flat()
      .filter((point) => isInsideBoard(point, gridSize))
      .map(({ x, y }) => cellKey(x, y)),
  );
  const reachable = reachableCells(obstacles, gridSize, { x: 9, y: 10 });

  return {
    obstacles,
    reachableCells: Array.from(reachable, (key) => {
      const [x = 0, y = 0] = key.split(",").map(Number);
      return { x, y };
    }),
  };
};

export function generateMaze(
  seed: number,
  gridSize: number,
  segmentCount = DEFAULT_MAZE_SEGMENTS,
  minimumReachableRatio = DEFAULT_MIN_REACHABLE_RATIO,
): MazeLayout {
  const random = seededRandom(seed);

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const candidate = new Set<string>();

    for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
      const horizontal = random() < 0.5;
      const length = 3 + Math.floor(random() * 4);
      const maxX = horizontal ? gridSize - length - 1 : gridSize - 2;
      const maxY = horizontal ? gridSize - 2 : gridSize - length - 1;
      const startX = 1 + Math.floor(random() * Math.max(1, maxX));
      const startY = 1 + Math.floor(random() * Math.max(1, maxY));
      const cells: Point[] = [];

      for (let offset = 0; offset < length; offset += 1) {
        cells.push({
          x: horizontal ? startX + offset : startX,
          y: horizontal ? startY : startY + offset,
        });
      }

      if (cells.some(isReservedStartCell)) {
        continue;
      }

      cells.forEach(({ x, y }) => candidate.add(cellKey(x, y)));
    }

    const reachable = reachableCells(candidate, gridSize, { x: 9, y: 10 });
    const freeCellCount = gridSize * gridSize - candidate.size;

    if (
      candidate.size >= 14 &&
      reachable.size >= freeCellCount * minimumReachableRatio
    ) {
      return {
        obstacles: candidate,
        reachableCells: Array.from(reachable, (key) => {
          const [x = 0, y = 0] = key.split(",").map(Number);
          return { x, y };
        }),
      };
    }
  }

  return fallbackMaze(gridSize);
}

export function availableSpawnCells({
  candidates,
  snake,
  obstacles,
  food,
  bonusFood,
}: SpawnCellOptions): Point[] {
  const snakeCells = new Set(snake.map(({ x, y }) => cellKey(x, y)));

  return candidates.filter(({ x, y }) => {
    const key = cellKey(x, y);

    return (
      !obstacles.has(key) &&
      !snakeCells.has(key) &&
      !samePoint(food, { x, y }) &&
      !samePoint(bonusFood, { x, y })
    );
  });
}

export function advanceSnake({
  snake,
  direction,
  food,
  bonusFood,
  obstacles,
  gridSize,
}: SnakeStepOptions): SnakeStepResult {
  const currentHead = snake[0];

  if (!currentHead) {
    return {
      kind: "collision",
      snake,
      head: { x: 0, y: 0 },
      collision: "self",
    };
  }

  const nextHead = wrapPoint(
    {
      x: currentHead.x + direction.x,
      y: currentHead.y + direction.y,
    },
    gridSize,
  );

  if (obstacles.has(cellKey(nextHead.x, nextHead.y))) {
    return {
      kind: "collision",
      snake,
      head: nextHead,
      collision: "obstacle",
    };
  }

  const eatingRegularFood = samePoint(food, nextHead);
  const eatingBonusFood = samePoint(bonusFood, nextHead);
  const collisionBody = eatingRegularFood ? snake : snake.slice(0, -1);
  const hitSelf = collisionBody.some((segment) => samePoint(segment, nextHead));

  if (hitSelf) {
    return {
      kind: "collision",
      snake,
      head: nextHead,
      collision: "self",
    };
  }

  const nextSnake = [nextHead, ...snake];

  if (!eatingRegularFood) {
    nextSnake.pop();
  }

  return {
    kind: eatingRegularFood
      ? "regular-food"
      : eatingBonusFood
        ? "bonus-food"
        : "move",
    snake: nextSnake,
    head: nextHead,
  };
}

export function calculateBonusPoints(
  remainingMs: number,
  durationMs: number,
  minimumScore: number,
  maximumScore: number,
): number {
  const remainingRatio = Math.max(0, Math.min(1, remainingMs / durationMs));
  const rawScore =
    minimumScore + (maximumScore - minimumScore) * remainingRatio;

  return Math.max(minimumScore, Math.floor(rawScore / 10) * 10);
}
