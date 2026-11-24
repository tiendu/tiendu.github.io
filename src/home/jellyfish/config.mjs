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
  bellShadow: "#5d55b7",
  bellCool: "#8a78e8",
  bellSoft: "#c69bea",
  bellWarm: "#ff984d",
  bellHot: "#ffd38a",
  rim: "#ff63bd",
  rimHot: "#ffd0ee",
  armDark: "#5d64c8",
  arm: "#8b7ee7",
  armHot: "#cf8fe9",
  tentacle: "#766bd6",
  tentacleHot: "#bca8ff",
  white: "#fff6f2",
});

export const WORLD = Object.freeze({
  minSnow: 8,
  maxSnow: 24,
});

export function snowCountFor(width, height) {
  const area = width * height;
  return Math.max(WORLD.minSnow, Math.min(WORLD.maxSnow, Math.round(area / 32000)));
}
