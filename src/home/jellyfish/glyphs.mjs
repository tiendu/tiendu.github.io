import { ASCII } from "./config.mjs";
import { clamp, lerp } from "./math.mjs";

const rgbCache = new Map();

function rgb(hex) {
  const cached = rgbCache.get(hex);
  if (cached) return cached;
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  const color = { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
  rgbCache.set(hex, color);
  return color;
}

export function rgba(hex, alpha) {
  const c = rgb(hex);
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${clamp(alpha, 0, 1)})`;
}

export function mixColor(a, b, t, alpha = 1) {
  const ca = rgb(a);
  const cb = rgb(b);
  const k = clamp(t, 0, 1);
  return `rgba(${Math.round(lerp(ca.r, cb.r, k))}, ${Math.round(lerp(ca.g, cb.g, k))}, ${Math.round(lerp(ca.b, cb.b, k))}, ${clamp(alpha, 0, 1)})`;
}

// Continuous glass / rose / crown blend. Cache only static palette entries;
// creating intermediate hex colours would grow rgbCache on every frame.
export function mixMembraneColor(palette, glassLight, coral, warmth, crown, alpha, flash = 0) {
  const cool = rgb(palette.bellCool), soft = rgb(palette.bellSoft);
  const glass = rgb(palette.bellGlass), rose = rgb(palette.bellCoral);
  const hot = rgb(palette.bellCrown);
  const flashColor = flash > 0 ? rgb(palette.tentacleAccent) : hot;
  const channel = key => Math.round(lerp(lerp(
    lerp(lerp(cool[key], soft[key], glassLight), lerp(glass[key], rose[key], coral), warmth),
    hot[key], crown,
  ), flashColor[key], clamp(flash, 0, 1)));
  return `rgba(${channel("r")}, ${channel("g")}, ${channel("b")}, ${clamp(alpha, 0, 1)})`;
}

// Anatomy-specific ink families, from fine marks to broader letterforms.
export const MATERIAL_GLYPHS = Object.freeze({
  membrane: Object.freeze([".,'\x60:;i!l", "i;:jrtfcsuv", "aceosuvnxyz"]),
  pigment: Object.freeze([".,:;ir", "ceosuvCJS", "OCGQS023568"]),
  ribbon: Object.freeze([".,:;!il", "rftjzsvyn", "xXAwmbdphkMNHK"]),
  fiber: Object.freeze({ horizontal: "~~~--_", vertical: "||||!il:", rising: "/////(", falling: "\\\\\\\\\\)" }),
  edge: Object.freeze({ horizontal: "===-~", vertical: "||||!I", rising: "/////<", falling: "\\\\\\\\\\>" }),
  canal: Object.freeze({ horizontal: "~~-=", vertical: "|||:;!", rising: "///{(", falling: "\\\\\\})" }),
});

// Stable material coordinates, never a frame counter or random stream.
export function glyphSeedAt(index, lane, phase = 0) {
  let h = Math.imul(index + 1, 374761393) ^ Math.imul(lane + 1, 668265263)
    ^ Math.round(phase * 4096);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function pickGlyph(family, seed) {
  return family[Math.floor(clamp(seed, 0, 0.9999) * family.length)];
}

export function materialGlyphAt(density, seed, families) {
  return pickGlyph(families[density < 0.23 ? 0 : density < 0.38 ? 1 : 2], seed);
}

export function fiberGlyphAt(dx, dy, table, seed) {
  return pickGlyph(directionGlyph(dx, dy, table), seed);
}

export function directionGlyph(dx, dy, table = ASCII.edge) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ay < ax * 0.42) return table.horizontal;
  if (ax < ay * 0.42) return table.vertical;
  return dx * dy < 0 ? table.rising : table.falling;
}

export function densityGlyph(value, ramp = ASCII.density) {
  const t = clamp(value, 0, 0.9999);
  const index = Math.floor(t * ramp.length);
  return ramp[Math.min(index, ramp.length - 1)];
}


export function setFont(ctx, fontSize) {
  ctx.font = `${fontSize}px "Source Code Pro Variable", "Source Code Pro", ui-monospace, monospace`;
}
