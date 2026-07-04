import type { RunCycleState } from "./chicken-run-cycle";

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface ChickenWorldPalette {
  sky: RgbColor;
  ground: RgbColor;
  groundLine: RgbColor;
  groundMark: RgbColor;
  distant: RgbColor;
  middle: RgbColor;
  grass: RgbColor;
  cloud: RgbColor;
  cloudShadow: RgbColor;
  obstaclePrimary: RgbColor;
  obstacleSecondary: RgbColor;
  obstacleHighlight: RgbColor;
  corn: RgbColor;
  cornHighlight: RgbColor;
  egg: RgbColor;
  eggAccent: RgbColor;
  fox: RgbColor;
  foxDetail: RgbColor;
  mud: RgbColor;
  mudDetail: RgbColor;
  mudHighlight: RgbColor;
  text: RgbColor;
  dim: RgbColor;
  particle: RgbColor;
  sun: RgbColor;
  moon: RgbColor;
  star: RgbColor;
}


export interface ChickenSpritePalette {
  body: RgbColor;
  wing: RgbColor;
  accent: RgbColor;
  ink: RgbColor;
  outline: RgbColor;
}

/**
 * The chicken is a single character, not part of the changing world palette.
 * Keeping these colors fixed prevents the sprite from appearing to change
 * identity between day and night. The dark one-pixel outline supplies contrast
 * against the pale daytime sky; the bright body supplies contrast at night.
 */
export const CHICKEN_SPRITE_PALETTE: Readonly<ChickenSpritePalette> =
  Object.freeze({
    body: { r: 235, g: 250, b: 199 },
    wing: { r: 179, g: 207, b: 143 },
    accent: { r: 217, g: 128, b: 93 },
    ink: { r: 8, g: 18, b: 9 },
    outline: { r: 8, g: 18, b: 9 },
  });

export interface CelestialVisual {
  x: number;
  y: number;
  alpha: number;
}

const DAY_PALETTE: ChickenWorldPalette = {
  sky: { r: 198, g: 226, b: 145 },
  ground: { r: 145, g: 177, b: 103 },
  groundLine: { r: 31, g: 69, b: 39 },
  groundMark: { r: 75, g: 109, b: 69 },
  distant: { r: 106, g: 143, b: 100 },
  middle: { r: 59, g: 99, b: 64 },
  grass: { r: 42, g: 79, b: 48 },
  cloud: { r: 235, g: 247, b: 208 },
  cloudShadow: { r: 159, g: 193, b: 124 },
  obstaclePrimary: { r: 45, g: 91, b: 53 },
  obstacleSecondary: { r: 99, g: 119, b: 53 },
  obstacleHighlight: { r: 178, g: 206, b: 119 },
  corn: { r: 107, g: 122, b: 39 },
  cornHighlight: { r: 237, g: 244, b: 169 },
  egg: { r: 245, g: 247, b: 215 },
  eggAccent: { r: 184, g: 151, b: 83 },
  fox: { r: 139, g: 75, b: 48 },
  foxDetail: { r: 65, g: 50, b: 39 },
  mud: { r: 113, g: 75, b: 52 },
  mudDetail: { r: 67, g: 44, b: 35 },
  mudHighlight: { r: 162, g: 113, b: 76 },
  text: { r: 29, g: 69, b: 38 },
  dim: { r: 64, g: 99, b: 60 },
  particle: { r: 244, g: 248, b: 218 },
  sun: { r: 247, g: 239, b: 151 },
  moon: { r: 218, g: 232, b: 173 },
  star: { r: 231, g: 242, b: 191 },
};

