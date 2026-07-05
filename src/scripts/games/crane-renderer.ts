import type { CrateSpec, PlacedCrate, WindState } from "./crane-rules";
import { configureFixedCanvas } from "./shared/canvas";

export const CRANE_WIDTH = 560;
export const CRANE_HEIGHT = 720;
export const CRANE_TOWER_X = 304;
export const CRANE_BASE_Y = 680;
export const CRANE_HANGING_Y = 178;
export const CRANE_CAMERA_THRESHOLD = 318;

interface FallingCrate extends CrateSpec {
  x: number;
  y: number;
}

interface CollapseVisual {
  elapsed: number;
  direction: -1 | 1;
}

export interface CraneRenderState {
  crates: readonly PlacedCrate[];
  hanging: FallingCrate | null;
  falling: FallingCrate | null;
  towerAngle: number;
  restLean: number;
  cameraOffset: number;
  trolleyX: number;
  cableAnchorX: number;
  wind: WindState;
  score: number;
  perfectStreak: number;
  magLockArmed: boolean;
  wideLoadArmed: boolean;
  windbreakDrops: number;
  stabilizerPulse: number;
  collapse: CollapseVisual | null;
  time: number;
  reducedMotion: boolean;
}

const palette = {
  skyTop: "#06130e",
  skyBottom: "#123321",
  skylineBack: "#10291c",
  skylineFront: "#173a25",
  ground: "#0d2418",
  shadow: "rgba(0, 0, 0, 0.62)",
  deepest: "#07120c",
  dark: "#10261a",
  darkMid: "#1b3b27",
  mid: "#2c5d3a",
  bright: "#76ad68",
  phosphor: "#c7f08b",
  hot: "#efffc9",
  amber: "#d8d774",
  cyan: "#76d9bd",
};

