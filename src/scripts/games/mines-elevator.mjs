// Mines escape UI. The board and server remain authoritative for turns / status.
// Static SVG markup: no user-provided strings are interpreted as HTML.
const ELEVATOR = `<span class="mine-elevator" aria-hidden="true">
  <svg viewBox="0 0 44 44" focusable="false" aria-hidden="true">
    <rect x="2" y="2" width="40" height="40" rx="2" fill="#16201e" stroke="#e4bd65" stroke-width="3"/>
    <path d="M5 5h34v6H5zM5 33h34v6H5z" fill="#302e28" stroke="#70614a" stroke-width="1"/>
    <path d="M6 8l5-3m2 6 6-6m2 6 6-6m2 6 6-6" stroke="#edbf50" stroke-width="3"/>
    <rect x="9" y="12" width="26" height="20" fill="#081612" stroke="#bd994b" stroke-width="2"/>
    <path class="mine-shaft-light" d="M13 14h18v16H13z" fill="#7bea99" opacity=".1"/>
    <path class="mine-gate-left" d="M11 13h10v18H11z" fill="#596763" stroke="#273932" stroke-width="2"/>
    <path class="mine-gate-right" d="M23 13h10v18H23z" fill="#596763" stroke="#273932" stroke-width="2"/>
    <path d="M21 13v18m2-18v18" stroke="#b9b2a0" stroke-width="1"/>
    <circle class="mine-shaft-signal" cx="35" cy="8" r="3" fill="#efa840" stroke="#312716" stroke-width="1"/>
  </svg>
  <span class="mine-exit-caption">EXIT</span>
</span>`;

export function renderMineExit(tile, value) {
  // The regular tile paint refreshes its children on each render.
  tile.classList.add("mine-exit");
  tile.querySelector(":scope > .mine-elevator")?.remove();
  tile.insertAdjacentHTML("beforeend", ELEVATOR);
  if (Number.isInteger(value) && value > 0) {
    const plaque = document.createElement("span");
    plaque.className = "mine-exit-clue";
    plaque.textContent = String(value);
    tile.lastElementChild.append(plaque);
  }
}

// Flawless means nobody set off a bomb or consumed a fuse. Collecting (or
// leaving behind) caches does not affect the result. Craters cover legacy rooms.
export function isFlawlessEscape(board) {
  return Array.isArray(board?.cells) &&
    !board.cells.includes(-1) && (board.fusesUsed ?? 0) === 0;
}

// One shortest cardinal route from each starting tile to the elevator.
// Overlapping portions are gold; individual portions keep each player's color.
export function escapeRoutePaths(board) {
  const parents = new Map();
  const distance = new Map();
  const paths = [];
  const owners = new Map();
  const { size, cells, exit, starts } = board;
  if (!Number.isInteger(exit) || !Number.isInteger(size) || size <= 0 ||
      exit < 0 || exit >= cells.length || cells[exit] == null || cells[exit] < 0)
    return { paths, owners, distance };
  parents.set(exit, null);
  distance.set(exit, 0);
  const queue = [exit];
  for (let i = 0; i < queue.length; i++) {
    const n = queue[i];
    const row = Math.floor(n / size), col = n % size;
    const neighbors = [
      ...(row > 0 ? [n - size] : []),
      ...(col > 0 ? [n - 1] : []),
      ...(col + 1 < size ? [n + 1] : []),
      ...(row + 1 < size ? [n + size] : []),
    ];
    for (const neighbor of neighbors) {
      if (parents.has(neighbor) || cells[neighbor] == null || cells[neighbor] < 0)
        continue;
      parents.set(neighbor, n);
      distance.set(neighbor, distance.get(n) + 1);
      queue.push(neighbor);
    }
  }
  for (const [seat, start] of starts.entries()) {
    if (!parents.has(start)) continue;
    const path = [];
    for (let at = start; at !== null; at = parents.get(at)) {
      path.push(at);
      if (!owners.has(at)) owners.set(at, seat);
      else if (owners.get(at) !== seat) owners.set(at, -1);
    }
    paths.push(path);
  }
  return { paths, owners, distance };
}

export function renderMineVictory(tiles, board, colors, banner, solo) {
  // A normal connected win can qualify as flawless with most bricks untouched.
  const phase = ["perfect", "won"].includes(board.status) ?
    (isFlawlessEscape(board) ? "perfect" : "won") :
    board.status === "connected" ? "connected" : "digging";
  const prior = tiles.dataset.mineEndingPhase;
  const changed = prior !== phase;
  if (changed) {
    tiles.classList.remove("mine-ending-digging", "mine-ending-connected",
      "mine-ending-won", "mine-ending-perfect", "mine-ending-animate");
    tiles.classList.add("mine-ending-" + phase);
    // Initial render of a finished room shows final state without replaying a win.
    if (prior && prior !== "fresh" && phase !== "digging")
      tiles.classList.add("mine-ending-animate");
    tiles.dataset.mineEndingPhase = phase;
  }
  const hasRoute = phase !== "digging";
  const { owners, distance } = hasRoute ? escapeRoutePaths(board) :
    { owners: new Map(), distance: new Map() };
  const maxDistance = Math.max(1, ...distance.values());
  for (let n = 0; n < board.cells.length; n++) {
    const tile = tiles.children[n];
    if (!tile) continue;
    const seat = owners.get(n);
    if (seat !== undefined) {
      tile.dataset.escape = "";
      tile.style.setProperty("--escape-ink", seat === -1 ? "#f4d97e" :
        colors[seat % colors.length]);
      tile.style.setProperty("--escape-delay",
        `${Math.round(850 * (1 - distance.get(n) / maxDistance))}ms`);
    } else {
      delete tile.dataset.escape;
      tile.style.removeProperty("--escape-ink");
      tile.style.removeProperty("--escape-delay");
    }
    const isSafeBomb = phase === "perfect" && board.clues[n] === -1 &&
      board.cells[n] === null;
    if (isSafeBomb) tile.dataset.intactMine = "";
    else delete tile.dataset.intactMine;
  }
  const finished = phase === "won" || phase === "perfect";
  banner.hidden = !finished;
  if (finished) {
    const message = phase === "perfect" ? "FLAWLESS ESCAPE!" :
      solo ? "YOU ESCAPED!" : "EVERYONE ESCAPED!";
    if (banner.textContent !== message) banner.textContent = message;
    banner.classList.toggle("mine-perfect-banner", phase === "perfect");
  } else {
    banner.classList.remove("mine-perfect-banner");
  }
}
