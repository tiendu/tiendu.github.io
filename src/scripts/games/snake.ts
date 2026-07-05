import {
  advanceSnake,
  allBoardCells,
  availableSpawnCells,
  calculateBonusPoints,
  generateMaze,
  isOppositeDirection,
  startingSnake,
  type Point,
  type SnakeMode,
} from "./snake-rules";
import { dispatchGameExit, GAME_EVENTS } from "./shared/events";
import {
  createSnakeRenderer,
  type SnakeVisualEffect,
} from "./snake-renderer";
import { mountAllGames } from "./shared/mount";
import { readStoredScore, writeStoredScore } from "./shared/storage";

type DirectionName = "up" | "down" | "left" | "right";

export function mountSnakeGames(): void {
  mountAllGames("[data-snake-game]", "snakeInitialized", mountSnakeGame);
}

function mountSnakeGame(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLCanvasElement>("[data-snake-canvas]");
  const modeOutput = root.querySelector<HTMLOutputElement>("[data-snake-mode]");
  const scoreOutput =
    root.querySelector<HTMLOutputElement>("[data-snake-score]");
  const highScoreOutput = root.querySelector<HTMLOutputElement>(
    "[data-snake-high-score]",
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
  const modePicker = root.querySelector<HTMLElement>(
    "[data-snake-mode-picker]",
  );
  const modeButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-snake-mode]"),
  );
  const directionButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-snake-direction]"),
  );

  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const GRID_SIZE = 20;
  const START_SPEED = 132;
  const MIN_SPEED = 72;
  const BONUS_TRIGGER_FOODS = 5;
  const BONUS_DURATION_MS = 5000;
  const BONUS_MIN_SCORE = 40;
  const BONUS_MAX_SCORE = 120;
  const HIGH_SCORE_KEYS: Record<SnakeMode, string> = {
    free: "tiendu-snake-high-score-free",
    maze: "tiendu-snake-high-score-maze",
  };
  const LEGACY_HIGH_SCORE_KEY = "tiendu-snake-high-score";
  const boardCells = allBoardCells(GRID_SIZE);
  const renderer = createSnakeRenderer(canvas, context, GRID_SIZE);

  const directions: Record<DirectionName, Point> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  let active = false;
  let started = false;
  let paused = false;
  let gameOver = false;
  let mode: SnakeMode | null = null;
  let mazeSeed: number | null = null;
  let snake: Point[] = [];
  let previousSnake: Point[] = [];
  let food: Point | null = null;
  let obstacles = new Set<string>();
  let mazeReachableCells: Point[] = [];
  let bonusFood: Point | null = null;
  let bonusRemainingMs = 0;
  let regularFoodsEaten = 0;
  let direction = directions.right;
  let queuedDirection = directions.right;
  let score = 0;
  let highScore = 0;
  let newHighScoreThisRun = false;
  let speed = START_SPEED;
  let animationFrame: number | null = null;
  let previousTime = 0;
  let accumulator = 0;
  let pointerStart: Point | null = null;
  let pointerId: number | null = null;
  let eatEffect: SnakeVisualEffect | null = null;
  let collisionEffect: SnakeVisualEffect | null = null;

  const formatScore = (value: number): string => String(value).padStart(4, "0");

  const readHighScore = (selectedMode: SnakeMode): number => {
    const storedScore = readStoredScore(HIGH_SCORE_KEYS[selectedMode]);

    if (storedScore > 0 || selectedMode === "maze") {
      return storedScore;
    }

    const legacyScore = readStoredScore(LEGACY_HIGH_SCORE_KEY);

    if (legacyScore > 0) {
      writeStoredScore(HIGH_SCORE_KEYS.free, legacyScore);
    }

    return legacyScore;
  };

  const saveHighScore = (): boolean => {
    if (!mode || score <= highScore) {
      return false;
    }

    highScore = score;
    newHighScoreThisRun = true;
    writeStoredScore(HIGH_SCORE_KEYS[mode], highScore);
    return true;
  };

  const announce = (message: string): void => {
    if (statusLabel) {
      statusLabel.textContent = message;
    }
  };

  const updateScoreboard = () => {
    if (modeOutput) {
      modeOutput.textContent = mode ? mode.toUpperCase() : "--";
    }

    if (scoreOutput) {
      scoreOutput.textContent = formatScore(score);
    }

    if (highScoreOutput) {
      highScoreOutput.textContent = formatScore(highScore);
    }
  };

  const updateBonusIndicator = () => {
    const visible = bonusFood && bonusRemainingMs > 0;

    if (bonusIndicator) {
      bonusIndicator.hidden = !visible;
    }

    if (visible && bonusTimeOutput) {
      bonusTimeOutput.textContent = String(
        Math.max(1, Math.ceil(bonusRemainingMs / 1000)),
      );
    }
  };

  const clearBonusFood = () => {
    bonusFood = null;
    bonusRemainingMs = 0;
    updateBonusIndicator();
  };

  const setOverlay = (
    title: string,
    message: string,
    visible = true,
    showModePicker = false,
  ): void => {
    if (stateLabel) {
      stateLabel.textContent = title;
    }

    if (messageLabel) {
      messageLabel.textContent = message;
    }

    if (modePicker) {
      modePicker.hidden = !showModePicker;
    }

    if (overlay) {
      overlay.hidden = !visible;
    }
  };

  const getSpawnCells = (): Point[] =>
    availableSpawnCells({
      candidates: mode === "maze" ? mazeReachableCells : boardCells,
      snake,
      obstacles,
      food,
      bonusFood,
    });

  const createMazeSeed = (): number => {
    if (globalThis.crypto) {
      const seed = new Uint32Array(1);
      globalThis.crypto.getRandomValues(seed);
      return seed[0] ?? 0;
    }

    return Date.now() ^ Math.floor(performance.now());
  };

  const clearPointerGesture = (): void => {
    if (pointerId !== null && canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }

    pointerStart = null;
    pointerId = null;
  };

  const configureCanvas = (): void => {
    renderer.configure();
  };

  const draw = (time = performance.now()): void => {
    const movementProgress =
      started || paused ? Math.min(1, accumulator / speed) : 1;

    renderer.draw({
      snake,
      previousSnake,
      food,
      bonusFood,
      obstacles,
      direction,
      mode,
      bonusRemainingMs,
      movementProgress,
      time,
      eatEffect,
      collisionEffect,
    });
  };

  const placeFood = () => {
    const freeCells = getSpawnCells();

    if (freeCells.length === 0) {
      finishGame(true);
      return;
    }

    food = freeCells[Math.floor(Math.random() * freeCells.length)];
  };

  const placeBonusFood = () => {
    const freeCells = getSpawnCells();

    if (freeCells.length === 0) {
      return;
    }

    bonusFood = freeCells[Math.floor(Math.random() * freeCells.length)];
    bonusRemainingMs = BONUS_DURATION_MS;
    updateBonusIndicator();
    announce("Bonus food appeared. Five seconds remaining.");
  };

  const finishGame = (won = false) => {
    gameOver = true;
    started = false;
    clearPointerGesture();
    clearBonusFood();
    saveHighScore();
    updateScoreboard();

    const result = won ? "SYSTEM CLEARED" : "GAME OVER";
    const highScoreMessage = newHighScoreThisRun ? " · NEW HIGH SCORE" : "";
    const retryMessage =
      mode === "maze"
        ? "R RETRY SAME MAP · SELECT MAZE FOR NEW MAP"
        : "R RESTART · SELECT MODE";

    setOverlay(
      result,
      `${formatScore(score)}${highScoreMessage} · ${retryMessage} · ESC EXIT`,
      true,
      true,
    );
    announce(
      `${won ? "Board cleared" : "Game over"}. Score ${score}.${
        newHighScoreThisRun ? " New high score." : ""
      }`,
    );
  };

  const resetGame = () => {
    if (!mode) {
      setOverlay(
        "SELECT MODE",
        "FREE WRAPS · MAZE WRAPS + OBSTACLES",
        true,
        true,
      );
      draw();
      return;
    }

    clearPointerGesture();
    snake = startingSnake();
    previousSnake = snake.map((segment) => ({ ...segment }));
    obstacles = new Set();
    mazeReachableCells = [];

    if (mode === "maze") {
      mazeSeed ??= createMazeSeed();
      const maze = generateMaze(mazeSeed, GRID_SIZE);
      obstacles = maze.obstacles;
      mazeReachableCells = maze.reachableCells;
    }

    direction = directions.right;
    queuedDirection = directions.right;
    score = 0;
    newHighScoreThisRun = false;
    regularFoodsEaten = 0;
    speed = START_SPEED;
    clearBonusFood();
    started = false;
    paused = false;
    gameOver = false;
    previousTime = 0;
    accumulator = 0;
    eatEffect = null;
    collisionEffect = null;
    placeFood();
    updateScoreboard();
    setOverlay(
      "PRESS A DIRECTION",
      `${mode.toUpperCase()} MODE · ARROWS / WASD / SWIPE`,
    );
    announce(
      `${mode === "maze" ? "Maze" : "Free"} mode ready. Press a direction to start.`,
    );
    draw();
  };

  const selectMode = (nextMode: string | undefined): void => {
    if (!active || (nextMode !== "free" && nextMode !== "maze")) {
      return;
    }

    mode = nextMode;
    mazeSeed = mode === "maze" ? createMazeSeed() : null;
    highScore = readHighScore(mode);
    resetGame();
    window.setTimeout(() => canvas.focus({ preventScroll: true }), 0);
  };

  const isOpposite = (nextDirection: Point): boolean =>
    isOppositeDirection(direction, nextDirection);

  const setDirection = (nextDirection: Point): void => {
    if (!active || !mode || gameOver || isOpposite(nextDirection)) {
      return;
    }

    queuedDirection = nextDirection;

    if (!started) {
      started = true;
      paused = false;
      setOverlay("", "", false);
      previousTime = performance.now();
      announce("Game started.");
    }
  };

  const tick = () => {
    direction = queuedDirection;
    const snakeBeforeStep = snake.map((segment) => ({ ...segment }));
    const regularFoodBeforeStep = food ? { ...food } : null;
    const bonusFoodBeforeStep = bonusFood ? { ...bonusFood } : null;

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
      if (regularFoodBeforeStep) {
        eatEffect = {
          kind: "regular-food",
          point: regularFoodBeforeStep,
          startedAt: performance.now(),
        };
      }

      score += 10;
      regularFoodsEaten += 1;
      saveHighScore();
      speed = Math.max(MIN_SPEED, START_SPEED - regularFoodsEaten * 4.5);
      placeFood();

      if (gameOver) {
        return;
      }

      if (regularFoodsEaten % BONUS_TRIGGER_FOODS === 0 && !bonusFood) {
        placeBonusFood();
      }

      updateScoreboard();
    } else if (result.kind === "bonus-food") {
      if (bonusFoodBeforeStep) {
        eatEffect = {
          kind: "bonus-food",
          point: bonusFoodBeforeStep,
          startedAt: performance.now(),
        };
      }

      score += calculateBonusPoints(
        bonusRemainingMs,
        BONUS_DURATION_MS,
        BONUS_MIN_SCORE,
        BONUS_MAX_SCORE,
      );
      clearBonusFood();
      saveHighScore();
      updateScoreboard();
    }
  };

  const gameLoop = (time: number): void => {
    if (!active) {
      return;
    }

    if (!previousTime) {
      previousTime = time;
    }

    const elapsed = Math.min(time - previousTime, 250);
    previousTime = time;

    if (started && !paused && !gameOver) {
      if (bonusFood) {
        bonusRemainingMs = Math.max(0, bonusRemainingMs - elapsed);

        if (bonusRemainingMs === 0) {
          clearBonusFood();
        } else {
          updateBonusIndicator();
        }
      }

      accumulator += elapsed;

      while (accumulator >= speed) {
        const stepDuration = speed;
        tick();
        accumulator -= stepDuration;

        if (gameOver) {
          break;
        }
      }
    }

    draw(time);
    animationFrame = window.requestAnimationFrame(gameLoop);
  };

  const pauseGame = (message = "P TO RESUME") => {
    if (!active || !started || gameOver || paused) {
      return;
    }

    paused = true;
    setOverlay("PAUSED", message);
    announce("Game paused.");
  };

  const togglePause = () => {
    if (!active || !started || gameOver) {
      return;
    }

    paused = !paused;

    if (paused) {
      setOverlay("PAUSED", "P TO RESUME");
      announce("Game paused.");
    } else {
      previousTime = performance.now();
      setOverlay("", "", false);
      announce("Game resumed.");
    }
  };

  const startGame = () => {
    active = true;
    root.hidden = false;
    mode = null;
    mazeSeed = null;
    snake = [];
    previousSnake = [];
    food = null;
    obstacles = new Set();
    mazeReachableCells = [];
    score = 0;
    highScore = 0;
    newHighScoreThisRun = false;
    speed = START_SPEED;
    regularFoodsEaten = 0;
    started = false;
    paused = false;
    gameOver = false;
    previousTime = 0;
    accumulator = 0;
    eatEffect = null;
    collisionEffect = null;
    clearPointerGesture();
    clearBonusFood();
    configureCanvas();
    updateScoreboard();
    setOverlay(
      "SELECT MODE",
      "FREE WRAPS · MAZE WRAPS + OBSTACLES",
      true,
      true,
    );
    announce("Select Free mode or Maze mode.");
    draw();

    if (animationFrame !== null) {
      window.cancelAnimationFrame(animationFrame);
    }

    animationFrame = window.requestAnimationFrame(gameLoop);
    window.setTimeout(() => canvas.focus({ preventScroll: true }), 0);
  };

  const exitGame = () => {
    if (!active) {
      return;
    }

    active = false;
    started = false;
    paused = false;
    clearPointerGesture();
    saveHighScore();
    mode = null;
    mazeSeed = null;
    eatEffect = null;
    collisionEffect = null;
    updateScoreboard();
    root.hidden = true;

    if (animationFrame !== null) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }

    dispatchGameExit(GAME_EVENTS.snake.exit, { score, highScore });
  };

  const directionForKey = (key: string): Point | null => {
    const normalized = key.toLowerCase();

    if (normalized === "arrowup" || normalized === "w") {
      return directions.up;
    }

    if (normalized === "arrowdown" || normalized === "s") {
      return directions.down;
    }

    if (normalized === "arrowleft" || normalized === "a") {
      return directions.left;
    }

    if (normalized === "arrowright" || normalized === "d") {
      return directions.right;
    }

    return null;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!active) {
      return;
    }

    const normalizedKey = event.key.toLowerCase();

    if ((!mode || gameOver) && (normalizedKey === "f" || normalizedKey === "m")) {
      event.preventDefault();
      selectMode(normalizedKey === "f" ? "free" : "maze");
      return;
    }

    const nextDirection = directionForKey(event.key);

    if (nextDirection) {
      event.preventDefault();
      setDirection(nextDirection);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      exitGame();
      return;
    }

    if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      resetGame();
      return;
    }

    if (event.key.toLowerCase() === "p" || event.key === " ") {
      event.preventDefault();
      togglePause();
    }
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (!active || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }

    clearPointerGesture();
    pointerStart = { x: event.clientX, y: event.clientY };
    pointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!active || !pointerStart || pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - pointerStart.x;
    const deltaY = event.clientY - pointerStart.y;
    clearPointerGesture();

    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 20) {
      return;
    }

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      setDirection(deltaX > 0 ? directions.right : directions.left);
    } else {
      setDirection(deltaY > 0 ? directions.down : directions.up);
    }
  };

  const onPointerCancel = (event: PointerEvent): void => {
    if (pointerId === event.pointerId) {
      clearPointerGesture();
    }
  };

  const onLostPointerCapture = (event: PointerEvent): void => {
    if (pointerId === event.pointerId) {
      pointerStart = null;
      pointerId = null;
    }
  };

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectMode(button.dataset.snakeMode);
    });
  });

  directionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.dataset.snakeDirection as DirectionName | undefined;
      const nextDirection = name ? directions[name] : undefined;

      if (nextDirection) {
        setDirection(nextDirection);
        canvas.focus({ preventScroll: true });
      }
    });
  });

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("lostpointercapture", onLostPointerCapture);
  document.addEventListener("keydown", onKeyDown);

  window.addEventListener("blur", () => pauseGame("P TO RESUME"));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pauseGame("P TO RESUME");
    }
  });

  window.addEventListener("resize", () => {
    if (active) {
      configureCanvas();
      draw();
    }
  });

  window.addEventListener(GAME_EVENTS.snake.start, startGame);
}
