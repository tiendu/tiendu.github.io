import test from "node:test";
import assert from "node:assert/strict";
import { createSoloBoard, frontier, play } from "../src/mines/board.mjs";
import { cardinalRoute } from "../../src/scripts/games/mines-hats.mjs";

test("hat starts on pennant and advances only after successful digs", () => {
  const board = createSoloBoard();
  const start = board.starts[0];
  assert.deepEqual(board.positions, [start]);
  const safe = [...frontier(board, "solo")].find((n) => board.clues[n] >= 0);
  assert.notEqual(safe, undefined);
  play(board, "solo", "flag", safe);
  assert.deepEqual(board.positions, [start]);
  play(board, "solo", "unflag", safe);
  assert.deepEqual(board.positions, [start]);
  play(board, "solo", "dig", safe);
  assert.deepEqual(board.positions, [safe]);

  // Older persistent rooms have no 'positions' field; upgrade on first dig.
  delete board.positions;
  const next = [...frontier(board, "solo")].find((n) => board.clues[n] >= 0);
  assert.notEqual(next, undefined);
  play(board, "solo", "dig", next);
  assert.deepEqual(board.positions, [next]);
});

test("animation route is strictly cardinal, using only revealed cells", () => {
  const board = { size: 3, cells: [0, 0, 0, null, null, 0, null, null, -1] };
  assert.deepEqual(cardinalRoute(board, 0, 8), [0, 1, 2, 5, 8]);
  board.cells[5] = null;
  assert.equal(cardinalRoute(board, 0, 8), null);
  board.cells[5] = 0;
  board.cells[4] = 0;
  assert.deepEqual(cardinalRoute(board, 0, 4), [0, 1, 4]);
  assert.equal(cardinalRoute(board, -1, 4), null);
});
