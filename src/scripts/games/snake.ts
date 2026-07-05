import {
  PROTOCOLS,
  advanceSnake,
  allBoardCells,
  availableSpawnCells,
  calculateBonusPoints,
  calculateFlowScore,
  generateSectorLayout,
  isOppositeDirection,
  protocolChoices,
  reachableCells,
  seededRandom,
  shrinkSnake,
  speedForSector,
  startingSnake,
  type Point,
  type SnakeProtocol,
} from "./snake-rules";
import { dispatchGameExit, GAME_EVENTS } from "./shared/events";
import { createSnakeRenderer, type SnakeVisualEffect } from "./snake-renderer";
import { mountAllGames } from "./shared/mount";
import {
  readStoredScore,
  readStoredSession,
  removeStoredSession,
  writeStoredScore,
  writeStoredSession,
} from "./shared/storage";

type ProtocolSlot = "left" | "right";
type DirectionName = "up" | "down" | "left" | "right";

const DIRECTIONS: Readonly<Record<DirectionName, Point>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

interface SnakeSessionState {
  runSeed: number;
  spawnCounter: number;
  snake: Point[];
  food: Point | null;
  bonusFood: Point | null;
  bonusRemainingMs: number;
  obstacles: string[];
  sector: number;
  foodsInSector: number;
  totalFoods: number;
  direction: Point;
  queuedDirections: Point[];
  score: number;
  flow: number;
  maxFlow: number;
  flowRemainingMs: number;
  activeProtocol: SnakeProtocol | null;
  choosingProtocol: boolean;
  protocolChoices: [SnakeProtocol, SnakeProtocol];
}

const SNAKE_SESSION_KEY = "tiendu-snake-session";
const SNAKE_SESSION_VERSION = 3;
const HIGH_SCORE_KEY = "tiendu-snake-high-score-neon";
const LEGACY_HIGH_SCORE_KEYS = [
  "tiendu-snake-high-score-free",
  "tiendu-snake-high-score-maze",
  "tiendu-snake-high-score",
] as const;

const isPoint = (value: unknown): value is Point => {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<Point>;
  return Number.isInteger(point.x) && Number.isInteger(point.y);
};

const isProtocol = (value: unknown): value is SnakeProtocol =>
  value === "stabilize" ||
  value === "overclock" ||
  value === "dense-grid" ||
  value === "tail-pressure";

function isSnakeSessionState(value: unknown): value is SnakeSessionState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<SnakeSessionState>;

  return (
    Number.isInteger(state.runSeed) &&
    Number.isInteger(state.spawnCounter) &&
    Array.isArray(state.snake) &&
    state.snake.length >= 5 &&
    state.snake.every(isPoint) &&
    (state.food === null || isPoint(state.food)) &&
    (state.bonusFood === null || isPoint(state.bonusFood)) &&
    typeof state.bonusRemainingMs === "number" &&
    Number.isFinite(state.bonusRemainingMs) &&
    Array.isArray(state.obstacles) &&
    state.obstacles.every((item) => typeof item === "string") &&
    Number.isInteger(state.sector) &&
    Number.isInteger(state.foodsInSector) &&
    Number.isInteger(state.totalFoods) &&
    isPoint(state.direction) &&
    Array.isArray(state.queuedDirections) &&
    state.queuedDirections.length <= 2 &&
    state.queuedDirections.every(isPoint) &&
    typeof state.score === "number" &&
    Number.isFinite(state.score) &&
    Number.isInteger(state.flow) &&
    Number.isInteger(state.maxFlow) &&
    typeof state.flowRemainingMs === "number" &&
    Number.isFinite(state.flowRemainingMs) &&
    (state.activeProtocol === null || isProtocol(state.activeProtocol)) &&
    typeof state.choosingProtocol === "boolean" &&
    Array.isArray(state.protocolChoices) &&
    state.protocolChoices.length === 2 &&
    state.protocolChoices.every(isProtocol)
  );
}

export function mountSnakeGames(): void {
  mountAllGames("[data-snake-game]", "snakeInitialized", mountSnakeGame);
}

