export const WIDTH = 13;
export const HEIGHT = 19;
export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}
export function maze(seed, tutorial = false) {
  const random = rng(seed);
  const a = Array.from({length: HEIGHT}, () => Array(WIDTH).fill(1));
  const stack = [[1, 1]];
  a[1][1] = 0;
  while (stack.length) {
    const [x, y] = stack.at(-1);
    const options = DIRS.map(([dx, dy]) => [x + 2 * dx, y + 2 * dy])
      .filter(([u, v]) => u > 0 && v > 0 && u < WIDTH - 1 && v < HEIGHT - 1 && a[v][u]);
    if (!options.length) { stack.pop(); continue; }
    const [u, v] = options[Math.floor(random() * options.length)];
    a[v][u] = a[(y + v) / 2][(x + u) / 2] = 0;
    stack.push([u, v]);
  }
  // Braid the spanning tree: removing interior walls adds alternative routes.
  const candidates = [];
  for (let y = 1; y < HEIGHT - 1; y++) {
    for (let x = 1; x < WIDTH - 1; x++) {
      if (a[y][x] && ((!a[y][x-1] && !a[y][x+1]) || (!a[y-1][x] && !a[y+1][x]))) candidates.push([x, y]);
    }
  }
  for (let i = 0; i < (tutorial ? 25 : 18) && candidates.length; i++) {
    const [x, y] = candidates.splice(Math.floor(random() * candidates.length), 1)[0];
    a[y][x] = 0;
  }
  // Open escape routes at remaining dead ends, keeping the outer boundary closed.
  for (const [x,y] of openCells(a)) {
    if (degree(a,x,y) !== 1) continue;
    const options = DIRS.map(([dx,dy]) => [x+dx,y+dy])
      .filter(([u,v]) => u>0 && v>0 && u<WIDTH-1 && v<HEIGHT-1 && a[v][u] && degree(a,u,v)>=2);
    if (options.length) {
      const [u,v] = options[Math.floor(random()*options.length)];
      a[v][u]=0;
    }
  }
  return a;
}

export const isOpen = (board, x, y) => board[y]?.[x] === 0;
export const openCells = board => board.flatMap((row, y) => row.flatMap((v, x) => v === 0 ? [[x,y]] : []));
export const degree = (board, x, y) => DIRS.filter(([dx,dy]) => isOpen(board,x+dx,y+dy)).length;
export function distances(board, [x,y]) {
  const result = board.map(row => row.map(() => Infinity));
  if (!isOpen(board,x,y)) return result;
  const queue = [[x,y]];
  result[y][x] = 0;
  for (let i=0; i<queue.length; i++) {
    const [u,v] = queue[i];
    for (const [dx,dy] of DIRS) {
      const a=u+dx, b=v+dy;
      if (!isOpen(board,a,b) || result[b][a] !== Infinity) continue;
      result[b][a] = result[v][u]+1;
      queue.push([a,b]);
    }
  }
  return result;
}
// Two distant anchors, then four distinct non-dead-end cells near each.
export function spawnCells(board, seed) {
  const cells = openCells(board).filter(([x,y]) => degree(board,x,y) >= 2);
  const random = rng(seed);
  const farthest = origin => {
    const d = distances(board,origin);
    return cells.reduce((best,p) => d[p[1]][p[0]] > d[best[1]][best[0]] ? p : best);
  };
  const a = farthest(cells[Math.floor(random()*cells.length)]), b = farthest(a);
  const near = anchor => {
    const d = distances(board,anchor);
    return [...cells].sort((p,q) => d[p[1]][p[0]]-d[q[1]][q[0]]).slice(0,4);
  };
  return [...near(a), ...near(b)];
}
