export interface Point {
  x: number;
  y: number;
}

export type SectorGateSide = "top" | "right" | "bottom" | "left";

export interface SectorGate {
  side: SectorGateSide;
  index: number;
  entry: Point;
}

export type TurnDirection = "left" | "right";
export type SnakeProtocol =
  "stabilize" | "overclock" | "dense-grid" | "tail-pressure";

export interface SectorLayout {
  obstacles: Set<string>;
  reachableCells: Point[];
}

export interface ProtocolDefinition {
  id: SnakeProtocol;
  name: string;
  summary: string;
  scoreMultiplier: number;
  speedMultiplier: number;
  extraObstacleCells: number;
  extraGrowth: number;
  tailReduction: number;
}

export type SnakeStepKind =
  | "move"
  | "regular-food"
  | "bonus-food"
  | "sector-gate"
  | "collision";

export type SnakeCollisionKind = "wall" | "obstacle" | "self";

export interface SnakeStepResult {
  kind: SnakeStepKind;
  snake: Point[];
  head: Point;
  collision?: SnakeCollisionKind;
}

interface SnakeStepOptions {
  snake: Point[];
  direction: Point;
  food: Point | null;
  bonusFood: Point | null;
  gate?: SectorGate | null;
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

interface SectorLayoutOptions {
  seed: number;
  gridSize: number;
  sector: number;
  snake: readonly Point[];
  extraObstacleCells?: number;
}

interface SectorGateOptions {
  seed: number;
  sector: number;
  gridSize: number;
  snake: readonly Point[];
  obstacles: ReadonlySet<string>;
  reachableCells?: readonly Point[];
}

const MINIMUM_REACHABLE_RATIO = 0.7;
const CARDINAL_DIRECTIONS: readonly Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export const PROTOCOLS: Readonly<Record<SnakeProtocol, ProtocolDefinition>> = {
  stabilize: {
    id: "stabilize",
    name: "STABILIZE",
    summary: "REMOVE 2 TAIL · SPEED -5%",
    scoreMultiplier: 1,
    speedMultiplier: 1.05,
    extraObstacleCells: 0,
    extraGrowth: 0,
    tailReduction: 2,
  },
  overclock: {
    id: "overclock",
    name: "OVERCLOCK",
    summary: "SCORE +35% · SPEED +6%",
    scoreMultiplier: 1.35,
    speedMultiplier: 0.94,
    extraObstacleCells: 0,
    extraGrowth: 0,
    tailReduction: 0,
  },
  "dense-grid": {
    id: "dense-grid",
    name: "DENSE GRID",
    summary: "SCORE +45% · HAZARDS +4",
    scoreMultiplier: 1.45,
    speedMultiplier: 1,
    extraObstacleCells: 4,
    extraGrowth: 0,
    tailReduction: 0,
  },
  "tail-pressure": {
    id: "tail-pressure",
    name: "TAIL PRESSURE",
    summary: "SCORE +55% · EXTRA GROWTH",
    scoreMultiplier: 1.55,
    speedMultiplier: 1,
    extraObstacleCells: 0,
    extraGrowth: 1,
    tailReduction: 0,
  },
};

export const cellKey = (x: number, y: number): string => `${x},${y}`;

export const samePoint = (left: Point | null, right: Point | null): boolean =>
  Boolean(left && right && left.x === right.x && left.y === right.y);

export const isInsideBoard = (point: Point, gridSize: number): boolean =>
  point.x >= 0 && point.x < gridSize && point.y >= 0 && point.y < gridSize;

export const isOppositeDirection = (current: Point, next: Point): boolean =>
  current.x + next.x === 0 && current.y + next.y === 0;

export const turnDirection = (current: Point, turn: TurnDirection): Point => {
  const next =
    turn === "left"
      ? { x: current.y, y: -current.x }
      : { x: -current.y, y: current.x };

  return {
    x: Object.is(next.x, -0) ? 0 : next.x,
    y: Object.is(next.y, -0) ? 0 : next.y,
  };
};

export const startingSnake = (gridSize = 20): Point[] => {
  const x = Math.floor(gridSize / 2);
  const headY = Math.min(gridSize - 5, Math.floor(gridSize * 0.62));

  return [0, 1, 2, 3, 4].map((offset) => ({ x, y: headY + offset }));
};

export const allBoardCells = (gridSize: number): Point[] =>
  Array.from({ length: gridSize * gridSize }, (_, index) => ({
    x: index % gridSize,
    y: Math.floor(index / gridSize),
  }));

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

export function reachableCells(
  blockedCells: ReadonlySet<string>,
  gridSize: number,
  start: Point,
): Set<string> {
  if (!isInsideBoard(start, gridSize)) {
    return new Set();
  }

  const startKey = cellKey(start.x, start.y);

  if (blockedCells.has(startKey)) {
    return new Set();
  }

  const visited = new Set([startKey]);
  const queue = [start];
  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const current = queue[queueIndex];
    queueIndex += 1;

    if (!current) continue;

    for (const direction of CARDINAL_DIRECTIONS) {
      const neighbor = {
        x: current.x + direction.x,
        y: current.y + direction.y,
      };

      if (!isInsideBoard(neighbor, gridSize)) continue;

      const key = cellKey(neighbor.x, neighbor.y);

      if (blockedCells.has(key) || visited.has(key)) continue;

      visited.add(key);
      queue.push(neighbor);
    }
  }