const SUNSET_PALETTE: ChickenWorldPalette = {
  sky: { r: 72, g: 45, b: 31 },
  ground: { r: 43, g: 52, b: 34 },
  groundLine: { r: 197, g: 178, b: 96 },
  groundMark: { r: 97, g: 104, b: 61 },
  distant: { r: 88, g: 80, b: 55 },
  middle: { r: 103, g: 103, b: 58 },
  grass: { r: 77, g: 87, b: 50 },
  cloud: { r: 151, g: 132, b: 92 },
  cloudShadow: { r: 79, g: 67, b: 51 },
  obstaclePrimary: { r: 157, g: 176, b: 100 },
  obstacleSecondary: { r: 195, g: 179, b: 84 },
  obstacleHighlight: { r: 234, g: 226, b: 154 },
  corn: { r: 225, g: 202, b: 84 },
  cornHighlight: { r: 255, g: 239, b: 170 },
  egg: { r: 247, g: 239, b: 193 },
  eggAccent: { r: 217, g: 128, b: 93 },
  fox: { r: 217, g: 128, b: 93 },
  foxDetail: { r: 45, g: 35, b: 28 },
  mud: { r: 148, g: 89, b: 63 },
  mudDetail: { r: 56, g: 39, b: 30 },
  mudHighlight: { r: 213, g: 143, b: 91 },
  text: { r: 233, g: 223, b: 149 },
  dim: { r: 153, g: 149, b: 91 },
  particle: { r: 242, g: 236, b: 183 },
  sun: { r: 255, g: 199, b: 100 },
  moon: { r: 225, g: 231, b: 177 },
  star: { r: 229, g: 238, b: 184 },
};

const NIGHT_PALETTE: ChickenWorldPalette = {
  sky: { r: 2, g: 7, b: 4 },
  ground: { r: 2, g: 7, b: 5 },
  groundLine: { r: 199, g: 240, b: 139 },
  groundMark: { r: 127, g: 164, b: 92 },
  distant: { r: 83, g: 107, b: 61 },
  middle: { r: 127, g: 164, b: 92 },
  grass: { r: 127, g: 164, b: 92 },
  cloud: { r: 93, g: 119, b: 73 },
  cloudShadow: { r: 40, g: 57, b: 39 },
  obstaclePrimary: { r: 143, g: 189, b: 102 },
  obstacleSecondary: { r: 217, g: 242, b: 119 },
  obstacleHighlight: { r: 231, g: 255, b: 176 },
  corn: { r: 217, g: 242, b: 119 },
  cornHighlight: { r: 231, g: 255, b: 176 },
  egg: { r: 231, g: 255, b: 176 },
  eggAccent: { r: 217, g: 242, b: 119 },
  fox: { r: 217, g: 128, b: 93 },
  foxDetail: { r: 2, g: 7, b: 4 },
  mud: { r: 217, g: 128, b: 93 },
  mudDetail: { r: 2, g: 7, b: 4 },
  mudHighlight: { r: 231, g: 255, b: 176 },
  text: { r: 199, g: 240, b: 139 },
  dim: { r: 127, g: 164, b: 92 },
  particle: { r: 231, g: 255, b: 176 },
  sun: { r: 255, g: 204, b: 108 },
  moon: { r: 217, g: 242, b: 119 },
  star: { r: 231, g: 255, b: 176 },
};

