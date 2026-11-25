export const SIMULATION = Object.freeze({
  fixedStep: 1 / 60,
  maxFrameDelta: 0.05,
  constraintIterations: 6,
});

export function renderFpsFor(width, height) {
  return width < 620 || height < 500 ? 24 : 30;
}

export const ASCII = Object.freeze({
  density: " .,:;irsXA253hMHGS#9B&@",
  tissue: " .,:;irszxXA25hMHGS#9B&@",
  ribbon: ".,:;irszxXA25hM",
  edge: Object.freeze({ horizontal: "~", vertical: "|", rising: "/", falling: "\\" }),
  arm: Object.freeze({ horizontal: "=", vertical: "|", rising: "/", falling: "\\" }),
  snow: Object.freeze([".", ",", "'"]),
});

// Rose-red crown and canals, violet glass, a magenta rim and cool blue trails.
// Keep deep tissue tones distinct from the fluorescent highlights.
export const JELLY_PALETTE = Object.freeze({
  bellShadow: "#6841b5",
  bellCool: "#8276ff",
  bellSoft: "#d6a1ff",
  bellGlass: "#f3c5ff",
  bellCoral: "#ff526f",
  bellWarm: "#ff739d",
  bellHot: "#ffb2cd",
  bellCrown: "#ffe1ed",
  rim: "#ff4fbf",
  rimHot: "#ffcaed",
  armDark: "#6452bf",
  arm: "#b28af8",
  armHot: "#e4b1ff",
  armAccent: "#ff83cc",
  tentacle: "#6e8be9",
  tentacleHot: "#b4c7ff",
  tentacleAccent: "#83d9ff",
  white: "#fff0fa",
});

export const WORLD = Object.freeze({
  minSnow: 8,
  maxSnow: 24,
});

export function snowCountFor(width, height) {
  const area = width * height;
  return Math.max(WORLD.minSnow, Math.min(WORLD.maxSnow, Math.round(area / 32000)));
}
