export type CraneTool = "stabilizer" | "mag-lock" | "wide-load" | "windbreak";

export interface CrateSpec {
  width: number;
  height: number;
  mass: number;
}

export interface PlacedCrate extends CrateSpec {
  id: number;
  centerX: number;
  bottom: number;
}

export interface LandingInput {
  crateCenterX: number;
  crateWidth: number;
  crateMass: number;
  lowerCenterX: number;
  lowerWidth: number;
  lateralVelocity: number;
  towerHeight: number;
  magLocked?: boolean;
}

export interface LandingResult {
  kind: "landed" | "miss";
  overlap: number;
  overlapRatio: number;
  offset: number;
  normalizedOffset: number;
  perfect: boolean;
  impactImpulse: number;
}

export interface WindState {
  direction: -1 | 0 | 1;
  strength: 0 | 1 | 2 | 3;
  force: number;
  label: string;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

function mixSeed(seed: number, index: number): number {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  value ^= value >>> 16;
  return value >>> 0;
}

function unit(seed: number, index: number): number {
  return mixSeed(seed, index) / 0xffffffff;
}

export function overlapAmount(
  centerA: number,
  widthA: number,
  centerB: number,
  widthB: number,
): number {
  const left = Math.max(centerA - widthA / 2, centerB - widthB / 2);
  const right = Math.min(centerA + widthA / 2, centerB + widthB / 2);
  return Math.max(0, right - left);
}

export function resolveLanding(input: LandingInput): LandingResult {
  const overlap = overlapAmount(
    input.crateCenterX,
    input.crateWidth,
    input.lowerCenterX,
    input.lowerWidth,
  );
  const supportWidth = Math.max(1, Math.min(input.crateWidth, input.lowerWidth));
  const overlapRatio = overlap / supportWidth;
  const offset = input.crateCenterX - input.lowerCenterX;
  const normalizedOffset = clamp(offset / supportWidth, -1.5, 1.5);
  const normalMinimumSupport = input.towerHeight < 180 ? 0.16 : 0.2;
  const minimumSupport = input.magLocked ? 0.055 : normalMinimumSupport;
  const perfectTolerance = Math.max(4, supportWidth * 0.055);
  const speedContribution = clamp(input.lateralVelocity / 230, -1.2, 1.2);
  const heightMultiplier = 1 + Math.min(0.8, input.towerHeight / 720);
  const lockMultiplier = input.magLocked ? 0.52 : 1;

  return {
    kind: overlapRatio >= minimumSupport ? "landed" : "miss",
    overlap,
    overlapRatio,
    offset,
    normalizedOffset,
    perfect:
      Math.abs(offset) <= perfectTolerance &&
      Math.abs(input.lateralVelocity) <= 82,
    impactImpulse:
      (normalizedOffset * 0.82 + speedContribution * 0.28) *
      input.crateMass *
      heightMultiplier *
      lockMultiplier,
  };
}

export function nextCrateSpec(seed: number, index: number): CrateSpec {
  const widthRoll = unit(seed, index * 3 + 1);
  const massRoll = unit(seed, index * 3 + 2);
  const heightRoll = unit(seed, index * 3 + 3);
  const difficulty = Math.min(1, index / 34);

  const maximumWidth = 214 - difficulty * 20;
  const minimumWidth = 158 - difficulty * 18;
  const width = Math.round(minimumWidth + widthRoll * (maximumWidth - minimumWidth));
  const height = Math.round(50 + heightRoll * 9);
  const mass = Number((0.84 + massRoll * 0.5 + difficulty * 0.08).toFixed(3));

  return { width, height, mass };
}

export function wideLoadSpec(spec: CrateSpec): CrateSpec {
  return {
    width: Math.min(248, Math.max(232, Math.round(spec.width * 1.2))),
    height: Math.max(46, Math.min(52, spec.height - 4)),
    mass: Number(Math.max(1.02, spec.mass * 0.94).toFixed(3)),
  };
}

export function windForHeight(seed: number, height: number): WindState {
  if (height < 7) {
    return { direction: 0, strength: 0, force: 0, label: "CALM" };
  }

  const phase = Math.floor((height - 7) / 3);
  const directionRoll = unit(seed, phase * 5 + 101);
  const strengthRoll = unit(seed, phase * 5 + 102);
  const maximumStrength = height < 16 ? 1 : height < 28 ? 2 : 3;
  const strength = clamp(
    1 + Math.floor(strengthRoll * maximumStrength),
    1,
    maximumStrength,
  ) as 1 | 2 | 3;
  const direction: -1 | 1 = directionRoll < 0.5 ? -1 : 1;
  const arrows = direction < 0 ? "<".repeat(strength) : ">".repeat(strength);

  return {
    direction,
    strength,
    force: direction * (18 + strength * 17),
    label: arrows,
  };
}

export function calculateRestLean(crates: readonly PlacedCrate[]): number {
  if (crates.length === 0) return 0;

  let totalMass = 0;
  let weightedCenter = 0;
  for (const crate of crates) {
    const leverage = 1 + crate.bottom / 540;
    totalMass += crate.mass * leverage;
    weightedCenter += crate.centerX * crate.mass * leverage;
  }

  const centerOfMass = totalMass > 0 ? weightedCenter / totalMass : 0;
  return clamp(centerOfMass / 560, -0.19, 0.19);
}

export function collapseAngleForHeight(height: number): number {
  return clamp(0.255 - height / 6200, 0.19, 0.255);
}

const TOOL_ORDER: readonly CraneTool[] = [
  "stabilizer",
  "mag-lock",
  "wide-load",
  "windbreak",
];

export function toolForAward(index: number): CraneTool {
  return TOOL_ORDER[((index % TOOL_ORDER.length) + TOOL_ORDER.length) % TOOL_ORDER.length] ?? "stabilizer";
}

const TOOL_PAIRS: readonly (readonly [CraneTool, CraneTool])[] = [
  ["stabilizer", "mag-lock"],
  ["wide-load", "windbreak"],
  ["mag-lock", "wide-load"],
  ["windbreak", "stabilizer"],
];

export function toolChoicesForAward(index: number): readonly [CraneTool, CraneTool] {
  return TOOL_PAIRS[((index % TOOL_PAIRS.length) + TOOL_PAIRS.length) % TOOL_PAIRS.length] ?? TOOL_PAIRS[0]!;
}

export function shouldAwardTool(
  perfectStreak: number,
  placedCount: number,
  hasToolOrChoice: boolean,
): boolean {
  if (hasToolOrChoice) return false;
  return perfectStreak >= 3 || (placedCount > 0 && placedCount % 10 === 0);
}

export function trolleySpeedForHeight(height: number): number {
  return clamp(80 + height * 1.9, 80, 150);
}

export function cableSwingForHeight(height: number): number {
  return clamp(9 + height * 0.36, 9, 21);
}
