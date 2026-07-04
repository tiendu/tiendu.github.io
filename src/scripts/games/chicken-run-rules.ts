export const COYOTE_TIME_MS = 105;
export const START_SPEED = 220;
export const MAX_SPEED = 430;

export type JumpAction = "jump" | "flap" | null;
export type ObstacleKind = "fence" | "hay" | "mud" | "log";
export type CrashKind = ObstacleKind | "fox";
export type CornLayout = "per-obstacle" | "combined";

export interface JumpState {
  grounded: boolean;
  millisecondsSinceGrounded: number;
  flapAvailable: boolean;
}

export interface JumpControlState {
  gameOver: boolean;
  crashing: boolean;
  paused: boolean;
  started: boolean;
  grounded: boolean;
  flapAvailable: boolean;
}

export interface JumpControl {
  label: string;
  disabled: boolean;
  ariaLabel: string;
}

export interface ObstacleDimensions {
  width: number;
  height: number;
}

export interface PatternObstacle {
  kind: ObstacleKind;
  offset: number;
}

export interface RunPattern {
  id: string;
  minimumScore: number;
  weight: number;
  obstacles: readonly PatternObstacle[];
  recoveryGap: number;
  cornLayout: CornLayout;
}

export const OBSTACLE_DIMENSIONS: Readonly<
  Record<ObstacleKind, ObstacleDimensions>
> = {
  fence: { width: 34, height: 62 },
  hay: { width: 62, height: 38 },
  mud: { width: 132, height: 10 },
  log: { width: 76, height: 24 },
};

export const RUN_PATTERNS: readonly RunPattern[] = [
  {
    id: "single-hay",
    minimumScore: 0,
    weight: 3.2,
    obstacles: [{ kind: "hay", offset: 0 }],
    recoveryGap: 286,
    cornLayout: "per-obstacle",
  },
  {
    id: "single-fence",
    minimumScore: 0,
    weight: 2.8,
    obstacles: [{ kind: "fence", offset: 0 }],
    recoveryGap: 300,
    cornLayout: "per-obstacle",
  },
  {
    id: "single-log",
    minimumScore: 180,
    weight: 1.45,
    obstacles: [{ kind: "log", offset: 0 }],
    recoveryGap: 305,
    cornLayout: "per-obstacle",
  },
  {
    id: "single-mud",
    minimumScore: 120,
    weight: 2.2,
    obstacles: [{ kind: "mud", offset: 0 }],
    recoveryGap: 330,
    cornLayout: "per-obstacle",
  },
  {
    id: "hay-pair",
    minimumScore: 260,
    weight: 1.8,
    obstacles: [
      { kind: "hay", offset: 0 },
      { kind: "hay", offset: 122 },
    ],
    recoveryGap: 330,
    cornLayout: "combined",
  },
  {
    id: "hay-then-fence",
    minimumScore: 380,
    weight: 1.45,
    obstacles: [
      { kind: "hay", offset: 0 },
      { kind: "fence", offset: 360 },
    ],
    recoveryGap: 300,
    cornLayout: "per-obstacle",
  },
  {
    id: "fence-then-mud",
    minimumScore: 520,
    weight: 1.25,
    obstacles: [
      { kind: "fence", offset: 0 },
      { kind: "mud", offset: 410 },
    ],
    recoveryGap: 330,
    cornLayout: "per-obstacle",
  },
  {
    id: "log-then-mud",
    minimumScore: 610,
    weight: 0.95,
    obstacles: [
      { kind: "log", offset: 0 },
      { kind: "mud", offset: 390 },
    ],
    recoveryGap: 340,
    cornLayout: "per-obstacle",
  },
  {
    id: "mud-then-hay",
    minimumScore: 680,
    weight: 1.05,
    obstacles: [
      { kind: "mud", offset: 0 },
      { kind: "hay", offset: 440 },
    ],
    recoveryGap: 320,
    cornLayout: "per-obstacle",
  },
  {
    id: "hay-trio",
    minimumScore: 860,
    weight: 0.85,
    obstacles: [
      { kind: "hay", offset: 0 },
      { kind: "hay", offset: 105 },
      { kind: "hay", offset: 210 },
    ],
    recoveryGap: 360,
    cornLayout: "combined",
  },
] as const;


export function jumpControlForState(state: JumpControlState): JumpControl {
  if (state.gameOver) {
    return { label: "RETRY", disabled: false, ariaLabel: "Restart Free Range" };
  }
  if (state.crashing) {
    return { label: "—", disabled: true, ariaLabel: "Collision in progress" };
  }
  if (state.paused) {
    return { label: "RESUME", disabled: false, ariaLabel: "Resume Free Range" };
  }
  if (!state.started || state.grounded) {
    return { label: "JUMP", disabled: false, ariaLabel: "Jump" };
  }
  if (state.flapAvailable) {
    return { label: "FLAP", disabled: false, ariaLabel: "Flap once in the air" };
  }
  return { label: "—", disabled: true, ariaLabel: "Wait to land" };
}

export function chooseJumpAction(state: JumpState): JumpAction {
  if (state.grounded || state.millisecondsSinceGrounded <= COYOTE_TIME_MS) {
    return "jump";
  }

  return state.flapAvailable ? "flap" : null;
}

export function speedForScore(score: number): number {
  const safeScore = Math.max(0, Math.floor(score));
  return Math.min(MAX_SPEED, START_SPEED + Math.floor(safeScore / 180) * 18);
}

export function speedLevelForScore(score: number): number {
  return speedLevelForVelocity(speedForScore(score));
}

export function speedLevelForVelocity(speed: number): number {
  const safeSpeed = Math.max(START_SPEED, speed);
  return 1 + Math.floor((safeSpeed - START_SPEED) / 18);
}

export function minimumObstacleGap(speed: number): number {
  return Math.max(250, Math.max(0, speed) * 0.92);
}

export function obstacleSpacing(speed: number, randomUnit: number): number {
  const normalizedRandom = Math.min(1, Math.max(0, randomUnit));
  return minimumObstacleGap(speed) + 60 + normalizedRandom * 180;
}

export function availablePatternsForScore(score: number): readonly RunPattern[] {
  const safeScore = Math.max(0, Math.floor(score));
  return RUN_PATTERNS.filter((pattern) => pattern.minimumScore <= safeScore);
}

export function selectPatternForScore(
  score: number,
  randomUnit: number,
): RunPattern {
  const patterns = availablePatternsForScore(score);
  const totalWeight = patterns.reduce((sum, pattern) => sum + pattern.weight, 0);
  const normalizedRandom = Math.min(1, Math.max(0, randomUnit));
  let cursor = normalizedRandom * totalWeight;

  for (const pattern of patterns) {
    cursor -= pattern.weight;
    if (cursor <= 0) return pattern;
  }

  return patterns[patterns.length - 1] ?? RUN_PATTERNS[0];
}

export function patternSpan(pattern: RunPattern): number {
  return pattern.obstacles.reduce((span, obstacle) => {
    const dimensions = OBSTACLE_DIMENSIONS[obstacle.kind];
    return Math.max(span, obstacle.offset + dimensions.width);
  }, 0);
}

export function patternTravelDistance(
  speed: number,
  pattern: RunPattern,
  randomUnit: number,
): number {
  const normalizedRandom = Math.min(1, Math.max(0, randomUnit));
  const speedPadding = Math.max(0, speed - START_SPEED) * 0.22;
  return (
    patternSpan(pattern) +
    pattern.recoveryGap +
    speedPadding +
    normalizedRandom * 110
  );
}
