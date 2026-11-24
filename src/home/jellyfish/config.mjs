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

// The single specimen deliberately uses a fixed warm-to-cool palette rather
// than randomly rotating palettes. The reference's orange/pink cap and
// violet/blue underside are part of its identity.
export const JELLY_PALETTE = Object.freeze({
  // Fluorescence belongs to the specimen, not the site chrome. The bell moves
  // from warm cream/coral at the crown into magenta and violet underneath.
  bellShadow: "#40378f",
  bellCool: "#7468db",
  bellSoft: "#d6a0f1",
  bellGlass: "#efc6ff",
  bellCoral: "#ff6f68",
  bellWarm: "#ff963f",
  bellHot: "#ffe58e",
  bellCrown: "#fff6c7",
  rim: "#ff45b5",
  rimHot: "#ffd1ef",
  armDark: "#5d64c8",
  arm: "#8b7ee7",
  armHot: "#cf8fe9",
  tentacle: "#766bd6",
  tentacleHot: "#bca8ff",
  white: "#fffaf2",
});

export const WORLD = Object.freeze({
  minSnow: 8,
  maxSnow: 24,
});

export function snowCountFor(width, height) {
  const area = width * height;
  return Math.max(WORLD.minSnow, Math.min(WORLD.maxSnow, Math.round(area / 32000)));
}
