import test from "node:test";
import assert from "node:assert/strict";
import { createBoard, createSoloBoard, frontier, play, provable } from "../src/mines/board.mjs";
import { escapeRoutePaths, isFlawlessEscape } from "../../src/scripts/games/mines-elevator.mjs";

test("escape routes use only revealed cardinal steps", () => {
  const board = { size: 3, exit: 2, starts: [6, 8],
    cells: [0, 0, 0, 0, -1, 0, 0, null, 0] };
  const routes = escapeRoutePaths(board);
  assert.deepEqual(routes.paths[0], [6, 3, 0, 1, 2]);
  assert.deepEqual(routes.paths[1], [8, 5, 2]);
  assert.equal(routes.owners.get(2), -1);
  for (const path of routes.paths) for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    assert.ok(Math.abs(a - b) === 3 ||
      (Math.floor(a / 3) === Math.floor(b / 3) && Math.abs(a - b) === 1));
  }
});

test("player count determines neutral, reachable fuse caches", () => {
  for (let count = 1; count <= 5; count++) {
    const players = Array.from({ length: count }, (_, i) => String(i));
    const board = count === 1 ? createSoloBoard() : createBoard(players);
    assert.equal(board.fuseCells.length, count);
    assert.equal(new Set(board.fuseCells).size, count);
    assert.ok(board.fuseCells.every((n) => board.clues[n] >= 0));
    assert.equal(board.fuses, 0);
    assert.equal(board.fusesUsed, 0);
    assert.ok(provable(board));
  }
});

test("bounded deterministic fallbacks remain valid", () => {
  for (let seats = 1; seats <= 5; seats++) {
    const players = Array.from({ length: seats }, (_, n) => String(n));
    const board = seats === 1 ? createSoloBoard(() => 0) : createBoard(players, () => 0);
    assert.equal(board.fuseCells.length, seats);
    assert.ok(provable(board));
  }
});

test("collecting neutral caches does not cost a flawless win", () => {
  const board = createBoard(["red", "blue", "green"]);
  const cache = [...frontier(board, "red")][0];
  board.fuseCells[0] = cache;
  board.clues[cache] = 0;
  play(board, "red", "dig", cache);
  assert.equal(board.fuses, 1);
  assert.equal(board.fusesUsed, 0);
  assert.equal(isFlawlessEscape(board), true);
});

test("a fuse collected by red protects blue from a bomb", () => {
  const board = createBoard(["red", "blue"]);
  const cache = [...frontier(board, "red")][0];
  const bomb = [...frontier(board, "blue")][0];
  board.fuseCells[0] = cache;
  board.clues[cache] = 0;
  play(board, "red", "dig", cache);
  assert.equal(board.fuses, 1);
  board.clues[bomb] = -1;
  play(board, "blue", "dig", bomb);
  assert.equal(board.fuses, 0);
  assert.equal(board.fusesUsed, 1);
  assert.equal(board.status, "digging");
  assert.equal(isFlawlessEscape(board), false);
});

test("team can collect and spend more than one fuse", () => {
  const board = createBoard(["a", "b", "c"]);
  const [a, b] = [...frontier(board, "a")];
  assert.ok([a, b].every(Number.isInteger));
  board.fuseCells = [a, b, board.fuseCells[2]];
  board.clues[a] = board.clues[b] = 0;
  play(board, "a", "dig", a);
  play(board, "a", "dig", b);
  assert.equal(board.fuses, 2);
  for (let hit = 0; hit < 3; hit++) {
    const bomb = [...frontier(board, "a")].find(
      (cell) => !board.fuseCells.includes(cell));
    assert.ok(Number.isInteger(bomb));
    board.clues[bomb] = -1;
    play(board, "a", "dig", bomb);
    assert.equal(board.status, hit < 2 ? "digging" : "lost");
  }
  assert.equal(board.fuses, 0);
  assert.equal(board.fusesUsed, 2);
});

test("flawless ignores unopened bricks but not an explosion", () => {
  const board = { cells: [0, null, null], fusesUsed: 0 };
  assert.equal(isFlawlessEscape(board), true);
  board.fusesUsed = 1;
  assert.equal(isFlawlessEscape(board), false);
  board.fusesUsed = 0;
  board.cells[1] = -1;
  assert.equal(isFlawlessEscape(board), false);
});