const containerFills = [
  "#244a30",
  "#2f5b38",
  "#1f4430",
  "#38663d",
  "#28523b",
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function drawCloud(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
): void {
  context.save();
  context.globalAlpha = 0.09;
  context.fillStyle = palette.phosphor;
  context.fillRect(x, y, 58 * scale, 8 * scale);
  context.fillRect(x + 10 * scale, y - 7 * scale, 42 * scale, 8 * scale);
  context.fillRect(x + 20 * scale, y - 13 * scale, 22 * scale, 7 * scale);
  context.restore();
}

function drawSkyline(context: CanvasRenderingContext2D): void {
  const backBuildings = [
    [8, 582, 36, 94],
    [50, 608, 30, 68],
    [87, 560, 44, 116],
    [139, 596, 34, 80],
    [181, 548, 48, 128],
    [239, 601, 36, 75],
    [282, 570, 45, 106],
    [338, 611, 33, 65],
    [378, 548, 51, 128],
    [440, 592, 39, 84],
    [487, 558, 52, 118],
  ] as const;

  context.fillStyle = palette.skylineBack;
  for (const [x, y, width, height] of backBuildings) {
    context.fillRect(x, y, width, height);
    context.fillRect(x + Math.floor(width * 0.42), y - 9, 4, 9);
  }

  const frontBuildings = [
    [0, 626, 68, 54],
    [73, 599, 52, 81],
    [131, 633, 69, 47],
    [205, 610, 58, 70],
    [270, 637, 72, 43],
    [349, 604, 64, 76],
    [420, 630, 61, 50],
    [487, 612, 73, 68],
  ] as const;

  context.fillStyle = palette.skylineFront;
  for (const [x, y, width, height] of frontBuildings) {
    context.fillRect(x, y, width, height);
  }

  context.fillStyle = "rgba(199, 240, 139, 0.2)";
  for (let x = 18; x < CRANE_WIDTH; x += 31) {
    for (let y = 625; y < 672; y += 17) {
      if ((x + y) % 3 !== 0) context.fillRect(x, y, 3, 5);
    }
  }

  context.strokeStyle = palette.skylineFront;
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(444, 592);
  context.lineTo(444, 524);
  context.lineTo(516, 524);
  context.moveTo(484, 524);
  context.lineTo(484, 579);
  context.stroke();
}

function drawBackground(
  context: CanvasRenderingContext2D,
  state: CraneRenderState,
): void {
  const gradient = context.createLinearGradient(0, 0, 0, CRANE_HEIGHT);
  gradient.addColorStop(0, palette.skyTop);
  gradient.addColorStop(0.65, palette.skyBottom);
  gradient.addColorStop(1, palette.ground);
  context.fillStyle = gradient;
  context.fillRect(0, 0, CRANE_WIDTH, CRANE_HEIGHT);

  context.fillStyle = "rgba(216, 215, 116, 0.14)";
  context.beginPath();
  context.arc(496, 116, 28, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(239, 255, 201, 0.12)";
  context.beginPath();
  context.arc(496, 116, 19, 0, Math.PI * 2);
  context.fill();

  drawCloud(context, 62, 113, 1.25);
  drawCloud(context, 330, 172, 0.9);
  drawCloud(context, 419, 78, 0.72);
  drawSkyline(context);

  context.fillStyle = palette.ground;
  context.fillRect(0, 676, CRANE_WIDTH, 44);
  context.fillStyle = "rgba(118, 173, 104, 0.2)";
  context.fillRect(0, 676, CRANE_WIDTH, 3);

  if (state.wind.strength > 0) {
    const direction = state.wind.direction || 1;
    context.strokeStyle = `rgba(199, 240, 139, ${0.08 + state.wind.strength * 0.025})`;
    context.lineWidth = 2;
    for (let index = 0; index < 6; index += 1) {
      const travel = (state.time * (0.028 + state.wind.strength * 0.008) + index * 103) % 690;
      const x = direction > 0 ? travel - 80 : CRANE_WIDTH - travel + 80;
      const y = 140 + ((index * 71) % 330);
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + direction * (24 + state.wind.strength * 7), y);
      context.lineTo(x + direction * (30 + state.wind.strength * 7), y - 3);
      context.stroke();
    }
  }

  context.fillStyle = "rgba(0, 0, 0, 0.08)";
  for (let y = 0; y < CRANE_HEIGHT; y += 4) {
    context.fillRect(0, y, CRANE_WIDTH, 1);
  }
}

function drawContainer(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  options: {
    id?: number;
    active?: boolean;
    perfect?: boolean;
    alpha?: number;
    label?: string;
  } = {},
): void {
  const x = Math.round(centerX - width / 2);
  const y = Math.round(centerY - height / 2);
  const depth = Math.max(5, Math.round(height * 0.12));
  const frame = options.active ? palette.phosphor : palette.bright;
  const fill = options.active
    ? "#2c6f50"
    : containerFills[Math.abs(options.id ?? 0) % containerFills.length] ?? palette.darkMid;

  context.save();
  context.globalAlpha = options.alpha ?? 1;

  context.fillStyle = palette.shadow;
  context.fillRect(x + 7, y + 8, width + depth, height + 2);

  context.fillStyle = palette.deepest;
  context.beginPath();
  context.moveTo(x + width, y + depth);
  context.lineTo(x + width + depth, y);
  context.lineTo(x + width + depth, y + height - depth);
  context.lineTo(x + width, y + height);
  context.closePath();
  context.fill();

  context.fillStyle = options.active ? "#4b8a62" : palette.mid;
  context.beginPath();
  context.moveTo(x, y + depth);
  context.lineTo(x + depth, y);
  context.lineTo(x + width + depth, y);
  context.lineTo(x + width, y + depth);
  context.closePath();
  context.fill();

  context.fillStyle = fill;
  context.fillRect(x, y + depth, width, height - depth);
  context.strokeStyle = options.perfect ? palette.hot : frame;
  context.lineWidth = options.active ? 3 : 2;
  context.strokeRect(x, y + depth, width, height - depth);

  context.fillStyle = palette.deepest;
  context.fillRect(x + 5, y + depth + 5, 5, height - depth - 10);
  context.fillRect(x + width - 10, y + depth + 5, 5, height - depth - 10);
  context.fillRect(x + 5, y + height - 9, width - 10, 4);

  context.strokeStyle = options.active
    ? "rgba(239, 255, 201, 0.48)"
    : "rgba(199, 240, 139, 0.28)";
  context.lineWidth = 1;
  const panelWidth = 15;
  for (let panelX = x + 16; panelX < x + width - 12; panelX += panelWidth) {
    context.beginPath();
    context.moveTo(panelX, y + depth + 7);
    context.lineTo(panelX, y + height - 10);
    context.stroke();
    context.beginPath();
    context.moveTo(panelX + 4, y + depth + 8);
    context.lineTo(panelX + 4, y + height - 11);
    context.stroke();
  }

  const doorX = x + width / 2;
  context.strokeStyle = "rgba(7, 18, 12, 0.75)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(doorX, y + depth + 4);
  context.lineTo(doorX, y + height - 7);
  context.stroke();
  context.fillStyle = palette.phosphor;
  context.fillRect(Math.round(doorX - 8), y + depth + 11, 2, height - depth - 22);
  context.fillRect(Math.round(doorX + 6), y + depth + 11, 2, height - depth - 22);

  context.fillStyle = options.active ? palette.hot : palette.phosphor;
  context.font = "13px 'VT323', monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(
    options.label ?? `CT-${String(options.id ?? 0).padStart(2, "0")}`,
    centerX,
    y + height - 15,
  );

  context.fillStyle = options.active ? palette.hot : palette.bright;
  for (const cornerX of [x + 2, x + width - 6]) {
    context.fillRect(cornerX, y + depth + 2, 4, 7);
    context.fillRect(cornerX, y + height - 8, 4, 6);
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
    });
    context.restore();
  }


  context.restore();
}

