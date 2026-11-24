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
  // Keep the animal fluorescent without turning it into a rainbow. Warm bell
  // tissue transitions through magenta/lavender into violet strands, with a
  // few cool cyan accents on the thinnest tentacle details.
  bellShadow: "#5147a8",
  bellCool: "#8071e8",
  bellSoft: "#e0a9f5",
  bellGlass: "#f3d0ff",
  bellCoral: "#ff776d",
  bellWarm: "#ffad55",
  bellHot: "#ffe6a3",
  bellCrown: "#fff8d8",
  rim: "#ff55bd",
  rimHot: "#ffe0f4",
  armDark: "#6668d6",
  arm: "#9985f0",
  armHot: "#dda1f4",
  armAccent: "#ff82d8",
  tentacle: "#7d73dc",
  tentacleHot: "#b8abff",
  tentacleAccent: "#7fd9ff",
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
