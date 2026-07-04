import {
  courseGapMultiplierForCycle,
  type RunCycleState,
} from "./chicken-run-cycle";
import {
  OBSTACLE_DIMENSIONS,
  patternSpan,
  patternTravelDistance,
  selectPatternForScore,
  type ObstacleKind,
} from "./chicken-run-rules";
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
  startX: number;
  endX: number;
  peakHeight: number;
  count: number;
  groundY: number;
  groupId: number;
}

function createCornArc(options: CornArcOptions): {
  kernels: CornKernel[];
  group: CornGroup;
} {
  const kernels: CornKernel[] = [];
  for (let index = 0; index < options.count; index += 1) {
    const t = (index + 1) / (options.count + 1);
    kernels.push({
      x: options.startX + (options.endX - options.startX) * t,
      y:
        options.groundY -
        28 -
        Math.sin(Math.PI * t) * options.peakHeight,
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

export function createEggPickup(options: {
  boardWidth: number;
  groundY: number;
  cycleIndex: number;
}): EggPickup {
  return {
    x: options.boardWidth + 44,
    y: options.groundY - 83,
    phase: options.cycleIndex * 1.37,
  };
}

export function eggPickupTravelDistance(speed: number): number {
  return Math.max(470, speed * 1.75);
}

export function spawnCoursePattern(options: {
  score: number;
  speed: number;
  boardWidth: number;
  groundY: number;
  nextCornGroupId: number;
  cycle: RunCycleState;
}): SpawnedCoursePattern {
  const pattern = selectPatternForScore(
    effectivePatternScore(options.score, options.cycle),
    Math.random(),
  );
  const baseX = options.boardWidth + 28;
  const obstacles = pattern.obstacles.map((entry) => {
    const dimensions = OBSTACLE_DIMENSIONS[entry.kind];
    return {
      kind: entry.kind,
      x: baseX + entry.offset,
      y: options.groundY - dimensions.height,
      width: dimensions.width,
      height: dimensions.height,
      passed: false,
    } satisfies ChickenObstacle;
  });

  const corn: CornKernel[] = [];
  const cornGroups = new Map<number, CornGroup>();
  let groupId = options.nextCornGroupId;

  const addArc = (
    startX: number,
    endX: number,
    peakHeight: number,
    count: number,
  ): void => {
    const arc = createCornArc({
      startX,
      endX,
      peakHeight,
      count,
      groundY: options.groundY,
      groupId,
    });
    corn.push(...arc.kernels);
    cornGroups.set(groupId, arc.group);
    groupId += 1;
  };

  if (pattern.cornLayout === "combined") {
    const span = patternSpan(pattern);
    const isTrio = pattern.obstacles.length >= 3;
    addArc(
      baseX - 48,
      baseX + span + 48,
      isTrio ? 126 : 116,
      isTrio ? 10 : 8,
    );
  } else {
    obstacles.forEach((obstacle) => {
      const settings = cornSettings(obstacle.kind);
      addArc(
        obstacle.x - settings.padding,
        obstacle.x + obstacle.width + settings.padding,
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
      patternTravelDistance(options.speed, pattern, Math.random()) *
      courseGapMultiplierForCycle(options.cycle),
  };
}