const DAWN_PALETTE: ChickenWorldPalette = {
  sky: { r: 102, g: 128, b: 91 },
  ground: { r: 74, g: 101, b: 66 },
  groundLine: { r: 184, g: 211, b: 126 },
  groundMark: { r: 96, g: 128, b: 79 },
  distant: { r: 83, g: 112, b: 80 },
  middle: { r: 74, g: 113, b: 72 },
  grass: { r: 58, g: 95, b: 59 },
  cloud: { r: 191, g: 207, b: 162 },
  cloudShadow: { r: 112, g: 139, b: 101 },
  obstaclePrimary: { r: 105, g: 142, b: 81 },
  obstacleSecondary: { r: 181, g: 193, b: 96 },
  obstacleHighlight: { r: 223, g: 232, b: 164 },
  corn: { r: 190, g: 204, b: 92 },
  cornHighlight: { r: 239, g: 239, b: 169 },
  egg: { r: 240, g: 241, b: 204 },
  eggAccent: { r: 197, g: 150, b: 86 },
  fox: { r: 187, g: 103, b: 73 },
  foxDetail: { r: 38, g: 42, b: 31 },
  mud: { r: 139, g: 88, b: 61 },
  mudDetail: { r: 55, g: 44, b: 34 },
  mudHighlight: { r: 194, g: 132, b: 86 },
  text: { r: 218, g: 230, b: 161 },
  dim: { r: 111, g: 139, b: 86 },
  particle: { r: 234, g: 240, b: 198 },
  sun: { r: 246, g: 218, b: 128 },
  moon: { r: 217, g: 229, b: 173 },
  star: { r: 225, g: 237, b: 188 },
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function mixNumber(from: number, to: number, amount: number): number {
  return Math.round(from + (to - from) * clamp01(amount));
}

export function mixColor(
  from: RgbColor,
  to: RgbColor,
  amount: number,
): RgbColor {
  return {
    r: mixNumber(from.r, to.r, amount),
    g: mixNumber(from.g, to.g, amount),
    b: mixNumber(from.b, to.b, amount),
  };
}

function mixPalette(
  from: ChickenWorldPalette,
  to: ChickenWorldPalette,
  amount: number,
): ChickenWorldPalette {
  const result = {} as ChickenWorldPalette;
  const keys = Object.keys(from) as Array<keyof ChickenWorldPalette>;
  keys.forEach((key) => {
    result[key] = mixColor(from[key], to[key], amount);
  });
  return result;
}

function stagedPalette(
  first: ChickenWorldPalette,
  middle: ChickenWorldPalette,
  last: ChickenWorldPalette,
  progress: number,
  midpoint: number,
): ChickenWorldPalette {
  if (progress <= midpoint) {
    return mixPalette(first, middle, smoothstep(progress / midpoint));
  }
  return mixPalette(
    middle,
    last,
    smoothstep((progress - midpoint) / (1 - midpoint)),
  );
}

export function paletteForCycle(cycle: RunCycleState): ChickenWorldPalette {
  if (cycle.phase === "day") return DAY_PALETTE;
  if (cycle.phase === "night") return NIGHT_PALETTE;
  if (cycle.phase === "sunset") {
    return stagedPalette(
      DAY_PALETTE,
      SUNSET_PALETTE,
      NIGHT_PALETTE,
      cycle.phaseProgress,
      0.58,
    );
  }
  return stagedPalette(
    NIGHT_PALETTE,
    DAWN_PALETTE,
    DAY_PALETTE,
    cycle.phaseProgress,
    0.45,
  );
}

export function rgbCss(color: RgbColor): string {
  return `rgb(${color.r} ${color.g} ${color.b})`;
}

export function rgbaCss(color: RgbColor, alpha: number): string {
  return `rgb(${color.r} ${color.g} ${color.b} / ${clamp01(alpha)})`;
}

export function relativeLuminance(color: RgbColor): number {
  return (color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722) / 255;
}

export function sunVisual(
  cycle: RunCycleState,
  width: number,
  groundY: number,
): CelestialVisual {
  if (cycle.phase === "night") return { x: 0, y: 0, alpha: 0 };

  if (cycle.phase === "day") {
    const progress = clamp01(cycle.phaseProgress);
    return {
      x: 44 + (width - 88) * progress,
      y: groundY - 116 - Math.sin(progress * Math.PI) * 78,
      alpha: 1,
    };
  }

  if (cycle.phase === "sunset") {
    const progress = clamp01(cycle.phaseProgress);
    return {
      x: width - 44 + progress * 48,
      y: groundY - 116 + progress * 82,
      alpha: 1 - smoothstep(progress),
    };
  }

  const progress = clamp01(cycle.phaseProgress);
  return {
    x: -20 + progress * 72,
    y: groundY + 18 - progress * 138,
    alpha: smoothstep(progress),
  };
}

export function moonVisual(
  cycle: RunCycleState,
  width: number,
  groundY: number,
): CelestialVisual {
  if (cycle.phase === "day") return { x: 0, y: 0, alpha: 0 };

  if (cycle.phase === "sunset") {
    const progress = clamp01(cycle.phaseProgress);
    return {
      x: -18 + progress * 90,
      y: groundY - 150 - progress * 30,
      alpha: smoothstep(progress),
    };
  }

  if (cycle.phase === "night") {
    const progress = clamp01(cycle.phaseProgress);
    return {
      x: 70 + (width - 140) * progress,
      y: groundY - 154 - Math.sin(progress * Math.PI) * 42,
      alpha: 1,
    };
  }

  const progress = clamp01(cycle.phaseProgress);
  return {
    x: width - 68 + progress * 48,
    y: groundY - 170 + progress * 68,
    alpha: 1 - smoothstep(progress),
  };
}

export function cloudOpacityForCycle(cycle: RunCycleState): number {
  if (cycle.phase === "day") return 0.92;
  if (cycle.phase === "night") return 0.1;
  if (cycle.phase === "sunset") {
    return 0.92 - smoothstep(cycle.phaseProgress) * 0.78;
  }
  return 0.1 + smoothstep(cycle.phaseProgress) * 0.82;
}
