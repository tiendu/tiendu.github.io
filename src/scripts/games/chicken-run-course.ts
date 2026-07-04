import {
  courseGapMultiplierForCycle,
  type RunCycleState,
} from "./chicken-run-cycle";
import {
  OBSTACLE_DIMENSIONS,
  availablePatternsForScore,
  patternSpan,
  patternTravelDistance,
  type ObstacleKind,
  type RunPattern,
} from "./chicken-run-rules";
import {
  findSafeTerrainStart,
  terrainHeightAt,
  terrainSlopeAt,
} from "./chicken-run-terrain";
import {
  courseGapMultiplierForWeather,
  logPatternWeightMultiplier,
  mudPatternWeightMultiplier,
  type RunWeatherState,
} from "./chicken-run-weather";
import type {
  ChickenObstacle,
  CornKernel,
  EggPickup,
} from "./chicken-run-renderer";

export interface CornGroup {
  total: number;
  collected: number;
  bonusAwarded: boolean;
}

export interface SpawnedCoursePattern {
  obstacles: ChickenObstacle[];
  corn: CornKernel[];
  cornGroups: Map<number, CornGroup>;
  nextCornGroupId: number;
  travelDistance: number;
}

interface CornArcOptions {
  startWorldX: number;
  endWorldX: number;
  peakHeight: number;
  count: number;
  baselineY: number;
  distance: number;
  groupId: number;
}

function createCornArc(options: CornArcOptions): {
  kernels: CornKernel[];
  group: CornGroup;
} {
  const kernels: CornKernel[] = [];
  for (let index = 0; index < options.count; index += 1) {
    const t = (index + 1) / (options.count + 1);
    const worldX =
      options.startWorldX + (options.endWorldX - options.startWorldX) * t;
    const heightAboveGround = 28 + Math.sin(Math.PI * t) * options.peakHeight;
    kernels.push({
      worldX,
      x: worldX - options.distance,
      y: terrainHeightAt(worldX, options.baselineY) - heightAboveGround,
      heightAboveGround,
      groupId: options.groupId,
      collected: false,
      phase: Math.random() * Math.PI * 2,
    });
  }

  return {
    kernels,
    group: {
      total: options.count,
      collected: 0,
      bonusAwarded: false,
    },
  };
}

function cornSettings(kind: ObstacleKind): {
  padding: number;
  peak: number;
  count: number;
} {
  if (kind === "fence") return { padding: 48, peak: 104, count: 5 };
  if (kind === "mud") return { padding: 56, peak: 106, count: 7 };
  if (kind === "log") return { padding: 48, peak: 84, count: 5 };
  return { padding: 46, peak: 76, count: 5 };
}

function effectivePatternScore(
  score: number,
  cycle: RunCycleState,
): number {
  if (cycle.phase === "night" && cycle.cycleIndex === 0) {
    return Math.min(score, 519);
  }
  return score;
}

function conditionedPatternWeight(
  pattern: RunPattern,
  weather: RunWeatherState,
): number {
  let multiplier = 1;
  if (pattern.obstacles.some((obstacle) => obstacle.kind === "mud")) {
    multiplier *= mudPatternWeightMultiplier(weather);
  }
  if (pattern.obstacles.some((obstacle) => obstacle.kind === "log")) {
    multiplier *= logPatternWeightMultiplier(weather);
  }
  return pattern.weight * multiplier;
}

function selectPatternForConditions(
  score: number,
  weather: RunWeatherState,
  randomUnit: number,
): RunPattern {
  const patterns = availablePatternsForScore(score);
  const weights = patterns.map((pattern) =>
    conditionedPatternWeight(pattern, weather),
  );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = Math.min(1, Math.max(0, randomUnit)) * totalWeight;

  for (let index = 0; index < patterns.length; index += 1) {
    cursor -= weights[index] ?? 0;
    if (cursor <= 0) return patterns[index] ?? patterns[0];
  }

  return patterns[patterns.length - 1] ?? availablePatternsForScore(0)[0];
}

