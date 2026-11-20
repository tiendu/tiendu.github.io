import test from "node:test";
import assert from "node:assert/strict";
import { advanceTallies, loadTallies, saveTallies, visibleTallyMarks, winnerForResult } from "../tally.mjs";

test("each outcome is credited to the correct side", () => {
  assert.equal(winnerForResult("win"), "player");
  assert.equal(winnerForResult("blackjack"), "player");
  assert.equal(winnerForResult("lose"), "dealer");
  assert.equal(winnerForResult("bust"), "dealer");
  assert.equal(winnerForResult("push"), null);
  assert.equal(winnerForResult(null), null);
});

test("wins are counted independently; pushes do nothing", () => {
  const start = { dealer: 4, player: 9 };
  assert.deepEqual(advanceTallies(start, "win"), { dealer: 4, player: 10 });
  assert.deepEqual(advanceTallies(start, "blackjack"), { dealer: 4, player: 10 });
  assert.deepEqual(advanceTallies(start, "bust"), { dealer: 5, player: 9 });
  assert.deepEqual(advanceTallies(start, "lose"), { dealer: 5, player: 9 });
  assert.equal(advanceTallies(start, "push"), start);
});

test("display 25 marks, then start over at 26 without resetting total", () => {
  const cases = [[0, 0], [1, 1], [4, 4], [5, 5], [24, 24], [25, 25], [26, 1], [49, 24], [50, 25], [51, 1], [100, 25]];
  for (const [input, expected] of cases) assert.equal(visibleTallyMarks(input), expected);
});

test("saved counts round-trip, including at a new 25-mark page", () => {
  const state = new Map();
  const storage = { getItem: (key) => state.get(key) || null, setItem: (key, value) => state.set(key, value) };
  saveTallies(storage, { dealer: 26, player: 125 });
  assert.deepEqual(loadTallies(storage), { dealer: 26, player: 125 });
});

test("missing, corrupt, or blocked storage is safe", () => {
  assert.deepEqual(loadTallies(null), { dealer: 0, player: 0 });
  assert.deepEqual(loadTallies({ getItem: () => "{broken" }), { dealer: 0, player: 0 });
  assert.deepEqual(loadTallies({ getItem: () => '{"player":-2,"dealer":1.5}' }), { dealer: 0, player: 0 });
  const blocked = { getItem: () => { throw Error("blocked"); }, setItem: () => { throw Error("blocked"); } };
  assert.deepEqual(loadTallies(blocked), { dealer: 0, player: 0 });
  assert.doesNotThrow(() => saveTallies(blocked, { dealer: 1, player: 2 }));
});
