export type TerrainSegmentKind =
  | "flat"
  | "uphill"
  | "plateau"
  | "downhill"
  | "valley";

export interface TerrainSample {
  groundY: number;
  slope: number;
  speedMultiplier: number;
}

export interface TerrainSegmentSnapshot {
  kind: TerrainSegmentKind;
  startX: number;
  endX: number;
  startOffset: number;
  endOffset: number;
}

type TerrainSegment = TerrainSegmentSnapshot;

const INITIAL_FLAT_LENGTH = 900;
const MAX_OFFSET = 24;
const MIN_ENVIRONMENT_SPEED_MULTIPLIER = 0.9;
const MAX_ENVIRONMENT_SPEED_MULTIPLIER = 1.1;

const segments: TerrainSegment[] = [
  {
    kind: "flat",
    startX: 0,
    endX: INITIAL_FLAT_LENGTH,
    startOffset: 0,
    endOffset: 0,
  },
];

let generatedThrough = INITIAL_FLAT_LENGTH;
let currentOffset = 0;
let zoneIndex = 0;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function hashUnit(index: number, salt: number): number {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function rangedLength(
  index: number,
  salt: number,
  minimum: number,
  maximum: number,
): number {
  return Math.round(minimum + hashUnit(index, salt) * (maximum - minimum));
}

function smootherstep(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function smootherstepDerivative(value: number): number {
  const t = clamp(value, 0, 1);
  return 30 * t * t * (t - 1) * (t - 1);
}

function appendSegment(
  kind: TerrainSegmentKind,
  length: number,
  endOffset: number,
): void {
  const safeLength = Math.max(240, Math.round(length));
  const boundedEndOffset = clamp(endOffset, -MAX_OFFSET, MAX_OFFSET);
  const segment: TerrainSegment = {
    kind,
    startX: generatedThrough,
    endX: generatedThrough + safeLength,
    startOffset: currentOffset,
    endOffset: boundedEndOffset,
  };
  segments.push(segment);
  generatedThrough = segment.endX;
  currentOffset = boundedEndOffset;
}

function appendFlat(length: number): void {
  appendSegment(
    Math.abs(currentOffset) < 0.5 ? "flat" : "plateau",
    length,
    currentOffset,
  );
}

function appendTransition(length: number, targetOffset: number): void {
  const kind: TerrainSegmentKind = targetOffset > currentOffset
    ? "downhill"
    : "uphill";
  appendSegment(kind, length, targetOffset);
}

/**
 * Build broad countryside profiles instead of layering short sine waves.
 * Every zone contains long readable sections and returns near the baseline,
 * which prevents rapid uphill/downhill oscillation.
 */
function appendTerrainZone(index: number): void {
  const template = index % 4;
  const height = rangedLength(index, 1, 16, 23);

  if (template === 0) {
    // Broad hill: approach, climb, crest, descent, recovery.
    appendFlat(rangedLength(index, 2, 420, 720));
    appendTransition(rangedLength(index, 3, 900, 1_300), -height);
    appendFlat(rangedLength(index, 4, 320, 560));
    appendTransition(rangedLength(index, 5, 920, 1_340), 0);
    appendFlat(rangedLength(index, 6, 520, 900));
    return;
  }

  if (template === 1) {
    // Open field with only a very gentle rise or dip.
    const direction = hashUnit(index, 7) < 0.5 ? -1 : 1;
    const gentleHeight = rangedLength(index, 8, 7, 11) * direction;
    appendFlat(rangedLength(index, 9, 1_050, 1_550));
    appendTransition(rangedLength(index, 10, 850, 1_180), gentleHeight);
    appendFlat(rangedLength(index, 11, 420, 700));
    appendTransition(rangedLength(index, 12, 850, 1_180), 0);
    appendFlat(rangedLength(index, 13, 700, 1_100));
    return;
  }

  if (template === 2) {
    // Shallow valley: descent, readable valley floor, climb, recovery.
    appendFlat(rangedLength(index, 14, 480, 760));
    appendTransition(rangedLength(index, 15, 920, 1_300), height);
    appendFlat(rangedLength(index, 16, 360, 620));
    appendTransition(rangedLength(index, 17, 940, 1_360), 0);
    appendFlat(rangedLength(index, 18, 520, 920));
    return;
  }

  // Long recovery country: mostly flat with one low, broad undulation.
  const direction = hashUnit(index, 19) < 0.5 ? -1 : 1;
  const lowHeight = rangedLength(index, 20, 5, 9) * direction;
  appendFlat(rangedLength(index, 21, 1_300, 1_900));
  appendTransition(rangedLength(index, 22, 1_000, 1_420), lowHeight);
  appendFlat(rangedLength(index, 23, 420, 760));
  appendTransition(rangedLength(index, 24, 1_000, 1_420), 0);
  appendFlat(rangedLength(index, 25, 900, 1_400));
}

function ensureTerrainThrough(worldX: number): void {
  const target = Math.max(0, worldX);
  while (generatedThrough < target) {
    appendTerrainZone(zoneIndex);
    zoneIndex += 1;
  }
}

function segmentFor(worldX: number): TerrainSegment {
  const safeX = Math.max(0, worldX);
  ensureTerrainThrough(safeX);

  let low = 0;
  let high = segments.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const segment = segments[middle];
    if (!segment) break;
    if (safeX < segment.startX) high = middle - 1;
    else if (safeX > segment.endX) low = middle + 1;
    else return segment;
  }

  return segments[segments.length - 1] as TerrainSegment;
}

function terrainOffsetAt(worldX: number): number {
  const segment = segmentFor(worldX);
  if (segment.endOffset === segment.startOffset) return segment.startOffset;
  const progress =
    (Math.max(0, worldX) - segment.startX) / (segment.endX - segment.startX);
  return (
    segment.startOffset +
    (segment.endOffset - segment.startOffset) * smootherstep(progress)
  );
}

/** Returns the ground line in canvas coordinates for a stable world position. */
export function terrainHeightAt(worldX: number, baselineY: number): number {
  return baselineY + terrainOffsetAt(worldX);
}

/** Positive means the course descends as the chicken runs right. */
export function terrainSlopeAt(worldX: number, _baselineY: number): number {
  const segment = segmentFor(worldX);
  if (segment.endOffset === segment.startOffset) return 0;
  const length = segment.endX - segment.startX;
  const progress = (Math.max(0, worldX) - segment.startX) / length;
  return (
    ((segment.endOffset - segment.startOffset) / length) *
    smootherstepDerivative(progress)
  );
}

export function terrainSegmentAt(worldX: number): TerrainSegmentSnapshot {
  const segment = segmentFor(worldX);
  return { ...segment };
}

export function terrainSpeedMultiplier(slope: number): number {
  return clamp(1 + clamp(slope, -0.06, 0.06) * 1.12, 0.95, 1.055);
}

/**
 * Terrain and weather are secondary modifiers. Cap their combined effect so a
 * rainy uphill headwind or a dry downhill tailwind never overwhelms the core
 * day/night speed curve.
 */
export function environmentSpeedMultiplier(
  terrainMultiplier: number,
  weatherMultiplier: number,
): number {
  return clamp(
    terrainMultiplier * weatherMultiplier,
    MIN_ENVIRONMENT_SPEED_MULTIPLIER,
    MAX_ENVIRONMENT_SPEED_MULTIPLIER,
  );
}

export function sampleTerrain(worldX: number, baselineY: number): TerrainSample {
  const slope = terrainSlopeAt(worldX, baselineY);
  return {
    groundY: terrainHeightAt(worldX, baselineY),
    slope,
    speedMultiplier: terrainSpeedMultiplier(slope),
  };
}

function placementIsSafe(
  startWorldX: number,
  span: number,
  baselineY: number,
  maxSlope: number,
  maxHeightChange: number,
): boolean {
  const samples = [
    startWorldX,
    startWorldX + span * 0.2,
    startWorldX + span * 0.4,
    startWorldX + span * 0.6,
    startWorldX + span * 0.8,
    startWorldX + span,
  ];
  const heights = samples.map((worldX) => terrainHeightAt(worldX, baselineY));
  const slopes = samples.map((worldX) => Math.abs(terrainSlopeAt(worldX, baselineY)));
  return (
    Math.max(...slopes) <= maxSlope &&
    Math.max(...heights) - Math.min(...heights) <= maxHeightChange
  );
}

/**
 * Move a course pattern forward until every obstacle has a readable landing
 * surface. Long hills are allowed, while crests, valleys, mud, and complex
 * chains receive stable placement surfaces.
 */
export function findSafeTerrainStart(options: {
  requestedWorldX: number;
  span: number;
  baselineY: number;
  maxSlope?: number;
  maxHeightChange?: number;
  searchDistance?: number;
}): number {
  const maxSlope = options.maxSlope ?? 0.12;
  const maxHeightChange = options.maxHeightChange ?? 18;
  const searchDistance = options.searchDistance ?? 720;

  for (let shift = 0; shift <= searchDistance; shift += 24) {
    const candidate = options.requestedWorldX + shift;
    if (
      placementIsSafe(
        candidate,
        options.span,
        options.baselineY,
        maxSlope,
        maxHeightChange,
      )
    ) {
      return candidate;
    }
  }

  return options.requestedWorldX + searchDistance;
}
