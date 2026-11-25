import { rotate } from "./math.mjs";

// Coordinates are in CSS pixels relative to the bell centre, before DPR.
export function projectedBellPoint(jelly, point, visualTilt) {
  const local = rotate(point.x - jelly.x, point.y - jelly.y, -jelly.tilt);
  return rotate(local.x, local.y, visualTilt);
}

// Each horizontal slab conservatively covers the polygon's occupied span.
// Unlike a Canvas clip, this costs nothing to the browser's glyph rasterizer.
// Tiny gaps inside a slab are intentionally treated as membrane.
export function buildOcclusionSpans(points, step = 2) {
  const minY = Math.min(...points.map(p => p.y));
  const maxY = Math.max(...points.map(p => p.y));
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const rows = Math.max(1, Math.ceil((maxY - minY) / step));
  const left = new Float64Array(rows).fill(Infinity);
  const right = new Float64Array(rows).fill(-Infinity);
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i], b = points[(i + 1) % points.length];
    const lo = Math.min(a.y, b.y), hi = Math.max(a.y, b.y);
    const first = Math.max(0, Math.floor((lo - minY) / step));
    const last = Math.min(rows - 1, Math.floor((hi - minY) / step));
    for (let row = Math.min(first, rows - 1); row <= last; row += 1) {
      const y0 = Math.max(lo, minY + row * step);
      const y1 = Math.min(hi, minY + (row + 1) * step);
      const dx = b.x - a.x, dy = b.y - a.y;
      const x0 = dy === 0 ? a.x : a.x + dx * (y0 - a.y) / dy;
      const x1 = dy === 0 ? b.x : a.x + dx * (y1 - a.y) / dy;
      left[row] = Math.min(left[row], x0, x1);
      right[row] = Math.max(right[row], x0, x1);
    }
  }
  return function overlaps(x0, y0, x1, y1) {
    if (x1 < minX || x0 > maxX || y1 < minY || y0 > maxY) return false;
    const start = Math.min(rows - 1, Math.max(0, Math.floor((y0 - minY) / step)));
    const end = Math.min(rows - 1, Math.floor((y1 - minY) / step));
    for (let row = start; row <= end; row += 1) {
      if (x1 >= left[row] && x0 <= right[row]) return true;
    }
    return false;
  };
}

// keepTrailDirection preserves world-space trail vectors.
// The corrected root follows the visual bell; all other points keep their
// projected displacement from that root. Precompute the affine coefficients
// once per appendage, including its branches and dark ribbon mask.
export function trailOcclusionFor(jelly, item, attachment, visualTilt, overlaps) {
  const root = projectedBellPoint(jelly, { x: attachment.rootX, y: attachment.rootY }, visualTilt);
  const tx = root.x - item.chain.x[0];
  const ty = root.y - item.chain.y[0];
  return {
    glyph(x, y, pad) {
      const px = x + tx, py = y + ty;
      return overlaps(px - pad, py - pad, px + pad, py + pad);
    },
    stroke(x0, y0, x1, y1, pad) {
      const ax = x0 + tx, ay = y0 + ty;
      const bx = x1 + tx, by = y1 + ty;
      return overlaps(Math.min(ax, bx) - pad, Math.min(ay, by) - pad,
        Math.max(ax, bx) + pad, Math.max(ay, by) + pad);
    },
  };
}
