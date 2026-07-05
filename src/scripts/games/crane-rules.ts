export type CraneTool = "stabilizer" | "mag-lock" | "wide-load" | "windbreak";
export type CrateKind = "standard" | "long" | "heavy";

export interface CrateSpec {
  kind: CrateKind;
  width: number;
  height: number;
  mass: number;
  tonnage: number;
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
  resolvedCenterX: number;
  resolvedLateralVelocity: number;
}

export interface WindState {
  direction: -1 | 0 | 1;
  strength: 0 | 1 | 2 | 3;
  force: number;
  label: string;
}

export interface CrateMotionProfile {
  trolleyFactor: number;
  swingFactor: number;
  windFactor: number;
}

export interface CraneRigProfile {
  beamStrain: number;
  cableTension: number;
  pickupStrain: number;
  rockAmplitude: number;
  rockRate: number;
  telescopingSpreader: boolean;
  trolleyCompression: number;
  warningBeacon: boolean;
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

export function crateKindLabel(kind: CrateKind): string {
  if (kind === "long") return "LONG";
  if (kind === "heavy") return "HEAVY";
  return "STANDARD";
}

export function crateMotionProfile(kind: CrateKind): CrateMotionProfile {
  if (kind === "long") {
    return { trolleyFactor: 0.96, swingFactor: 1.12, windFactor: 1.08 };
  }
  if (kind === "heavy") {
    return { trolleyFactor: 0.82, swingFactor: 0.64, windFactor: 0.48 };
  }
  return { trolleyFactor: 1, swingFactor: 1, windFactor: 1 };
}

export function craneRigProfile(kind: CrateKind): CraneRigProfile {
  if (kind === "long") {
    return {
      beamStrain: 0.12,
      cableTension: 0.66,
      pickupStrain: 0.46,
      rockAmplitude: 1,
      rockRate: 0.00165,
      telescopingSpreader: true,
      trolleyCompression: 0.24,
      warningBeacon: false,
    };
  }
  if (kind === "heavy") {
    return {
      beamStrain: 1,
      cableTension: 1,
      pickupStrain: 1,
      rockAmplitude: 0.12,
      rockRate: 0.0038,
      telescopingSpreader: false,
      trolleyCompression: 1,
      warningBeacon: true,
    };
  }
  return {
    beamStrain: 0,
    cableTension: 0.5,
    pickupStrain: 0.28,
    rockAmplitude: 0.3,
    rockRate: 0.0019,
    telescopingSpreader: false,
    trolleyCompression: 0.12,
    warningBeacon: false,
  };
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
  // MAG-LOCK is a one-use guarantee rather than a vague assistance bonus.
  // It aligns the load with the current support and removes lateral velocity.
  const resolvedCenterX = input.magLocked ? input.lowerCenterX : input.crateCenterX;
  const resolvedLateralVelocity = input.magLocked ? 0 : input.lateralVelocity;
  const overlap = overlapAmount(
    resolvedCenterX,
    input.crateWidth,
    input.lowerCenterX,
    input.lowerWidth,
  );
  const supportWidth = Math.max(1, Math.min(input.crateWidth, input.lowerWidth));
  const overlapRatio = overlap / supportWidth;
  const offset = resolvedCenterX - input.lowerCenterX;
  const normalizedOffset = clamp(offset / supportWidth, -1.5, 1.5);
  const minimumSupport = input.towerHeight < 180 ? 0.16 : 0.2;
  const perfectTolerance = Math.max(4, supportWidth * 0.055);
  const speedContribution = clamp(resolvedLateralVelocity / 230, -1.2, 1.2);
  const heightMultiplier = 1 + Math.min(0.8, input.towerHeight / 720);

  return {
    kind: overlapRatio >= minimumSupport ? "landed" : "miss",
    overlap,
    overlapRatio,
    offset,
    normalizedOffset,
    perfect:
      Boolean(input.magLocked) ||
      (Math.abs(offset) <= perfectTolerance &&
        Math.abs(resolvedLateralVelocity) <= 82),
    impactImpulse: input.magLocked
      ? 0
      : (normalizedOffset * 0.82 + speedContribution * 0.28) *
        input.crateMass *
        heightMultiplier,
    resolvedCenterX,
    resolvedLateralVelocity,
  };
}

function crateKindForIndex(seed: number, index: number): CrateKind {
  // Give the player two predictable loads before introducing variants.
  if (index < 2) return "standard";

  const difficulty = Math.min(1, index / 34);
  const roll = unit(seed, index * 7 + 1);
  const heavyChance = 0.18 + difficulty * 0.08;
  const longChance = 0.3;
  if (roll < heavyChance) return "heavy";
  if (roll < heavyChance + longChance) return "long";
  return "standard";
}

export function nextCrateSpec(seed: number, index: number): CrateSpec {
  const kind = crateKindForIndex(seed, index);
  const widthRoll = unit(seed, index * 7 + 2);
  const massRoll = unit(seed, index * 7 + 3);
  const heightRoll = unit(seed, index * 7 + 4);
  const weightRoll = unit(seed, index * 7 + 5);
  const difficulty = Math.min(1, index / 34);

  if (kind === "long") {
    return {
      kind,
      width: Math.round(218 + widthRoll * 26 - difficulty * 5),
      height: Math.round(46 + heightRoll * 6),
      mass: Number((0.94 + massRoll * 0.22 + difficulty * 0.04).toFixed(3)),
      tonnage: Math.round(11 + weightRoll * 6),
    };
  }

  if (kind === "heavy") {
    return {
      kind,
      width: Math.round(154 + widthRoll * 28 - difficulty * 5),
      height: Math.round(58 + heightRoll * 7),
      mass: Number((1.43 + massRoll * 0.34 + difficulty * 0.08).toFixed(3)),
      tonnage: Math.round(25 + weightRoll * 10),
    };
  }

  return {
    kind,
    width: Math.round(170 + widthRoll * 36 - difficulty * 12),
    height: Math.round(51 + heightRoll * 8),
    mass: Number((0.93 + massRoll * 0.32 + difficulty * 0.06).toFixed(3)),
    tonnage: Math.round(13 + weightRoll * 7),
  };
}

export function wideLoadSpec(spec: CrateSpec): CrateSpec {
  const tonnage = Number.isFinite(spec.tonnage) ? spec.tonnage : 14;
  return {
    kind: "long",
    width: Math.min(252, Math.max(238, Math.round(spec.width * 1.2))),
    height: Math.max(46, Math.min(51, spec.height - 4)),
    mass: Number(Math.max(1, spec.mass * 0.92).toFixed(3)),
    tonnage: Math.max(12, Math.round(tonnage * 0.92)),
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