  return visited;
}

const parseCell = (key: string): Point => {
  const [x = 0, y = 0] = key.split(",").map(Number);
  return { x, y };
};

const reserveCellsAroundSnake = (
  snake: readonly Point[],
  gridSize: number,
): Set<string> => {
  const reserved = new Set<string>();

  snake.forEach((segment, index) => {
    const radius = index === 0 ? 3 : 1;

    for (let y = segment.y - radius; y <= segment.y + radius; y += 1) {
      for (let x = segment.x - radius; x <= segment.x + radius; x += 1) {
        const point = { x, y };
        if (isInsideBoard(point, gridSize)) reserved.add(cellKey(x, y));
      }
    }
  });

  return reserved;
};

export function generateSectorLayout({
  seed,
  gridSize,
  sector,
  snake,
  extraObstacleCells = 0,
}: SectorLayoutOptions): SectorLayout {
  const head = snake[0] ?? {
    x: Math.floor(gridSize / 2),
    y: Math.floor(gridSize / 2),
  };

  if (sector <= 1) {
    return {
      obstacles: new Set(),
      reachableCells: allBoardCells(gridSize),
    };
  }

  const random = seededRandom(seed ^ Math.imul(sector, 0x9e3779b1));
  const reserved = reserveCellsAroundSnake(snake, gridSize);
  const baseTarget =
    sector === 2 ? 4 : sector === 3 ? 7 : 10 + Math.max(0, sector - 4) * 2;
  const targetCells = Math.min(
    Math.floor(gridSize * gridSize * 0.16),
    baseTarget + extraObstacleCells,
  );

  for (let attempt = 0; attempt < 90; attempt += 1) {
    const obstacles = new Set<string>();
    const segmentTarget = Math.max(2, Math.ceil(targetCells / 4));

    for (let segment = 0; segment < segmentTarget; segment += 1) {
      const horizontal = random() < 0.5;
      const length = 2 + Math.floor(random() * Math.min(5, 2 + sector / 2));
      const startX = 1 + Math.floor(random() * Math.max(1, gridSize - 2));
      const startY = 1 + Math.floor(random() * Math.max(1, gridSize - 2));

      for (let offset = 0; offset < length; offset += 1) {
        const point = {
          x: horizontal ? startX + offset : startX,
          y: horizontal ? startY : startY + offset,
        };

        if (!isInsideBoard(point, gridSize)) continue;
        if (
          point.x === 0 ||
          point.y === 0 ||
          point.x === gridSize - 1 ||
          point.y === gridSize - 1
        )
          continue;

        const key = cellKey(point.x, point.y);
        if (!reserved.has(key)) obstacles.add(key);
      }
    }

    if (obstacles.size < Math.min(5, targetCells)) continue;

    const reachable = reachableCells(obstacles, gridSize, head);
    const freeCount = gridSize * gridSize - obstacles.size;

    if (reachable.size >= freeCount * MINIMUM_REACHABLE_RATIO) {
      return {
        obstacles,
        reachableCells: Array.from(reachable, parseCell),
      };
    }
  }

  return {
    obstacles: new Set(),
    reachableCells: allBoardCells(gridSize),
  };
}

