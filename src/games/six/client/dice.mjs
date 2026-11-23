// Pure, dependency-free SVG dice. The D12 and D20 are regular polyhedra:
// every face has a stable number, and every front-facing face is labelled.
// Hidden faces are revealed as different results orient the die differently.
// Cosmetic roll frames never decide the outcome.
const pips = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

const PHI = (1 + Math.sqrt(5)) / 2;
const plus = (a, b) => a.map((n, i) => n + b[i]);
const minus = (a, b) => a.map((n, i) => n - b[i]);
const dot = (a, b) => a.reduce((sum, n, i) => sum + n * b[i], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = a => a.map(n => n / Math.hypot(...a));
const mean = points => points.reduce(plus, [0, 0, 0]).map(n => n / points.length);

// Duality gives us both solids without a mesh library. An icosahedron has
// 20 triangles; the centres of those triangles are the dodecahedron's vertices.
function makeSolids() {
  const icoVertices = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    icoVertices.push(unit([0, a, b * PHI]));
    icoVertices.push(unit([a, b * PHI, 0]));
    icoVertices.push(unit([a * PHI, 0, b]));
  }
  const icoFaces = [];
  // The nearest vertices form the 30 equal edges of a regular icosahedron.
  const edgeLength2 = 4 / (1 + PHI * PHI);
  const edge = (i, j) => Math.abs(dot(minus(icoVertices[i], icoVertices[j]), minus(icoVertices[i], icoVertices[j])) - edgeLength2) < 1e-6;
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let k = j + 1; k < 12; k++) {
    if (!edge(i, j) || !edge(j, k) || !edge(k, i)) continue;
    const vertices = [i, j, k];
    const points = vertices.map(n => icoVertices[n]);
    if (dot(cross(minus(points[1], points[0]), minus(points[2], points[0])), mean(points)) < 0) vertices.reverse();
    icoFaces.push(vertices);
  }
  const d12Vertices = icoFaces.map(face => unit(mean(face.map(i => icoVertices[i]))));
  const d12Faces = icoVertices.map((normal, i) => {
    const basisX = unit(cross(Math.abs(normal[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0], normal));
    const basisY = cross(normal, basisX);
    return icoFaces.map((face, index) => face.includes(i) ? index : -1)
      .filter(index => index >= 0)
      .sort((a, b) => {
        const pa = d12Vertices[a], pb = d12Vertices[b];
        return Math.atan2(dot(pa, basisY), dot(pa, basisX)) - Math.atan2(dot(pb, basisY), dot(pb, basisX));
      });
  });
  return {
    12: { vertices: d12Vertices, faces: d12Faces },
    20: { vertices: icoVertices, faces: icoFaces },
  };
}

function prepareSolid({ vertices, faces }) {
  const normals = faces.map(face => {
    const [a, b, c] = face.map(i => vertices[i]);
    const normal = unit(cross(minus(b, a), minus(c, a)));
    return dot(normal, mean(face.map(i => vertices[i]))) > 0 ? normal : normal.map(n => -n);
  });
  // Opposite face numbers total 13 on D12 and 21 on D20.
  const labels = Array(faces.length).fill(null);
  let next = 1;
  for (let i = 0; i < faces.length; i++) {
    if (labels[i] !== null) continue;
    const opposite = normals.findIndex((n, j) => j !== i && dot(n, normals[i]) < -0.999);
    labels[i] = next;
    labels[opposite] = faces.length + 1 - next;
    next++;
  }
  return { vertices, faces, normals, labels };
}

const SOLIDS = Object.fromEntries(Object.entries(makeSolids()).map(([sides, solid]) => [sides, prepareSolid(solid)]));

