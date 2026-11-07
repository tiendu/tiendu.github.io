import test from "node:test";
import assert from "node:assert/strict";
import {
  createBoard,
  createSoloBoard,
  frontier,
  play,
  provable,
} from "../src/mines/board.mjs";

for (const [i, mines] of [20, 28, 36, 46].entries()) {
  test(`fair fields for ${i + 2} players`, () => {
    const players = Array.from({ length: i + 2 }, (_, n) => String(n));
    let seed = 721;
    const random = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
    for (let n = 0; n < 100; n++) {
      const b = createBoard(players, random);
      assert.equal(b.size, 12 + 2 * i);
      assert.equal(b.clues.filter((x) => x === -1).length, mines);
      for (let cell = 0; cell < b.cells.length; cell++) {
        if (b.clues[cell] < 0) continue;
        let mines = 0;
        for (
          let y = Math.max(0, Math.floor(cell / b.size) - 1);
          y <= Math.min(b.size - 1, Math.floor(cell / b.size) + 1);
          y++
        )
          for (
            let x = Math.max(0, (cell % b.size) - 1);
            x <= Math.min(b.size - 1, (cell % b.size) + 1);
            x++
          )
            if (b.clues[y * b.size + x] === -1) mines++;
        assert.equal(b.clues[cell], mines);
      }
      assert.ok(provable(b));
      assert.ok(b.starts.every((x) => b.cells[x] === 0));
      assert.equal(new Set(b.starts).size, players.length);
    }
  });
}

test("frontiers merge, flags protect tiles, perfect clears finish", () => {
  const b = createBoard(["a", "b"]);
  const cell = [...frontier(b, "a")][0];
  assert.throws(() => play(b, "b", "dig", cell));
  play(b, "a", "flag", cell);
  assert.throws(() => play(b, "a", "dig", cell));
  play(b, "a", "unflag", cell);
  let connected = false;
  while (b.status !== "perfect") {
    let progress = false;
    for (const p of b.players) {
      const safe = [...frontier(b, p)].find((x) => b.clues[x] >= 0);
      if (safe !== undefined) {
        play(b, p, "dig", safe);
        if (b.status === "connected") {
          connected = true;
          assert.deepEqual(frontier(b, "a"), frontier(b, "b"));
        }
        progress = true;
      }
    }
    assert.ok(progress);
  }
  assert.equal(b.status, "perfect");
  assert.ok(connected || b.cells.filter((x) => x === null).length === b.mines);
});

test("digging the fuse absorbs one mine and the next ends the round", () => {
  const b = createBoard(["a", "b"]);
  const [fuse, a, c] = frontier(b, "a");
  b.fuseCell = fuse;
  assert.equal(b.fuses, 0);
  play(b, "a", "dig", fuse);
  assert.equal(b.fuses, 1);
  b.clues[a] = b.clues[c] = -1;
  play(b, "a", "dig", a);
  assert.equal(b.fuses, 0);
  assert.equal(b.status, "digging");
  play(b, "a", "dig", c);
  assert.equal(b.status, "lost");
  assert.throws(() => play(b, "a", "dig", c));
});

test("solo shares dig and flag rules with a 12×12 board and a reachable exit", () => {
  assert.throws(() => createBoard(["only online seat"]));
  for (let n = 0; n < 100; n++) {
    const board = createSoloBoard();
    assert.equal(board.size, 12);
    assert.equal(board.mines, 32);
    assert.equal(board.clues.filter((n) => n === -1).length, 32);
    assert.equal(board.exit, 143 - board.starts[0]);
    assert.equal(provable(board, 1), false);
    assert.equal(board.fuses, 0);
    assert.ok(provable(board));
    const [me] = board.players;
    const [first] = frontier(board, me);
    play(board, me, "flag", first);
    assert.throws(() => play(board, me, "dig", first));
    play(board, me, "unflag", first);
    while (board.status === "digging") {
      const safe = [...frontier(board, me)].find(
        (cell) => board.clues[cell] >= 0,
      );
      play(board, me, "dig", safe);
    }
    assert.ok(board.cells[board.exit] >= 0 && board.cells[board.exit] !== null);
    assert.ok(["connected", "perfect"].includes(board.status));
  }
});

test("corner contact does not merge patches or permit diagonal digs", () => {
  const board = {
    sideOnly: true,
    size: 3,
    starts: [0, 4],
    players: ["a", "b"],
    cells: [0, null, null, null, 0, null, null, null, null],
    flags: {},
    status: "digging",
    clues: Array(9).fill(0),
    exit: 4,
  };
  assert.deepEqual(frontier(board, "a"), new Set([1, 3]));
  assert.throws(() => play(board, "a", "dig", 5));
  assert.throws(() => play(board, "a", "flag", 5));
  assert.ok(!frontier(board, "b").has(2));
  play(board, "a", "dig", 1);
  assert.equal(board.status, "connected");
  assert.deepEqual(frontier(board, "a"), frontier(board, "b"));
});
test("solver rejects a diagonal-only route to a proven safe exit", () => {
  const board = {
    size: 4,
    starts: [0],
    clues: [0, 2, -1, 2, 2, 4, -1, 2, -1, -1, 2, 1, 2, 2, 1, 0],
    fuseCell: 1,
    exit: 15,
  };
  assert.equal(provable(board), true); // Legacy eight-way path crosses a corner.
  assert.equal(provable({ ...board, sideOnly: true }), false);
});
test("bounded solo generation recovers from repeatedly unsuitable layouts", () => {
  assert.ok(provable(createSoloBoard(() => 0)));
});
