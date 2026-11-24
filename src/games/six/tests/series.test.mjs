import test from 'node:test';
import assert from 'node:assert/strict';
import { recordWin } from '../core/series.mjs';

test('series counts completed wins independently for each player', () => {
  const initial = {};
  const one = recordWin(initial, 'alice');
  const two = recordWin(one, 'bob');
  const three = recordWin(two, 'alice');
  assert.deepEqual(three, {alice: 2, bob: 1});
  assert.deepEqual(initial, {}); // Returns a new map, never edits old snapshots.
});

test('draws do not award a match win', () => {
  const counts = {alice: 2, bob: 1};
  assert.strictEqual(recordWin(counts, null), counts);
  assert.strictEqual(recordWin(counts, undefined), counts);
});

test('legacy rooms without a wins map begin at zero', () => {
  assert.deepEqual(recordWin(undefined, 'alice'), {alice: 1});
});