export function protocolChoices(
  seed: number,
  sector: number,
): [SnakeProtocol, SnakeProtocol] {
  const riskyChoices: SnakeProtocol[] = [
    "overclock",
    "dense-grid",
    "tail-pressure",
  ];
  const random = seededRandom(seed ^ Math.imul(sector + 1, 0x85ebca6b));
  const risky =
    riskyChoices[Math.floor(random() * riskyChoices.length)] ?? "overclock";

  // Every transition offers a recovery route and a higher-scoring route. This
  // keeps a difficult sector from forcing the player into another punishment.
  return random() < 0.5 ? ["stabilize", risky] : [risky, "stabilize"];
}

export function chooseSectorGate({
  seed,
  sector,
  gridSize,
  snake,
  obstacles,
  reachableCells: reachableCandidates,
}: SectorGateOptions): SectorGate | null {
  const head = snake[0];
  if (!head || gridSize < 6) return null;

  const occupied = new Set(snake.map(({ x, y }) => cellKey(x, y)));
  const reachable = new Set(
    (reachableCandidates ?? allBoardCells(gridSize)).map(({ x, y }) =>
      cellKey(x, y),
    ),
  );
  const candidates: SectorGate[] = [];

  const addCandidate = (side: SectorGateSide, index: number): void => {
    const entry =
      side === "top"
        ? { x: index, y: 0 }
        : side === "right"
          ? { x: gridSize - 1, y: index }
          : side === "bottom"
            ? { x: index, y: gridSize - 1 }
            : { x: 0, y: index };
    const approach =
      side === "top"
        ? { x: index, y: 1 }
        : side === "right"
          ? { x: gridSize - 2, y: index }
          : side === "bottom"
            ? { x: index, y: gridSize - 2 }
            : { x: 1, y: index };
    const entryKey = cellKey(entry.x, entry.y);
    const approachKey = cellKey(approach.x, approach.y);
    const distance = Math.abs(entry.x - head.x) + Math.abs(entry.y - head.y);

    if (distance < 6) return;
    if (occupied.has(entryKey) || occupied.has(approachKey)) return;
    if (obstacles.has(entryKey) || obstacles.has(approachKey)) return;
    if (!reachable.has(entryKey) || !reachable.has(approachKey)) return;
    candidates.push({ side, index, entry });
  };

  for (let index = 2; index <= gridSize - 3; index += 1) {
    addCandidate("top", index);
    addCandidate("right", index);
    addCandidate("bottom", index);
    addCandidate("left", index);
  }

  if (candidates.length === 0) return null;
  const random = seededRandom(
    seed ^ Math.imul(sector + 17, 0x27d4eb2d) ^ candidates.length,
  );
  return candidates[Math.floor(random() * candidates.length)] ?? null;
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
  gate = null,
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

  const nextHead = {
    x: currentHead.x + direction.x,
    y: currentHead.y + direction.y,
  };

  if (!isInsideBoard(nextHead, gridSize)) {
    return {
      kind: "collision",
      snake,
      head: nextHead,
      collision: "wall",
    };
  }

  if (obstacles.has(cellKey(nextHead.x, nextHead.y))) {
    return {
      kind: "collision",
      snake,
      head: nextHead,
      collision: "obstacle",
    };
  }

  const reachingSectorGate = samePoint(gate?.entry ?? null, nextHead);
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

  if (!eatingRegularFood) nextSnake.pop();

  return {
    kind: reachingSectorGate
      ? "sector-gate"
      : eatingRegularFood
        ? "regular-food"
        : eatingBonusFood
          ? "bonus-food"
          : "move",
    snake: nextSnake,
    head: nextHead,
  };
}

export const sectorForFoods = (
  foodsEaten: number,
  foodsPerSector = 6,
): number => Math.floor(Math.max(0, foodsEaten) / foodsPerSector) + 1;

export const speedForSector = (
  sector: number,
  startSpeed = 170,
  minimumSpeed = 100,
): number => Math.max(minimumSpeed, startSpeed - Math.max(0, sector - 1) * 5);

export const calculateFlowScore = (
  baseScore: number,
  flowMultiplier: number,
  protocolMultiplier: number,
): number =>
  Math.max(
    0,
    Math.round(
      baseScore * Math.max(1, flowMultiplier) * Math.max(1, protocolMultiplier),
    ),
  );

export const shrinkSnake = (
  snake: readonly Point[],
  amount: number,
  minimumLength = 5,
): Point[] => {
  const nextLength = Math.max(
    minimumLength,
    snake.length - Math.max(0, Math.floor(amount)),
  );
  return snake.slice(0, nextLength).map((point) => ({ ...point }));
};

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
