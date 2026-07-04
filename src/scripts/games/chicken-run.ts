import {
  cycleStateForElapsed,
  foxApproachPerSecond,
  foxStartingPressure,
  foxXForPressure,
  shouldOfferEgg,
  type RunCycleState,
  type RunPhase,
} from "./chicken-run-cycle";
import {
  createEggPickup,
  eggPickupTravelDistance,
  spawnCoursePattern,
  type CornGroup,
} from "./chicken-run-course";
import {
  emitEggShells,
  emitFeathers as appendFeathers,
  updateFeathers as advanceFeathers,
  type FeatherEffect,
} from "./chicken-run-effects";
import {
  drawChickenRunScene,
  type ChickenObstacle,
  type CornKernel,
  type CrashVisual,
  type EggPickup,
  type Feather,
  type Point,
  type Rect,
  type RunNotice,
  type ScoreBurst,
} from "./chicken-run-renderer";
import {
  chooseJumpAction,
  jumpControlForState,
  speedForScore,
  speedLevelForVelocity,
  type CrashKind,
} from "./chicken-run-rules";
import { configureFixedCanvas } from "./shared/canvas";
import { dispatchGameExit, GAME_EVENTS } from "./shared/events";
import { mountAllGames } from "./shared/mount";
import { readStoredScore, writeStoredScore } from "./shared/storage";

interface CrashState extends CrashVisual {
  freezeRemaining: number;
  duration: number;
  vx: number;
  vy: number;
  spin: number;
}

const BOARD_WIDTH = 640;
const BOARD_HEIGHT = 320;
const GROUND_Y = 264;
const CHICKEN_X = 92;
const CHICKEN_WIDTH = 42;
const CHICKEN_HEIGHT = 42;
const GRAVITY = 1_620;
const JUMP_VELOCITY = -610;
const FLAP_VELOCITY = -430;
const JUMP_BUFFER_MS = 110;
const EGG_INVULNERABILITY_SECONDS = 1.15;
const MAX_RUN_SPEED = 545;
const HIGH_SCORE_KEY = "tiendu-chicken-high-score";

export function mountChickenRunGames(): void {
  mountAllGames(
    "[data-chicken-game]",
    "chickenInitialized",
    mountChickenRunGame,
  );
}

