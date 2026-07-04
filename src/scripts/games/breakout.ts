import { configureFixedCanvas } from "./shared/canvas";
import { dispatchGameExit, GAME_EVENTS } from "./shared/events";
import { mountAllGames } from "./shared/mount";
import { readStoredScore, writeStoredScore } from "./shared/storage";

interface Point {
  x: number;
  y: number;
}
interface Rect extends Point {
  width: number;
  height: number;
}
interface Ball extends Point {
  vx: number;
  vy: number;
  radius: number;
  attached: boolean;
}
interface Brick extends Rect {
  hp: number;
  maxHp: number;
  row: number;
}
type PowerupType = "wide" | "multi" | "slow" | "life";
interface Powerup extends Rect {
  type: PowerupType;
  velocity: number;
}
interface LevelConfig {
  pattern: string[];
  loop: number;
  speed: number;
}

export function mountBreakoutGames(): void {
  mountAllGames(
    "[data-breakout-game]",
    "breakoutInitialized",
    mountBreakoutGame,
  );
}

function mountBreakoutGame(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLCanvasElement>(
    "[data-breakout-canvas]",
  );
  const scoreOutput = root.querySelector<HTMLOutputElement>(
    "[data-breakout-score]",
  );
  const highScoreOutput = root.querySelector<HTMLOutputElement>(
    "[data-breakout-high-score]",
  );
  const levelOutput = root.querySelector<HTMLOutputElement>(
    "[data-breakout-level]",
  );
  const livesOutput = root.querySelector<HTMLOutputElement>(
    "[data-breakout-lives]",
  );
  const ballsOutput = root.querySelector<HTMLOutputElement>(
    "[data-breakout-balls]",
  );
  const overlay = root.querySelector<HTMLElement>("[data-breakout-overlay]");
  const stateLabel = root.querySelector<HTMLElement>("[data-breakout-state]");
  const messageLabel = root.querySelector<HTMLElement>(
    "[data-breakout-message]",
  );
  const controlButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-breakout-control]"),
  );

  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const BOARD_WIDTH = 480;
  const BOARD_HEIGHT = 560;
  const PADDLE_Y = 510;
  const PADDLE_BASE_WIDTH = 78;
  const PADDLE_WIDE_WIDTH = 122;
  const PADDLE_HEIGHT = 12;
  const PADDLE_SPEED = 330;
  const BALL_RADIUS = 5;
  const STARTING_LIVES = 3;
  const MAX_LIVES = 5;
  const HIGH_SCORE_KEY = "tiendu-breakout-high-score";
  const POWERUP_DROP_CHANCE = 0.18;
  const POWERUP_DURATION = 12000;

  const levelPatterns: string[][] = [
    ["1111111111", "1111111111", "1111111111", "1111111111", "1111111111"],
    [
      "1100000011",
      "0110000110",
      "0011001100",
      "0001111000",
      "0011001100",
      "0110000110",
      "1100000011",
    ],
    [
      "2222222222",
      "2000000002",
      "2011111102",
      "2010000102",
      "2011111102",
      "2000000002",
      "2222222222",
    ],
    [
      "1010101010",
      "0101010101",
      "1111111111",
      "0101010101",
      "1010101010",
      "1111111111",
    ],
    [
      "2222222222",
      "2111111112",
      "2122222212",
      "2121111212",
      "2122222212",
      "2111111112",
      "2222222222",
    ],
  ];

  const powerupLabels: Record<PowerupType, string> = {
    wide: "W",
    multi: "M",
    slow: "S",
    life: "+",
  };

  let active = false;
  let started = false;
  let paused = false;
  let gameOver = false;
  let transitionLocked = false;
  let score = 0;
  let highScore = 0;
  let level = 1;
  let lives = STARTING_LIVES;
  let paddle: Rect = {
    x: BOARD_WIDTH / 2 - PADDLE_BASE_WIDTH / 2,
    y: PADDLE_Y,
    width: PADDLE_BASE_WIDTH,
    height: PADDLE_HEIGHT,
  };
  let balls: Ball[] = [];
  let bricks: Brick[] = [];
  let powerups: Powerup[] = [];
  let wideUntil = 0;
  let previousTime = 0;
  let animationFrame: number | null = null;
  let transitionTimer: number | null = null;
  let pointerDirection = 0;
  let pointerDragging = false;

  const keys = {
    left: false,
    right: false,
  };

  const formatScore = (value: number): string => String(value).padStart(4, "0");
  const formatLevel = (value: number): string => String(value).padStart(2, "0");

  const getLevelConfig = (): LevelConfig => {
    const patternIndex = (level - 1) % levelPatterns.length;
    const loop = Math.floor((level - 1) / levelPatterns.length) + 1;
    const loopBoost = Math.max(0, loop - 1);

    return {
      pattern: levelPatterns[patternIndex] ?? levelPatterns[0]!,
      loop,
      speed: Math.min(420, 245 + patternIndex * 18 + loopBoost * 28),
    };
  };

  const readHighScore = (): number => readStoredScore(HIGH_SCORE_KEY);

  const saveHighScore = () => {
    if (score <= highScore) {
      return;
    }

    highScore = score;

    writeStoredScore(HIGH_SCORE_KEY, highScore);
  };

  const updateScoreboard = () => {
    if (scoreOutput) {
      scoreOutput.textContent = formatScore(score);
    }

    if (highScoreOutput) {
      highScoreOutput.textContent = formatScore(highScore);
    }

    if (levelOutput) {
      levelOutput.textContent = formatLevel(level);
    }

    if (livesOutput) {
      livesOutput.textContent = String(lives);
    }

    if (ballsOutput) {
      ballsOutput.textContent = String(Math.max(1, balls.length));
    }
  };

  const setOverlay = (title: string, message: string, visible = true): void => {
    if (stateLabel) {
      stateLabel.textContent = title;
    }

    if (messageLabel) {
      messageLabel.textContent = message;
    }

    if (overlay) {
      overlay.hidden = !visible;
    }
  };

  const configureCanvas = (): void => {
    configureFixedCanvas(canvas, context, BOARD_WIDTH, BOARD_HEIGHT);
    context.imageSmoothingEnabled = false;
  };

  const clampPaddle = () => {
    paddle.x = Math.max(4, Math.min(BOARD_WIDTH - paddle.width - 4, paddle.x));
  };

  const intersects = (a: Rect, b: Rect): boolean =>
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;

  const circleIntersectsRect = (ball: Ball, rectangle: Rect): boolean => {
    const nearestX = Math.max(
      rectangle.x,
      Math.min(ball.x, rectangle.x + rectangle.width),
    );
    const nearestY = Math.max(
      rectangle.y,
      Math.min(ball.y, rectangle.y + rectangle.height),
    );
    const deltaX = ball.x - nearestX;
    const deltaY = ball.y - nearestY;
    return deltaX * deltaX + deltaY * deltaY <= ball.radius * ball.radius;
  };

  const createBricks = () => {
    const config = getLevelConfig();
    const pattern = config.pattern;
    const columns = Math.max(...pattern.map((row) => row.length));
    const gap = 4;
    const sidePadding = 18;
    const brickWidth =
      (BOARD_WIDTH - sidePadding * 2 - gap * (columns - 1)) / columns;
    const brickHeight = 18;
    const startY = 64;

    bricks = [];

    pattern.forEach((row, rowIndex) => {
      [...row].forEach((cell, columnIndex) => {
        const hp = Number(cell);

        if (!hp) {
          return;
        }

        bricks.push({
          x: sidePadding + columnIndex * (brickWidth + gap),
          y: startY + rowIndex * (brickHeight + gap),
          width: brickWidth,
          height: brickHeight,
          hp,
          maxHp: hp,
          row: rowIndex,
        });
      });
    });
  };

  const createAttachedBall = () => {
    balls = [
      {
        x: paddle.x + paddle.width / 2,
        y: paddle.y - BALL_RADIUS - 2,
        vx: 0,
        vy: 0,
        radius: BALL_RADIUS,
        attached: true,
      },
    ];
    updateScoreboard();
  };

  const resetPaddle = () => {
    paddle.width = PADDLE_BASE_WIDTH;
    paddle.x = BOARD_WIDTH / 2 - paddle.width / 2;
    wideUntil = 0;
    clampPaddle();
  };

  const resetLevel = () => {
    resetPaddle();
    powerups = [];
    createBricks();
    createAttachedBall();
    updateScoreboard();
  };

  const resetGame = () => {
    if (transitionTimer !== null) {
      window.clearTimeout(transitionTimer);
      transitionTimer = null;
    }

    score = 0;
    level = 1;
    lives = STARTING_LIVES;
    started = false;
    paused = false;
    gameOver = false;
    transitionLocked = false;
    previousTime = 0;
    keys.left = false;
    keys.right = false;
    pointerDirection = 0;
    resetLevel();
    setOverlay("PRESS FIRE OR MOVE", "ARROWS / A D / SPACE / DRAG");
    draw();
  };

  const drawGrid = () => {
    context.strokeStyle = "rgba(199, 240, 139, 0.03)";
    context.lineWidth = 1;

    for (let x = 24; x < BOARD_WIDTH; x += 24) {
      context.beginPath();
      context.moveTo(x + 0.5, 0);
      context.lineTo(x + 0.5, BOARD_HEIGHT);
      context.stroke();
    }

    for (let y = 24; y < BOARD_HEIGHT; y += 24) {
      context.beginPath();
      context.moveTo(0, y + 0.5);
      context.lineTo(BOARD_WIDTH, y + 0.5);
      context.stroke();
    }
  };

  const drawPaddle = () => {
    context.save();
    context.fillStyle = "#e7ffb0";
    context.shadowColor = "rgba(231, 255, 176, 0.5)";
    context.shadowBlur = 8;
    context.fillRect(
      Math.round(paddle.x),
      paddle.y,
      Math.round(paddle.width),
      paddle.height,
    );
    context.fillStyle = "#7fa45c";
    context.shadowBlur = 0;
    context.fillRect(
      Math.round(paddle.x + 8),
      paddle.y + 3,
      Math.max(4, Math.round(paddle.width - 16)),
      3,
    );
    context.restore();
  };

  const drawBall = (ball: Ball): void => {
    context.save();
    context.fillStyle = "#e7ffb0";
    context.shadowColor = "rgba(231, 255, 176, 0.72)";
    context.shadowBlur = 9;
    context.beginPath();
    context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  };

  const drawBrick = (brick: Brick): void => {
    const bright = brick.hp > 1;
    const inset = 2;

    context.save();
    context.fillStyle = bright ? "#d9f277" : "#8fbd66";
    context.shadowColor = bright
      ? "rgba(217, 242, 119, 0.35)"
      : "rgba(199, 240, 139, 0.18)";
    context.shadowBlur = bright ? 6 : 3;
    context.fillRect(
      Math.round(brick.x),
      Math.round(brick.y),
      Math.round(brick.width),
      brick.height,
    );
    context.fillStyle = bright ? "#7fa45c" : "#4f6130";
    context.shadowBlur = 0;
    context.fillRect(
      Math.round(brick.x + inset),
      Math.round(brick.y + inset),
      Math.round(brick.width - inset * 2),
      3,
    );
    context.restore();
  };

  const drawPowerup = (powerup: Powerup): void => {
    const label = powerupLabels[powerup.type] ?? "?";

    context.save();
    context.fillStyle = powerup.type === "life" ? "#d9805d" : "#d9f277";
    context.shadowColor =
      powerup.type === "life"
        ? "rgba(217, 128, 93, 0.58)"
        : "rgba(217, 242, 119, 0.48)";
    context.shadowBlur = 8;
    context.fillRect(powerup.x, powerup.y, powerup.width, powerup.height);
    context.fillStyle = "#07120b";
    context.shadowBlur = 0;
    context.font = "bold 12px monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      label,
      powerup.x + powerup.width / 2,
      powerup.y + powerup.height / 2 + 0.5,
    );
    context.restore();
  };

  const draw = () => {
    context.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    context.fillStyle = "#020704";
    context.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    drawGrid();
    bricks.forEach(drawBrick);
    powerups.forEach(drawPowerup);
    balls.forEach(drawBall);
    drawPaddle();
  };

  const startPlaying = () => {
    if (!active || gameOver || transitionLocked) {
      return;
    }

    if (!started) {
      started = true;
      paused = false;
      setOverlay("RUNNING", "", false);
      previousTime = performance.now();
    }
  };

  const launchAttachedBalls = () => {
    if (!active || gameOver || paused || transitionLocked) {
      return;
    }

    startPlaying();
    const config = getLevelConfig();

    balls.forEach((ball, index) => {
      if (!ball.attached) {
        return;
      }

      const direction = index % 2 === 0 ? 1 : -1;
      ball.attached = false;
      ball.vx = config.speed * 0.48 * direction;
      ball.vy = -Math.sqrt(
        Math.max(0, config.speed * config.speed - ball.vx * ball.vx),
      );
    });
  };

  const spawnPowerup = (brick: Brick): void => {
    if (Math.random() > POWERUP_DROP_CHANCE || powerups.length >= 3) {
      return;
    }

    const roll = Math.random();
    const type: PowerupType =
      roll < 0.34
        ? "wide"
        : roll < 0.64
          ? "multi"
          : roll < 0.88
            ? "slow"
            : "life";

    powerups.push({
      type,
      x: brick.x + brick.width / 2 - 11,
      y: brick.y + brick.height / 2 - 7,
      width: 22,
      height: 14,
      velocity: 92,
    });
  };

  const applyWidePowerup = (now: number): void => {
    const center = paddle.x + paddle.width / 2;
    paddle.width = PADDLE_WIDE_WIDTH;
    paddle.x = center - paddle.width / 2;
    wideUntil = now + POWERUP_DURATION;
    clampPaddle();
  };

  const applyMultiPowerup = () => {
    const movingBalls = balls.filter((ball) => !ball.attached);
    const source = movingBalls[0] ?? balls[0];

    if (!source || balls.length >= 5) {
      return;
    }

    const speed = Math.max(220, Math.hypot(source.vx, source.vy));
    const angles = [-0.68, 0.68];

    angles.forEach((angle) => {
      if (balls.length >= 5) {
        return;
      }

      balls.push({
        x: source.x,
        y: source.y,
        vx: Math.sin(angle) * speed,
        vy: -Math.abs(Math.cos(angle) * speed),
        radius: BALL_RADIUS,
        attached: false,
      });
    });
  };

  const applySlowPowerup = () => {
    balls.forEach((ball) => {
      if (ball.attached) {
        return;
      }

      const speed = Math.hypot(ball.vx, ball.vy);

      if (speed <= 205) {
        return;
      }

      const factor = 205 / speed;
      ball.vx *= factor;
      ball.vy *= factor;
    });
  };

  const applyPowerup = (powerup: Powerup, now: number): void => {
    if (powerup.type === "wide") {
      applyWidePowerup(now);
    } else if (powerup.type === "multi") {
      applyMultiPowerup();
    } else if (powerup.type === "slow") {
      applySlowPowerup();
    } else if (powerup.type === "life") {
      lives = Math.min(MAX_LIVES, lives + 1);
    }

    score += 50;
    saveHighScore();
    updateScoreboard();
  };

  const finishGame = () => {
    gameOver = true;
    started = false;
    paused = false;
    transitionLocked = false;
    saveHighScore();
    updateScoreboard();
    setOverlay("GAME OVER", `${formatScore(score)} · R RESTART · ESC EXIT`);
  };

  const loseLife = () => {
    if (transitionLocked || gameOver) {
      return;
    }

    lives -= 1;
    updateScoreboard();

    if (lives <= 0) {
      finishGame();
      return;
    }

    transitionLocked = true;
    started = false;
    powerups = [];
    resetPaddle();
    createAttachedBall();
    setOverlay("BALL LOST", `${lives} LIVES REMAIN`);

    transitionTimer = window.setTimeout(() => {
      transitionLocked = false;
      setOverlay("PRESS FIRE OR MOVE", "ARROWS / A D / SPACE / DRAG");
      draw();
    }, 900);
  };

  const clearLevel = () => {
    if (transitionLocked || gameOver) {
      return;
    }

    transitionLocked = true;
    started = false;
    powerups = [];
    saveHighScore();
    updateScoreboard();
    setOverlay(`LEVEL ${formatLevel(level)} CLEARED`, "NEXT BOARD IN 2...");

    transitionTimer = window.setTimeout(() => {
      level += 1;
      transitionLocked = false;
      resetLevel();
      setOverlay("PRESS FIRE OR MOVE", "ARROWS / A D / SPACE / DRAG");
      draw();
    }, 1500);
  };

  const updatePaddle = (delta: number): void => {
    const direction =
      (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + pointerDirection;

    if (direction !== 0) {
      startPlaying();
    }

    paddle.x += direction * PADDLE_SPEED * delta;
    clampPaddle();

    balls.forEach((ball) => {
      if (ball.attached) {
        ball.x = paddle.x + paddle.width / 2;
        ball.y = paddle.y - ball.radius - 2;
      }
    });
  };

  const bounceFromPaddle = (ball: Ball): void => {
    const relative =
      (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
    const clamped = Math.max(-0.92, Math.min(0.92, relative));
    const speed = Math.max(225, Math.hypot(ball.vx, ball.vy));
    const angle = clamped * 1.05;

    ball.vx = Math.sin(angle) * speed;
    ball.vy = -Math.abs(Math.cos(angle) * speed);
    ball.y = paddle.y - ball.radius - 0.5;
  };

  const collideBallWithBrick = (
    ball: Ball,
    brick: Brick,
    previousX: number,
    previousY: number,
  ): boolean => {
    if (!circleIntersectsRect(ball, brick)) {
      return false;
    }

    const wasAbove = previousY + ball.radius <= brick.y;
    const wasBelow = previousY - ball.radius >= brick.y + brick.height;
    const wasLeft = previousX + ball.radius <= brick.x;
    const wasRight = previousX - ball.radius >= brick.x + brick.width;

    if (wasAbove || wasBelow) {
      ball.vy *= -1;
    } else if (wasLeft || wasRight) {
      ball.vx *= -1;
    } else {
      ball.vy *= -1;
    }

    brick.hp -= 1;
    score += brick.maxHp > 1 ? 20 : 10;

    if (brick.hp <= 0) {
      spawnPowerup(brick);
    }

    saveHighScore();
    updateScoreboard();
    return true;
  };

  const updateBalls = (delta: number): void => {
    const substeps = 3;
    const step = delta / substeps;

    for (let substep = 0; substep < substeps; substep += 1) {
      for (let index = balls.length - 1; index >= 0; index -= 1) {
        const ball = balls[index];

        if (ball.attached) {
          continue;
        }

        const previousX = ball.x;
        const previousY = ball.y;
        ball.x += ball.vx * step;
        ball.y += ball.vy * step;

        if (ball.x - ball.radius <= 0) {
          ball.x = ball.radius;
          ball.vx = Math.abs(ball.vx);
        } else if (ball.x + ball.radius >= BOARD_WIDTH) {
          ball.x = BOARD_WIDTH - ball.radius;
          ball.vx = -Math.abs(ball.vx);
        }

        if (ball.y - ball.radius <= 0) {
          ball.y = ball.radius;
          ball.vy = Math.abs(ball.vy);
        }

        if (
          ball.vy > 0 &&
          circleIntersectsRect(ball, paddle) &&
          previousY + ball.radius <= paddle.y + 4
        ) {
          bounceFromPaddle(ball);
        }

        const brick = bricks.find((candidate) =>
          circleIntersectsRect(ball, candidate),
        );

        if (brick) {
          collideBallWithBrick(ball, brick, previousX, previousY);
          bricks = bricks.filter((candidate) => candidate.hp > 0);

          if (bricks.length === 0) {
            clearLevel();
            return;
          }
        }

        if (ball.y - ball.radius > BOARD_HEIGHT) {
          balls.splice(index, 1);
          updateScoreboard();
        }
      }
    }

    if (balls.length === 0 && !transitionLocked && !gameOver) {
      loseLife();
    }
  };

  const updatePowerups = (delta: number, now: number): void => {
    for (let index = powerups.length - 1; index >= 0; index -= 1) {
      const powerup = powerups[index];

      if (!powerup) {
        continue;
      }

      powerup.y += powerup.velocity * delta;

      if (intersects(powerup, paddle)) {
        applyPowerup(powerup, now);
        powerups.splice(index, 1);
        continue;
      }

      if (powerup.y > BOARD_HEIGHT) {
        powerups.splice(index, 1);
      }
    }

    if (wideUntil && now >= wideUntil) {
      const center = paddle.x + paddle.width / 2;
      paddle.width = PADDLE_BASE_WIDTH;
      paddle.x = center - paddle.width / 2;
      wideUntil = 0;
      clampPaddle();
    }
  };

  const update = (delta: number, now: number): void => {
    updatePaddle(delta);
    updateBalls(delta);

    if (transitionLocked || gameOver) {
      return;
    }

    updatePowerups(delta, now);
  };

  const gameLoop = (time: number): void => {
    if (!active) {
      return;
    }

    if (!previousTime) {
      previousTime = time;
    }

    const milliseconds = Math.min(time - previousTime, 34);
    const delta = milliseconds / 1000;
    previousTime = time;

    if (started && !paused && !gameOver && !transitionLocked) {
      update(delta, time);
    }

    draw();
    animationFrame = window.requestAnimationFrame(gameLoop);
  };

  const togglePause = () => {
    if (!active || !started || gameOver || transitionLocked) {
      return;
    }

    paused = !paused;

    if (paused) {
      setOverlay("PAUSED", "P TO RESUME");
    } else {
      previousTime = performance.now();
      setOverlay("RUNNING", "", false);
    }
  };

  const pauseGame = () => {
    if (!active || !started || paused || gameOver || transitionLocked) {
      return;
    }

    paused = true;
    setOverlay("PAUSED", "P TO RESUME");
  };

  const startGame = () => {
    active = true;
    root.hidden = false;
    highScore = readHighScore();
    configureCanvas();
    resetGame();

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
    saveHighScore();
    updateScoreboard();
    root.hidden = true;

    if (transitionTimer !== null) {
      window.clearTimeout(transitionTimer);
      transitionTimer = null;
    }

    if (animationFrame !== null) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }

    dispatchGameExit(GAME_EVENTS.breakout.exit, { score, highScore, level });
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!active) {
      return;
    }

    const key = event.key.toLowerCase();

    if (event.key === "ArrowLeft" || key === "a") {
      event.preventDefault();
      keys.left = true;
      startPlaying();
      return;
    }

    if (event.key === "ArrowRight" || key === "d") {
      event.preventDefault();
      keys.right = true;
      startPlaying();
      return;
    }

    if (event.key === " " || key === "f") {
      event.preventDefault();
      launchAttachedBalls();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      exitGame();
      return;
    }

    if (key === "r") {
      event.preventDefault();
      resetGame();
      return;
    }

    if (key === "p") {
      event.preventDefault();
      togglePause();
    }
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    if (!active) {
      return;
    }

    const key = event.key.toLowerCase();

    if (event.key === "ArrowLeft" || key === "a") {
      keys.left = false;
    }

    if (event.key === "ArrowRight" || key === "d") {
      keys.right = false;
    }
  };

  const setPointerMovement = (direction: number): void => {
    pointerDirection = direction;
    startPlaying();
  };

  controlButtons.forEach((button) => {
    const control = button.dataset.breakoutControl;

    if (control === "launch") {
      button.addEventListener("click", () => {
        launchAttachedBalls();
        canvas.focus({ preventScroll: true });
      });
      return;
    }

    const direction = control === "left" ? -1 : 1;

    button.addEventListener("pointerdown", (event: PointerEvent) => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      setPointerMovement(direction);
    });

    const stop = () => {
      if (pointerDirection === direction) {
        pointerDirection = 0;
      }
    };

    button.addEventListener("pointerup", stop);
    button.addEventListener("pointercancel", stop);
    button.addEventListener("lostpointercapture", stop);
  });

  const movePaddleToPointer = (event: PointerEvent): void => {
    const bounds = canvas.getBoundingClientRect();
    const scaleX = BOARD_WIDTH / bounds.width;
    const x = (event.clientX - bounds.left) * scaleX;
    paddle.x = x - paddle.width / 2;
    clampPaddle();
    startPlaying();
  };

  canvas.addEventListener("pointerdown", (event: PointerEvent) => {
    if (!active) {
      return;
    }

    event.preventDefault();
    pointerDragging = true;
    canvas.setPointerCapture?.(event.pointerId);
    movePaddleToPointer(event);
  });

  canvas.addEventListener("pointermove", (event: PointerEvent) => {
    if (!active || !pointerDragging) {
      return;
    }

    event.preventDefault();
    movePaddleToPointer(event);
  });

  const stopPointerDrag = (event: PointerEvent): void => {
    if (!pointerDragging) {
      return;
    }

    pointerDragging = false;
    canvas.releasePointerCapture?.(event.pointerId);
  };

  canvas.addEventListener("pointerup", (event: PointerEvent) => {
    stopPointerDrag(event);
    launchAttachedBalls();
  });
  canvas.addEventListener("pointercancel", stopPointerDrag);

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  window.addEventListener("blur", pauseGame);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pauseGame();
    }
  });

  window.addEventListener("resize", () => {
    if (active) {
      configureCanvas();
      draw();
    }
  });

  window.addEventListener(GAME_EVENTS.breakout.start, startGame);
}
