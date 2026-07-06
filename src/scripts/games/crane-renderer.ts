import {
  craneRigProfile,
  crateKindLabel,
  type CrateKind,
  type CrateSpec,
  type PlacedCrate,
  type WindState,
} from "./crane-rules";
import { configureFixedCanvas } from "./shared/canvas";

export const CRANE_WIDTH = 560;
export const CRANE_HEIGHT = 720;
export const CRANE_TOWER_X = 304;
export const CRANE_BASE_Y = 680;
export const CRANE_HANGING_Y = 205;
export const CRANE_CAMERA_THRESHOLD = 318;

interface FallingCrate extends CrateSpec {
  x: number;
  y: number;
}

interface CollapseVisual {
  elapsed: number;
  direction: -1 | 1;
}

interface LandingFeedbackVisual {
  kind: "perfect" | "stable" | "risky" | "mag-lock";
  label: string;
  centerX: number;
  height: number;
  elapsed: number;
}

export interface CraneRenderState {
  crates: readonly PlacedCrate[];
  hanging: FallingCrate | null;
  falling: FallingCrate | null;
  towerAngle: number;
  restLean: number;
  cameraOffset: number;
  trolleyX: number;
  trolleyDirection: -1 | 1;
  cableAnchorX: number;
  loadAge: number;
  wind: WindState;
  score: number;
  perfectStreak: number;
  magLockArmed: boolean;
  wideLoadArmed: boolean;
  windbreakDrops: number;
  stabilizerPulse: number;
  landingFeedback: LandingFeedbackVisual | null;
  collapse: CollapseVisual | null;
  time: number;
  reducedMotion: boolean;
}

const palette = {
  skyTop: "#03100b",
  skyMid: "#0a2116",
  skyBottom: "#153722",
  skylineBack: "#0e271a",
  skylineFront: "#153723",
  water: "#0a2119",
  waterLine: "#28533c",
  ground: "#0b2116",
  shadow: "rgba(0, 0, 0, 0.64)",
  deepest: "#06110b",
  dark: "#0e2418",
  darkMid: "#183824",
  mid: "#2b5b3a",
  bright: "#76ad68",
  phosphor: "#c7f08b",
  hot: "#efffc9",
  amber: "#d8d774",
  cyan: "#76d9bd",
};

const kindFill: Record<CrateKind, string> = {
  standard: "#28543a",
  long: "#4c5730",
  heavy: "#1f4c46",
};

const kindActiveFill: Record<CrateKind, string> = {
  standard: "#3d7a51",
  long: "#77733b",
  heavy: "#2e7368",
};

