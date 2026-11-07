// Inline, top-down miner hats (no external images). All routes are cardinal.
const STEP = 45; // Existing mine tiles are 44px with a 1px grid gap.
const INSET = 4; // Existing #tiles grid padding.
const HAT = `<svg viewBox="0 0 36 36" aria-hidden="true" focusable="false">
  <path d="M4 21v-3C4 10 10 4 18 4s14 6 14 14v3l-5 5H9z" fill="#0c1611"/>
  <path d="M6 21v-3C6 11 11 6 18 6s12 5 12 12v3l-4 3H10z" fill="currentColor"/>
  <path d="M15 6h6v18h-6z" fill="#fff" opacity=".24"/>
  <path d="M4 23c6 4 22 4 28 0v4c-6 5-22 5-28 0z" fill="currentColor" stroke="#0c1611" stroke-width="1.5"/>
  <rect x="13" y="23" width="10" height="8" rx="2" fill="#18221d" stroke="#0c1611"/>
  <rect x="16" y="25" width="4" height="4" fill="#ffe5a0"/>
</svg>`;

function offset(cell, size) {
  return `translate(${INSET + (cell % size) * STEP}px, ${INSET + Math.floor(cell / size) * STEP}px)`;
}

// Shortest revealed route: no diagonal steps and no movement through covered cells.
// A just-dug mine/crater is allowed only at the destination.
export function cardinalRoute(board, from, to) {
  const { cells, size } = board;
  if (![from, to].every((n) => Number.isInteger(n) && n >= 0 && n < cells.length))
    return null;
  if (from === to) return [from];
  if (cells[to] === null) return null;
  const previous = new Map([[from, null]]);
  const queue = [from];
  for (let i = 0; i < queue.length && !previous.has(to); i++) {
    const cell = queue[i], row = Math.floor(cell / size), col = cell % size;
    const nextCells = [
      ...(row > 0 ? [cell - size] : []),
      ...(col > 0 ? [cell - 1] : []),
      ...(col + 1 < size ? [cell + 1] : []),
      ...(row + 1 < size ? [cell + size] : []),
    ];
    for (const next of nextCells) {
      if (previous.has(next)) continue;
      if (next !== to && (cells[next] === null || cells[next] < 0)) continue;
      previous.set(next, cell);
      queue.push(next);
    }
  }
  if (!previous.has(to)) return null;
  const route = [];
  for (let cell = to; cell !== null; cell = previous.get(cell)) route.push(cell);
  return route.reverse();
}

export function renderMinerHats(tiles, board, colors) {
  let layer = tiles.querySelector(":scope > .miners");
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "miners";
    layer.setAttribute("aria-hidden", "true");
    tiles.append(layer); // Tile buttons still occupy children[0 .. size² - 1].
  }
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  board.players.forEach((_, seat) => {
    const target = board.positions?.[seat] ?? board.starts[seat];
    if (!Number.isInteger(target) || target < 0 || target >= board.cells.length)
      return;
    let hat = layer.querySelector(`[data-seat="${seat}"]`);
    if (!hat) {
      hat = document.createElement("span");
      hat.className = "miner-hat";
      hat.dataset.seat = String(seat);
      hat.style.color = colors[seat % colors.length];
      hat.innerHTML = HAT; // Constant trusted markup; no player-supplied HTML.
      hat.style.transform = offset(target, board.size);
      hat.dataset.cell = String(target);
      layer.append(hat);
      return;
    }
    const from = Number(hat.dataset.cell);
    if (from === target) return;
    const path = cardinalRoute(board, from, target);
    hat.getAnimations?.().forEach((animation) => animation.cancel());
    hat.dataset.cell = String(target);
    hat.style.transform = offset(target, board.size);
    if (!reducedMotion && path && path.length > 1) {
      hat.animate?.(
        path.map((cell, i) => ({
          transform: offset(cell, board.size),
          offset: i / (path.length - 1),
        })),
        { duration: Math.min(1500, (path.length - 1) * 110), easing: "linear" },
      );
    }
  });
}
