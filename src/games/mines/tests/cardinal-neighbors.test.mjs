import test from "node:test";
import assert from "node:assert/strict";
import { cardinalNeighbors } from "../client/cardinal-neighbors.mjs";

// Order matters: tie-breaking in both movement and escape animations uses BFS.
test("cardinal neighbors preserve grid boundaries and BFS order", () => {
  assert.deepEqual(cardinalNeighbors(0, 3), [1, 3]);
  assert.deepEqual(cardinalNeighbors(4, 3), [1, 3, 5, 7]);
  assert.deepEqual(cardinalNeighbors(8, 3), [5, 7]);
});