const kindAccent: Record<CrateKind, string> = {
  standard: palette.phosphor,
  long: palette.amber,
  heavy: palette.cyan,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

interface RigAnimation {
  beamSag: number;
  cableSeparation: number;
  cableThickness: number;
  hookJitterX: number;
  hookJitterY: number;
  loadLiftOffset: number;
  loadRotation: number;
  pickupProgress: number;
  spreaderExtension: number;
  trolleyOffsetY: number;
  trolleyShakeX: number;
  warningBeacon: boolean;
}

function activeRigAnimation(state: CraneRenderState): RigAnimation {
  const crate = state.hanging;
  if (!crate) {
    return {
      beamSag: 0,
      cableSeparation: 7,
      cableThickness: 2,
      hookJitterX: 0,
      hookJitterY: 0,
      loadLiftOffset: 0,
      loadRotation: 0,
      pickupProgress: 1,
      spreaderExtension: 1,
      trolleyOffsetY: 0,
      trolleyShakeX: 0,
      warningBeacon: false,
    };
  }

  const profile = craneRigProfile(crate.kind);
  const rawProgress = state.reducedMotion ? 1 : clamp(state.loadAge / 0.62, 0, 1);
  const pickupProgress = 1 - Math.pow(1 - rawProgress, 3);
  const startupOscillation = state.reducedMotion
    ? 0
    : Math.exp(-state.loadAge * 4.8) * Math.sin(state.loadAge * 17);
  const heavyVibration =
    !state.reducedMotion && crate.kind === "heavy"
      ? Math.sin(state.time * 0.035)
      : 0;
  const longRock = state.reducedMotion
    ? 0
    : Math.sin(state.time * profile.rockRate + crate.x * 0.008);
  const directionalLean =
    state.reducedMotion || crate.kind !== "long"
      ? 0
      : state.trolleyDirection * 0.005;

  return {
    beamSag: profile.beamStrain * (2.8 * pickupProgress + heavyVibration * 0.35),
    cableSeparation: crate.kind === "heavy" ? 10 : crate.kind === "long" ? 8 : 7,
    cableThickness: 1.7 + profile.cableTension * 1.6,
    hookJitterX: heavyVibration * profile.pickupStrain * 0.65,
    hookJitterY: heavyVibration * profile.pickupStrain * 0.42,
    loadLiftOffset:
      (1 - pickupProgress) * profile.pickupStrain * 9 +
      startupOscillation * profile.pickupStrain * 2.3,
    loadRotation: longRock * profile.rockAmplitude * 0.028 + directionalLean,
    pickupProgress,
    spreaderExtension: profile.telescopingSpreader ? pickupProgress : 1,
    trolleyOffsetY:
      profile.trolleyCompression * (3.2 * pickupProgress + heavyVibration * 0.42) +
      profile.beamStrain * startupOscillation * 0.55,
    trolleyShakeX: heavyVibration * profile.pickupStrain * 0.5,
    warningBeacon: profile.warningBeacon,
  };
}

function bridgeSagAt(
  x: number,
  trolleyX: number,
  maximumSag: number,
): number {
  if (maximumSag <= 0) return 0;
  const distance = Math.abs(x - trolleyX);
  const radius = 145;
  const normalized = clamp(distance / radius, 0, 1);
  return maximumSag * (1 - normalized * normalized);
}

function drawPixelCloud(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  alpha: number,
): void {
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = palette.phosphor;
  context.fillRect(x, y, 58 * scale, 8 * scale);
  context.fillRect(x + 10 * scale, y - 7 * scale, 42 * scale, 8 * scale);
  context.fillRect(x + 20 * scale, y - 13 * scale, 22 * scale, 7 * scale);
  context.restore();
}

function drawStars(
  context: CanvasRenderingContext2D,
  state: CraneRenderState,
): void {
  const visibility = clamp((state.score - 8) / 18, 0, 0.34);
  if (visibility <= 0) return;

  const stars = [
    [76, 101], [119, 153], [182, 78], [229, 126], [286, 92],
    [345, 142], [398, 104], [458, 65], [520, 158], [89, 228],
    [207, 205], [371, 232], [491, 213],
  ] as const;
  context.fillStyle = `rgba(239, 255, 201, ${visibility})`;
  for (const [x, y] of stars) {
    const twinkle = state.reducedMotion
      ? 1
      : 0.65 + Math.sin(state.time * 0.002 + x * 0.07) * 0.25;
    context.globalAlpha = clamp(twinkle, 0.35, 1);
    context.fillRect(x, y, 2, 2);
  }
  context.globalAlpha = 1;
}

function drawMoon(
  context: CanvasRenderingContext2D,
  state: CraneRenderState,
): void {
  const y = 118 + state.cameraOffset * 0.035;
  context.fillStyle = "rgba(216, 215, 116, 0.08)";
  context.beginPath();
  context.arc(492, y, 36, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(216, 215, 116, 0.18)";
  context.beginPath();
  context.arc(492, y, 25, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(239, 255, 201, 0.1)";
  context.beginPath();
  context.arc(486, y - 4, 17, 0, Math.PI * 2);
  context.fill();
}

function drawFarCity(
  context: CanvasRenderingContext2D,
  state: CraneRenderState,
): void {
  const yShift = state.cameraOffset * 0.1;
  const backBuildings = [
    [4, 530, 38, 82], [48, 558, 29, 54], [83, 513, 46, 99],
    [137, 548, 34, 64], [179, 501, 49, 111], [237, 550, 38, 62],
    [283, 522, 43, 90], [336, 557, 34, 55], [380, 505, 52, 107],
    [440, 541, 39, 71], [487, 516, 55, 96],
  ] as const;

  context.fillStyle = palette.skylineBack;
  for (const [x, y, width, height] of backBuildings) {
    const shiftedY = y + yShift;
    context.fillRect(x, shiftedY, width, height);
    context.fillRect(x + Math.floor(width * 0.42), shiftedY - 8, 4, 8);
  }

  const frontBuildings = [
    [0, 579, 67, 48], [73, 552, 53, 75], [132, 586, 68, 41],
    [205, 563, 60, 64], [271, 589, 70, 38], [349, 558, 64, 69],
    [421, 583, 60, 44], [487, 565, 73, 62],
  ] as const;
  context.fillStyle = palette.skylineFront;
  for (const [x, y, width, height] of frontBuildings) {
    context.fillRect(x, y + yShift, width, height);
  }

  context.fillStyle = "rgba(199, 240, 139, 0.18)";
  for (let x = 17; x < CRANE_WIDTH; x += 31) {
    for (let y = 577; y < 620; y += 17) {
      if ((x + y) % 3 !== 0) context.fillRect(x, y + yShift, 3, 4);
    }
  }
}

function drawDistantCranes(
  context: CanvasRenderingContext2D,
  state: CraneRenderState,
): void {
  const yShift = state.cameraOffset * 0.18;
  const beaconOn = state.reducedMotion || Math.floor(state.time / 700) % 2 === 0;

  context.save();
  context.strokeStyle = "rgba(118, 173, 104, 0.24)";
  context.fillStyle = "rgba(16, 41, 28, 0.82)";
  context.lineWidth = 4;

  for (const [mastX, mastTop, boomLength, direction] of [
    [112, 438, 105, 1],
    [432, 452, 92, -1],
  ] as const) {
    const top = mastTop + yShift;
    context.beginPath();
    context.moveTo(mastX, top);
    context.lineTo(mastX, 610 + yShift);
    context.moveTo(mastX - 10, top + 13);
    context.lineTo(mastX + direction * boomLength, top + 13);
    context.moveTo(mastX, top + 13);
    context.lineTo(mastX + direction * boomLength * 0.68, top + 35);
    context.stroke();
    context.fillRect(mastX - 7, top + 4, 14, 13);
    context.fillRect(mastX + direction * boomLength - 2, top + 12, 3, 38);
    if (beaconOn) {
      context.fillStyle = "rgba(216, 215, 116, 0.56)";
      context.fillRect(mastX - 2, top - 4, 4, 4);
      context.fillStyle = "rgba(16, 41, 28, 0.82)";
    }
  }
  context.restore();
}

function drawWaterAndShip(
  context: CanvasRenderingContext2D,
  state: CraneRenderState,
): void {
  const waterY = 618 + state.cameraOffset * 0.28;
  context.fillStyle = palette.water;
  context.fillRect(0, waterY, CRANE_WIDTH, CRANE_HEIGHT - waterY);
  context.fillStyle = "rgba(118, 173, 104, 0.18)";
  context.fillRect(0, waterY, CRANE_WIDTH, 2);

  for (let y = waterY + 12; y < CRANE_HEIGHT; y += 17) {
    const offset = ((Math.floor(y) * 7) % 39) - 20;
    context.fillStyle = "rgba(118, 173, 104, 0.08)";
    for (let x = offset; x < CRANE_WIDTH; x += 56) {
      context.fillRect(x, y, 29, 1);
    }
  }

  const travel = state.reducedMotion ? 0.42 : (state.time * 0.000018) % 1;
  const shipX = -150 + travel * (CRANE_WIDTH + 290);
  const shipY = waterY - 28;
  context.fillStyle = "rgba(10, 27, 19, 0.88)";
  context.beginPath();
  context.moveTo(shipX, shipY + 14);
  context.lineTo(shipX + 132, shipY + 14);
  context.lineTo(shipX + 113, shipY + 29);
  context.lineTo(shipX + 17, shipY + 29);
  context.closePath();
  context.fill();
  context.fillRect(shipX + 38, shipY, 52, 15);
  context.fillRect(shipX + 67, shipY - 12, 6, 12);
  context.fillStyle = "rgba(199, 240, 139, 0.18)";
  context.fillRect(shipX + 45, shipY + 5, 7, 3);
  context.fillRect(shipX + 58, shipY + 5, 7, 3);
  context.fillRect(shipX + 75, shipY + 5, 7, 3);
}

function drawWarehouseYard(
  context: CanvasRenderingContext2D,
  state: CraneRenderState,
): void {
  const yShift = state.cameraOffset * 0.42;
  const warehouseY = 603 + yShift;

  context.fillStyle = "rgba(15, 45, 29, 0.96)";
  context.fillRect(44, warehouseY, 168, 62);
  context.fillRect(349, warehouseY - 13, 166, 75);
  context.fillStyle = "rgba(31, 76, 47, 0.66)";
  context.fillRect(54, warehouseY + 11, 45, 51);
  context.fillRect(108, warehouseY + 11, 45, 51);
  context.fillRect(162, warehouseY + 11, 39, 51);
  context.fillRect(361, warehouseY + 4, 68, 58);
  context.fillRect(437, warehouseY + 4, 66, 58);

  context.strokeStyle = "rgba(118, 173, 104, 0.18)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(38, warehouseY);
  context.lineTo(129, warehouseY - 30);
  context.lineTo(218, warehouseY);
  context.moveTo(342, warehouseY - 13);
  context.lineTo(430, warehouseY - 42);
  context.lineTo(522, warehouseY - 13);
  context.stroke();

  const stacks = [
    [233, 622, 60, 18], [227, 602, 70, 18], [301, 628, 43, 17],
    [10, 638, 30, 14], [520, 630, 34, 15],
  ] as const;
  for (const [x, y, width, height] of stacks) {
    context.fillStyle = "rgba(43, 91, 58, 0.48)";
    context.fillRect(x, y + yShift, width, height);
    context.strokeStyle = "rgba(118, 173, 104, 0.16)";
    context.strokeRect(x, y + yShift, width, height);
  }

  if (state.score < 15) {
    const travel = state.reducedMotion ? 0.32 : (state.time * 0.000035) % 1;
    const forkX = 85 + travel * 360;
    const forkY = 662 + yShift;
    context.fillStyle = "rgba(216, 215, 116, 0.24)";
    context.fillRect(forkX, forkY - 8, 20, 9);
    context.fillRect(forkX + 13, forkY - 17, 5, 10);
    context.fillStyle = "rgba(7, 18, 12, 0.8)";
    context.fillRect(forkX + 2, forkY, 5, 4);
    context.fillRect(forkX + 14, forkY, 5, 4);
    context.fillStyle = "rgba(239, 255, 201, 0.16)";
    context.beginPath();
    context.moveTo(forkX + 21, forkY - 7);
    context.lineTo(forkX + 44, forkY - 12);
    context.lineTo(forkX + 44, forkY - 2);
    context.closePath();
    context.fill();
  }
}

function drawFogBands(
  context: CanvasRenderingContext2D,
  state: CraneRenderState,
): void {
  const drift = state.reducedMotion ? 0 : (state.time * 0.008) % 120;
  context.fillStyle = "rgba(199, 240, 139, 0.025)";
  context.fillRect(-120 + drift, 296 + state.cameraOffset * 0.04, 310, 17);
  context.fillRect(250 - drift * 0.42, 375 + state.cameraOffset * 0.07, 360, 13);
  context.fillRect(-70 + drift * 0.25, 487 + state.cameraOffset * 0.11, 250, 10);
}

function drawBackground(
  context: CanvasRenderingContext2D,
  state: CraneRenderState,
): void {
  const gradient = context.createLinearGradient(0, 0, 0, CRANE_HEIGHT);
  gradient.addColorStop(0, palette.skyTop);
  gradient.addColorStop(0.55, palette.skyMid);
  gradient.addColorStop(1, palette.skyBottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, CRANE_WIDTH, CRANE_HEIGHT);

  drawStars(context, state);
  drawMoon(context, state);

  const cloudDrift = state.reducedMotion ? 0 : state.time * 0.006;
  drawPixelCloud(context, ((52 + cloudDrift) % 680) - 80, 118 + state.cameraOffset * 0.025, 1.18, 0.08);
  drawPixelCloud(context, ((332 - cloudDrift * 0.55 + 680) % 680) - 70, 189 + state.cameraOffset * 0.04, 0.86, 0.07);
  drawPixelCloud(context, ((446 + cloudDrift * 0.32) % 680) - 70, 72 + state.cameraOffset * 0.018, 0.68, 0.055);

  drawFarCity(context, state);
  drawWaterAndShip(context, state);
  drawDistantCranes(context, state);
  drawWarehouseYard(context, state);
  drawFogBands(context, state);

  const groundY = 676 + state.cameraOffset * 0.56;
  context.fillStyle = palette.ground;
  context.fillRect(0, groundY, CRANE_WIDTH, CRANE_HEIGHT - groundY);
  context.fillStyle = "rgba(118, 173, 104, 0.2)";
  context.fillRect(0, groundY, CRANE_WIDTH, 3);

  if (state.wind.strength > 0) {
    const direction = state.wind.direction || 1;
    context.strokeStyle = `rgba(199, 240, 139, ${0.075 + state.wind.strength * 0.024})`;
    context.lineWidth = 2;
    for (let index = 0; index < 7; index += 1) {
      const travel = (state.time * (0.028 + state.wind.strength * 0.008) + index * 103) % 690;
      const x = direction > 0 ? travel - 80 : CRANE_WIDTH - travel + 80;
      const y = 142 + ((index * 67) % 350);
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + direction * (24 + state.wind.strength * 7), y);
      context.lineTo(x + direction * (30 + state.wind.strength * 7), y - 3);
      context.stroke();
    }
  }

  context.fillStyle = "rgba(0, 0, 0, 0.075)";
  for (let y = 0; y < CRANE_HEIGHT; y += 4) {
    context.fillRect(0, y, CRANE_WIDTH, 1);
  }
}

interface ContainerOptions {
  id: number;
  kind: CrateKind;
  tonnage: number;
  active?: boolean;
  perfect?: boolean;
  alpha?: number;
}

function drawLongMarkings(
  context: CanvasRenderingContext2D,
  x: number,
  faceY: number,
  width: number,
  faceHeight: number,
): void {
  context.save();
  context.beginPath();
  context.rect(x + 7, faceY + 4, 17, faceHeight - 8);
  context.rect(x + width - 24, faceY + 4, 17, faceHeight - 8);
  context.clip();
  context.strokeStyle = palette.amber;
  context.lineWidth = 4;
  for (let stripeY = faceY - 12; stripeY < faceY + faceHeight + 16; stripeY += 12) {
    context.beginPath();
    context.moveTo(x + 3, stripeY + 13);
    context.lineTo(x + 29, stripeY - 3);
    context.moveTo(x + width - 29, stripeY + 13);
    context.lineTo(x + width - 3, stripeY - 3);
    context.stroke();
  }
  context.restore();
}

function drawHeavyMarkings(
  context: CanvasRenderingContext2D,
  x: number,
  faceY: number,
  width: number,
  faceHeight: number,
  accent: string,
): void {
  context.strokeStyle = "rgba(118, 217, 189, 0.42)";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(x + 18, faceY + 8);
  context.lineTo(x + 42, faceY + faceHeight - 8);
  context.moveTo(x + 42, faceY + 8);
  context.lineTo(x + 18, faceY + faceHeight - 8);
  context.moveTo(x + width - 42, faceY + 8);
  context.lineTo(x + width - 18, faceY + faceHeight - 8);
  context.moveTo(x + width - 18, faceY + 8);
  context.lineTo(x + width - 42, faceY + faceHeight - 8);
  context.stroke();

  context.fillStyle = accent;
  for (const cornerX of [x + 3, x + width - 11]) {
    context.fillRect(cornerX, faceY + 3, 8, 10);
    context.fillRect(cornerX, faceY + faceHeight - 13, 8, 10);
  }
}

function drawStandardRibs(
  context: CanvasRenderingContext2D,
  x: number,
  faceY: number,
  width: number,
  faceHeight: number,
): void {
  context.strokeStyle = "rgba(199, 240, 139, 0.25)";
  context.lineWidth = 1;
  const plateHalfWidth = 56;
  for (let ribX = x + 17; ribX < x + width - 12; ribX += 15) {
    if (Math.abs(ribX - (x + width / 2)) < plateHalfWidth) continue;
    context.beginPath();
    context.moveTo(ribX, faceY + 7);
    context.lineTo(ribX, faceY + faceHeight - 9);
    context.stroke();
  }
}

function drawContainer(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  options: ContainerOptions,
): void {
  const x = Math.round(centerX - width / 2);
  const y = Math.round(centerY - height / 2);
  const depth = Math.max(5, Math.round(height * 0.12));
  const faceY = y + depth;
  const faceHeight = height - depth;
  const accent = options.perfect ? palette.hot : kindAccent[options.kind];
  const fill = options.active ? kindActiveFill[options.kind] : kindFill[options.kind];

  context.save();
  context.globalAlpha = options.alpha ?? 1;

  context.fillStyle = palette.shadow;
  context.fillRect(x + 8, y + 9, width + depth, height + 3);

  context.fillStyle = palette.deepest;
  context.beginPath();
  context.moveTo(x + width, y + depth);
  context.lineTo(x + width + depth, y);
  context.lineTo(x + width + depth, y + height - depth);
  context.lineTo(x + width, y + height);
  context.closePath();
  context.fill();

  context.fillStyle = options.active ? "#5b8960" : palette.mid;
  context.beginPath();
  context.moveTo(x, y + depth);
  context.lineTo(x + depth, y);
  context.lineTo(x + width + depth, y);
  context.lineTo(x + width, y + depth);
  context.closePath();
  context.fill();

  context.fillStyle = fill;
  context.fillRect(x, faceY, width, faceHeight);
  context.strokeStyle = accent;
  context.lineWidth = options.active ? 3 : options.kind === "heavy" ? 3 : 2;
  context.strokeRect(x, faceY, width, faceHeight);

  context.fillStyle = palette.deepest;
  context.fillRect(x + 5, faceY + 5, 5, faceHeight - 10);
  context.fillRect(x + width - 10, faceY + 5, 5, faceHeight - 10);
  context.fillRect(x + 5, faceY + faceHeight - 8, width - 10, 4);

  if (options.kind === "standard") {
    drawStandardRibs(context, x, faceY, width, faceHeight);
  } else if (options.kind === "long") {
    drawLongMarkings(context, x, faceY, width, faceHeight);
  } else {
    drawHeavyMarkings(context, x, faceY, width, faceHeight, accent);
  }

  const plateWidth = Math.min(116, Math.max(88, width * 0.46));
  const plateHeight = Math.min(36, Math.max(29, faceHeight - 12));
  const plateX = centerX - plateWidth / 2;
  const plateY = faceY + (faceHeight - plateHeight) / 2;
  context.fillStyle = "rgba(4, 14, 9, 0.88)";
  context.fillRect(plateX, plateY, plateWidth, plateHeight);
  context.strokeStyle = accent;
  context.lineWidth = 1.5;
  context.strokeRect(plateX, plateY, plateWidth, plateHeight);

  context.fillStyle = options.active ? palette.hot : palette.phosphor;
  context.font = "22px 'VT323', monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(options.id).padStart(2, "0"), centerX, plateY + 13);

  context.fillStyle = accent;
  context.font = "10px 'VT323', monospace";
  context.fillText(
    `${crateKindLabel(options.kind)} · ${options.tonnage}T`,
    centerX,
    plateY + plateHeight - 7,
  );

  if (options.active) {
    context.fillStyle = palette.hot;
    context.fillRect(x + 3, faceY + 3, 5, 8);
    context.fillRect(x + width - 8, faceY + 3, 5, 8);
    context.fillRect(x + 3, faceY + faceHeight - 10, 5, 7);
    context.fillRect(x + width - 8, faceY + faceHeight - 10, 5, 7);
  }

  context.restore();
}

function drawFoundation(
  context: CanvasRenderingContext2D,
  baseX: number,
  baseY: number,
): void {
  context.fillStyle = palette.shadow;
  context.fillRect(baseX - 132, baseY + 9, 264, 18);
  context.fillStyle = palette.dark;
  context.strokeStyle = palette.bright;
  context.lineWidth = 2;
  context.fillRect(baseX - 123, baseY - 10, 246, 25);
  context.strokeRect(baseX - 123, baseY - 10, 246, 25);

  context.save();
  context.beginPath();
  context.rect(baseX - 119, baseY - 6, 238, 17);
  context.clip();
  context.strokeStyle = palette.amber;
  context.lineWidth = 5;
  for (let x = baseX - 145; x < baseX + 150; x += 22) {
    context.beginPath();
    context.moveTo(x, baseY + 13);
    context.lineTo(x + 18, baseY - 8);
    context.stroke();
  }
  context.restore();
}

function towerVisualAngle(state: CraneRenderState): number {
  const collapseAngle = state.collapse
    ? state.collapse.direction * Math.min(1.18, state.collapse.elapsed * 0.74)
    : 0;
  return state.towerAngle + collapseAngle;
}

function drawTower(
  context: CanvasRenderingContext2D,
  state: CraneRenderState,
  baseX: number,
  baseY: number,
): void {
  if (state.crates.length === 0) return;
  const angle = towerVisualAngle(state);

  context.save();
  context.translate(baseX, baseY);
  context.rotate(angle);

  for (const crate of state.crates) {
    let tumbleX = 0;
    let tumbleY = 0;
    let tumbleRotation = 0;
    if (state.collapse) {
      const release = Math.max(0, state.collapse.elapsed - crate.id * 0.032);
      tumbleX = state.collapse.direction * release * release * (17 + crate.id * 2.5);
      tumbleY = release * release * (10 + crate.id * 0.9);
      tumbleRotation = state.collapse.direction * release * (0.055 + crate.id * 0.0035);
    }

    context.save();
    context.translate(crate.centerX + tumbleX, -crate.bottom - crate.height / 2 + tumbleY);
    context.rotate(tumbleRotation);
    drawContainer(context, 0, 0, crate.width, crate.height, {
      id: crate.id,
      kind: crate.kind,
      tonnage: crate.tonnage,
    });
    context.restore();
  }

  context.restore();
}

const GANTRY_LEFT_X = 20;
const GANTRY_RAIL_Y = 58;
const GANTRY_LEG_WIDTH = 22;

function craneEquipmentAccent(state: CraneRenderState): string {
  if (state.magLockArmed) return palette.cyan;
  if (state.wideLoadArmed) return palette.amber;
  return palette.phosphor;
}

function drawGantryLeg(
  context: CanvasRenderingContext2D,
  x: number,
  railY: number,
  mirrored: boolean,
): void {
  const legTop = railY + 12;
  const legHeight = CRANE_HEIGHT - legTop;
  const innerX = mirrored ? x - GANTRY_LEG_WIDTH : x;
  const braceDirection = mirrored ? -1 : 1;

  context.fillStyle = palette.shadow;
  context.fillRect(innerX + 6, legTop + 6, GANTRY_LEG_WIDTH, legHeight);

  context.fillStyle = palette.darkMid;
  context.strokeStyle = palette.phosphor;
  context.lineWidth = 2;
  context.fillRect(innerX, legTop, GANTRY_LEG_WIDTH, legHeight);
  context.strokeRect(innerX, legTop, GANTRY_LEG_WIDTH, legHeight);

  context.fillStyle = palette.deepest;
  context.fillRect(innerX + 5, legTop + 4, 4, legHeight - 8);
  context.fillRect(innerX + GANTRY_LEG_WIDTH - 9, legTop + 4, 4, legHeight - 8);

  context.save();
  context.beginPath();
  context.rect(innerX + 2, legTop + 2, GANTRY_LEG_WIDTH - 4, legHeight - 4);
  context.clip();
  context.strokeStyle = "rgba(216, 215, 116, 0.78)";
  context.lineWidth = 4;
  for (let y = legTop - 8; y < CRANE_HEIGHT + 24; y += 27) {
    context.beginPath();
    if (braceDirection > 0) {
      context.moveTo(innerX - 3, y + 25);
      context.lineTo(innerX + GANTRY_LEG_WIDTH + 3, y - 3);
    } else {
      context.moveTo(innerX + GANTRY_LEG_WIDTH + 3, y + 25);
      context.lineTo(innerX - 3, y - 3);
    }
    context.stroke();
  }
  context.restore();

  context.fillStyle = palette.bright;
  context.fillRect(innerX - 4, legTop - 2, GANTRY_LEG_WIDTH + 8, 5);
  context.fillStyle = palette.deepest;
  context.fillRect(innerX - 5, CRANE_HEIGHT - 15, GANTRY_LEG_WIDTH + 10, 10);
  context.strokeStyle = palette.bright;
  context.strokeRect(innerX - 5, CRANE_HEIGHT - 15, GANTRY_LEG_WIDTH + 10, 10);
}

function drawBridgeTruss(
  context: CanvasRenderingContext2D,
  state: CraneRenderState,
  rig: RigAnimation,
): void {
  const bridgeLeft = 12;
  const bridgeRight = CRANE_WIDTH - 12;
  const bridgeWidth = bridgeRight - bridgeLeft;
  const upperY = 27;
  const lowerY = GANTRY_RAIL_Y + 9;
  const lowerTop = lowerY - 10;
  const lowerHeight = 13;

  context.fillStyle = palette.shadow;
  context.fillRect(bridgeLeft + 6, upperY + 7, bridgeWidth, lowerY - upperY + 9);

  context.fillStyle = palette.dark;
  context.strokeStyle = palette.phosphor;
  context.lineWidth = 2;
  context.fillRect(bridgeLeft, upperY, bridgeWidth, 10);
  context.strokeRect(bridgeLeft, upperY, bridgeWidth, 10);

  const beamPoints: Array<{ x: number; sag: number }> = [];
  for (let x = bridgeLeft; x < bridgeRight; x += 18) {
    beamPoints.push({ x, sag: bridgeSagAt(x, state.trolleyX, rig.beamSag) });
  }
  beamPoints.push({
    x: bridgeRight,
    sag: bridgeSagAt(bridgeRight, state.trolleyX, rig.beamSag),
  });

  context.beginPath();
  context.moveTo(beamPoints[0]!.x, lowerTop + beamPoints[0]!.sag);
  for (const point of beamPoints.slice(1)) {
    context.lineTo(point.x, lowerTop + point.sag);
  }
  for (const point of [...beamPoints].reverse()) {
    context.lineTo(point.x, lowerTop + lowerHeight + point.sag);
  }
  context.closePath();
  context.fill();
  context.stroke();

  context.strokeStyle = "rgba(118, 173, 104, 0.72)";
  context.lineWidth = 3;
  const bayWidth = 43;
  for (let x = bridgeLeft + 8, bay = 0; x < bridgeRight - 8; x += bayWidth, bay += 1) {
    const nextX = Math.min(bridgeRight - 8, x + bayWidth);
    const lowerAtX = lowerTop + bridgeSagAt(x, state.trolleyX, rig.beamSag);
    const lowerAtNext = lowerTop + bridgeSagAt(nextX, state.trolleyX, rig.beamSag);
    context.beginPath();
    if (bay % 2 === 0) {
      context.moveTo(x, upperY + 9);
      context.lineTo(nextX, lowerAtNext);
    } else {
      context.moveTo(x, lowerAtX);
      context.lineTo(nextX, upperY + 9);
    }
    context.stroke();
  }

  context.fillStyle = palette.bright;
  context.fillRect(bridgeLeft + 2, upperY + 2, bridgeWidth - 4, 3);
  context.strokeStyle = palette.deepest;
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(beamPoints[0]!.x + 2, lowerTop + 5 + beamPoints[0]!.sag);
  for (const point of beamPoints.slice(1, -1)) {
    context.lineTo(point.x, lowerTop + 5 + point.sag);
  }
  const finalPoint = beamPoints[beamPoints.length - 1]!;
  context.lineTo(finalPoint.x - 2, lowerTop + 5 + finalPoint.sag);
  context.stroke();

  context.strokeStyle = "rgba(199, 240, 139, 0.46)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(bridgeLeft + 5, upperY - 5);
  context.lineTo(bridgeRight - 5, upperY - 5);
  context.stroke();
  for (let x = bridgeLeft + 10; x < bridgeRight; x += 36) {
    context.fillStyle = palette.darkMid;
    context.fillRect(x, upperY - 10, 3, 7);
  }

  const beaconOn = state.reducedMotion || Math.floor(state.time / 560) % 2 === 0;
  if (beaconOn) {
    context.fillStyle = state.magLockArmed ? palette.cyan : palette.amber;
    context.fillRect(bridgeRight - 25, upperY - 13, 6, 6);
  }
}

function drawTrolleyWheel(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  rotation: number,
  accent: string,
): void {
  context.fillStyle = palette.deepest;
  context.beginPath();
  context.arc(x, y, 7, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = accent;
  context.lineWidth = 1.5;
  context.stroke();

  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.strokeStyle = "rgba(239, 255, 201, 0.72)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(-4, 0);
  context.lineTo(4, 0);
  context.moveTo(0, -4);
  context.lineTo(0, 4);
  context.stroke();
  context.restore();
}

function drawTrolley(
  context: CanvasRenderingContext2D,
  state: CraneRenderState,
  rig: RigAnimation,
): void {
  const x = Math.round(state.trolleyX + rig.trolleyShakeX);
  const accent = craneEquipmentAccent(state);
  const railDeflection = bridgeSagAt(state.trolleyX, state.trolleyX, rig.beamSag);
  const offsetY = railDeflection + rig.trolleyOffsetY;
  const wheelY = GANTRY_RAIL_Y + 6 + offsetY;
  const bodyY = GANTRY_RAIL_Y - 17 + offsetY;
  const wheelRotation = state.reducedMotion ? 0 : state.trolleyX * 0.065;

  context.fillStyle = palette.shadow;
  context.fillRect(x - 31, bodyY + 8, 68, 39);

  drawTrolleyWheel(context, x - 23, wheelY, wheelRotation, accent);
  drawTrolleyWheel(context, x + 23, wheelY, wheelRotation, accent);

  context.fillStyle = state.magLockArmed
    ? "#245d58"
    : state.wideLoadArmed
      ? "#625e31"
      : palette.mid;
  context.strokeStyle = accent;
  context.lineWidth = 2;
  context.fillRect(x - 30, bodyY, 60, 30);
  context.strokeRect(x - 30, bodyY, 60, 30);

  context.fillStyle = palette.dark;
  context.fillRect(x - 18, bodyY - 10, 36, 12);
  context.strokeStyle = "rgba(199, 240, 139, 0.7)";
  context.strokeRect(x - 18, bodyY - 10, 36, 12);

  context.fillStyle = palette.deepest;
  context.fillRect(x - 22, bodyY + 6, 15, 14);
  context.strokeStyle = "rgba(199, 240, 139, 0.48)";
  context.strokeRect(x - 22, bodyY + 6, 15, 14);
  for (let grilleX = x - 19; grilleX <= x - 10; grilleX += 4) {
    context.fillStyle = "rgba(118, 173, 104, 0.62)";
    context.fillRect(grilleX, bodyY + 8, 1, 10);
  }

  context.fillStyle = palette.deepest;
  context.fillRect(x + 7, bodyY + 5, 16, 16);
  context.strokeStyle = accent;
  context.strokeRect(x + 7, bodyY + 5, 16, 16);
  context.beginPath();
  context.arc(x + 15, bodyY + 13, 5, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = state.magLockArmed ? palette.hot : accent;
  context.font = "10px 'VT323', monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(state.magLockArmed ? "MAG" : rig.warningBeacon ? "HEAVY" : "HOIST", x, bodyY + 25);

  const pulse = state.reducedMotion ? 1 : 0.45 + Math.sin(state.time * 0.012) * 0.35;
  context.fillStyle = state.magLockArmed
    ? `rgba(118, 217, 189, ${clamp(pulse, 0.22, 0.9)})`
    : "rgba(216, 215, 116, 0.62)";
  context.fillRect(x + 23, bodyY - 7, 4, 5);

  if (rig.warningBeacon) {
    const beaconOn = state.reducedMotion || Math.floor(state.time / 180) % 2 === 0;
    context.fillStyle = palette.deepest;
    context.fillRect(x - 7, bodyY - 17, 14, 4);
    context.strokeStyle = palette.amber;
    context.strokeRect(x - 7, bodyY - 17, 14, 4);
    if (beaconOn) {
      context.fillStyle = "rgba(216, 215, 116, 0.2)";
      context.beginPath();
      context.arc(x, bodyY - 20, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = palette.amber;
      context.fillRect(x - 4, bodyY - 25, 8, 8);
      context.fillStyle = palette.hot;
      context.fillRect(x - 1, bodyY - 24, 2, 4);
    }

    if (!state.reducedMotion) {
      context.strokeStyle = "rgba(216, 215, 116, 0.65)";
      context.lineWidth = 1;
      for (const side of [-1, 1] as const) {
        context.beginPath();
        context.moveTo(x + side * 34, bodyY + 4);
        context.lineTo(x + side * 39, bodyY + 1);
        context.moveTo(x + side * 34, bodyY + 12);
        context.lineTo(x + side * 40, bodyY + 12);
        context.stroke();
      }
    }
  }

  const undercarriageY = GANTRY_RAIL_Y + 10 + offsetY + rig.trolleyOffsetY * 0.35;
  context.fillStyle = palette.deepest;
  context.fillRect(x - 12, undercarriageY, 24, 10);
  context.strokeStyle = accent;
  context.strokeRect(x - 12, undercarriageY, 24, 10);
  context.beginPath();
  context.arc(x - 5, undercarriageY + 5, 3, 0, Math.PI * 2);
  context.arc(x + 5, undercarriageY + 5, 3, 0, Math.PI * 2);
  context.stroke();
}

function drawMastAndRail(
  context: CanvasRenderingContext2D,
  state: CraneRenderState,
  rig: RigAnimation,
): void {
  drawGantryLeg(context, GANTRY_LEFT_X, GANTRY_RAIL_Y, false);
  drawBridgeTruss(context, state, rig);
  drawTrolley(context, state, rig);

  const tickOffset = state.cameraOffset % 96;
  for (let y = 126 + tickOffset; y < CRANE_HEIGHT - 28; y += 96) {
    context.fillStyle = "rgba(199, 240, 139, 0.44)";
    context.fillRect(GANTRY_LEFT_X + GANTRY_LEG_WIDTH + 4, Math.round(y), 12, 2);
  }
}

function topSupport(state: CraneRenderState): {
  centerX: number;
  width: number;
  centerY: number;
  top: number;
} {
  const top = state.crates[state.crates.length - 1];
  if (!top) {
    return { centerX: 0, width: 230, centerY: 0, top: 0 };
  }
  return {
    centerX: top.centerX,
    width: top.width,
    centerY: top.bottom + top.height / 2,
    top: top.bottom + top.height,
  };
}

function drawCornerBrackets(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  length: number,
): void {
  const left = x - width / 2;
  const right = x + width / 2;
  const top = y - height / 2;
  const bottom = y + height / 2;
  context.beginPath();
  context.moveTo(left, top + length);
  context.lineTo(left, top);
  context.lineTo(left + length, top);
  context.moveTo(right - length, top);
  context.lineTo(right, top);
  context.lineTo(right, top + length);
  context.moveTo(left, bottom - length);
  context.lineTo(left, bottom);
  context.lineTo(left + length, bottom);
  context.moveTo(right - length, bottom);
  context.lineTo(right, bottom);
  context.lineTo(right, bottom - length);
  context.stroke();
}

function drawMagLockTarget(
  context: CanvasRenderingContext2D,
  state: CraneRenderState,
  baseX: number,
  baseY: number,
): void {
  if (!state.magLockArmed) return;
  const crate = state.hanging ?? state.falling;
  if (!crate) return;

  const support = topSupport(state);
  const cosine = Math.cos(state.towerAngle);
  const sine = Math.sin(state.towerAngle);
  const supportVisualX = support.centerX * cosine + support.centerY * sine;
  const targetX = baseX + supportVisualX;
  const targetY = baseY - support.top - crate.height / 2;
  const pulse = state.reducedMotion ? 0.5 : (Math.sin(state.time * 0.009) + 1) / 2;

  context.save();
  context.strokeStyle = `rgba(118, 217, 189, ${0.58 + pulse * 0.3})`;
  context.lineWidth = 2 + pulse;
  drawCornerBrackets(
    context,
    targetX,
    targetY,
    crate.width + 14 + pulse * 8,
    crate.height + 14 + pulse * 5,
    16,
  );

  context.strokeStyle = `rgba(118, 217, 189, ${0.16 + pulse * 0.14})`;
  context.lineWidth = 1;
  for (let offset = -2; offset <= 2; offset += 1) {
    context.beginPath();
    context.moveTo(targetX + offset * 13, targetY - crate.height / 2 - 16);
    context.lineTo(targetX + offset * 9, targetY + crate.height / 2 + 16);
    context.stroke();
  }

  const crateScreenX = baseX + crate.x;
  const crateScreenY = baseY - crate.y;
  if (state.falling) {
    context.strokeStyle = `rgba(118, 217, 189, ${0.28 + pulse * 0.24})`;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(crateScreenX, crateScreenY);
    context.lineTo(targetX, targetY);
    context.stroke();

    const attraction = state.reducedMotion ? 0.5 : (state.time * 0.0017) % 1;
    const particleX = crateScreenX + (targetX - crateScreenX) * attraction;
    const particleY = crateScreenY + (targetY - crateScreenY) * attraction;
    context.fillStyle = palette.hot;
    context.fillRect(particleX - 2, particleY - 2, 4, 4);
  }
  context.restore();
}

function drawHoistCable(
  context: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  accent: string,
  thickness: number,
): void {
  context.strokeStyle = "rgba(1, 6, 4, 0.86)";
  context.lineWidth = thickness + 3.5;
  context.beginPath();
  context.moveTo(startX, startY);
  context.lineTo(endX, endY);
  context.stroke();

  context.strokeStyle = accent;
  context.lineWidth = thickness;
  context.beginPath();
  context.moveTo(startX, startY);
  context.lineTo(endX, endY);
  context.stroke();

  context.strokeStyle = "rgba(239, 255, 201, 0.34)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(startX - 1, startY);
  context.lineTo(endX - 1, endY);
  context.stroke();
}

function drawHookBlock(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  accent: string,
  state: CraneRenderState,
): void {
  const blockWidth = 30;
  const blockHeight = 20;

  context.fillStyle = palette.shadow;
  context.fillRect(x - blockWidth / 2 + 5, y - blockHeight / 2 + 5, blockWidth, blockHeight);
  context.fillStyle = palette.darkMid;
  context.strokeStyle = accent;
  context.lineWidth = 2;
  context.fillRect(x - blockWidth / 2, y - blockHeight / 2, blockWidth, blockHeight);
  context.strokeRect(x - blockWidth / 2, y - blockHeight / 2, blockWidth, blockHeight);

  const pulleyRotation = state.reducedMotion ? 0 : state.time * 0.006;
  for (const pulleyX of [x - 8, x + 8]) {
    context.fillStyle = palette.deepest;
    context.beginPath();
    context.arc(pulleyX, y, 5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(239, 255, 201, 0.72)";
    context.lineWidth = 1;
    context.stroke();

    context.save();
    context.translate(pulleyX, y);
    context.rotate(pulleyRotation);
    context.strokeStyle = accent;
    context.beginPath();
    context.moveTo(-3, 0);
    context.lineTo(3, 0);
    context.moveTo(0, -3);
    context.lineTo(0, 3);
    context.stroke();
    context.restore();
  }

  context.fillStyle = state.magLockArmed ? palette.hot : accent;
  context.fillRect(x - 3, y + blockHeight / 2, 6, 8);
}

function drawSpreader(
  context: CanvasRenderingContext2D,
  state: CraneRenderState,
  centerX: number,
  spreaderY: number,
  crateTopY: number,
  crateWidth: number,
  crateKind: CrateKind,
  extensionProgress: number,
): void {
  const accent = craneEquipmentAccent(state);
  const targetWidth = Math.max(88, crateWidth - (crateKind === "heavy" ? 8 : 18));
  const collapsedWidth = Math.min(targetWidth, 122);
  const spreaderWidth =
    crateKind === "long"
      ? collapsedWidth + (targetWidth - collapsedWidth) * extensionProgress
      : targetWidth;
  const left = centerX - spreaderWidth / 2;
  const right = centerX + spreaderWidth / 2;
  const barHeight = crateKind === "heavy" ? 15 : 12;
  const pulse = state.reducedMotion ? 0.55 : (Math.sin(state.time * 0.012) + 1) / 2;

  if (state.magLockArmed) {
    context.strokeStyle = `rgba(118, 217, 189, ${0.2 + pulse * 0.28})`;
    context.lineWidth = 2;
    context.strokeRect(
      left - 6 - pulse * 2,
      spreaderY - 8 - pulse,
      spreaderWidth + 12 + pulse * 4,
      28 + pulse * 2,
    );
  }

  context.fillStyle = palette.shadow;
  context.fillRect(left + 5, spreaderY - barHeight / 2 + 5, spreaderWidth, barHeight + 4);

  context.fillStyle = state.magLockArmed
    ? "#245d58"
    : state.wideLoadArmed
      ? "#625e31"
      : crateKind === "heavy"
        ? "#174039"
        : palette.darkMid;
  context.strokeStyle = accent;
  context.lineWidth = crateKind === "heavy" ? 2.5 : 2;
  context.fillRect(left, spreaderY - barHeight / 2, spreaderWidth, barHeight);
  context.strokeRect(left, spreaderY - barHeight / 2, spreaderWidth, barHeight);

  context.fillStyle = palette.deepest;
  context.fillRect(left + 5, spreaderY - 2, spreaderWidth - 10, 4);

  if (crateKind === "long") {
    const bodyWidth = Math.min(100, spreaderWidth - 20);
    context.fillStyle = "rgba(216, 215, 116, 0.18)";
    context.fillRect(centerX - bodyWidth / 2, spreaderY - 5, bodyWidth, 10);
    context.strokeStyle = palette.amber;
    context.lineWidth = 1;
    context.strokeRect(centerX - bodyWidth / 2, spreaderY - 5, bodyWidth, 10);
    context.fillStyle = palette.dark;
    context.fillRect(left + 6, spreaderY - 4, Math.max(0, (spreaderWidth - bodyWidth) / 2 - 8), 8);
    context.fillRect(
      centerX + bodyWidth / 2 + 2,
      spreaderY - 4,
      Math.max(0, (spreaderWidth - bodyWidth) / 2 - 8),
      8,
    );
    context.fillStyle = palette.amber;
    context.fillRect(left - 4, spreaderY - 9, 8, 18);
    context.fillRect(right - 4, spreaderY - 9, 8, 18);
  } else {
    context.strokeStyle = "rgba(239, 255, 201, 0.45)";
    context.lineWidth = 1;
    for (let x = left + 12, bay = 0; x < right - 10; x += 20, bay += 1) {
      context.beginPath();
      if (bay % 2 === 0) {
        context.moveTo(x - 7, spreaderY - 5);
        context.lineTo(x + 7, spreaderY + 5);
      } else {
        context.moveTo(x - 7, spreaderY + 5);
        context.lineTo(x + 7, spreaderY - 5);
      }
      context.stroke();
    }
    context.fillStyle = accent;
    context.fillRect(left - 4, spreaderY - 8, 8, 16);
    context.fillRect(right - 4, spreaderY - 8, 8, 16);
  }

  if (crateKind === "heavy") {
    context.strokeStyle = palette.cyan;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(left + 10, spreaderY - barHeight / 2);
    context.lineTo(left + 24, spreaderY - barHeight / 2 - 7);
    context.lineTo(right - 24, spreaderY - barHeight / 2 - 7);
    context.lineTo(right - 10, spreaderY - barHeight / 2);
    context.stroke();
  }

  const crateLeft = centerX - crateWidth / 2;
  const crateRight = centerX + crateWidth / 2;
  const targetLockXs = [
    crateLeft + 14,
    centerX - crateWidth * 0.17,
    centerX + crateWidth * 0.17,
    crateRight - 14,
  ];
  const sourceLockXs = [
    left + Math.min(18, spreaderWidth * 0.1),
    centerX - spreaderWidth * 0.17,
    centerX + spreaderWidth * 0.17,
    right - Math.min(18, spreaderWidth * 0.1),
  ];

  for (let index = 0; index < targetLockXs.length; index += 1) {
    const sourceX = sourceLockXs[index]!;
    const targetX = targetLockXs[index]!;
    context.strokeStyle = state.magLockArmed ? palette.cyan : palette.phosphor;
    context.lineWidth = state.magLockArmed || crateKind === "heavy" ? 2 : 1.5;
    context.beginPath();
    context.moveTo(sourceX, spreaderY + barHeight / 2);
    context.lineTo(targetX, crateTopY + 3);
    context.stroke();

    context.fillStyle = palette.deepest;
    context.fillRect(targetX - 4, crateTopY, 8, 6);
    context.strokeStyle = state.magLockArmed ? palette.hot : accent;
    context.strokeRect(targetX - 4, crateTopY, 8, 6);

    if (state.magLockArmed) {
      context.fillStyle = `rgba(118, 217, 189, ${0.48 + pulse * 0.45})`;
      context.fillRect(targetX - 2, crateTopY + 2, 4, 2);
    }
  }

  const label = state.magLockArmed
    ? "LOCKED"
    : crateKind === "long"
      ? "TELE"
      : crateKind === "heavy"
        ? "HEAVY"
        : "SPREADER";
  context.fillStyle = state.magLockArmed ? palette.hot : accent;
  context.font = "9px 'VT323', monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, centerX, spreaderY + 1);
}

function drawCraneLoad(
  context: CanvasRenderingContext2D,
  state: CraneRenderState,
  baseX: number,
  baseY: number,
  rig: RigAnimation,
): void {
  const crate = state.hanging ?? state.falling;
  if (!crate) return;
  const crateScreenX = crate.x + baseX;
  const crateScreenY = baseY - crate.y + (state.hanging ? rig.loadLiftOffset : 0);

  if (state.hanging) {
    const accent = craneEquipmentAccent(state);
    const crateTopY = crateScreenY - crate.height / 2;
    const spreaderY = crateTopY - 16;
    const hookY = spreaderY - 29 + rig.hookJitterY;
    const hookX = crateScreenX + rig.hookJitterX;
    const cableStartY =
      GANTRY_RAIL_Y +
      21 +
      bridgeSagAt(state.trolleyX, state.trolleyX, rig.beamSag) +
      rig.trolleyOffsetY;

    drawHoistCable(
      context,
      state.cableAnchorX - rig.cableSeparation + rig.trolleyShakeX,
      cableStartY,
      hookX - 8,
      hookY - 8,
      accent,
      rig.cableThickness,
    );
    drawHoistCable(
      context,
      state.cableAnchorX + rig.cableSeparation + rig.trolleyShakeX,
      cableStartY,
      hookX + 8,
      hookY - 8,
      accent,
      rig.cableThickness,
    );

    drawHookBlock(context, hookX, hookY, accent, state);

    const targetSpreaderWidth = Math.max(
      88,
      crate.width - (crate.kind === "heavy" ? 8 : 18),
    );
    const collapsedSpreaderWidth = Math.min(targetSpreaderWidth, 122);
    const currentSpreaderWidth =
      crate.kind === "long"
        ? collapsedSpreaderWidth +
          (targetSpreaderWidth - collapsedSpreaderWidth) * rig.spreaderExtension
        : targetSpreaderWidth;
    const spreaderHalf = Math.max(38, currentSpreaderWidth * 0.31);
    const cosine = Math.cos(rig.loadRotation);
    const sine = Math.sin(rig.loadRotation);
    const transformPoint = (x: number, y: number): { x: number; y: number } => ({
      x: crateScreenX + x * cosine - y * sine,
      y: crateScreenY + x * sine + y * cosine,
    });
    const spreaderLocalY = spreaderY - crateScreenY;
    const leftBrace = transformPoint(-spreaderHalf, spreaderLocalY - 7);
    const rightBrace = transformPoint(spreaderHalf, spreaderLocalY - 7);

    context.strokeStyle = "rgba(1, 6, 4, 0.82)";
    context.lineWidth = crate.kind === "heavy" ? 7 : 5;
    context.beginPath();
    context.moveTo(hookX - 4, hookY + 12);
    context.lineTo(leftBrace.x, leftBrace.y);
    context.moveTo(hookX + 4, hookY + 12);
    context.lineTo(rightBrace.x, rightBrace.y);
    context.stroke();

    context.strokeStyle = accent;
    context.lineWidth = crate.kind === "heavy" ? 3 : 2;
    context.beginPath();
    context.moveTo(hookX - 4, hookY + 12);
    context.lineTo(leftBrace.x, leftBrace.y);
    context.moveTo(hookX + 4, hookY + 12);
    context.lineTo(rightBrace.x, rightBrace.y);
    context.stroke();

    context.save();
    context.translate(crateScreenX, crateScreenY);
    context.rotate(rig.loadRotation);
    drawSpreader(
      context,
      state,
      0,
      spreaderLocalY,
      -crate.height / 2,
      crate.width,
      crate.kind,
      rig.spreaderExtension,
    );
    drawContainer(context, 0, 0, crate.width, crate.height, {
      id: state.score + 1,
      kind: crate.kind,
      tonnage: crate.tonnage,
      active: true,
    });
    context.restore();

    if (!state.reducedMotion && crate.kind === "heavy") {
      const vibration = 5 + Math.abs(Math.sin(state.time * 0.035)) * 3;
      context.strokeStyle = "rgba(118, 217, 189, 0.55)";
      context.lineWidth = 1;
      for (const side of [-1, 1] as const) {
        const edgeX = crateScreenX + side * (crate.width / 2 + 9);
        context.beginPath();
        context.moveTo(edgeX, crateScreenY - vibration);
        context.lineTo(edgeX + side * 4, crateScreenY - 2);
        context.moveTo(edgeX, crateScreenY + 4);
        context.lineTo(edgeX + side * 4, crateScreenY + vibration + 5);
        context.stroke();
      }
    }
    return;
  }

  drawContainer(context, crateScreenX, crateScreenY, crate.width, crate.height, {
    id: state.score + 1,
    kind: crate.kind,
    tonnage: crate.tonnage,
    active: true,
  });
}

function worldPointToScreen(
  baseX: number,
  baseY: number,
  x: number,
  height: number,
  angle: number,
): { x: number; y: number } {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: baseX + x * cosine + height * sine,
    y: baseY + x * sine - height * cosine,
  };
}

function feedbackAccent(kind: LandingFeedbackVisual["kind"]): string {
  if (kind === "mag-lock") return palette.cyan;
  if (kind === "perfect") return palette.hot;
  if (kind === "risky") return palette.amber;
  return palette.phosphor;
}

function drawLandingFeedback(
  context: CanvasRenderingContext2D,
  state: CraneRenderState,
  baseX: number,
  baseY: number,
): void {
  const feedback = state.landingFeedback;
  if (!feedback) return;
  const progress = clamp(feedback.elapsed / 1.25, 0, 1);
  const alpha = 1 - progress;
  const point = worldPointToScreen(
    baseX,
    baseY,
    feedback.centerX,
    feedback.height,
    state.towerAngle,
  );
  const accent = feedbackAccent(feedback.kind);
  const labelY = point.y - 22 - progress * 24;

  context.save();
  context.globalAlpha = alpha;
  context.strokeStyle = accent;
  context.lineWidth = 2;
  const burst = 10 + progress * 15;
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    context.beginPath();
    context.moveTo(point.x + dx * 4, point.y + dy * 3);
    context.lineTo(point.x + dx * burst, point.y + dy * burst * 0.55);
    context.stroke();
  }

  const width = Math.max(78, feedback.label.length * 10 + 22);
  context.fillStyle = "rgba(3, 13, 8, 0.9)";
  context.fillRect(point.x - width / 2, labelY - 14, width, 27);
  context.strokeStyle = accent;
  context.strokeRect(point.x - width / 2, labelY - 14, width, 27);
  context.fillStyle = accent;
  context.font = "17px 'VT323', monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(feedback.label, point.x, labelY);
  context.restore();
}

function drawLoadManifest(
  context: CanvasRenderingContext2D,
  state: CraneRenderState,
): void {
  const crate = state.hanging ?? state.falling;
  if (!crate) return;
  const x = CRANE_WIDTH - 178;
  const y = 82;
  const width = 150;
  const height = 48;
  const accent = state.magLockArmed ? palette.cyan : kindAccent[crate.kind];

  context.fillStyle = "rgba(3, 13, 8, 0.84)";
  context.fillRect(x, y, width, height);
  context.strokeStyle = accent;
  context.lineWidth = state.magLockArmed ? 2 : 1;
  context.strokeRect(x, y, width, height);
  context.fillStyle = state.magLockArmed ? palette.hot : palette.phosphor;
  context.font = "15px 'VT323', monospace";
  context.textAlign = "left";
  context.textBaseline = "middle";
  const manifestTitle = state.magLockArmed
    ? "MAG-LOCK"
    : state.wideLoadArmed
      ? "WIDE LOAD"
      : "NEXT LOAD";
  context.fillText(
    `${manifestTitle} ${String(state.score + 1).padStart(3, "0")}`,
    x + 10,
    y + 15,
  );
  context.fillStyle = accent;
  context.font = "13px 'VT323', monospace";
  context.fillText(
    `${crateKindLabel(crate.kind)} · ${crate.tonnage}T`,
    x + 10,
    y + 34,
  );
}

function drawHud(
  context: CanvasRenderingContext2D,
  state: CraneRenderState,
): void {
  drawLoadManifest(context, state);

  if (state.perfectStreak > 0) {
    context.fillStyle = "rgba(3, 13, 8, 0.82)";
    context.fillRect(55, 82, 113, 27);
    context.strokeStyle = "rgba(199, 240, 139, 0.48)";
    context.strokeRect(55, 82, 113, 27);
    context.fillStyle = palette.hot;
    context.font = "17px 'VT323', monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(`PERFECT ×${state.perfectStreak}`, 111, 96);
  }

  const danger = Math.abs(state.towerAngle) / 0.22;
  if (danger > 0.65) {
    context.fillStyle = `rgba(216, 215, 116, ${clamp((danger - 0.65) * 1.6, 0.1, 0.65)})`;
    context.fillRect(0, 0, CRANE_WIDTH, 5);
    context.fillRect(0, CRANE_HEIGHT - 5, CRANE_WIDTH, 5);
    context.fillRect(0, 0, 5, CRANE_HEIGHT);
    context.fillRect(CRANE_WIDTH - 5, 0, 5, CRANE_HEIGHT);
  }

  if (state.stabilizerPulse > 0) {
    context.strokeStyle = `rgba(239, 255, 201, ${Math.min(0.8, state.stabilizerPulse)})`;
    context.lineWidth = 4;
    context.strokeRect(9, 9, CRANE_WIDTH - 18, CRANE_HEIGHT - 18);
  }
}

export function createCraneRenderer(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
): {
  configure: () => void;
  draw: (state: CraneRenderState) => void;
} {
  return {
    configure: () => {
      configureFixedCanvas(canvas, context, CRANE_WIDTH, CRANE_HEIGHT);
      context.imageSmoothingEnabled = false;
    },
    draw: (state) => {
      drawBackground(context, state);
      const baseX = CRANE_TOWER_X;
      const baseY = CRANE_BASE_Y + state.cameraOffset;
      const rig = activeRigAnimation(state);
      drawFoundation(context, baseX, baseY);
      drawTower(context, state, baseX, baseY);
      drawMagLockTarget(context, state, baseX, baseY);
      drawHud(context, state);
      drawMastAndRail(context, state, rig);
      drawCraneLoad(context, state, baseX, baseY, rig);
      drawLandingFeedback(context, state, baseX, baseY);
    },
  };
}