function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function mountChickenRunGame(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLCanvasElement>("[data-chicken-canvas]");
  const scoreOutput = root.querySelector<HTMLOutputElement>(
    "[data-chicken-score]",
  );
  const highScoreOutput = root.querySelector<HTMLOutputElement>(
    "[data-chicken-high-score]",
  );
  const eggOutput = root.querySelector<HTMLOutputElement>(
    "[data-chicken-egg]",
  );
  const speedOutput = root.querySelector<HTMLOutputElement>(
    "[data-chicken-speed]",
  );
  const overlay = root.querySelector<HTMLElement>("[data-chicken-overlay]");
  const stateLabel = root.querySelector<HTMLElement>("[data-chicken-state]");
  const messageLabel = root.querySelector<HTMLElement>(
    "[data-chicken-message]",
  );
  const jumpButton = root.querySelector<HTMLButtonElement>(
    '[data-chicken-control="jump"]',
  );

  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;

  let active = false;
  let started = false;
  let paused = false;
  let gameOver = false;
  let score = 0;
  let highScore = 0;
  let runHighScore = 0;
  let isNewHighScore = false;
  let distance = 0;
  let bonusScore = 0;
  let sceneElapsed = 0;
  let runElapsed = 0;
  let cycle = cycleStateForElapsed(0);
  let previousPhase: RunPhase = cycle.phase;
  let currentSpeed = speedForScore(0);
  let chickenY = GROUND_Y - CHICKEN_HEIGHT;
  let chickenVelocityY = 0;
  let grounded = true;
  let flapAvailable = true;
  let lastGroundedAt = 0;
  let jumpBufferedUntil = 0;
  let nextPatternDistance = 330;
  let obstacles: ChickenObstacle[] = [];
  let corn: CornKernel[] = [];
  let cornGroups = new Map<number, CornGroup>();
  let nextCornGroupId = 1;
  let egg: EggPickup | null = null;
  let eggCarried = false;
  let eggOfferPending = false;
  let offeredEggCycle = -1;
  let foxPressure = 0;
  let foxRunFrame = 0;
  let invulnerableRemaining = 0;
  let rescuePulse = 0;
  let feathers: Feather[] = [];
  let scoreBursts: ScoreBurst[] = [];
  let notice: RunNotice | null = null;
  let crash: CrashState | null = null;
  let previousTime = 0;
  let animationFrame: number | null = null;
  let runFrame = 0;
  let featherAccumulator = 0;
  let crashFeatherAccumulator = 0;
  let celebrationAccumulator = 0;
  let takeoffPulse = 0;
  let flapPulse = 0;
  let landingPulse = 0;
  let lastSpeedLevel = 1;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const formatScore = (value: number): string =>
    String(Math.max(0, Math.floor(value))).padStart(4, "0");

  const setOverlay = (title: string, message: string, visible = true): void => {
    if (stateLabel) stateLabel.textContent = title;
    if (messageLabel) messageLabel.textContent = message;
    if (overlay) overlay.hidden = !visible;
  };

  const setNotice = (text: string, lifetime = 0.9): void => {
    notice = { text, age: 0, lifetime };
  };

  const updateHighScore = (): void => {
    if (score > highScore) highScore = score;
  };

  const persistHighScore = (): void => {
    updateHighScore();
    writeStoredScore(HIGH_SCORE_KEY, highScore);
  };

  const updateScoreboard = (): void => {
    if (scoreOutput) scoreOutput.textContent = formatScore(score);
    if (highScoreOutput) highScoreOutput.textContent = formatScore(highScore);
    if (eggOutput) eggOutput.textContent = eggCarried ? "01" : "00";
    if (speedOutput) {
      speedOutput.textContent = String(
        speedLevelForVelocity(currentSpeed),
      ).padStart(2, "0");
    }
  };

  const setJumpButton = (
    label: string,
    disabled: boolean,
    ariaLabel: string,
  ): void => {
    if (!jumpButton) return;
    if (jumpButton.textContent !== label) jumpButton.textContent = label;
    jumpButton.disabled = disabled;
    jumpButton.setAttribute("aria-label", ariaLabel);
  };

  const updateJumpButton = (): void => {
    if (!active) return;
    const control = jumpControlForState({
      gameOver,
      crashing: crash !== null,
      paused,
      started,
      grounded,
      flapAvailable,
    });
    setJumpButton(control.label, control.disabled, control.ariaLabel);
  };

  const configureCanvas = (): void => {
    configureFixedCanvas(canvas, context, BOARD_WIDTH, BOARD_HEIGHT);
    context.imageSmoothingEnabled = false;
  };

  const emitFeathers = (
    effect: FeatherEffect,
    origin: Point,
    requestedCount?: number,
  ): void => {
    appendFeathers(
      feathers,
      effect,
      origin,
      reducedMotion.matches,
      BOARD_WIDTH,
      requestedCount,
    );
  };

  const spawnNextCourse = (): void => {
    if (eggOfferPending && !eggCarried && !egg) {
      egg = createEggPickup({
        boardWidth: BOARD_WIDTH,
        groundY: GROUND_Y,
        cycleIndex: cycle.cycleIndex,
      });
      eggOfferPending = false;
      offeredEggCycle = cycle.cycleIndex;
      nextPatternDistance = distance + eggPickupTravelDistance(currentSpeed);
      setNotice("EGG AHEAD · ONE EXTRA LIFE", 1.15);
      return;
    }

    const spawned = spawnCoursePattern({
      score,
      speed: currentSpeed,
      boardWidth: BOARD_WIDTH,
      groundY: GROUND_Y,
      nextCornGroupId,
      cycle,
    });
    obstacles.push(...spawned.obstacles);
    corn.push(...spawned.corn);
    spawned.cornGroups.forEach((group, groupId) => {
      cornGroups.set(groupId, group);
    });
    nextCornGroupId = spawned.nextCornGroupId;
    nextPatternDistance = distance + spawned.travelDistance;
  };

  const resetGame = (): void => {
    started = false;
    paused = false;
    gameOver = false;
    score = 0;
    runHighScore = highScore;
    isNewHighScore = false;
    distance = 0;
    bonusScore = 0;
    sceneElapsed = 0;
    runElapsed = 0;
    cycle = cycleStateForElapsed(0);
    previousPhase = cycle.phase;
    currentSpeed = speedForScore(0);
    chickenY = GROUND_Y - CHICKEN_HEIGHT;
    chickenVelocityY = 0;
    grounded = true;
    flapAvailable = true;
    lastGroundedAt = performance.now();
    jumpBufferedUntil = 0;
    nextPatternDistance = 330;
    obstacles = [];
    corn = [];
    cornGroups = new Map();
    nextCornGroupId = 1;
    egg = null;
    eggCarried = false;
    eggOfferPending = false;
    offeredEggCycle = -1;
    foxPressure = 0;
    foxRunFrame = 0;
    invulnerableRemaining = 0;
    rescuePulse = 0;
    feathers = [];
    scoreBursts = [];
    notice = null;
    crash = null;
    previousTime = 0;
    runFrame = 0;
    featherAccumulator = 0;
    crashFeatherAccumulator = 0;
    celebrationAccumulator = 0;
    takeoffPulse = 0;
    flapPulse = 0;
    landingPulse = 0;
    lastSpeedLevel = 1;
    updateScoreboard();
    updateJumpButton();
    setOverlay(
      "PRESS JUMP",
      "SPACE / UP / TAP · FLAP ONCE · FIND AN EGG BEFORE NIGHT",
    );
    draw();
  };

  const startPlaying = (): void => {
    if (!active || gameOver || crash) return;
    if (!started) {
      started = true;
      paused = false;
      previousTime = performance.now();
      setOverlay("RUNNING", "", false);
      updateJumpButton();
    }
  };

  const performJump = (now: number): boolean => {
    const action = chooseJumpAction({
      grounded,
      millisecondsSinceGrounded: now - lastGroundedAt,
      flapAvailable,
    });

    if (action === "jump") {
      chickenVelocityY = JUMP_VELOCITY;
      grounded = false;
      lastGroundedAt = Number.NEGATIVE_INFINITY;
      flapAvailable = true;
      takeoffPulse = 0.13;
      landingPulse = 0;
      emitFeathers("jump", { x: CHICKEN_X + 8, y: GROUND_Y - 7 });
      updateJumpButton();
      return true;
    }

    if (action === "flap") {
      chickenVelocityY = Math.min(chickenVelocityY, FLAP_VELOCITY);
      flapAvailable = false;
      flapPulse = 0.18;
      emitFeathers("flap", { x: CHICKEN_X + 9, y: chickenY + 22 });
      updateJumpButton();
      return true;
    }

    return false;
  };

  const requestJump = (): void => {
    if (!active || paused || gameOver || crash) return;
    startPlaying();
    const now = performance.now();
    if (!performJump(now)) jumpBufferedUntil = now + JUMP_BUFFER_MS;
  };

  const chickenHitbox = (): Rect => ({
    x: CHICKEN_X + 7,
    y: chickenY + 5,
    width: CHICKEN_WIDTH - 13,
    height: CHICKEN_HEIGHT - 8,
  });

  const obstacleHitbox = (obstacle: ChickenObstacle): Rect => {
    if (obstacle.kind === "mud") {
      return {
        x: obstacle.x + 7,
        y: GROUND_Y - 6,
        width: obstacle.width - 14,
        height: 8,
      };
    }
    return {
      x: obstacle.x + 3,
      y: obstacle.y + 3,
      width: obstacle.width - 6,
      height: obstacle.height - 3,
    };
  };

  const beginCrash = (kind: CrashKind): void => {
    if (crash || gameOver) return;
    started = false;
    paused = false;
    jumpBufferedUntil = 0;
    const mud = kind === "mud";
    crash = {
      kind,
      elapsed: 0,
      freezeRemaining: reducedMotion.matches ? 0 : 0.08,
      duration: reducedMotion.matches ? 0.18 : mud ? 0.62 : 0.54,
      x: CHICKEN_X,
      y: chickenY,
      vx: mud ? 0 : kind === "fox" ? 138 : 118,
      vy: mud ? 0 : kind === "fox" ? -225 : -255,
      rotation: 0,
      spin: mud ? 0 : kind === "fox" ? 6.2 : 5.4,
      sink: 0,
    };
    crashFeatherAccumulator = 0;
    emitFeathers(
      "crash",
      { x: CHICKEN_X + 21, y: chickenY + 21 },
      mud ? 11 : undefined,
    );
    setOverlay("CRASHED", "", false);
    updateJumpButton();
  };

  const rescueWithEgg = (kind: CrashKind): boolean => {
    if (!eggCarried || crash || gameOver) return false;

    eggCarried = false;
    invulnerableRemaining = EGG_INVULNERABILITY_SECONDS;
    rescuePulse = 0.9;
    jumpBufferedUntil = 0;
    chickenY = Math.min(chickenY, GROUND_Y - CHICKEN_HEIGHT - 12);
    chickenVelocityY = -420;
    grounded = false;
    flapAvailable = true;
    lastGroundedAt = Number.NEGATIVE_INFINITY;
    foxPressure = Math.max(0.12, foxPressure - 0.48);
    obstacles = obstacles.filter(
      (obstacle) =>
        obstacle.x > CHICKEN_X + 255 ||
        obstacle.x + obstacle.width < CHICKEN_X - 28,
    );
    emitEggShells(
      feathers,
      { x: CHICKEN_X + 18, y: chickenY + 20 },
      reducedMotion.matches,
    );
    emitFeathers("flap", { x: CHICKEN_X + 11, y: chickenY + 23 }, 7);
    bonusScore += 25;
    scoreBursts.push({
      x: CHICKEN_X + 24,
      y: chickenY - 6,
      text: "+25",
      age: 0,
      lifetime: 0.9,
    });
    setNotice(
      kind === "fox" ? "EGG SAVED YOU · RUN!" : "EGG CRACKED · KEEP GOING",
      1.2,
    );
    updateScoreboard();
    return true;
  };

  const finishGame = (): void => {
    if (gameOver) return;
    gameOver = true;
    paused = false;
    isNewHighScore = score > runHighScore;
    persistHighScore();
    updateScoreboard();
    updateJumpButton();

    let failure = "FEATHERS EVERYWHERE";
    if (crash?.kind === "mud") failure = "MUD BATH";
    if (crash?.kind === "fox") failure = "FOX CAUGHT UP";
    const record = isNewHighScore ? "NEW HIGH · " : "";
    setOverlay(
      "GAME OVER",
      `${record}${failure} · ${formatScore(score)} · R/SPACE RETRY · ESC EXIT`,
    );
  };

  const updateAnimationTimers = (delta: number): void => {
    takeoffPulse = Math.max(0, takeoffPulse - delta);
    flapPulse = Math.max(0, flapPulse - delta);
    landingPulse = Math.max(0, landingPulse - delta);
    rescuePulse = Math.max(0, rescuePulse - delta);
    invulnerableRemaining = Math.max(0, invulnerableRemaining - delta);

    if (notice) {
      notice.age += delta;
      if (notice.age >= notice.lifetime) notice = null;
    }

    scoreBursts.forEach((burst) => {
      burst.age += delta;
    });
    scoreBursts = scoreBursts.filter((burst) => burst.age < burst.lifetime);
  };

  const updateChicken = (delta: number, now: number): void => {
    chickenVelocityY += GRAVITY * delta;
    chickenY += chickenVelocityY * delta;

    const floor = GROUND_Y - CHICKEN_HEIGHT;
    if (chickenY >= floor) {
      const impactVelocity = chickenVelocityY;
      const landed = !grounded && impactVelocity > 120;
      chickenY = floor;
      chickenVelocityY = 0;
      grounded = true;
      flapAvailable = true;
      lastGroundedAt = now;
      if (landed) {
        landingPulse = Math.min(0.14, 0.07 + impactVelocity / 4_000);
        emitFeathers("land", { x: CHICKEN_X + 12, y: GROUND_Y - 5 });
      }
      if (jumpBufferedUntil >= now) {
        jumpBufferedUntil = 0;
        performJump(now);
      }
    } else {
      grounded = false;
    }
    updateJumpButton();
  };

  const collectCorn = (kernel: CornKernel): void => {
    kernel.collected = true;
    bonusScore += 5;
    if (cycle.phase === "night") foxPressure = Math.max(0.08, foxPressure - 0.004);
    scoreBursts.push({
      x: kernel.x,
      y: kernel.y - 4,
      text: "+5",
      age: 0,
      lifetime: 0.62,
    });

    const group = cornGroups.get(kernel.groupId);
    if (!group) return;
    group.collected += 1;
    if (group.collected === group.total && !group.bonusAwarded) {
      group.bonusAwarded = true;
      bonusScore += 20;
      if (cycle.phase === "night") {
        foxPressure = Math.max(0.08, foxPressure - 0.025);
      }
      setNotice("CORN ARC +20", 0.88);
      scoreBursts.push({
        x: CHICKEN_X + 28,
        y: chickenY - 6,
        text: "+20",
        age: 0,
        lifetime: 0.82,
      });
    }
  };

  const collectEgg = (): void => {
    if (!egg || eggCarried) return;
    const collectedX = egg.x;
    const collectedY = egg.y;
    egg = null;
    eggCarried = true;
    eggOfferPending = false;
    bonusScore += 50;
    setNotice("EGG SECURED · ONE EXTRA LIFE", 1.2);
    scoreBursts.push({
      x: collectedX,
      y: collectedY - 6,
      text: "+50",
      age: 0,
      lifetime: 0.9,
    });
    emitFeathers("celebrate", { x: 0, y: 0 }, 2);
    updateScoreboard();
  };

  const updateCollectibles = (delta: number): void => {
    const chickenCenter = {
      x: CHICKEN_X + CHICKEN_WIDTH * 0.52,
      y: chickenY + CHICKEN_HEIGHT * 0.48,
    };

    corn.forEach((kernel) => {
      kernel.x -= currentSpeed * delta;
      if (kernel.collected) return;
      const dx = kernel.x - chickenCenter.x;
      const dy = kernel.y - chickenCenter.y;
      if (dx * dx + dy * dy <= 17 * 17) collectCorn(kernel);
    });

    corn = corn.filter((kernel) => !kernel.collected && kernel.x > -24);
    const activeGroups = new Set(corn.map((kernel) => kernel.groupId));
    cornGroups.forEach((_group, groupId) => {
      if (!activeGroups.has(groupId)) cornGroups.delete(groupId);
    });

    if (egg) {
      egg.x -= currentSpeed * delta;
      const dx = egg.x - chickenCenter.x;
      const dy = egg.y - chickenCenter.y;
      if (dx * dx + dy * dy <= 20 * 20) collectEgg();
      else if (egg.x < -26) egg = null;
    }
  };

  const updateObstacles = (delta: number): void => {
    obstacles.forEach((obstacle) => {
      obstacle.x -= currentSpeed * delta;
      if (!obstacle.passed && obstacle.x + obstacle.width < CHICKEN_X) {
        obstacle.passed = true;
        bonusScore += 15;
        if (cycle.phase === "night") {
          foxPressure = Math.max(0.08, foxPressure - 0.012);
        }
      }
    });
    obstacles = obstacles.filter(
      (obstacle) => obstacle.x + obstacle.width > -24,
    );

    if (distance >= nextPatternDistance) spawnNextCourse();
    if (invulnerableRemaining > 0) return;

    const chicken = chickenHitbox();
    const collision = obstacles.find((obstacle) =>
      intersects(chicken, obstacleHitbox(obstacle)),
    );
    if (!collision) return;
    if (!rescueWithEgg(collision.kind)) beginCrash(collision.kind);
  };

  const handlePhaseTransition = (
    previous: RunCycleState,
    next: RunCycleState,
  ): void => {
    const changedCycle = previous.cycleIndex !== next.cycleIndex;
    if (previous.phase === next.phase && !changedCycle) return;

    if (next.phase === "sunset") {
      setNotice("NIGHT APPROACHING · FIND COVER", 1.15);
      return;
    }
    if (next.phase === "night") {
      foxPressure = Math.max(
        foxPressure,
        foxStartingPressure(next.cycleIndex),
      );
      setNotice("RUN! FOX BEHIND", 1.25);
      return;
    }
    if (next.phase === "dawn") {
      setNotice("DAWN · HOLD ON", 1.05);
      return;
    }
    if (next.phase === "day" && next.cycleIndex > 0) {
      foxPressure = 0;
      setNotice("DAYLIGHT · SAFE FOR NOW", 1.15);
    }
  };

  const updateCycle = (delta: number): void => {
    const nextCycle = cycleStateForElapsed(runElapsed);
    handlePhaseTransition(cycle, nextCycle);
    previousPhase = cycle.phase;
    cycle = nextCycle;

    if (
      shouldOfferEgg({
        state: cycle,
        hasEgg: eggCarried,
        activeEgg: egg !== null,
        offeredCycle: offeredEggCycle,
      })
    ) {
      eggOfferPending = true;
    }

    if (cycle.phase === "night") {
      foxPressure += foxApproachPerSecond(cycle.cycleIndex) * delta;
    } else if (cycle.phase === "sunset") {
      const target = foxStartingPressure(cycle.cycleIndex) * 0.48;
      foxPressure = Math.max(foxPressure, target * cycle.phaseProgress);
    } else if (cycle.phase === "dawn") {
      foxPressure = Math.max(0, foxPressure - 0.68 * delta);
    } else if (previousPhase !== "dawn") {
      foxPressure = 0;
    }

    foxPressure = clamp01(foxPressure);
    foxRunFrame += delta * (10 + currentSpeed / 52);

    if (cycle.phase === "night" && foxPressure >= 1 && !crash) {
      if (!rescueWithEgg("fox")) beginCrash("fox");
    }
  };

  const updateFeathers = (delta: number): void => {
    feathers = advanceFeathers(
      feathers,
      delta,
      BOARD_WIDTH,
      BOARD_HEIGHT,
    );
  };

  const updateCrash = (delta: number): void => {
    if (!crash) return;
    updateAnimationTimers(delta);
    updateFeathers(delta);
    sceneElapsed += delta;
    foxRunFrame += delta * 18;

    if (crash.freezeRemaining > 0) {
      crash.freezeRemaining = Math.max(0, crash.freezeRemaining - delta);
      return;
    }

    crash.elapsed += delta;
    if (crash.kind === "mud") {
      crash.sink = Math.min(13, crash.elapsed * 27);
      runFrame += delta * 18;
      crashFeatherAccumulator += delta;
      if (crashFeatherAccumulator >= 0.12) {
        crashFeatherAccumulator = 0;
        emitFeathers("flap", { x: crash.x + 9, y: crash.y + 21 }, 2);
      }
    } else {
      crash.x += crash.vx * delta;
      crash.y += crash.vy * delta;
      crash.vy += GRAVITY * 0.9 * delta;
      crash.rotation += crash.spin * delta;
    }

    if (crash.elapsed >= crash.duration) finishGame();
  };

  const updateGameOverEffects = (delta: number): void => {
    updateAnimationTimers(delta);
    updateFeathers(delta);
    sceneElapsed += delta;
    foxRunFrame += delta * 5;
    if (!isNewHighScore) return;
    celebrationAccumulator += delta;
    if (celebrationAccumulator >= 0.22) {
      celebrationAccumulator = 0;
      emitFeathers("celebrate", { x: 0, y: 0 });
    }
  };

  const update = (delta: number, now: number): void => {
    runElapsed += delta;
    updateCycle(delta);
    currentSpeed = Math.min(
      MAX_RUN_SPEED,
      speedForScore(score) * cycle.speedMultiplier,
    );
    distance += currentSpeed * delta;
    sceneElapsed += delta;
    runFrame += delta * (grounded ? 11 + currentSpeed / 65 : 3.2);
    featherAccumulator += delta;

    if (grounded && featherAccumulator >= 0.62) {
      featherAccumulator = 0;
      emitFeathers("run", { x: CHICKEN_X + 5, y: chickenY + 24 });
    }

    updateAnimationTimers(delta);
    updateChicken(delta, now);
    updateCollectibles(delta);
    updateObstacles(delta);
    updateFeathers(delta);

    score = Math.floor(distance / 12) + bonusScore;
    const speedLevel = speedLevelForVelocity(currentSpeed);
    if (speedLevel > lastSpeedLevel && cycle.phase === "day") {
      setNotice(`SPEED ${String(speedLevel).padStart(2, "0")}`, 0.95);
    }
    lastSpeedLevel = speedLevel;

    updateHighScore();
    updateScoreboard();
  };

  const draw = (): void => {
    const foxVisible =
      cycle.phase === "night" ||
      cycle.phase === "dawn" ||
      (cycle.phase === "sunset" && cycle.phaseProgress > 0.2) ||
      crash?.kind === "fox";

    drawChickenRunScene(context, {
      width: BOARD_WIDTH,
      height: BOARD_HEIGHT,
      groundY: GROUND_Y,
      distance,
      elapsed: sceneElapsed,
      obstacles,
      corn,
      egg,
      feathers,
      scoreBursts,
      notice,
      cycle,
      fox: {
        visible: foxVisible,
        x: crash?.kind === "fox" ? 49 : foxXForPressure(foxPressure),
        pressure: foxPressure,
        runFrame: foxRunFrame,
      },
      chicken: {
        x: CHICKEN_X,
        y: chickenY,
        velocityY: chickenVelocityY,
        grounded,
        flapAvailable,
        runFrame,
        takeoffPulse,
        flapPulse,
        landingPulse,
        rescuePulse,
        invulnerable: invulnerableRemaining > 0,
        eggCarried,
        crash,
      },
    });
  };

  const gameLoop = (time: number): void => {
    if (!active) return;
    if (!previousTime) previousTime = time;
    const milliseconds = Math.min(time - previousTime, 34);
    const delta = milliseconds / 1000;
    previousTime = time;

    if (crash && !gameOver) updateCrash(delta);
    else if (started && !paused && !gameOver) update(delta, time);
    else if (gameOver) updateGameOverEffects(delta);
    else {
      updateAnimationTimers(delta);
      updateFeathers(delta);
      sceneElapsed += delta;
    }

    draw();
    animationFrame = window.requestAnimationFrame(gameLoop);
  };

  const togglePause = (): void => {
    if (!active || !started || gameOver || crash) return;
    paused = !paused;
    if (paused) setOverlay("PAUSED", "P TO RESUME");
    else {
      previousTime = performance.now();
      setOverlay("RUNNING", "", false);
    }
    updateJumpButton();
  };

  const pauseGame = (): void => {
    if (!active || !started || paused || gameOver || crash) return;
    paused = true;
    setOverlay("PAUSED", "P TO RESUME");
    updateJumpButton();
  };

  const startGame = (): void => {
    active = true;
    root.hidden = false;
    highScore = readStoredScore(HIGH_SCORE_KEY);
    configureCanvas();
    resetGame();
    if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    animationFrame = window.requestAnimationFrame(gameLoop);
    window.setTimeout(() => canvas.focus({ preventScroll: true }), 0);
  };

  const exitGame = (): void => {
    if (!active) return;
    active = false;
    started = false;
    paused = false;
    persistHighScore();
    updateScoreboard();
    root.hidden = true;
    if (animationFrame !== null) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    dispatchGameExit(GAME_EVENTS.chicken.exit, {
      score,
      highScore,
      speed: speedLevelForVelocity(currentSpeed),
    });
  };

  const retryAndJump = (): void => {
    resetGame();
    requestJump();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!active) return;
    const key = event.key.toLowerCase();

    if (event.key === "Escape") {
      event.preventDefault();
      exitGame();
      return;
    }

    if (event.key === " " || event.key === "ArrowUp" || key === "w") {
      event.preventDefault();
      if (gameOver) retryAndJump();
      else if (!crash) requestJump();
      return;
    }

    if (key === "r") {
      event.preventDefault();
      if (gameOver || !crash) resetGame();
      return;
    }

    if (key === "p") {
      event.preventDefault();
      togglePause();
    }
  };

  const activateFromPointer = (event: PointerEvent): void => {
    if (!active) return;
    event.preventDefault();
    if (paused) return;
    if (gameOver) retryAndJump();
    else if (!crash) requestJump();
    canvas.focus({ preventScroll: true });
  };

  jumpButton?.addEventListener("click", () => {
    if (paused) {
      togglePause();
    } else if (gameOver) {
      retryAndJump();
    } else {
      requestJump();
    }
    canvas.focus({ preventScroll: true });
  });
  canvas.addEventListener("pointerdown", activateFromPointer);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("blur", pauseGame);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseGame();
  });
  window.addEventListener("resize", () => {
    if (active) {
      configureCanvas();
      draw();
    }
  });
  window.addEventListener(GAME_EVENTS.chicken.start, startGame);
}