function polyhedronSvg(value, sides) {
  const { vertices, faces, normals, labels } = SOLIDS[sides];
  const selected = labels.indexOf(value);
  const towards = normals[selected];
  const up = Math.abs(towards[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1];
  const right = unit(cross(up, towards));
  const vertical = cross(towards, right);
  const project = point => {
    const x = dot(point, right), y = dot(point, vertical), z = dot(point, towards);
    const perspective = 4.5 / (4.5 - z);
    return [80 + x * 68 * perspective, 80 - y * 68 * perspective, z];
  };
  const visible = faces.map((face, index) => {
    const n = normals[index];
    const facing = dot(n, towards);
    if (facing < 0.025) return null;
    const corners = face.map(i => project(vertices[i]));
    const center = corners.reduce((sum, p) => [sum[0] + p[0], sum[1] + p[1]], [0, 0]).map(n => n / corners.length);
    // Foreshortened side facets can become thin slivers. Use the true
    // distance to their nearest edge so numbers never spill across facets.
    const inradius = Math.min(...corners.map(([x1, y1], i) => {
      const [x2, y2] = corners[(i + 1) % corners.length];
      return Math.abs((x2 - x1) * (center[1] - y1) - (y2 - y1) * (center[0] - x1)) /
        Math.hypot(x2 - x1, y2 - y1);
    }));
    const light = Math.max(0, dot(n, unit(plus(plus(right.map(x => -0.35 * x), vertical.map(x => 0.75 * x)), towards.map(x => 0.85 * x)))));
    const shade = Math.round(170 + 70 * light);
    const fill = index === selected ? '#f4eee7' : `rgb(${shade},${shade - 9},${shade - 18})`;
    const size = index === selected ? (sides === 12 ? 35 : 29) : Math.min(16, inradius * (labels[index] >= 10 ? 1.35 : 1.65));
    return { index, depth: corners.reduce((sum, p) => sum + p[2], 0) / corners.length,
      points: corners.map(p => p.slice(0, 2).map(n => n.toFixed(1)).join(',')).join(' '),
      center, fill, size };
  }).filter(Boolean).sort((a, b) => a.depth - b.depth);
  const polygons = visible.map(face => {
    const number = labels[face.index];
    const current = face.index === selected;
    const [x, y] = face.center.map(n => n.toFixed(1));
    return `<g class="six-poly-face${current ? ' six-poly-current' : ''}" data-face="${number}">
      <polygon points="${face.points}" fill="${face.fill}" stroke="#857b71" stroke-width="1.6" stroke-linejoin="round"/>
      ${face.size >= 7 ? `<text x="${x}" y="${y}" font-family="system-ui,Arial,sans-serif" font-weight="800"
        font-size="${face.size.toFixed(1)}" fill="#27221e" text-anchor="middle" dominant-baseline="central"
        paint-order="stroke" stroke="${face.fill}" stroke-width="${current ? '1.4' : '0.7'}">${number}</text>` : ''}
    </g>`;
  }).join('');
  return `<svg class="six-die-svg" data-sides="${sides}" viewBox="0 0 160 160" focusable="false" aria-hidden="true">
    ${polygons}
  </svg>`;
}

export function dieSvg(face, sides = 12) {
  if (![6, 12, 20].includes(sides) || !Number.isInteger(face) || face < 1 || face > sides) return '';
  if (sides !== 6) return polyhedronSvg(face, sides);
  return `<svg class="six-die-svg" data-sides="6" viewBox="0 0 100 100" focusable="false" aria-hidden="true">
    <defs><linearGradient id="six-ivory" x1="0" y1="0" x2=".85" y2="1">
      <stop stop-color="#fffefa"/><stop offset=".5" stop-color="#eee9e2"/><stop offset="1" stop-color="#c8c0b8"/>
    </linearGradient></defs>
    <rect x="3" y="3" width="94" height="94" rx="20" fill="url(#six-ivory)" stroke="#bcb3aa" stroke-width="2"/>
    <path d="M15 43V24Q15 14 27 14H71" stroke="#fff" stroke-opacity=".8" stroke-width="4" stroke-linecap="round" fill="none"/>
    ${pips[face].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8" fill="#242326" stroke="#77716f" stroke-width="1"/>`).join('')}
  </svg>`;
}