function terrainLimitsForPattern(pattern: RunPattern): {
  maxSlope: number;
  maxHeightChange: number;
} {
  if (pattern.obstacles.some((entry) => entry.kind === "mud")) {
    return { maxSlope: 0.028, maxHeightChange: 7 };
  }
  if (pattern.obstacles.length >= 2) {
    return { maxSlope: 0.04, maxHeightChange: 12 };
  }
  return { maxSlope: 0.052, maxHeightChange: 17 };
}

export function createEggPickup(options: {
  distance: number;
  boardWidth: number;
  baselineY: number;
  cycleIndex: number;
}): EggPickup {
  const requestedWorldX = options.distance + options.boardWidth + 44;
  const worldX = findSafeTerrainStart({
    requestedWorldX,
    span: 36,
    baselineY: options.baselineY,
    maxSlope: 0.032,
    maxHeightChange: 5,
    searchDistance: 520,
  });
  const heightAboveGround = 83;
  return {
    worldX,
    x: worldX - options.distance,
    y: terrainHeightAt(worldX, options.baselineY) - heightAboveGround,
    heightAboveGround,
    phase: options.cycleIndex * 1.37,
  };
}

export function eggPickupTravelDistance(speed: number): number {
  return Math.max(470, speed * 1.75);
}

export function spawnCoursePattern(options: {
  score: number;
  speed: number;
  distance: number;
  boardWidth: number;
  baselineY: number;
  nextCornGroupId: number;
  cycle: RunCycleState;
  weather: RunWeatherState;
}): SpawnedCoursePattern {
  const pattern = selectPatternForConditions(
    effectivePatternScore(options.score, options.cycle),
    options.weather,
    Math.random(),
  );
  const requestedWorldX = options.distance + options.boardWidth + 28;
  const span = patternSpan(pattern);
  const terrainLimits = terrainLimitsForPattern(pattern);
  const baseWorldX = findSafeTerrainStart({
    requestedWorldX,
    span,
    baselineY: options.baselineY,
    ...terrainLimits,
  });
  const placementShift = baseWorldX - requestedWorldX;

  const obstacles = pattern.obstacles.map((entry) => {
    const dimensions = OBSTACLE_DIMENSIONS[entry.kind];
    const worldX = baseWorldX + entry.offset;
    const groundY = terrainHeightAt(worldX + dimensions.width * 0.5, options.baselineY);
    return {
      kind: entry.kind,
      worldX,
      x: worldX - options.distance,
      y: groundY - dimensions.height,
      width: dimensions.width,
      height: dimensions.height,
      slope: terrainSlopeAt(worldX + dimensions.width * 0.5, options.baselineY),
      passed: false,
    } satisfies ChickenObstacle;
  });

  const corn: CornKernel[] = [];
  const cornGroups = new Map<number, CornGroup>();
  let groupId = options.nextCornGroupId;

  const addArc = (
    startWorldX: number,
    endWorldX: number,
    peakHeight: number,
    count: number,
  ): void => {
    const arc = createCornArc({
      startWorldX,
      endWorldX,
      peakHeight,
      count,
      baselineY: options.baselineY,
      distance: options.distance,
      groupId,
    });
    corn.push(...arc.kernels);
    cornGroups.set(groupId, arc.group);
    groupId += 1;
  };

  if (pattern.cornLayout === "combined") {
    const isTrio = pattern.obstacles.length >= 3;
    addArc(
      baseWorldX - 48,
      baseWorldX + span + 48,
      isTrio ? 126 : 116,
      isTrio ? 10 : 8,
    );
  } else {
    obstacles.forEach((obstacle) => {
      const settings = cornSettings(obstacle.kind);
      addArc(
        obstacle.worldX - settings.padding,
        obstacle.worldX + obstacle.width + settings.padding,
        settings.peak,
        settings.count,
      );
    });
  }

  return {
    obstacles,
    corn,
    cornGroups,
    nextCornGroupId: groupId,
    travelDistance:
      placementShift +
      patternTravelDistance(options.speed, pattern, Math.random()) *
        courseGapMultiplierForCycle(options.cycle) *
        courseGapMultiplierForWeather(options.weather),
  };
}
