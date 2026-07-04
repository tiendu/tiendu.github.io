export type RunPhase = "day" | "sunset" | "night" | "dawn";

export interface RunCycleState {
  phase: RunPhase;
  phaseProgress: number;
  cycleIndex: number;
  cycleElapsed: number;
  nightFactor: number;
  speedMultiplier: number;
}

const FIRST_DAY_SECONDS = 22;
const LATER_DAY_SECONDS = 18;
const SUNSET_SECONDS = 5;
const BASE_NIGHT_SECONDS = 17;
const MAX_NIGHT_BONUS_SECONDS = 5;
const DAWN_SECONDS = 5;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

export function dayDurationForCycle(cycleIndex: number): number {
  return cycleIndex <= 0 ? FIRST_DAY_SECONDS : LATER_DAY_SECONDS;
}

export function nightDurationForCycle(cycleIndex: number): number {
  return (
    BASE_NIGHT_SECONDS +
    Math.min(MAX_NIGHT_BONUS_SECONDS, Math.max(0, cycleIndex) * 1.25)
  );
}

export function cycleDurationForIndex(cycleIndex: number): number {
  return (
    dayDurationForCycle(cycleIndex) +
    SUNSET_SECONDS +
    nightDurationForCycle(cycleIndex) +
    DAWN_SECONDS
  );
}

function nightSpeedMultiplier(
  cycleIndex: number,
  phaseProgress: number,
): number {
  const cycleBoost = Math.min(0.09, Math.max(0, cycleIndex) * 0.015);
  const chaseRamp = clamp01(phaseProgress) * 0.07;
  const surge = Math.max(
    0,
    Math.sin(clamp01(phaseProgress) * Math.PI * 5),
  ) * 0.035;
  return 1.18 + cycleBoost + chaseRamp + surge;
}

export function cycleStateForElapsed(elapsedSeconds: number): RunCycleState {
  let remaining = Math.max(0, elapsedSeconds);
  let cycleIndex = 0;
  let duration = cycleDurationForIndex(cycleIndex);

  while (remaining >= duration) {
    remaining -= duration;
    cycleIndex += 1;
    duration = cycleDurationForIndex(cycleIndex);
  }

  const dayDuration = dayDurationForCycle(cycleIndex);
  const nightDuration = nightDurationForCycle(cycleIndex);

  if (remaining < dayDuration) {
    return {
      phase: "day",
      phaseProgress: clamp01(remaining / dayDuration),
      cycleIndex,
      cycleElapsed: remaining,
      nightFactor: 0,
      speedMultiplier: 1,
    };
  }

  remaining -= dayDuration;
  if (remaining < SUNSET_SECONDS) {
    const progress = clamp01(remaining / SUNSET_SECONDS);
    const transition = smoothstep(progress);
    return {
      phase: "sunset",
      phaseProgress: progress,
      cycleIndex,
      cycleElapsed: dayDuration + remaining,
      nightFactor: transition,
      speedMultiplier: lerp(1, 1.15, transition),
    };
  }

  remaining -= SUNSET_SECONDS;
  if (remaining < nightDuration) {
    const progress = clamp01(remaining / nightDuration);
    return {
      phase: "night",
      phaseProgress: progress,
      cycleIndex,
      cycleElapsed: dayDuration + SUNSET_SECONDS + remaining,
      nightFactor: 1,
      speedMultiplier: nightSpeedMultiplier(cycleIndex, progress),
    };
  }

  remaining -= nightDuration;
  const progress = clamp01(remaining / DAWN_SECONDS);
  const transition = smoothstep(progress);
  const nightEndSpeed = nightSpeedMultiplier(cycleIndex, 1);
  return {
    phase: "dawn",
    phaseProgress: progress,
    cycleIndex,
    cycleElapsed:
      dayDuration + SUNSET_SECONDS + nightDuration + remaining,
    nightFactor: 1 - transition,
    speedMultiplier: lerp(nightEndSpeed, 1.04, transition),
  };
}

export function courseGapMultiplierForCycle(state: RunCycleState): number {
  if (state.phase === "night") {
    return Math.max(1.1, 1.16 - state.cycleIndex * 0.012);
  }
  if (state.phase === "sunset") return 1.07;
  return 1;
}

export function foxStartingPressure(cycleIndex: number): number {
  return Math.min(0.46, 0.24 + Math.max(0, cycleIndex) * 0.055);
}

export function foxApproachPerSecond(cycleIndex: number): number {
  return 0.027 + Math.min(0.014, Math.max(0, cycleIndex) * 0.0025);
}

export function foxXForPressure(pressure: number): number {
  return -58 + clamp01(pressure) * 110;
}

export function shouldOfferEgg(options: {
  state: RunCycleState;
  hasEgg: boolean;
  activeEgg: boolean;
  offeredCycle: number;
}): boolean {
  if (options.hasEgg || options.activeEgg) return false;
  if (options.offeredCycle === options.state.cycleIndex) return false;

  return (
    (options.state.phase === "day" && options.state.phaseProgress >= 0.62) ||
    options.state.phase === "sunset"
  );
}
