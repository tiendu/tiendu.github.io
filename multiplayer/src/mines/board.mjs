const sizes = [12, 14, 16, 18];
const counts = [20, 28, 36, 46];
const grids = new Map();

function neighbors(size) {
  if (!grids.has(size)) {
    grids.set(
      size,
      Array.from({ length: size * size }, (_, cell) => {
        const result = [];
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const x = (cell % size) + dx,
              y = Math.floor(cell / size) + dy;
            if ((dx || dy) && x >= 0 && x < size && y >= 0 && y < size)
              result.push(y * size + x);
          }
        return result;
      }),
    );
  }
  return grids.get(size);
}

// Only clues on revealed tiles participate in the proof. Every inferred dig
// borders an already open component containing at least one player's pennant.
export function provable(board) {
  const { size, clues, starts, exit } = board;
  const near = neighbors(size);
  const open = new Set(starts),
    marked = new Set();
  let changed;
  do {
    changed = false;
    for (const tile of open) {
      const unknown = near[tile].filter((n) => !open.has(n) && !marked.has(n));
      if (!unknown.length) continue;
      const remaining =
        clues[tile] - near[tile].filter((n) => marked.has(n)).length;
      const result =
        remaining === 0 ? open : remaining === unknown.length ? marked : null;
      if (result) {
        for (const n of unknown) result.add(n);
        changed = true;
      }
    }
  } while (changed);
  const connected = component(near, starts[0], (n) => open.has(n));
  return connected.has(exit) && starts.every((n) => connected.has(n));
}

function component(near, start, allowed) {
  const seen = new Set([start]);
  for (const n of seen)
    for (const next of near[n]) if (allowed(next)) seen.add(next);
  return seen;
}

export function createBoard(players, random = Math.random) {
  if (players.length < 2 || players.length > 5)
    throw Error("Start with 2–5 players.");
  return generateBoard(players, players.length - 2, random);
}

export function createSoloBoard(random = Math.random) {
  return generateBoard(["solo"], 0, random);
}

function generateBoard(players, preset, random) {
  const size = sizes[preset],
    mines = counts[preset];
  const near = neighbors(size),
    mid = (size - 1) / 2;
  for (let attempt = 0; attempt < 40; attempt++) {
    const angle = random() * Math.PI * 2;
    const starts = players.map((_, i) => {
      const a =
        angle + (Math.PI * 2 * i) / players.length + (random() - 0.5) * 0.22;
      return (
        Math.round(mid + (mid - 1) * Math.sin(a)) * size +
        Math.round(mid + (mid - 1) * Math.cos(a))
      );
    });
    const exit =
      (Math.floor(mid) - 1 + Math.floor(random() * 3)) * size +
      Math.floor(mid) -
      1 +
      Math.floor(random() * 3);
    const safe = new Set([exit, ...starts, ...starts.flatMap((i) => near[i])]);
    const pool = near.map((_, i) => i).filter((i) => !safe.has(i));
    const clues = Array(near.length).fill(0);
    for (let i = 0; i < mines; i++) {
      const j = i + Math.floor(random() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
      clues[pool[i]] = -1;
    }
    near.forEach((tiles, n) => {
      if (clues[n] !== -1)
        clues[n] = tiles.filter((i) => clues[i] === -1).length;
    });
    const board = {
      size,
      mines,
      starts,
      exit,
      clues,
      players: [...players],
      fuses: 2,
      cells: near.map(() => null),
      flags: {},
      status: "digging",
    };
    for (const i of starts) board.cells[i] = 0;
    if (
      provable(board) &&
      component(near, starts[0], (n) => clues[n] >= 0).size ===
        clues.length - mines
    )
      return board;
  }
  throw Error("Could not find a fair field. Start again.");
}

export function play(board, player, type, cell) {
  if (!["digging", "connected"].includes(board.status))
    throw Error("Round finished.");
  const seat = board.players.indexOf(player);
  if (
    seat < 0 ||
    !Number.isInteger(cell) ||
    cell < 0 ||
    cell >= board.cells.length
  )
    throw Error("Invalid tile.");
  const near = neighbors(board.size);
  const open = (i) => board.cells[i] !== null && board.cells[i] >= 0;
  const patch = component(near, board.starts[seat], open);
  if (board.cells[cell] !== null || !near[cell].some((n) => patch.has(n)))
    throw Error("Choose a covered tile beside your patch.");
  if (type === "flag") {
    if (board.flags[cell] !== undefined) throw Error("Already flagged.");
    board.flags[cell] = player;
    return;
  }
  if (type === "unflag") {
    delete board.flags[cell];
    return;
  }
  if (type !== "dig" || board.flags[cell] !== undefined)
    throw Error("Remove the flag before digging.");
  board.cells[cell] = board.clues[cell];
  if (board.cells[cell] === -1) {
    if (--board.fuses === 0)
      board.status = board.status === "connected" ? "won" : "lost";
    return;
  }
  if (board.cells.every((value, i) => value !== null || board.clues[i] === -1))
    board.status = "perfect";
  else if (board.status === "digging") {
    const joined = component(near, cell, open);
    if (joined.has(board.exit) && board.starts.every((n) => joined.has(n)))
      board.status = "connected";
  }
}

export function frontier(board, id) {
  const start = board.starts[board.players.indexOf(id)];
  const cells = new Set();
  if (start === undefined) return cells;
  const near = neighbors(board.size);
  for (const n of component(
    near,
    start,
    (i) => board.cells[i] !== null && board.cells[i] >= 0,
  )) {
    for (const tile of near[n]) if (board.cells[tile] === null) cells.add(tile);
  }
  return cells;
}
