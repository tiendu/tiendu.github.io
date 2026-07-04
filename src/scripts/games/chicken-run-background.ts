export type BackgroundSceneKind =
  | "open-field"
  | "farmstead"
  | "wooded-ridge"
  | "high-plateau"
  | "wet-valley";

export type BackgroundLandmarkKind =
  | "barn-cluster"
  | "farmhouse"
  | "windmill"
  | "water-tower"
  | "scarecrow"
  | "wooden-bridge"
  | "tree-grove";

export type BackgroundLayer = "far" | "middle";

export interface BackgroundTerrainContext {
  kind: "flat" | "uphill" | "plateau" | "downhill" | "valley";
  offset: number;
  slope: number;
}

export interface BackgroundLandmark {
  kind: BackgroundLandmarkKind;
  layer: BackgroundLayer;
  worldX: number;
  scale: number;
}

export interface BackgroundChunk {
  index: number;
  startX: number;
  endX: number;
  kind: BackgroundSceneKind;
  transitionLength: number;
  landmark: BackgroundLandmark | null;
}

export interface BackgroundSceneState {
  kind: BackgroundSceneKind;
  previousKind: BackgroundSceneKind;
  blend: number;
  chunk: BackgroundChunk;
}

export interface BackgroundWorld {
  sceneAt(worldX: number): BackgroundSceneState;
  chunksInRange(startWorldX: number, endWorldX: number): readonly BackgroundChunk[];
  farProfileAt(worldX: number): number;
  middleProfileAt(worldX: number): number;
}

interface TerrainSummary {
  dominantKind: BackgroundTerrainContext["kind"];
  averageOffset: number;
  averageSlope: number;
  maximumSlope: number;
}

interface SceneProfile {
  farAmplitude: number;
  farBias: number;
  middleAmplitude: number;
  middleBias: number;
}

const MIN_CHUNK_LENGTH = 1_850;
const MAX_CHUNK_LENGTH = 3_250;
const INITIAL_CHUNK_LENGTH = 2_400;
const MIN_TRANSITION_LENGTH = 440;
const MAX_TRANSITION_LENGTH = 680;

