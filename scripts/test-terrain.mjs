import test from 'node:test';
import assert from 'node:assert/strict';
import { bases, layoutSignature, seededMultiplayerTerrain } from '../public/games/unfold/terrain.mjs';

// This test checks a stable contract, not a specific generated board picture.
test('competitive terrain generation is deterministic and keeps cubes intact', () => {
  for (const count of [2, 3, 4]) {
    const size = count === 2 ? 13 : count === 3 ? 17 : 19;
    const makeState = () => ({
      size, seed: 41414, nextId: 1,
      players: bases(size, count, 'competitive').map((base, id) => ({ id, base })),
      cubes: [], obstacles: [], goal: null,
    });
    const a = makeState(), b = makeState();
    seededMultiplayerTerrain(a);
    seededMultiplayerTerrain(b);
    assert.deepEqual(a, b);
    assert(a.cubes.length > 0);
    assert(a.cubes.every(c => c.owner === null && c.cells.length === 6));
    const seen = new Set(a.players.map(p => p.base.join(',')));
    for (const item of [...a.cubes, ...a.obstacles]) {
      for (const cell of item.cells) {
        const k = cell.join(',');
        assert(!seen.has(k), `overlapping terrain at ${k}`);
        seen.add(k);
      }
    }
    assert.equal(layoutSignature(a), layoutSignature(b));
    assert.equal(layoutSignature(a).length, size * size);
  }
});
