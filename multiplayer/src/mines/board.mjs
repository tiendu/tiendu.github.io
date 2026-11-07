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

const edges = new Map();
function sideNeighbors(size) {
  if (!edges.has(size)) {
    edges.set(
      size,
      neighbors(size).map((ring, cell) =>
        ring.filter(
          (next) =>
            Math.floor(next / size) === Math.floor(cell / size) ||
            next % size === cell % size,
        ),
      ),
    );
  }
  return edges.get(size);
}

// Stored rooms finish under the movement rules used to generate their board.
function movement(board) {
  return board.sideOnly ? sideNeighbors(board.size) : neighbors(board.size);
}

// Only clues on revealed tiles participate in the proof. Every inferred dig
// borders an already open component containing at least one player's pennant.
export function provable(board, numberedWaves = Infinity) {
  const requireFuse = numberedWaves === Infinity;
  const { size, clues, starts, exit } = board;
  const near = neighbors(size);
  const open = new Set(starts),
    marked = new Set();
  const adjacent = movement(board);
  const safe = new Set(starts);
  let changed;
  do {
    changed = false;
    const inferred = new Set();
    for (const tile of open) {
      const unknown = near[tile].filter((n) => !safe.has(n) && !marked.has(n));
      if (!unknown.length) continue;
      const remaining =
        clues[tile] - near[tile].filter((n) => marked.has(n)).length;
      if (remaining === unknown.length) {
        for (const n of unknown) marked.add(n);
        changed = true;
      } else if (remaining === 0) {
        for (const n of unknown) (clues[tile] === 0 ? safe : inferred).add(n);
        if (clues[tile] === 0) changed = true;
      }
    }
    // A diagonal deduction can be remembered, but its clue is unreadable
    // until a dig from a side-connected patch actually opens the square.
    for (const tile of open) {
      for (const n of adjacent[tile]) {
        if (safe.has(n) && !open.has(n)) {
          open.add(n);
          changed = true;
        }
      }
    }
    if (!changed && inferred.size && numberedWaves > 0) {
      for (const n of inferred) safe.add(n);
      numberedWaves--;
      changed = true;
    }
  } while (changed);
  const connected = component(adjacent, starts[0], (n) => open.has(n));
  return (
    connected.has(exit) &&
    starts.every((n) => connected.has(n)) &&
    (!requireFuse || (Array.isArray(board.fuseCells)
      ? board.fuseCells.every((cell) => connected.has(cell))
      : connected.has(board.fuseCell)))
  );
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
    mines = players.length === 1 ? 32 : counts[preset];
  const near = neighbors(size),
    mid = (size - 1) / 2;
  for (let attempt = 0; attempt <= 240; attempt++) {
    // A prevalidated seed per seat count bounds retries on hard fields.
    // The fallback goes through all the same reachability and difficulty checks.
    if (attempt === 240) {
      let seed = [25, 1, 2, 3, 1][players.length - 1];
      random = () =>
        (seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 2 ** 32;
    }
    const angle = random() * Math.PI * 2;
    const starts = players.map((_, i) => {
      const a =
        angle + (Math.PI * 2 * i) / players.length + (random() - 0.5) * 0.22;
      return (
        Math.round(mid + (mid - 1) * Math.sin(a)) * size +
        Math.round(mid + (mid - 1) * Math.cos(a))
      );
    });
    const solo = players.length === 1;
    const exit = solo
      ? size * size - 1 - starts[0]
      : (Math.floor(mid) - 1 + Math.floor(random() * 3)) * size +
        Math.floor(mid) -
        1 +
        Math.floor(random() * 3);
    const safe = new Set([exit, ...starts, ...starts.flatMap((i) => near[i])]);
    const distance = (a, b) =>
      Math.max(
        Math.abs((a % size) - (b % size)),
        Math.abs(Math.floor(a / size) - Math.floor(b / size)),
      );
    const detours = near
      .map((_, i) => i)
      .filter(
        (i) =>
          !safe.has(i) &&
          distance(i, exit) >= 3 &&
          starts.every((start) => distance(start, i) >= 3) &&
          (!solo ||
            distance(starts[0], i) + distance(i, exit) >=
              distance(starts[0], exit) + 3),
      );
    // One neutral cache per miner, with one shared team inventory.
    const fuseCells = [];
    const remaining = [...detours];
    for (let i = 0; i < players.length; i++) {
      const choice = Math.floor(random() * remaining.length);
      fuseCells.push(remaining.splice(choice, 1)[0]);
    }
    if (fuseCells.some((cell) => cell === undefined)) continue;
    for (const cell of fuseCells) safe.add(cell);
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
      sideOnly: true,
      mines,
      starts,
      exit,
      clues,
      players: [...players],
      positions: [...starts],
      fuseCells,
      fuses: 0,
      fusesUsed: 0,
      cells: near.map(() => null),
      flags: {},
      status: "digging",
    };
    for (const i of starts) board.cells[i] = 0;
    // A solo crossing must leave the initial zero clearing and its numbered rim.
    if (solo) {
      const clearing = component(
        sideNeighbors(size),
        starts[0],
        (n) => clues[n] === 0,
      );
      if ([...clearing].some((n) => distance(n, exit) <= 3)) continue;
    }
    if (
      (!solo || !provable(board, 1)) &&
      provable(board) &&
      component(sideNeighbors(size), starts[0], (n) => clues[n] >= 0).size ===
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
  const near = movement(board);
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
  (board.positions ??= [...board.starts])[seat] = cell;
  if (board.cells[cell] === -1) {
    if (Array.isArray(board.fuseCells)) {
      // Every miner can use the team's collected fuses.
      if (board.fuses > 0) {
        board.fuses--;
        board.fusesUsed = (board.fusesUsed ?? 0) + 1;
      } else {
        board.status = board.status === "connected" ? "won" : "lost";
      }
    } else {
      // Preserve the fuse semantics of active rooms created by old Workers.
      const protectedHit = board.fuses > (board.fuseCell === undefined ? 1 : 0);
      board.fuses = Math.max(0, board.fuses - 1);
      if (!protectedHit)
        board.status = board.status === "connected" ? "won" : "lost";
    }
    return;
  }
  if (Array.isArray(board.fuseCells)) {
    if (board.fuseCells.includes(cell)) board.fuses++;
  } else if (cell === board.fuseCell) board.fuses = 1;
  if (!Array.isArray(board.fuseCells) &&
      board.cells.every((value, i) => value !== null || board.clues[i] === -1))
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
  const near = movement(board);
  for (const n of component(
    near,
    start,
    (i) => board.cells[i] !== null && board.cells[i] >= 0,
  )) {
    for (const tile of near[n]) if (board.cells[tile] === null) cells.add(tile);
  }
  return cells;
}

// Discover one shortest open route per pennant, sharing the trunk at the exit.
export function escapeRoutes(board) {
  const adjacent = movement(board);
  const parent = new Map([[board.exit, null]]);
  const distance = new Map([[board.exit, 0]]);
  for (const cell of parent.keys()) {
    for (const next of adjacent[cell]) {
      if (
        parent.has(next) ||
        board.cells[next] == null ||
        board.cells[next] < 0
      )
        continue;
      parent.set(next, cell);
      distance.set(next, distance.get(cell) + 1);
    }
  }
  const routes = new Map();
  for (let cell of board.starts) {
    while (parent.has(cell) && !routes.has(cell)) {
      routes.set(cell, distance.get(cell));
      cell = parent.get(cell);
    }
  }
  return routes;
}