const SCENE_PROFILES: Readonly<Record<BackgroundSceneKind, SceneProfile>> = {
  "open-field": {
    farAmplitude: 8,
    farBias: 8,
    middleAmplitude: 5,
    middleBias: 8,
  },
  farmstead: {
    farAmplitude: 11,
    farBias: 3,
    middleAmplitude: 7,
    middleBias: 4,
  },
  "wooded-ridge": {
    farAmplitude: 23,
    farBias: -14,
    middleAmplitude: 16,
    middleBias: -6,
  },
  "high-plateau": {
    farAmplitude: 15,
    farBias: -11,
    middleAmplitude: 9,
    middleBias: -7,
  },
  "wet-valley": {
    farAmplitude: 13,
    farBias: 12,
    middleAmplitude: 7,
    middleBias: 11,
  },
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function hashUnit(index: number, salt: number): number {
  const value = Math.sin((index + 1) * 17.731 + salt * 83.113) * 43758.5453;
  return value - Math.floor(value);
}

function rangedValue(
  index: number,
  salt: number,
  minimum: number,
  maximum: number,
): number {
  return minimum + hashUnit(index, salt) * (maximum - minimum);
}

function valueNoise(worldX: number, cellSize: number, salt: number): number {
  const cell = Math.floor(Math.max(0, worldX) / cellSize);
  const progress = (Math.max(0, worldX) - cell * cellSize) / cellSize;
  const from = hashUnit(cell, salt) * 2 - 1;
  const to = hashUnit(cell + 1, salt) * 2 - 1;
  return from + (to - from) * smoothstep(progress);
}

function summarizeTerrain(
  startX: number,
  endX: number,
  terrainAt: (worldX: number) => BackgroundTerrainContext,
): TerrainSummary {
  const samples = Array.from({ length: 7 }, (_, index) =>
    terrainAt(startX + ((endX - startX) * index) / 6),
  );
  const kindCounts = new Map<BackgroundTerrainContext["kind"], number>();
  samples.forEach((sample) => {
    kindCounts.set(sample.kind, (kindCounts.get(sample.kind) ?? 0) + 1);
  });
  const dominantKind = [...kindCounts.entries()].sort(
    (left, right) => right[1] - left[1],
  )[0]?.[0] ?? "flat";

  return {
    dominantKind,
    averageOffset:
      samples.reduce((sum, sample) => sum + sample.offset, 0) / samples.length,
    averageSlope:
      samples.reduce((sum, sample) => sum + sample.slope, 0) / samples.length,
    maximumSlope: Math.max(...samples.map((sample) => Math.abs(sample.slope))),
  };
}

function candidateScenes(summary: TerrainSummary): BackgroundSceneKind[] {
  const candidates: BackgroundSceneKind[] = ["open-field"];
  const stable = summary.maximumSlope < 0.026;

  if (
    stable ||
    summary.dominantKind === "flat" ||
    summary.dominantKind === "plateau"
  ) {
    candidates.push("farmstead");
  }

  if (
    summary.dominantKind === "uphill" ||
    summary.dominantKind === "downhill" ||
    summary.averageOffset < -4
  ) {
    candidates.push("wooded-ridge");
  }

  if (
    summary.dominantKind === "plateau" ||
    (stable && summary.averageOffset < -5)
  ) {
    candidates.push("high-plateau");
  }

  if (
    summary.dominantKind === "valley" ||
    summary.averageOffset > 5
  ) {
    candidates.push("wet-valley");
  }

  return [...new Set(candidates)];
}

function chooseScene(
  index: number,
  summary: TerrainSummary,
  recentKinds: readonly BackgroundSceneKind[],
): BackgroundSceneKind {
  const previous = recentKinds.at(-1);
  const beforePrevious = recentKinds.at(-2);
  let candidates = candidateScenes(summary).filter((kind) => kind !== previous);

  if (previous === "farmstead") {
    candidates = candidates.filter((kind) => kind !== "farmstead");
  }
  if (previous === beforePrevious && previous) {
    candidates = candidates.filter((kind) => kind !== previous);
  }
  if (candidates.length === 0) candidates = ["open-field"];

  const preferred: BackgroundSceneKind | null =
    summary.averageOffset > 8
      ? "wet-valley"
      : summary.averageOffset < -9 && summary.maximumSlope < 0.022
        ? "high-plateau"
        : Math.abs(summary.averageSlope) > 0.012
          ? "wooded-ridge"
          : null;

  if (preferred && candidates.includes(preferred) && hashUnit(index, 41) < 0.72) {
    return preferred;
  }

  return candidates[Math.floor(hashUnit(index, 43) * candidates.length)] ?? "open-field";
}

function chooseLandmarkKind(
  index: number,
  scene: BackgroundSceneKind,
  recentLandmarks: readonly BackgroundLandmarkKind[],
): BackgroundLandmarkKind | null {
  const options: Array<BackgroundLandmarkKind | null> =
    scene === "open-field"
      ? ["scarecrow", "water-tower", null, null]
      : scene === "farmstead"
        ? ["barn-cluster", "farmhouse", "water-tower"]
        : scene === "wooded-ridge"
          ? ["tree-grove", "windmill", null]
          : scene === "high-plateau"
            ? ["windmill", "water-tower", "scarecrow"]
            : ["wooden-bridge", "tree-grove", null];
  const recent = new Set(recentLandmarks.slice(-2));
  const fresh = options.filter((kind) => kind === null || !recent.has(kind));
  const candidates = fresh.length > 0 ? fresh : options;
  const sceneSalt =
    scene === "open-field"
      ? 101
      : scene === "farmstead"
        ? 107
        : scene === "wooded-ridge"
          ? 109
          : scene === "high-plateau"
            ? 113
            : 127;
  return candidates[Math.floor(hashUnit(index, sceneSalt) * candidates.length)] ?? null;
}

function landmarkLayer(kind: BackgroundLandmarkKind): BackgroundLayer {
  if (kind === "water-tower" || kind === "windmill") return "far";
  return "middle";
}

function landscapeProfile(
  worldX: number,
  scene: BackgroundSceneState,
  layer: BackgroundLayer,
): number {
  const current = SCENE_PROFILES[scene.kind];
  const previous = SCENE_PROFILES[scene.previousKind];
  const amplitude =
    (layer === "far" ? previous.farAmplitude : previous.middleAmplitude) +
    ((layer === "far" ? current.farAmplitude : current.middleAmplitude) -
      (layer === "far" ? previous.farAmplitude : previous.middleAmplitude)) *
      scene.blend;
  const bias =
    (layer === "far" ? previous.farBias : previous.middleBias) +
    ((layer === "far" ? current.farBias : current.middleBias) -
      (layer === "far" ? previous.farBias : previous.middleBias)) *
      scene.blend;
  const cellSize = layer === "far" ? 4_600 : 2_350;
  const primary = valueNoise(worldX, cellSize, layer === "far" ? 61 : 67);
  const secondary = valueNoise(
    worldX,
    cellSize * 0.47,
    layer === "far" ? 71 : 73,
  );
  return bias + primary * amplitude + secondary * amplitude * 0.22;
}

export function createBackgroundWorld(
  terrainAt: (worldX: number) => BackgroundTerrainContext,
): BackgroundWorld {
  const chunks: BackgroundChunk[] = [];
  let generatedThrough = 0;

  function appendChunk(index: number): void {
    const length =
      index === 0
        ? INITIAL_CHUNK_LENGTH
        : Math.round(
            rangedValue(index, 3, MIN_CHUNK_LENGTH, MAX_CHUNK_LENGTH),
          );
    const startX = generatedThrough;
    const endX = startX + length;
    const summary = summarizeTerrain(startX, endX, terrainAt);
    const recentKinds = chunks.slice(-2).map((chunk) => chunk.kind);
    const kind = index === 0 ? "open-field" : chooseScene(index, summary, recentKinds);
    const recentLandmarks = chunks
      .map((chunk) => chunk.landmark?.kind)
      .filter((landmarkKind): landmarkKind is BackgroundLandmarkKind => Boolean(landmarkKind))
      .slice(-3);
    const landmarkKind = chooseLandmarkKind(index, kind, recentLandmarks);
    const landmark = landmarkKind
      ? {
          kind: landmarkKind,
          layer: landmarkLayer(landmarkKind),
          worldX: startX + length * rangedValue(index, 79, 0.34, 0.72),
          scale: rangedValue(index, 83, 0.88, 1.14),
        }
      : null;

    chunks.push({
      index,
      startX,
      endX,
      kind,
      transitionLength: Math.round(
        rangedValue(
          index,
          89,
          MIN_TRANSITION_LENGTH,
          MAX_TRANSITION_LENGTH,
        ),
      ),
      landmark,
    });
    generatedThrough = endX;
  }

  function ensureThrough(worldX: number): void {
    const target = Math.max(0, worldX);
    while (generatedThrough < target || chunks.length === 0) {
      appendChunk(chunks.length);
    }
  }

  function chunkAt(worldX: number): BackgroundChunk {
    const safeX = Math.max(0, worldX);
    ensureThrough(safeX);
    let low = 0;
    let high = chunks.length - 1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const chunk = chunks[middle];
      if (!chunk) break;
      if (safeX < chunk.startX) high = middle - 1;
      else if (safeX >= chunk.endX) low = middle + 1;
      else return chunk;
    }
    return chunks[chunks.length - 1] as BackgroundChunk;
  }

  function sceneAt(worldX: number): BackgroundSceneState {
    const safeX = Math.max(0, worldX);
    const chunk = chunkAt(safeX);
    const previous = chunks[Math.max(0, chunk.index - 1)] ?? chunk;
    const transitionProgress =
      chunk.index === 0
        ? 1
        : (safeX - chunk.startX) / chunk.transitionLength;
    return {
      kind: chunk.kind,
      previousKind: previous.kind,
      blend: smoothstep(transitionProgress),
      chunk,
    };
  }

  function chunksInRange(
    startWorldX: number,
    endWorldX: number,
  ): readonly BackgroundChunk[] {
    const start = Math.max(0, Math.min(startWorldX, endWorldX));
    const end = Math.max(start, Math.max(startWorldX, endWorldX));
    ensureThrough(end);
    return chunks.filter((chunk) => chunk.endX >= start && chunk.startX <= end);
  }

  return {
    sceneAt,
    chunksInRange,
    farProfileAt(worldX: number): number {
      return landscapeProfile(worldX, sceneAt(worldX), "far");
    },
    middleProfileAt(worldX: number): number {
      return landscapeProfile(worldX, sceneAt(worldX), "middle");
    },
  };
}