function mountSnakeGame(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLCanvasElement>("[data-snake-canvas]");
  const sectorOutput =
    root.querySelector<HTMLOutputElement>("[data-snake-mode]");
  const scoreOutput =
    root.querySelector<HTMLOutputElement>("[data-snake-score]");
  const flowOutput = root.querySelector<HTMLOutputElement>("[data-snake-flow]");
  const highScoreOutput = root.querySelector<HTMLOutputElement>(
    "[data-snake-high-score]",
  );
  const overdriveOutput = root.querySelector<HTMLOutputElement>(
    "[data-snake-overdrive]",
  );
  const bonusIndicator = root.querySelector<HTMLElement>(
    "[data-snake-bonus-indicator]",
  );
  const bonusTimeOutput = root.querySelector<HTMLOutputElement>(
    "[data-snake-bonus-time]",
  );
  const overlay = root.querySelector<HTMLElement>("[data-snake-overlay]");
  const stateLabel = root.querySelector<HTMLElement>("[data-snake-state]");
  const messageLabel = root.querySelector<HTMLElement>("[data-snake-message]");
  const statusLabel = root.querySelector<HTMLElement>("[data-snake-status]");
  const startPicker = root.querySelector<HTMLElement>(
    "[data-snake-start-picker]",
  );
  const startButton =
    root.querySelector<HTMLButtonElement>("[data-snake-start]");
  const resumePicker = root.querySelector<HTMLElement>(
    "[data-snake-resume-picker]",
  );
  const resumeSummary = root.querySelector<HTMLElement>(
    "[data-snake-resume-summary]",
  );
  const protocolPicker = root.querySelector<HTMLElement>(
    "[data-snake-protocol-picker]",
  );
  const resumeButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-snake-resume]"),
  );
  const protocolButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-snake-protocol]"),
  );
  const directionButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-snake-direction]"),
  );
  const overdriveButton = root.querySelector<HTMLButtonElement>(
    "[data-snake-overdrive-button]",
  );

  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;

  const GRID_SIZE = 20;
  const FOODS_PER_SECTOR = 6;
  const FLOW_DURATION_MS = 5000;
  const FLOW_DECAY_STEP_MS = 1500;
  const BONUS_TRIGGER_FOODS = 4;
  const BONUS_DURATION_MS = 5500;
  const BONUS_MIN_SCORE = 30;
  const BONUS_MAX_SCORE = 90;
  const MINIMUM_SNAKE_LENGTH = 5;
  const OVERDRIVE_BURN_INTERVAL_MS = 1200;
  const boardCells = allBoardCells(GRID_SIZE);
  const renderer = createSnakeRenderer(canvas, context, GRID_SIZE);

  let active = false;
  let started = false;
  let prepared = false;
  let paused = false;
  let gameOver = false;
  let choosingProtocol = false;
  let resumePrompt = false;
  let runSeed = 0;
  let spawnCounter = 0;
  let snake: Point[] = [];
  let previousSnake: Point[] = [];
  let food: Point | null = null;
  let bonusFood: Point | null = null;
  let bonusRemainingMs = 0;
  let obstacles = new Set<string>();
  let reachableBoardCells: Point[] = boardCells;
  let sector = 1;
  let foodsInSector = 0;
  let totalFoods = 0;
  let direction: Point = { x: 0, y: -1 };
  let directionQueue: Point[] = [];
  let score = 0;
  let highScore = 0;
  let newHighScoreThisRun = false;
  let flow = 1;
  let maxFlow = 1;
  let flowRemainingMs = 0;
  let activeProtocol: SnakeProtocol | null = null;
  let currentProtocolChoices: [SnakeProtocol, SnakeProtocol] = [
    "stabilize",
    "overclock",
  ];
  let overdriveActive = false;
  let overdriveBurnElapsed = 0;
  let animationFrame: number | null = null;
  let previousTime = 0;
  let accumulator = 0;
  let lastPersistAt = 0;
  let pointerStart: Point | null = null;
  let pointerId: number | null = null;
  let eatEffect: SnakeVisualEffect | null = null;
  let collisionEffect: SnakeVisualEffect | null = null;

  const createRunSeed = (): number => {
    if (globalThis.crypto) {
      const seed = new Uint32Array(1);
      globalThis.crypto.getRandomValues(seed);
      return seed[0] ?? 0;
    }

    return Date.now() ^ Math.floor(performance.now());
  };

  const clearSession = (): void => removeStoredSession(SNAKE_SESSION_KEY);

  const readHighScore = (): number => {
    const current = readStoredScore(HIGH_SCORE_KEY);
    if (current > 0) return current;

    const legacy = Math.max(...LEGACY_HIGH_SCORE_KEYS.map(readStoredScore));
    if (legacy > 0) writeStoredScore(HIGH_SCORE_KEY, legacy);
    return legacy;
  };

  const saveHighScore = (): boolean => {
    if (score <= highScore) return false;

    highScore = score;
    newHighScoreThisRun = true;
    writeStoredScore(HIGH_SCORE_KEY, highScore);
    return true;
  };

  const persistSession = (): void => {
    if (
      !prepared ||
      gameOver ||
      snake.length < MINIMUM_SNAKE_LENGTH ||
      (!started && !paused && !choosingProtocol)
    ) {
      return;
    }

    writeStoredSession<SnakeSessionState>(
      SNAKE_SESSION_KEY,
      SNAKE_SESSION_VERSION,
      {
        runSeed,
        spawnCounter,
        snake: snake.map((segment) => ({ ...segment })),
        food: food ? { ...food } : null,
        bonusFood: bonusFood ? { ...bonusFood } : null,
        bonusRemainingMs,
        obstacles: [...obstacles],
        sector,
        foodsInSector,
        totalFoods,
        direction: { ...direction },
        queuedDirections: directionQueue.map((queued) => ({ ...queued })),
        score,
        flow,
        maxFlow,
        flowRemainingMs,
        activeProtocol,
        choosingProtocol,
        protocolChoices: [...currentProtocolChoices],
      },
    );
  };

  const formatScore = (value: number): string => String(value).padStart(5, "0");
  const announce = (message: string): void => {
    if (statusLabel) statusLabel.textContent = message;
  };

  const setPickerVisibility = (options: {
    start?: boolean;
    resume?: boolean;
    protocol?: boolean;
  }): void => {
    if (startPicker) startPicker.hidden = !options.start;
    if (resumePicker) resumePicker.hidden = !options.resume;
    if (protocolPicker) protocolPicker.hidden = !options.protocol;
    resumePrompt = Boolean(options.resume);
  };

  const setOverlay = (
    title: string,
    message: string,
    visible: boolean,
    pickers: { start?: boolean; resume?: boolean; protocol?: boolean } = {},
  ): void => {
    if (stateLabel) stateLabel.textContent = title;
    if (messageLabel) messageLabel.textContent = message;
    setPickerVisibility(pickers);
    if (overlay) overlay.hidden = !visible;
  };

  const updateBonusIndicator = (): void => {
    const visible = Boolean(bonusFood && bonusRemainingMs > 0);
    if (bonusIndicator) bonusIndicator.hidden = !visible;
    if (visible && bonusTimeOutput) {
      bonusTimeOutput.textContent = String(
        Math.max(1, Math.ceil(bonusRemainingMs / 1000)),
      );
    }
  };

  const updateOverdriveIndicator = (): void => {
    const capacity = Math.max(0, snake.length - MINIMUM_SNAKE_LENGTH);
    const lit = Math.min(6, Math.ceil(capacity / 2));
    if (overdriveOutput) {
      overdriveOutput.textContent = `${"■".repeat(lit)}${"·".repeat(6 - lit)}`;
    }
    if (overdriveButton) {
      overdriveButton.classList.toggle("is-active", overdriveActive);
      overdriveButton.disabled = capacity <= 0;
    }
  };

  const updateScoreboard = (): void => {
    if (sectorOutput)
      sectorOutput.textContent = String(sector).padStart(2, "0");
    if (scoreOutput) scoreOutput.textContent = formatScore(score);
    if (flowOutput) flowOutput.textContent = `x${flow}`;
    if (highScoreOutput) highScoreOutput.textContent = formatScore(highScore);
    updateOverdriveIndicator();
  };

  const clearBonusFood = (): void => {
    bonusFood = null;
    bonusRemainingMs = 0;
    updateBonusIndicator();
  };

  const clearPointerGesture = (): void => {
    if (pointerId !== null && canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
    pointerStart = null;
    pointerId = null;
  };

  const effectiveSpeed = (): number => {
    const protocolSpeed = activeProtocol
      ? PROTOCOLS[activeProtocol].speedMultiplier
      : 1;
    const overdriveSpeed = overdriveActive ? 0.82 : 1;
    return speedForSector(sector) * protocolSpeed * overdriveSpeed;
  };

  const draw = (time = performance.now()): void => {
    const speed = effectiveSpeed();
    const movementProgress =
      started || paused || choosingProtocol
        ? Math.min(1, accumulator / Math.max(1, speed))
        : 1;

    renderer.draw({
      snake,
      previousSnake,
      food,
      bonusFood,
      obstacles,
      direction,
      sector,
      flow,
      activeProtocol,
      bonusRemainingMs,
      overdriveActive,
      movementProgress,
      time,
      eatEffect,
      collisionEffect,
    });
  };

  const getSpawnCells = (): Point[] =>
    availableSpawnCells({
      candidates: reachableBoardCells,
      snake,
      obstacles,
      food,
      bonusFood,
    });

  const chooseSpawnCell = (cells: readonly Point[]): Point | null => {
    if (cells.length === 0) return null;
    spawnCounter += 1;
    const random = seededRandom(runSeed ^ Math.imul(spawnCounter, 0x9e3779b1));
    return cells[Math.floor(random() * cells.length)] ?? null;
  };

  const preferredSpawnCells = (cells: readonly Point[]): Point[] => {
    const head = snake[0];
    if (!head) return [...cells];

    const preferred = cells.filter((cell) => {
      const distance = Math.abs(cell.x - head.x) + Math.abs(cell.y - head.y);
      if (distance < 4 || distance > 12) return false;
      if (
        sector <= 3 &&
        (cell.x <= 1 ||
          cell.y <= 1 ||
          cell.x >= GRID_SIZE - 2 ||
          cell.y >= GRID_SIZE - 2)
      ) {
        return false;
      }

      const blockedNeighbors = [
        { x: cell.x + 1, y: cell.y },
        { x: cell.x - 1, y: cell.y },
        { x: cell.x, y: cell.y + 1 },
        { x: cell.x, y: cell.y - 1 },
      ].filter(
        (neighbor) =>
          neighbor.x < 0 ||
          neighbor.x >= GRID_SIZE ||
          neighbor.y < 0 ||
          neighbor.y >= GRID_SIZE ||
          obstacles.has(`${neighbor.x},${neighbor.y}`),
      ).length;

      return blockedNeighbors <= 1;
    });

    return preferred.length >= 8 ? preferred : [...cells];
  };

  const placeFood = (): void => {
    food = chooseSpawnCell(preferredSpawnCells(getSpawnCells()));
    if (!food) finishGame(true);
  };

  const placeBonusFood = (): void => {
    bonusFood = chooseSpawnCell(preferredSpawnCells(getSpawnCells()));
    if (!bonusFood) return;
    bonusRemainingMs = BONUS_DURATION_MS;
    updateBonusIndicator();
    announce("Surge core detected. Five seconds remaining.");
  };

  const configureSector = (): void => {
    const protocol = activeProtocol ? PROTOCOLS[activeProtocol] : null;
    const layout = generateSectorLayout({
      seed: runSeed,
      gridSize: GRID_SIZE,
      sector,
      snake,
      extraObstacleCells: protocol?.extraObstacleCells ?? 0,
    });

    obstacles = layout.obstacles;
    reachableBoardCells = layout.reachableCells;
  };

  const stopOverdrive = (): void => {
    overdriveActive = false;
    overdriveBurnElapsed = 0;
    updateOverdriveIndicator();
  };

  const startOverdrive = (): void => {
    if (!active || !started || paused || choosingProtocol || gameOver) return;
    if (snake.length <= MINIMUM_SNAKE_LENGTH) return;
    overdriveActive = true;
    updateOverdriveIndicator();
  };

  const prepareNewRun = (): void => {
    clearSession();
    clearPointerGesture();
    runSeed = createRunSeed();
    spawnCounter = 0;
    snake = startingSnake(GRID_SIZE);
    previousSnake = snake.map((segment) => ({ ...segment }));
    food = null;
    bonusFood = null;
    bonusRemainingMs = 0;
    obstacles = new Set();
    reachableBoardCells = boardCells;
    sector = 1;
    foodsInSector = 0;
    totalFoods = 0;
    direction = { x: 0, y: -1 };
    directionQueue = [];
    score = 0;
    flow = 1;
    maxFlow = 1;
    flowRemainingMs = 0;
    activeProtocol = null;
    currentProtocolChoices = ["stabilize", "overclock"];
    newHighScoreThisRun = false;
    started = false;
    prepared = true;
    paused = false;
    gameOver = false;
    choosingProtocol = false;
    previousTime = 0;
    accumulator = 0;
    lastPersistAt = 0;
    eatEffect = null;
    collisionEffect = null;
    stopOverdrive();
    configureSector();
    placeFood();
    updateScoreboard();
    updateBonusIndicator();
    setOverlay("NEON RUN", "STEER · BUILD FLOW · BURN THE TAIL", true, {
      start: true,
    });
    announce(
      "Neon Run ready. Start the run, then steer with the arrow keys or W A S D.",
    );
    draw();
  };

  const beginRun = (): void => {
    if (!active || !prepared || gameOver || resumePrompt) return;
    started = true;
    paused = false;
    choosingProtocol = false;
    previousTime = performance.now();
    if (stateLabel) stateLabel.textContent = "RUNNING";
    setOverlay("RUNNING", "", false);
    announce("Run started.");
    persistSession();
    canvas.focus({ preventScroll: true });
  };

  const finishGame = (cleared = false): void => {
    gameOver = true;
    started = false;
    paused = false;
    choosingProtocol = false;
    stopOverdrive();
    clearSession();
    clearPointerGesture();
    clearBonusFood();
    saveHighScore();
    updateScoreboard();

    const result = cleared ? "GRID CLEARED" : "RUN TERMINATED";
    const record = newHighScoreThisRun ? " · NEW HIGH" : "";
    setOverlay(
      result,
      `SCORE ${formatScore(score)} · SECTOR ${String(sector).padStart(2, "0")} · MAX FLOW x${maxFlow}${record}`,
      true,
      { start: true },
    );
    announce(
      `${cleared ? "Grid cleared" : "Run terminated"}. Score ${score}, sector ${sector}, maximum flow ${maxFlow}.`,
    );
  };

  const updateProtocolPicker = (): void => {
    const slots: readonly ProtocolSlot[] = ["left", "right"];
    slots.forEach((slot, index) => {
      const protocolId = currentProtocolChoices[index];
      if (!protocolId) return;
      const definition = PROTOCOLS[protocolId];
      const name = root.querySelector<HTMLElement>(
        `[data-snake-protocol-name="${slot}"]`,
      );
      const summary = root.querySelector<HTMLElement>(
        `[data-snake-protocol-summary="${slot}"]`,
      );
      if (name) name.textContent = definition.name;
      if (summary) summary.textContent = definition.summary;
    });
  };

  const beginProtocolChoice = (): void => {
    started = false;
    choosingProtocol = true;
    paused = false;
    stopOverdrive();
    clearBonusFood();
    currentProtocolChoices = protocolChoices(runSeed, sector);
    updateProtocolPicker();
    setOverlay(
      `SECTOR ${String(sector).padStart(2, "0")} CLEARED`,
      "CHOOSE RECOVERY OR RISK · LEFT OR RIGHT",
      true,
      { protocol: true },
    );
    announce(`Sector ${sector} cleared. Choose the next protocol.`);
    persistSession();
  };

  const selectProtocol = (slot: ProtocolSlot): void => {
    if (!active || !choosingProtocol) return;
    const protocol = currentProtocolChoices[slot === "left" ? 0 : 1];
    activeProtocol = protocol;
    sector += 1;
    foodsInSector = 0;
    flowRemainingMs = Math.max(flowRemainingMs, 1400);
    const definition = PROTOCOLS[protocol];
    if (definition.tailReduction > 0) {
      snake = shrinkSnake(
        snake,
        definition.tailReduction,
        MINIMUM_SNAKE_LENGTH,
      );
      previousSnake = previousSnake.slice(0, snake.length);
    }
    configureSector();
    clearBonusFood();
    food = null;
    placeFood();
    if (gameOver) return;

    choosingProtocol = false;
    started = true;
    paused = false;
    previousTime = performance.now();
    accumulator = 0;
    setOverlay("RUNNING", "", false);
    updateScoreboard();
    announce(`${PROTOCOLS[protocol].name} active for sector ${sector}.`);
    persistSession();
    canvas.focus({ preventScroll: true });
  };

  const queueDirection = (name: DirectionName): void => {
    if (!active) return;

    if (choosingProtocol && (name === "left" || name === "right")) {
      selectProtocol(name);
      return;
    }

    if (!started || paused || gameOver || resumePrompt) return;
    const next = DIRECTIONS[name];
    const lastQueued = directionQueue[directionQueue.length - 1] ?? direction;
    if (
      directionQueue.length >= 2 ||
      isOppositeDirection(lastQueued, next) ||
      (lastQueued.x === next.x && lastQueued.y === next.y)
    ) {
      return;
    }
    directionQueue.push({ ...next });
  };

  const tick = (): void => {
    const queued = directionQueue.shift();
    if (queued) direction = queued;
    const snakeBeforeStep = snake.map((segment) => ({ ...segment }));
    const foodBeforeStep = food ? { ...food } : null;
    const bonusBeforeStep = bonusFood ? { ...bonusFood } : null;

    const result = advanceSnake({
      snake,
      direction,
      food,
      bonusFood,
      obstacles,
      gridSize: GRID_SIZE,
    });

    if (result.kind === "collision") {
      collisionEffect = {
        kind: "collision",
        point: result.head,
        startedAt: performance.now(),
      };
      previousSnake = snake.map((segment) => ({ ...segment }));
      finishGame();
      return;
    }

    previousSnake = snakeBeforeStep;
    snake = result.snake;

    if (result.kind === "regular-food") {
      if (foodBeforeStep) {
        eatEffect = {
          kind: "regular-food",
          point: foodBeforeStep,
          startedAt: performance.now(),
        };
      }

      flow = flowRemainingMs > 0 ? Math.min(5, flow + 1) : 1;
      maxFlow = Math.max(maxFlow, flow);
      flowRemainingMs = FLOW_DURATION_MS;
      const protocol = activeProtocol ? PROTOCOLS[activeProtocol] : null;
      score += calculateFlowScore(10, flow, protocol?.scoreMultiplier ?? 1);
      totalFoods += 1;
      foodsInSector += 1;

      const extraGrowth =
        activeProtocol === "tail-pressure" && totalFoods % 2 === 0
          ? (protocol?.extraGrowth ?? 0)
          : 0;
      const tail = snake[snake.length - 1];
      if (tail) {
        for (let index = 0; index < extraGrowth; index += 1) {
          snake.push({ ...tail });
        }
      }

      saveHighScore();
      food = null;
      updateScoreboard();

      if (foodsInSector >= FOODS_PER_SECTOR) {
        beginProtocolChoice();
        return;
      }

      placeFood();
      if (gameOver) return;

      if (totalFoods % BONUS_TRIGGER_FOODS === 0 && !bonusFood) {
        placeBonusFood();
      }
      persistSession();
    } else if (result.kind === "bonus-food") {
      if (bonusBeforeStep) {
        eatEffect = {
          kind: "bonus-food",
          point: bonusBeforeStep,
          startedAt: performance.now(),
        };
      }

      const baseBonus = calculateBonusPoints(
        bonusRemainingMs,
        BONUS_DURATION_MS,
        BONUS_MIN_SCORE,
        BONUS_MAX_SCORE,
      );
      const protocol = activeProtocol ? PROTOCOLS[activeProtocol] : null;
      score += calculateFlowScore(
        baseBonus,
        flow,
        protocol?.scoreMultiplier ?? 1,
      );
      clearBonusFood();
      saveHighScore();
      updateScoreboard();
      persistSession();
    }
  };

  const updateTimers = (elapsed: number): void => {
    if (bonusFood) {
      bonusRemainingMs = Math.max(0, bonusRemainingMs - elapsed);
      if (bonusRemainingMs === 0) clearBonusFood();
      else updateBonusIndicator();
    }

    if (flowRemainingMs > 0) {
      flowRemainingMs = Math.max(0, flowRemainingMs - elapsed);
      if (flowRemainingMs === 0 && flow > 1) {
        flow -= 1;
        flowRemainingMs = flow > 1 ? FLOW_DECAY_STEP_MS : 0;
        updateScoreboard();
      }
    }

    if (overdriveActive) {
      if (snake.length <= MINIMUM_SNAKE_LENGTH) {
        stopOverdrive();
      } else {
        overdriveBurnElapsed += elapsed;
        while (overdriveBurnElapsed >= OVERDRIVE_BURN_INTERVAL_MS) {
          overdriveBurnElapsed -= OVERDRIVE_BURN_INTERVAL_MS;
          snake = shrinkSnake(snake, 1, MINIMUM_SNAKE_LENGTH);
          previousSnake = previousSnake.slice(0, snake.length);
          updateOverdriveIndicator();
          if (snake.length <= MINIMUM_SNAKE_LENGTH) {
            stopOverdrive();
            break;
          }
        }
      }
    }
  };

  const gameLoop = (time: number): void => {
    if (!active) return;

    if (!previousTime) previousTime = time;
    const elapsed = Math.min(time - previousTime, 250);
    previousTime = time;

    if (started && !paused && !gameOver && !choosingProtocol) {
      updateTimers(elapsed);
      accumulator += elapsed;

      let speed = effectiveSpeed();
      while (accumulator >= speed) {
        tick();
        accumulator -= speed;
        if (gameOver || choosingProtocol) break;
        speed = effectiveSpeed();
      }

      if (time - lastPersistAt >= 1000) {
        lastPersistAt = time;
        persistSession();
      }
    }

    draw(time);
    animationFrame = window.requestAnimationFrame(gameLoop);
  };

  const pauseGame = (message = "P TO RESUME"): void => {
    if (!active || !started || gameOver || paused || choosingProtocol) return;
    paused = true;
    stopOverdrive();
    persistSession();
    setOverlay("PAUSED", message, true);
    announce("Game paused.");
  };

  const togglePause = (): void => {
    if (!active || !started || gameOver || choosingProtocol) return;
    paused = !paused;

    if (paused) {
      stopOverdrive();
      persistSession();
      setOverlay("PAUSED", "P TO RESUME", true);
      announce("Game paused.");
    } else {
      previousTime = performance.now();
      setOverlay("RUNNING", "", false);
      announce("Game resumed.");
    }
  };

  const restoreSession = (state: SnakeSessionState): void => {
    runSeed = state.runSeed;
    spawnCounter = Math.max(0, state.spawnCounter);
    snake = state.snake.map((segment) => ({ ...segment }));
    previousSnake = snake.map((segment) => ({ ...segment }));
    food = state.food ? { ...state.food } : null;
    bonusFood = state.bonusFood ? { ...state.bonusFood } : null;
    bonusRemainingMs = Math.max(0, state.bonusRemainingMs);
    obstacles = new Set(state.obstacles);
    reachableBoardCells = Array.from(
      reachableCells(obstacles, GRID_SIZE, snake[0] ?? { x: 10, y: 10 }),
      (key) => {
        const [x = 0, y = 0] = key.split(",").map(Number);
        return { x, y };
      },
    );
    sector = Math.max(1, state.sector);
    foodsInSector = Math.max(0, state.foodsInSector);
    totalFoods = Math.max(0, state.totalFoods);
    direction = { ...state.direction };
    directionQueue = state.queuedDirections.map((queued) => ({ ...queued }));
    score = Math.max(0, state.score);
    flow = Math.min(5, Math.max(1, state.flow));
    maxFlow = Math.min(5, Math.max(flow, state.maxFlow));
    flowRemainingMs = Math.max(0, state.flowRemainingMs);
    activeProtocol = state.activeProtocol;
    currentProtocolChoices = [...state.protocolChoices];
    prepared = true;
    started = false;
    paused = true;
    gameOver = false;
    choosingProtocol = state.choosingProtocol;
    previousTime = 0;
    accumulator = 0;
    eatEffect = null;
    collisionEffect = null;
    stopOverdrive();
    updateScoreboard();
    updateBonusIndicator();
    if (resumeSummary) {
      resumeSummary.textContent = `SECTOR ${String(sector).padStart(2, "0")} · SCORE ${formatScore(score)}`;
    }
    updateProtocolPicker();
    setOverlay("SAVED RUN", "CONTINUE OR START OVER", true, { resume: true });
    announce(`Saved run found. Sector ${sector}, score ${score}.`);
    draw();
  };

  const continueSession = (): void => {
    if (!active || !resumePrompt || !prepared) return;
    resumePrompt = false;
    paused = false;
    previousTime = performance.now();

    if (choosingProtocol) {
      started = false;
      setOverlay(
        `SECTOR ${String(sector).padStart(2, "0")} CLEARED`,
        "CHOOSE RECOVERY OR RISK · LEFT OR RIGHT",
        true,
        { protocol: true },
      );
      announce(`Sector ${sector} cleared. Choose the next protocol.`);
    } else {
      started = true;
      setOverlay("RUNNING", "", false);
      announce("Saved run resumed.");
    }

    persistSession();
    canvas.focus({ preventScroll: true });
  };

  const discardSession = (): void => {
    clearSession();
    prepareNewRun();
  };

  const restartRun = (): void => {
    prepareNewRun();
    beginRun();
  };

  const startGame = (): void => {
    active = true;
    root.hidden = false;
    highScore = readHighScore();
    renderer.configure();
    updateScoreboard();

    const saved = readStoredSession(
      SNAKE_SESSION_KEY,
      SNAKE_SESSION_VERSION,
      isSnakeSessionState,
    );

    if (saved) restoreSession(saved.state);
    else prepareNewRun();

    if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    animationFrame = window.requestAnimationFrame(gameLoop);
    window.setTimeout(() => canvas.focus({ preventScroll: true }), 0);
  };

  const exitGame = (): void => {
    if (!active) return;
    persistSession();
    active = false;
    started = false;
    paused = false;
    choosingProtocol = false;
    stopOverdrive();
    clearPointerGesture();
    saveHighScore();
    updateScoreboard();
    root.hidden = true;

    if (animationFrame !== null) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }

    dispatchGameExit(GAME_EVENTS.snake.exit, { score, highScore });
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!active) return;
    const key = event.key.toLowerCase();

    if (resumePrompt) {
      if (key === "c" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        continueSession();
      } else if (key === "n" || key === "r") {
        event.preventDefault();
        discardSession();
      } else if (event.key === "Escape") {
        event.preventDefault();
        exitGame();
      }
      return;
    }

    if (
      choosingProtocol &&
      (key === "a" ||
        key === "arrowleft" ||
        key === "d" ||
        key === "arrowright")
    ) {
      event.preventDefault();
      selectProtocol(key === "a" || key === "arrowleft" ? "left" : "right");
      return;
    }

    if (
      !started &&
      prepared &&
      !gameOver &&
      (event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      beginRun();
      return;
    }

    const directionName: DirectionName | null =
      key === "w" || key === "arrowup"
        ? "up"
        : key === "s" || key === "arrowdown"
          ? "down"
          : key === "a" || key === "arrowleft"
            ? "left"
            : key === "d" || key === "arrowright"
              ? "right"
              : null;
    if (directionName) {
      event.preventDefault();
      queueDirection(directionName);
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      startOverdrive();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      exitGame();
      return;
    }

    if (key === "r") {
      event.preventDefault();
      restartRun();
      return;
    }

    if (key === "p") {
      event.preventDefault();
      togglePause();
    }
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === "Space") stopOverdrive();
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (!active || (event.pointerType === "mouse" && event.button !== 0))
      return;
    clearPointerGesture();
    pointerStart = { x: event.clientX, y: event.clientY };
    pointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!active || !pointerStart || pointerId !== event.pointerId) return;
    const deltaX = event.clientX - pointerStart.x;
    const deltaY = event.clientY - pointerStart.y;
    clearPointerGesture();

    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 18) {
      if (!started && prepared && !gameOver) beginRun();
      return;
    }

    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      queueDirection(deltaX < 0 ? "left" : "right");
    } else {
      queueDirection(deltaY < 0 ? "up" : "down");
    }
  };

  const onPointerCancel = (event: PointerEvent): void => {
    if (pointerId === event.pointerId) clearPointerGesture();
  };

  const onLostPointerCapture = (event: PointerEvent): void => {
    if (pointerId === event.pointerId) {
      pointerStart = null;
      pointerId = null;
    }
  };

  startButton?.addEventListener("click", () => {
    if (gameOver) prepareNewRun();
    beginRun();
  });

  resumeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.snakeResume === "continue") continueSession();
      else discardSession();
    });
  });

  protocolButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const slot = button.dataset.snakeProtocol;
      if (slot === "left" || slot === "right") selectProtocol(slot);
    });
  });

  directionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextDirection = button.dataset.snakeDirection;
      if (
        nextDirection === "up" ||
        nextDirection === "down" ||
        nextDirection === "left" ||
        nextDirection === "right"
      ) {
        queueDirection(nextDirection);
      }
      canvas.focus({ preventScroll: true });
    });
  });

  const startDriveFromPointer = (event: PointerEvent): void => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    overdriveButton?.setPointerCapture(event.pointerId);
    startOverdrive();
  };
  const stopDriveFromPointer = (): void => stopOverdrive();
  overdriveButton?.addEventListener("pointerdown", startDriveFromPointer);
  overdriveButton?.addEventListener("pointerup", stopDriveFromPointer);
  overdriveButton?.addEventListener("pointercancel", stopDriveFromPointer);
  overdriveButton?.addEventListener("lostpointercapture", stopDriveFromPointer);

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("lostpointercapture", onLostPointerCapture);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  window.addEventListener("blur", () => pauseGame("P TO RESUME"));
  window.addEventListener("pagehide", persistSession);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      persistSession();
      pauseGame("P TO RESUME");
    }
  });

  window.addEventListener("resize", () => {
    if (active) {
      renderer.configure();
      draw();
    }
  });

  window.addEventListener(GAME_EVENTS.snake.start, startGame);
}