function drawMastAndRail(
  context: CanvasRenderingContext2D,
  state: CraneRenderState,
): void {
  const mastX = 24;
  const mastWidth = 18;
  const railY = 48;

  context.fillStyle = palette.shadow;
  context.fillRect(mastX + 6, railY + 16, mastWidth, CRANE_HEIGHT - railY - 16);
  context.fillStyle = palette.darkMid;
  context.strokeStyle = palette.phosphor;
  context.lineWidth = 2;
  context.fillRect(mastX, railY + 11, mastWidth, CRANE_HEIGHT - railY - 11);
  context.strokeRect(mastX, railY + 11, mastWidth, CRANE_HEIGHT - railY - 11);

  context.save();
  context.beginPath();
  context.rect(mastX + 2, railY + 13, mastWidth - 4, CRANE_HEIGHT - railY - 15);
  context.clip();
  context.strokeStyle = palette.amber;
  context.lineWidth = 5;
  for (let y = railY + 4; y < CRANE_HEIGHT + 20; y += 22) {
    context.beginPath();
    context.moveTo(mastX - 2, y + 17);
    context.lineTo(mastX + mastWidth + 3, y - 3);
    context.stroke();
  }
  context.restore();

  context.fillStyle = palette.darkMid;
  context.fillRect(14, railY, CRANE_WIDTH - 28, 20);
  context.strokeStyle = palette.phosphor;
  context.lineWidth = 2;
  context.strokeRect(14, railY, CRANE_WIDTH - 28, 20);
  context.fillStyle = palette.bright;
  context.fillRect(16, railY + 2, CRANE_WIDTH - 32, 4);
  context.fillStyle = palette.deepest;
  context.fillRect(16, railY + 15, CRANE_WIDTH - 32, 3);

  for (let x = 34; x < CRANE_WIDTH - 24; x += 38) {
    context.fillStyle = palette.deepest;
    context.beginPath();
    context.arc(x, railY + 11, 3.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = palette.bright;
    context.beginPath();
    context.arc(x - 1, railY + 10, 1.2, 0, Math.PI * 2);
    context.fill();
  }

  const trolleyX = Math.round(state.trolleyX);
  context.fillStyle = palette.deepest;
  context.beginPath();
  context.arc(trolleyX - 12, railY + 20, 5, 0, Math.PI * 2);
  context.arc(trolleyX + 12, railY + 20, 5, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = palette.bright;
  context.fillRect(trolleyX - 18, railY + 4, 36, 19);
  context.strokeStyle = palette.hot;
  context.lineWidth = 2;
  context.strokeRect(trolleyX - 18, railY + 4, 36, 19);
  context.fillStyle = palette.deepest;
  context.font = "12px 'VT323', monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("LIFT", trolleyX, railY + 14);

  const tickOffset = state.cameraOffset % 96;
  for (let y = 112 + tickOffset; y < CRANE_HEIGHT - 12; y += 96) {
    context.fillStyle = "rgba(199, 240, 139, 0.48)";
    context.fillRect(mastX + mastWidth + 3, Math.round(y), 13, 2);
  }
}

function drawCraneLoad(
  context: CanvasRenderingContext2D,
  state: CraneRenderState,
  baseX: number,
  baseY: number,
): void {
  const crate = state.hanging ?? state.falling;
  if (!crate) return;
  const crateScreenX = crate.x + baseX;
  const crateScreenY = baseY - crate.y;

  if (state.hanging) {
    const hookY = crateScreenY - crate.height / 2 - 12;
    context.strokeStyle = state.magLockArmed ? palette.cyan : state.wideLoadArmed ? palette.amber : palette.phosphor;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(state.cableAnchorX, 71);
    context.lineTo(crateScreenX, hookY);
    context.stroke();

    context.fillStyle = palette.deepest;
    context.beginPath();
    context.arc(crateScreenX, hookY, 7, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = state.magLockArmed ? palette.hot : state.wideLoadArmed ? palette.amber : palette.cyan;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(crateScreenX, hookY, 9, 0, Math.PI * 2);
    context.stroke();

    context.strokeStyle = palette.phosphor;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(crateScreenX, hookY + 8);
    context.lineTo(crateScreenX - crate.width * 0.34, crateScreenY - crate.height / 2 + 3);
    context.moveTo(crateScreenX, hookY + 8);
    context.lineTo(crateScreenX + crate.width * 0.34, crateScreenY - crate.height / 2 + 3);
    context.stroke();
  }

  drawContainer(
    context,
    crateScreenX,
    crateScreenY,
    crate.width,
    crate.height,
    {
      active: true,
      label: state.magLockArmed ? "MAG-LOCK" : state.wideLoadArmed ? "WIDE LOAD" : "NEXT LOAD",
    },
  );
}

function drawHud(
  context: CanvasRenderingContext2D,
  state: CraneRenderState,
): void {
  if (state.perfectStreak > 0) {
    context.fillStyle = "rgba(6, 19, 14, 0.82)";
    context.fillRect(CRANE_WIDTH - 132, 82, 106, 27);
    context.strokeStyle = "rgba(199, 240, 139, 0.45)";
    context.strokeRect(CRANE_WIDTH - 132, 82, 106, 27);
    context.fillStyle = palette.hot;
    context.font = "17px 'VT323', monospace";
    context.textAlign = "center";
    context.fillText(`PERFECT ×${state.perfectStreak}`, CRANE_WIDTH - 79, 100);
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
      drawFoundation(context, baseX, baseY);
      drawTower(context, state, baseX, baseY);
      drawMastAndRail(context, state);
      drawCraneLoad(context, state, baseX, baseY);
      drawHud(context, state);
    },
  };
}
