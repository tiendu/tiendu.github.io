// Limit backing-store memory without lowering the anatomical sample density.
const MAX_PIXELS = 8_000_000;
const MAX_EDGE = 4096;

export function canvasPixelRatio(width, height,
  dpr = globalThis.devicePixelRatio || 1,
  zoom = globalThis.visualViewport?.scale ?? 1) {
  const w = Math.max(1, width), h = Math.max(1, height);
  const desired = Math.min(4, Math.min(3, Math.max(1, dpr)) * Math.max(1, zoom));
  const limit = Math.min(desired, Math.sqrt(MAX_PIXELS / (w * h)), MAX_EDGE / Math.max(w, h));
  // Quarter steps avoid reallocating the canvas on every tiny pinch movement.
  return limit >= 0.25 ? Math.floor(limit * 4) / 4 : limit;
}
