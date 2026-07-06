import {
  calculateRestLean,
  cableSwingForHeight,
  collapseAngleForHeight,
  crateMotionProfile,
  nextCrateSpec,
  resolveLanding,
  shouldAwardTool,
  toolChoicesForAward,
  trolleySpeedForHeight,
  wideLoadSpec,
  windForHeight,
  type CraneTool,
  type CrateKind,
  type CrateSpec,
  type PlacedCrate,
  type WindState,
} from "./crane-rules";
import {
  CRANE_BASE_Y,
  CRANE_CAMERA_THRESHOLD,
  CRANE_HANGING_Y,
  CRANE_TOWER_X,
  CRANE_WIDTH,
  createCraneRenderer,
  type CraneRenderState,
} from "./crane-renderer";
import {
  dispatchGameExit,
  dispatchGameStatus,
  GAME_EVENTS,
  readGameCommand,
} from "./shared/events";
import { mountAllGames } from "./shared/mount";
import {
  readStoredScore,
  readStoredSession,
  removeStoredSession,
  writeStoredScore,
  writeStoredSession,
} from "./shared/storage";

interface AirborneCrate extends CrateSpec {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface CollapseState {
  elapsed: number;
  direction: -1 | 1;
}

type LandingFeedbackKind = "perfect" | "stable" | "risky" | "mag-lock";

interface LandingFeedback {
  kind: LandingFeedbackKind;
  label: string;
  centerX: number;
  height: number;
  elapsed: number;
}

type ConfirmationAction = "restart" | "discard-save";

interface CraneSessionState {
  score: number;
  highScoreAtRunStart: number;
  perfectStreak: number;
  pendingToolChoices: [CraneTool, CraneTool] | null;
  toolAwardIndex: number;
  magLockArmed: boolean;
  wideLoadArmed: boolean;
  windbreakDrops: number;
  runSeed: number;
  crates: PlacedCrate[];
  trolleyX: number;
  trolleyDirection: -1 | 1;
  swingPhase: number;
  towerAngle: number;
  angularVelocity: number;
  restLean: number;
  cameraOffset: number;
}

const HIGH_SCORE_KEY = "tiendu-crane-high-score";
const SESSION_KEY = "tiendu-crane-session";
const SESSION_VERSION = 2;
const BASE_WIDTH = 230;
const GRAVITY = 760;
const MAX_FRAME_STEP = 1 / 30;
const RENDER_INTERVAL_MS = 1000 / 30;
const CALM_WIND: WindState = {
  direction: 0,
  strength: 0,
  force: 0,
  label: "CALM",
};

const TOOL_LABELS: Record<CraneTool, string> = {
  stabilizer: "STABILIZE",
  "mag-lock": "MAG-LOCK",
  "wide-load": "WIDE LOAD",
  windbreak: "WINDBREAK",
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isCraneTool(value: unknown): value is CraneTool {
  return value === "stabilizer" || value === "mag-lock" || value === "wide-load" || value === "windbreak";
}

function isCrateKind(value: unknown): value is CrateKind {
  return value === "standard" || value === "long" || value === "heavy";
}

function isPlacedCrate(value: unknown): value is PlacedCrate {
  if (!value || typeof value !== "object") return false;
  const crate = value as Partial<PlacedCrate>;
  return (
    Number.isInteger(crate.id) &&
    isFiniteNumber(crate.centerX) &&
    isFiniteNumber(crate.bottom) &&
    isCrateKind(crate.kind) &&
    isFiniteNumber(crate.width) &&
    (crate.width ?? 0) > 0 &&
    (crate.width ?? 10_000) < 1_000 &&
    isFiniteNumber(crate.height) &&
    (crate.height ?? 0) > 0 &&
    (crate.height ?? 10_000) < 1_000 &&
    isFiniteNumber(crate.mass) &&
    (crate.mass ?? 0) > 0 &&
    (crate.mass ?? 10_000) < 10_000 &&
    isFiniteNumber(crate.tonnage) &&
    (crate.tonnage ?? 0) > 0 &&
    (crate.tonnage ?? 10_000) < 10_000
  );
}

function isCraneSessionState(value: unknown): value is CraneSessionState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<CraneSessionState>;
  const choices = state.pendingToolChoices;
  return (
    Number.isInteger(state.score) &&
    (state.score ?? 0) > 0 &&
    (state.score ?? 100_001) <= 100_000 &&
    Number.isInteger(state.highScoreAtRunStart) &&
    (state.highScoreAtRunStart ?? -1) >= 0 &&
    Number.isInteger(state.perfectStreak) &&
    (state.perfectStreak ?? -1) >= 0 &&
    (choices === null ||
      (Array.isArray(choices) && choices.length === 2 && choices.every(isCraneTool))) &&
    Number.isInteger(state.toolAwardIndex) &&
    typeof state.magLockArmed === "boolean" &&
    typeof state.wideLoadArmed === "boolean" &&
    Number.isInteger(state.windbreakDrops) &&
    Number.isInteger(state.runSeed) &&
    Array.isArray(state.crates) &&
    state.crates.length === state.score &&
    state.crates.length <= 100_000 &&
    state.crates.every(isPlacedCrate) &&
    isFiniteNumber(state.trolleyX) &&
    (state.trolleyDirection === -1 || state.trolleyDirection === 1) &&
    isFiniteNumber(state.swingPhase) &&
    isFiniteNumber(state.towerAngle) &&
    isFiniteNumber(state.angularVelocity) &&
    isFiniteNumber(state.restLean) &&
    isFiniteNumber(state.cameraOffset)
  );
}

export function mountCraneGames(): void {
  mountAllGames("[data-crane-game]", "craneInitialized", mountCraneGame);
}

function mountCraneGame(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLCanvasElement>("[data-crane-canvas]");
  const heightOutput = root.querySelector<HTMLOutputElement>("[data-crane-height]");
  const highOutput = root.querySelector<HTMLOutputElement>("[data-crane-high]");
  const windOutput = root.querySelector<HTMLOutputElement>("[data-crane-wind]");
  const overlay = root.querySelector<HTMLElement>("[data-crane-overlay]");
  const stateLabel = root.querySelector<HTMLElement>("[data-crane-state]");
  const messageLabel = root.querySelector<HTMLElement>("[data-crane-message]");
  const statusLabel = root.querySelector<HTMLElement>("[data-crane-status]");
  const resumePicker = root.querySelector<HTMLElement>("[data-crane-resume-picker]");
  const resumeSummary = root.querySelector<HTMLElement>("[data-crane-resume-summary]");
  const resumeButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-crane-resume]"),
  );
  const choicePanel = root.querySelector<HTMLElement>("[data-crane-tool-choices]");
  const choiceButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-crane-tool-choice]"),
  );
  const pauseButton = root.querySelector<HTMLButtonElement>('[data-crane-action="pause"]');
  const restartButton = root.querySelector<HTMLButtonElement>('[data-crane-action="restart"]');
  const exitButton = root.querySelector<HTMLButtonElement>('[data-crane-action="exit"]');
  const confirmPanel = root.querySelector<HTMLElement>("[data-crane-confirm]");
  const confirmTitle = root.querySelector<HTMLElement>("[data-crane-confirm-title]");
  const confirmMessage = root.querySelector<HTMLElement>("[data-crane-confirm-message]");
  const confirmButton = root.querySelector<HTMLButtonElement>('[data-crane-confirm-action="confirm"]');
  const confirmActionButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-crane-confirm-action]"),
  );

  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;

  const renderer = createCraneRenderer(canvas, context);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let active = false;
  let started = false;
  let paused = false;
  let gameOver = false;
  let score = 0;
  let highScore = readStoredScore(HIGH_SCORE_KEY);
  let highScoreAtRunStart = highScore;
  let perfectStreak = 0;
  let pendingToolChoices: readonly [CraneTool, CraneTool] | null = null;
  let toolAwardIndex = 0;
  let magLockArmed = false;
  let wideLoadArmed = false;
  let windbreakDrops = 0;
  let windSuppressedForDrop = false;
  let stabilizerPulse = 0;
  let landingFeedback: LandingFeedback | null = null;
  let runSeed = randomSeed();
  let wind: WindState = windForHeight(runSeed, 0);
  let crates: PlacedCrate[] = [];
  let hanging: AirborneCrate | null = null;
  let falling: AirborneCrate | null = null;
  let loadAge = 0;
  let respawnDelay = 0;
  let trolleyX = 148;
  let trolleyDirection: -1 | 1 = 1;
  let swingPhase = 0;
  let cableAnchorX = trolleyX;
  let towerAngle = 0;
  let angularVelocity = 0;
  let restLean = 0;
  let cameraOffset = 0;
  let collapse: CollapseState | null = null;
  let previousTime = 0;
  let lastRenderTime = 0;
  let animationFrame: number | null = null;
  let lastNotice = "";
  let resumePrompt = false;
  let lastStableSession: CraneSessionState | null = null;
  let pendingConfirmation: ConfirmationAction | null = null;
  let resumeAfterConfirmation = false;

  const clearSession = (): void => {
    lastStableSession = null;
    removeStoredSession(SESSION_KEY);
  };

  const captureStableSession = (): CraneSessionState | null => {
    if (score <= 0 || gameOver || collapse) return null;
    return {
      score,
      highScoreAtRunStart,
      perfectStreak,
      pendingToolChoices: pendingToolChoices ? [...pendingToolChoices] as [CraneTool, CraneTool] : null,
      toolAwardIndex,
      magLockArmed,
      wideLoadArmed,
      windbreakDrops,
      runSeed,
      crates: crates.map((crate) => ({ ...crate })),
      trolleyX,
      trolleyDirection,
      swingPhase,
      towerAngle,
      angularVelocity,
      restLean,
      cameraOffset,
    };
  };

  const refreshSessionCheckpoint = (): void => {
    const checkpoint = captureStableSession();
    if (!checkpoint) return;
    lastStableSession = checkpoint;
    writeStoredSession(SESSION_KEY, SESSION_VERSION, checkpoint);
  };

  const persistSession = (): void => {
    if (lastStableSession) {
      writeStoredSession(SESSION_KEY, SESSION_VERSION, lastStableSession);
      return;
    }
    refreshSessionCheckpoint();
  };

  const setResumePicker = (visible: boolean): void => {
    resumePrompt = visible;
    if (resumePicker) resumePicker.hidden = !visible;
  };

  function randomSeed(): number {
    if (globalThis.crypto) {
      const values = new Uint32Array(1);
      globalThis.crypto.getRandomValues(values);
      return values[0] ?? Date.now();
    }
    return (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
  }

  const format = (value: number, width: number): string =>
    String(Math.max(0, Math.floor(value))).padStart(width, "0");

  const towerHeight = (): number => {
    const top = crates[crates.length - 1];
    return top ? top.bottom + top.height : 0;
  };

  const topSupport = (): { centerX: number; width: number; centerY: number } => {
    const top = crates[crates.length - 1];
    if (!top) return { centerX: 0, width: BASE_WIDTH, centerY: 0 };
    return {
      centerX: top.centerX,
      width: top.width,
      centerY: top.bottom + top.height / 2,
    };
  };

  const announce = (message: string): void => {
    lastNotice = message;
    if (statusLabel) statusLabel.textContent = message;
  };

  const effectiveWind = (): WindState => {
    if (!windSuppressedForDrop && windbreakDrops <= 0) return wind;
    return {
      ...CALM_WIND,
      label: windbreakDrops > 0 ? `CALM×${windbreakDrops}` : "CALM",
    };
  };

  const setPhase = (): void => {
    root.dataset.cranePhase = pendingConfirmation
      ? "confirming"
      : resumePrompt
        ? "ready"
        : gameOver
          ? "gameover"
          : pendingToolChoices
            ? "choosing"
            : paused
              ? "paused"
              : collapse
                ? "collapse"
                : started
                  ? "running"
                  : "ready";
  };

  const publishStatus = (): void => {
    if (!active) return;
    const progress = format(score, 3);

    if (pendingConfirmation) {
      dispatchGameStatus(GAME_EVENTS.crane.status, {
        game: "crane",
        phase: "confirming",
        progress,
        text: `HEIGHT ${progress} · CONFIRM ACTION`,
        pauseDisabled: true,
      });
      return;
    }
    if (resumePrompt) {
      dispatchGameStatus(GAME_EVENTS.crane.status, {
        game: "crane",
        phase: "saved",
        progress,
        text: `SAVED TOWER · HEIGHT ${progress} · CONTINUE OR NEW RUN`,
        pauseDisabled: true,
      });
      return;
    }
    if (gameOver) {
      dispatchGameStatus(GAME_EVENTS.crane.status, {
        game: "crane",
        phase: "gameover",
        progress,
        text: `HEIGHT ${progress} · STRUCTURAL FAILURE · RETRY OR EXIT`,
        pauseDisabled: true,
      });
      return;
    }
    if (collapse) {
      dispatchGameStatus(GAME_EVENTS.crane.status, {
        game: "crane",
        phase: "crashed",
        progress,
        text: `HEIGHT ${progress} · STRUCTURAL FAILURE`,
        pauseDisabled: true,
      });
      return;
    }
    if (pendingToolChoices) {
      dispatchGameStatus(GAME_EVENTS.crane.status, {
        game: "crane",
        phase: "choosing",
        progress,
        text: `HEIGHT ${progress} · BONUS READY · CHOOSE TOOL`,
        pauseDisabled: true,
      });
      return;
    }
    if (paused) {
      dispatchGameStatus(GAME_EVENTS.crane.status, {
        game: "crane",
        phase: "paused",
        progress,
        text: `HEIGHT ${progress} · GAME PAUSED`,
        pauseLabel: "RESUME",
      });
      return;
    }
    if (falling) {
      dispatchGameStatus(GAME_EVENTS.crane.status, {
        game: "crane",
        phase: "playing",
        progress,
        text: `HEIGHT ${progress} · CARGO FALLING`,
      });
      return;
    }
    if (hanging && started) {
      dispatchGameStatus(GAME_EVENTS.crane.status, {
        game: "crane",
        phase: "playing",
        progress,
        text: `HEIGHT ${progress} · LOAD READY · TIME THE DROP`,
      });
      return;
    }
    if (started) {
      dispatchGameStatus(GAME_EVENTS.crane.status, {
        game: "crane",
        phase: "transitioning",
        progress,
        text: `HEIGHT ${progress} · PREPARING NEXT LOAD`,
      });
      return;
    }

    dispatchGameStatus(GAME_EVENTS.crane.status, {
      game: "crane",
      phase: "ready",
      progress,
      text: "STACK TRACE · READY · TAP/CLICK/SPACE TO DROP",
      pauseDisabled: true,
    });
  };

  const updateToolChoiceOverlay = (): void => {
    if (!choicePanel) return;

    if (pendingToolChoices && !gameOver && !resumePrompt && !pendingConfirmation) {
      choicePanel.hidden = false;
      choiceButtons.forEach((button, index) => {
        const candidate = pendingToolChoices?.[index];
        button.hidden = !candidate;
        button.disabled = !candidate;
        if (candidate) button.textContent = TOOL_LABELS[candidate];
      });
      return;
    }

    choicePanel.hidden = true;
  };

  const updateControls = (): void => {
    setPhase();

    if (pauseButton) {
      const text = paused ? "RESUME" : "PAUSE";
      const label = paused ? "Resume game" : "Pause game";
      if (pauseButton.textContent !== text) pauseButton.textContent = text;
      if (pauseButton.getAttribute("aria-label") !== label) pauseButton.setAttribute("aria-label", label);
      pauseButton.hidden = !active || resumePrompt || !started || gameOver || Boolean(collapse) || Boolean(pendingToolChoices);
      pauseButton.disabled = Boolean(pendingConfirmation);
    }

    if (restartButton) {
      restartButton.hidden = !active || resumePrompt || (!started && !gameOver);
      restartButton.disabled = Boolean(pendingConfirmation);
    }

    if (exitButton) exitButton.disabled = Boolean(pendingConfirmation);
    updateToolChoiceOverlay();
    publishStatus();
  };

  const updateScoreboard = (): void => {
    if (heightOutput) heightOutput.textContent = format(score, 3);
    if (highOutput) highOutput.textContent = format(highScore, 3);
    if (windOutput) windOutput.textContent = effectiveWind().label;
    updateControls();
  };

  const setOverlay = (title: string, message: string, visible: boolean): void => {
    if (stateLabel) stateLabel.textContent = title;
    if (messageLabel) messageLabel.textContent = message;
    if (overlay) overlay.hidden = !visible;
  };

  const spawnCrate = (): void => {
    if (!active || !started || gameOver || collapse || pendingToolChoices) return;
    const baseSpec = nextCrateSpec(runSeed, score);
    const spec = wideLoadArmed ? wideLoadSpec(baseSpec) : baseSpec;
    hanging = {
      ...spec,
      x: trolleyX - CRANE_TOWER_X,
      y: CRANE_BASE_Y + cameraOffset - CRANE_HANGING_Y,
      vx: 0,
      vy: 0,
    };
    falling = null;
    loadAge = 0;
    updateScoreboard();
  };

  const persistHighScore = (): void => {
    if (score <= highScore) return;
    highScore = score;
    writeStoredScore(HIGH_SCORE_KEY, highScore);
  };

  const awardToolChoice = (): void => {
    pendingToolChoices = toolChoicesForAward(toolAwardIndex);
    toolAwardIndex += 1;
    perfectStreak = 0;
    announce("Bonus earned. Choose one.");
    stopAnimation();
    refreshSessionCheckpoint();
    updateScoreboard();
    renderer.draw(buildRenderState(performance.now()));
  };

  const applyToolImmediately = (selected: CraneTool): void => {
    if (selected === "stabilizer") {
      angularVelocity *= 0.12;
      towerAngle = restLean + (towerAngle - restLean) * 0.22;
      restLean *= 0.72;
      stabilizerPulse = 1;
      announce("STABILIZE APPLIED");
    } else if (selected === "mag-lock") {
      magLockArmed = true;
      announce("MAG-LOCK ARMED · NEXT LOAD WILL ALIGN PERFECTLY");
    } else if (selected === "wide-load") {
      wideLoadArmed = true;
      if (hanging) {
        const widened = wideLoadSpec(hanging);
        hanging = { ...hanging, ...widened };
        loadAge = 0;
      }
      announce("WIDE LOAD APPLIED TO NEXT CONTAINER");
    } else if (selected === "windbreak") {
      windbreakDrops = 2;
      windSuppressedForDrop = false;
      announce("WINDBREAK ACTIVE FOR TWO DROPS");
    }
  };

  const chooseTool = (index: number): void => {
    const selected = pendingToolChoices?.[index];
    if (!selected || gameOver) return;

    pendingToolChoices = null;
    applyToolImmediately(selected);

    // Rewards pause between loads. Resume with the next load already visible,
    // so the chosen effect is applied now rather than stored for later.
    if (!hanging && !falling) {
      respawnDelay = 0;
      spawnCrate();
    }

    refreshSessionCheckpoint();
    updateScoreboard();
    renderer.draw(buildRenderState(performance.now()));
    ensureAnimation();
  };

  const beginCollapse = (direction: number, reason: string): void => {
    if (collapse || gameOver) return;
    const resolvedDirection: -1 | 1 = direction < 0 ? -1 : 1;
    collapse = { elapsed: 0, direction: resolvedDirection };
    hanging = null;
    falling = null;
    pendingToolChoices = null;
    clearSession();
    setResumePicker(false);
    persistHighScore();
    setOverlay("STRUCTURAL FAILURE", reason, false);
    announce(reason);
    updateScoreboard();
  };

  const finishCollapse = (): void => {
    if (!collapse) return;
    gameOver = true;
    const newBest = score > highScoreAtRunStart;
    setOverlay(
      "STRUCTURAL FAILURE",
      `HEIGHT ${format(score, 3)}\nBEST ${format(highScore, 3)}${newBest ? " · NEW HIGH" : ""}\n\nTAP TO RETRY`,
      true,
    );
    updateScoreboard();
  };

  const placeFallingCrate = (): void => {
    if (!falling) return;
    const support = topSupport();
    const currentTop = towerHeight();
    const cosine = Math.cos(towerAngle);
    const sine = Math.sin(towerAngle);
    const supportVisualX = support.centerX * cosine + support.centerY * sine;
    const usedMagLock = magLockArmed;
    const usedWideLoad = wideLoadArmed;
    const landing = resolveLanding({
      crateCenterX: falling.x,
      crateWidth: falling.width,
      crateMass: falling.mass,
      lowerCenterX: supportVisualX,
      lowerWidth: support.width,
      lateralVelocity: falling.vx,
      towerHeight: currentTop,
      magLocked: usedMagLock,
    });

    if (landing.kind === "miss") {
      const currentWind = effectiveWind();
      const missDirection = falling.x - supportVisualX || falling.vx || currentWind.direction || 1;
      beginCollapse(missDirection, "LOAD MISSED SUPPORT");
      return;
    }

    const centerY = currentTop + falling.height / 2;
    const localCenterX =
      (landing.resolvedCenterX - centerY * sine) / Math.max(0.75, cosine);
    const placedCrate: PlacedCrate = {
      id: score + 1,
      kind: falling.kind,
      centerX: localCenterX,
      bottom: currentTop,
      width: falling.width,
      height: falling.height,
      mass: falling.mass,
      tonnage: falling.tonnage,
    };
    crates.push(placedCrate);
    score += 1;
    persistHighScore();

    angularVelocity += landing.impactImpulse * 0.42;
    if (usedMagLock) {
      perfectStreak += 1;
      angularVelocity *= 0.18;
      towerAngle = restLean + (towerAngle - restLean) * 0.28;
      landingFeedback = {
        kind: "mag-lock",
        label: "PERFECT LOCK",
        centerX: localCenterX,
        height: currentTop + falling.height,
        elapsed: 0,
      };
      announce("MAG-LOCKED · PERFECT ALIGNMENT");
    } else if (landing.perfect) {
      perfectStreak += 1;
      angularVelocity *= 0.34;
      towerAngle = restLean + (towerAngle - restLean) * 0.55;
      landingFeedback = {
        kind: "perfect",
        label: "PERFECT",
        centerX: localCenterX,
        height: currentTop + falling.height,
        elapsed: 0,
      };
      announce("PERFECT DROP · SWAY REDUCED");
    } else {
      perfectStreak = 0;
      const risky = Math.abs(landing.normalizedOffset) > 0.32;
      landingFeedback = {
        kind: risky ? "risky" : "stable",
        label: risky ? "RISKY" : usedWideLoad ? "WIDE LOAD" : "STABLE",
        centerX: localCenterX,
        height: currentTop + falling.height,
        elapsed: 0,
      };
      announce(
        usedWideLoad
          ? "WIDE LOAD SECURED"
          : risky
            ? "DANGEROUS OVERHANG"
            : "LOAD SECURED",
      );
    }

    restLean = calculateRestLean(crates);
    wind = windForHeight(runSeed, score);
    magLockArmed = false;
    wideLoadArmed = false;
    windSuppressedForDrop = false;
    falling = null;
    respawnDelay = reducedMotion.matches ? 0.12 : 0.46;

    if (shouldAwardTool(perfectStreak, score, pendingToolChoices !== null)) {
      awardToolChoice();
    }

    refreshSessionCheckpoint();
    updateScoreboard();
  };

  const dropCrate = (): void => {
    if (!active || resumePrompt || pendingToolChoices || pendingConfirmation) return;
    if (!started || gameOver) {
      startRun();
      return;
    }
    if (paused || collapse || !hanging) return;

    const currentWind = effectiveWind();
    const motion = crateMotionProfile(hanging.kind);
    const speed = trolleySpeedForHeight(score) * motion.trolleyFactor;
    const amplitude = cableSwingForHeight(score) * motion.swingFactor;
    const swingRate = 1.35 + currentWind.strength * 0.08;
    const swingVelocity = Math.cos(swingPhase) * amplitude * swingRate;
    const horizontalVelocity =
      trolleyDirection * speed * 0.095 +
      swingVelocity +
      currentWind.force * 0.2 * motion.windFactor;

    windSuppressedForDrop = windbreakDrops > 0;
    if (windSuppressedForDrop) windbreakDrops -= 1;

    falling = {
      ...hanging,
      vx: horizontalVelocity,
      vy: -20,
    };
    hanging = null;
    loadAge = 0;
    updateScoreboard();
  };

  const togglePause = (): void => {
    if (!active || !started || gameOver || collapse || pendingToolChoices || pendingConfirmation) return;
    paused = !paused;
    if (paused) persistSession();
    setOverlay(
      paused ? "PAUSED" : "RUNNING",
      paused ? "TAP PAUSE OR PRESS P TO RESUME" : "",
      paused,
    );
    announce(paused ? "Game paused." : lastNotice || "Game resumed.");
    updateScoreboard();
    if (paused) {
      stopAnimation();
      renderer.draw(buildRenderState(performance.now()));
    } else {
      ensureAnimation();
    }
  };

  const resetRun = (startImmediately = true): void => {
    stopAnimation();
    pendingConfirmation = null;
    resumeAfterConfirmation = false;
    if (confirmPanel) confirmPanel.hidden = true;
    clearSession();
    setResumePicker(false);
    score = 0;
    perfectStreak = 0;
    pendingToolChoices = null;
    toolAwardIndex = 0;
    magLockArmed = false;
    wideLoadArmed = false;
    windbreakDrops = 0;
    windSuppressedForDrop = false;
    stabilizerPulse = 0;
    landingFeedback = null;
    runSeed = randomSeed();
    highScoreAtRunStart = highScore;
    wind = windForHeight(runSeed, 0);
    crates = [];
    hanging = null;
    falling = null;
    loadAge = 0;
    respawnDelay = 0;
    trolleyX = 148;
    trolleyDirection = 1;
    swingPhase = 0;
    cableAnchorX = trolleyX;
    towerAngle = 0;
    angularVelocity = 0;
    restLean = 0;
    cameraOffset = 0;
    collapse = null;
    gameOver = false;
    paused = false;
    started = startImmediately;
    previousTime = performance.now();

    if (startImmediately) {
      spawnCrate();
      setOverlay("RUNNING", "", false);
      announce("Tap, click, or press Space to drop.");
    } else {
      setOverlay("STACK TRACE", "TAP TO START", true);
      announce("Crane ready.");
    }
    updateScoreboard();
    if (active) renderer.draw(buildRenderState(performance.now()));
    if (startImmediately) ensureAnimation();
  };

  const startRun = (): void => {
    if (!active) return;
    resetRun(true);
  };

  const exitGame = (): void => {
    if (!active) return;
    pendingConfirmation = null;
    if (confirmPanel) confirmPanel.hidden = true;
    persistHighScore();
    persistSession();
    active = false;
    started = false;
    paused = false;
    root.hidden = true;
    stopAnimation();
    dispatchGameExit(GAME_EVENTS.crane.exit, { score, highScore });
  };

  const buildRenderState = (time: number): CraneRenderState => ({
    crates,
    hanging,
    falling,
    towerAngle,
    restLean,
    cameraOffset,
    trolleyX,
    trolleyDirection,
    cableAnchorX,
    loadAge,
    wind: effectiveWind(),
    score,
    perfectStreak,
    magLockArmed,
    wideLoadArmed,
    windbreakDrops,
    stabilizerPulse,
    landingFeedback,
    collapse,
    time,
    reducedMotion: reducedMotion.matches,
  });

  const update = (delta: number): void => {
    if (!started || paused || gameOver || pendingToolChoices) return;

    stabilizerPulse = Math.max(0, stabilizerPulse - delta * 1.8);
    if (landingFeedback) {
      landingFeedback.elapsed += delta;
      if (landingFeedback.elapsed >= 1.25) landingFeedback = null;
    }
    const targetCameraOffset = Math.max(0, towerHeight() - CRANE_CAMERA_THRESHOLD);
    const cameraBlend = reducedMotion.matches ? 1 : Math.min(1, delta * 4.2);
    cameraOffset += (targetCameraOffset - cameraOffset) * cameraBlend;

    if (collapse) {
      collapse.elapsed += delta;
      towerAngle += collapse.direction * delta * (0.22 + collapse.elapsed * 0.5);
      if (collapse.elapsed >= (reducedMotion.matches ? 0.45 : 2.1)) finishCollapse();
      return;
    }

    const currentWind = effectiveWind();
    const currentHeight = towerHeight();
    const spring = score < 10 ? 2.7 : 2.15;
    const damping = score < 10 ? 1.02 : 0.76;
    const towerWind = score >= 15 ? (currentWind.force / 4300) * (1 + currentHeight / 520) : 0;
    angularVelocity +=
      ((restLean - towerAngle) * spring - angularVelocity * damping + towerWind) * delta;
    towerAngle += angularVelocity * delta;

    if (crates.length > 0 && Math.abs(towerAngle) > collapseAngleForHeight(currentHeight)) {
      beginCollapse(towerAngle, "TOWER LOST BALANCE");
      return;
    }

    if (hanging) {
      loadAge += delta;
      const motion = crateMotionProfile(hanging.kind);
      const speed = trolleySpeedForHeight(score) * motion.trolleyFactor;
      trolleyX += trolleyDirection * speed * delta;
      const halfWidth = hanging.width / 2;
      const minimumX = 58 + halfWidth;
      const maximumX = CRANE_WIDTH - 24 - halfWidth;
      if (trolleyX >= maximumX) {
        trolleyX = maximumX;
        trolleyDirection = -1;
      } else if (trolleyX <= minimumX) {
        trolleyX = minimumX;
        trolleyDirection = 1;
      }

      swingPhase += delta * (1.35 + currentWind.strength * 0.08);
      const amplitude = cableSwingForHeight(score) * motion.swingFactor;
      const pendulum = Math.sin(swingPhase) * amplitude;
      const windDrift = currentWind.force * 0.19 * motion.windFactor;
      cableAnchorX = trolleyX;
      hanging.x = trolleyX + pendulum + windDrift - CRANE_TOWER_X;
      hanging.y = CRANE_BASE_Y + cameraOffset - CRANE_HANGING_Y;
    }

    if (falling) {
      const landingY = currentHeight + falling.height / 2;
      if (magLockArmed) {
        const support = topSupport();
        const cosine = Math.cos(towerAngle);
        const sine = Math.sin(towerAngle);
        const supportVisualX = support.centerX * cosine + support.centerY * sine;
        const distanceToLanding = Math.max(0, falling.y - landingY);
        const magneticPull = distanceToLanding < 150 ? 24 : 11;
        falling.vx += (supportVisualX - falling.x) * magneticPull * delta;
        falling.vx *= Math.max(0, 1 - delta * 7.5);
      } else {
        const motion = crateMotionProfile(falling.kind);
        falling.vx += currentWind.force * 0.16 * motion.windFactor * delta;
      }
      falling.x += falling.vx * delta;
      falling.vy -= GRAVITY * delta;
      falling.y += falling.vy * delta;
      if (falling.y <= landingY) {
        falling.y = landingY;
        placeFallingCrate();
      }
    } else if (!hanging && respawnDelay > 0) {
      respawnDelay -= delta;
      if (respawnDelay <= 0) spawnCrate();
    }
  };

  const shouldAnimate = (): boolean =>
    active && started && !paused && !gameOver && !pendingToolChoices && !pendingConfirmation;

  const stopAnimation = (): void => {
    if (animationFrame === null) return;
    window.cancelAnimationFrame(animationFrame);
    animationFrame = null;
  };

  const ensureAnimation = (): void => {
    if (animationFrame !== null || !shouldAnimate()) return;
    previousTime = performance.now();
    lastRenderTime = previousTime - RENDER_INTERVAL_MS;
    animationFrame = window.requestAnimationFrame(renderLoop);
  };

  const renderLoop = (time: number): void => {
    animationFrame = null;
    if (!shouldAnimate()) return;

    const elapsed = previousTime > 0 ? (time - previousTime) / 1000 : 0;
    previousTime = time;
    update(Math.min(MAX_FRAME_STEP, Math.max(0, elapsed)));

    if (time - lastRenderTime >= RENDER_INTERVAL_MS || gameOver || pendingToolChoices) {
      renderer.draw(buildRenderState(time));
      lastRenderTime = time;
    }

    if (shouldAnimate()) animationFrame = window.requestAnimationFrame(renderLoop);
  };

  const restoreSession = (state: CraneSessionState): void => {
    stopAnimation();
    score = state.score;
    highScoreAtRunStart = state.highScoreAtRunStart;
    perfectStreak = state.perfectStreak;
    pendingToolChoices = state.pendingToolChoices ? [...state.pendingToolChoices] as [CraneTool, CraneTool] : null;
    toolAwardIndex = state.toolAwardIndex;
    magLockArmed = state.magLockArmed;
    wideLoadArmed = state.wideLoadArmed;
    windbreakDrops = state.windbreakDrops;
    windSuppressedForDrop = false;
    stabilizerPulse = 0;
    landingFeedback = null;
    runSeed = state.runSeed;
    wind = windForHeight(runSeed, score);
    crates = state.crates.map((crate) => ({ ...crate }));
    hanging = null;
    falling = null;
    loadAge = 0;
    respawnDelay = 0;
    trolleyX = state.trolleyX;
    trolleyDirection = state.trolleyDirection;
    swingPhase = state.swingPhase;
    cableAnchorX = trolleyX;
    towerAngle = state.towerAngle;
    angularVelocity = state.angularVelocity;
    restLean = state.restLean;
    cameraOffset = state.cameraOffset;
    collapse = null;
    gameOver = false;
    paused = true;
    started = false;
    previousTime = performance.now();
    lastStableSession = { ...state, crates: state.crates.map((crate) => ({ ...crate })) };
    if (resumeSummary) resumeSummary.textContent = `HEIGHT ${format(score, 3)}`;
    setResumePicker(true);
    setOverlay("SAVED TOWER", "CONTINUE OR START OVER", true);
    updateScoreboard();
    renderer.draw(buildRenderState(performance.now()));
    announce(`Saved tower found at height ${score}.`);
  };

  const continueSession = (): void => {
    if (!active || !resumePrompt) return;
    setResumePicker(false);
    started = true;
    paused = false;
    previousTime = performance.now();
    setOverlay("RUNNING", "", false);
    if (!pendingToolChoices && !hanging && !falling) spawnCrate();
    updateScoreboard();
    renderer.draw(buildRenderState(performance.now()));
    ensureAnimation();
    announce("Saved tower resumed.");
    canvas.focus({ preventScroll: true });
  };

  const discardSession = (): void => {
    clearSession();
    setResumePicker(false);
    resetRun(true);
  };

  const hideConfirmation = (): void => {
    pendingConfirmation = null;
    if (confirmPanel) confirmPanel.hidden = true;
    updateScoreboard();
  };

  const showConfirmation = (
    action: ConfirmationAction,
    title: string,
    message: string,
    confirmText: string,
  ): void => {
    if (pendingConfirmation) return;
    resumeAfterConfirmation = shouldAnimate();
    pendingConfirmation = action;
    if (confirmTitle) confirmTitle.textContent = title;
    if (confirmMessage) confirmMessage.textContent = message;
    if (confirmButton) confirmButton.textContent = confirmText;
    if (confirmPanel) confirmPanel.hidden = false;
    persistSession();
    stopAnimation();
    updateScoreboard();
    confirmActionButtons[0]?.focus({ preventScroll: true });
  };

  const cancelConfirmation = (): void => {
    if (!pendingConfirmation) return;
    const shouldResume = resumeAfterConfirmation;
    resumeAfterConfirmation = false;
    hideConfirmation();
    if (shouldResume) ensureAnimation();
    canvas.focus({ preventScroll: true });
  };

  const confirmDestructiveAction = (): void => {
    const action = pendingConfirmation;
    if (!action) return;
    resumeAfterConfirmation = false;
    hideConfirmation();
    if (action === "discard-save") setResumePicker(false);
    resetRun(true);
  };

  const requestRestart = (): void => {
    if (!active || pendingConfirmation) return;
    const hasRecoverableProgress = !gameOver && !collapse && score > 0;
    if (!hasRecoverableProgress) {
      resetRun(true);
      return;
    }
    showConfirmation(
      "restart",
      "RESTART RUN?",
      `YOUR CURRENT TOWER AT HEIGHT ${format(score, 3)} WILL BE DISCARDED.`,
      "RESTART",
    );
  };

  const requestNewRun = (): void => {
    if (!active || pendingConfirmation) return;
    if (!resumePrompt || score <= 0) {
      discardSession();
      return;
    }
    showConfirmation(
      "discard-save",
      "START NEW RUN?",
      `YOUR SAVED TOWER AT HEIGHT ${format(score, 3)} WILL BE DISCARDED.`,
      "NEW RUN",
    );
  };

  const startGame = (): void => {
    if (active) return;
    active = true;
    root.hidden = false;
    renderer.configure();
    const saved = readStoredSession(SESSION_KEY, SESSION_VERSION, isCraneSessionState);
    if (saved) restoreSession(saved.state);
    else resetRun(false);
    window.setTimeout(() => canvas.focus(), 0);
  };

  const onCanvasPointer = (event: PointerEvent): void => {
    event.preventDefault();
    dropCrate();
  };

  const onCommand = (event: Event): void => {
    const action = readGameCommand(event);
    if (!active || !action) return;
    if (action === "pause") togglePause();
    else if (action === "restart") requestRestart();
    else if (action === "exit") exitGame();
    else if (action === "drop" || action === "start") dropCrate();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!active) return;
    const key = event.key.toLowerCase();
    if (pendingConfirmation) {
      if (key === "escape") {
        event.preventDefault();
        cancelConfirmation();
      } else if (key === "enter") {
        event.preventDefault();
        confirmDestructiveAction();
      }
      return;
    }
    if (resumePrompt) {
      if (key === "c" || key === " " || key === "enter") {
        event.preventDefault();
        continueSession();
      } else if (key === "n" || key === "r") {
        event.preventDefault();
        requestNewRun();
      } else if (key === "escape") {
        event.preventDefault();
        exitGame();
      }
      return;
    }
    if (key === " " || key === "enter" || key === "arrowdown") {
      event.preventDefault();
      dropCrate();
    } else if (key === "p") {
      event.preventDefault();
      togglePause();
    } else if (key === "r") {
      event.preventDefault();
      requestRestart();
    } else if (key === "escape") {
      event.preventDefault();
      exitGame();
    }
  };

  canvas.addEventListener("pointerdown", onCanvasPointer);
  document.addEventListener("keydown", onKeyDown);
  resumeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.craneResume === "continue") continueSession();
      else requestNewRun();
    });
  });

  choiceButtons.forEach((button, index) => {
    button.addEventListener("click", () => chooseTool(index));
  });


  confirmActionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.craneConfirmAction === "confirm") confirmDestructiveAction();
      else cancelConfirmation();
    });
  });

  window.addEventListener("pagehide", persistSession);
  window.addEventListener("blur", () => {
    if (!active || !started || paused || gameOver || collapse || pendingToolChoices || pendingConfirmation) return;
    paused = true;
    persistSession();
    setOverlay("PAUSED", "TAP PAUSE OR PRESS P TO RESUME", true);
    updateScoreboard();
    stopAnimation();
    renderer.draw(buildRenderState(performance.now()));
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) persistSession();
  });
  window.addEventListener(GAME_EVENTS.crane.start, startGame);
  window.addEventListener(GAME_EVENTS.crane.command, onCommand);
  updateScoreboard();
}
