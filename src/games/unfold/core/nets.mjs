// All eleven free cube nets, generated from six-square polyominoes.
// A net is valid only if folding about its shared edges produces six unique face normals.
const key = ([x, y]) => `${x},${y}`;
const offsets = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const normalize = (cells) => {
  const left = Math.min(...cells.map(([x]) => x));
  const top = Math.min(...cells.map(([, y]) => y));
  return cells.map(([x, y]) => [x - left, y - top]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
};
const rotate = ([x, y]) => [-y, x];
const transform = (cells, turns = 0, flip = false) => {
  let output = cells.map(([x, y]) => [flip ? -x : x, y]);
  for (let i = 0; i < turns; i++) output = output.map(rotate);
  return normalize(output);
};
const signature = (cells) => cells.map(key).join(';');
const canonical = (cells) => {
  const keys = [];
  for (const flip of [false, true]) for (let turn = 0; turn < 4; turn++) {
    keys.push(signature(transform(cells, turn, flip)));
  }
  return keys.sort()[0];
};
const dot = (v, w) => v.reduce((s, a, i) => s + a * w[i], 0);
const negative = (v) => v.map(n => -n);
const equal = (v, w) => v.every((a, i) => a === w[i]);
function neighboringNormal(frame, dx, dy) {
  if (dx === 1) return frame.u;
  if (dx === -1) return negative(frame.u);
  if (dy === 1) return frame.v;
  return negative(frame.v);
}
function adjacentFrame(frame, dx, dy) {
  const n = neighboringNormal(frame, dx, dy);
  if (dx !== 0) return {u: negative(frame.n).map(v => v * dx), v: frame.v, n};
  return {u: frame.u, v: negative(frame.n).map(v => v * dy), n};
}
function isCubeNet(cells) {
  const byKey = new Set(cells.map(key));
  const parent = new Map([[key(cells[0]), {u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1]}]]);
  const queue = [cells[0]];
  let edges = 0;
  for (let q = 0; q < queue.length; q++) {
    const [x, y] = queue[q];
    const current = parent.get(key([x, y]));
    for (const [dx, dy] of offsets) {
      const adjacent = key([x + dx, y + dy]);
      if (!byKey.has(adjacent)) continue;
      edges++;
      const next = adjacentFrame(current, dx, dy);
      if (parent.has(adjacent)) {
        if (!equal(parent.get(adjacent).n, next.n)) return false;
      } else {
        parent.set(adjacent, next);
        queue.push([x + dx, y + dy]);
      }
    }
  }
  // A cube net is a connected *tree* of five hinges, not a loop of panels.
  if (parent.size !== 6 || edges !== 10) return false;
  const normals = [...parent.values()].map(frame => frame.n);
  return new Set(normals.map(key3 => key3.join(','))).size === 6 && normals.every(n => dot(n, n) === 1);
}
function generate() {
  let current = new Map([[canonical([[0, 0]]), [[0, 0]]]]);
  for (let size = 2; size <= 6; size++) {
    const next = new Map();
    for (const cells of current.values()) {
      const occupied = new Set(cells.map(key));
      for (const [x, y] of cells) for (const [dx, dy] of offsets) {
        const cell = [x + dx, y + dy];
        if (occupied.has(key(cell))) continue;
        const candidate = normalize([...cells, cell]);
        const id = canonical(candidate);
        if (!next.has(id)) next.set(id, candidate);
      }
    }
    current = next;
  }
  return [...current.entries()].filter(([, cells]) => isCubeNet(cells)).sort(([a], [b]) => a.localeCompare(b)).map(([, cells]) => cells);
}
export const NETS = Object.freeze(generate().map(cells => Object.freeze(cells.map(c => Object.freeze(c)))));
if (NETS.length !== 11) throw new Error(`Expected 11 cube nets; found ${NETS.length}`);
export const oriented = (index, rotation = 0, flipped = false) => transform(NETS[index], rotation, flipped);
export const netName = (index) => `Net ${String(index + 1).padStart(2, '0')}`;
export const netKey = (cells) => signature(normalize(cells));
