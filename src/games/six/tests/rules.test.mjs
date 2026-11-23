import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, guess, currentPlayer, botChoice} from '../core/rules.mjs';
test('opening roll gives first player a score', () => {const g=createGame(['a','b'],4); assert.equal(g.scores.a,4);assert.equal(currentPlayer(g),'b');});
test('first round wrong guess resets score to zero', () => {const g=createGame(['a','b'],4);guess(g,'b','higher',2);assert.equal(g.scores.b,0);assert.equal(g.round,2);assert.deepEqual(g.alive,['a','b']);});
test('tie doubles winning roll', () => {const g=createGame(['a','b'],6);guess(g,'b','tie',6);assert.equal(g.scores.b,12);});
test('wrong guess eliminates only when below zero after opening round', () => {const g=createGame(['a','b'],6);guess(g,'b','higher',3);guess(g,'a','higher',1);assert.equal(g.scores.a,5);guess(g,'b','higher',1);assert.equal(g.over,true);assert.equal(g.winner,'a');});
test('twenty players admitted, twenty one rejected',()=>{assert.equal(createGame(Array.from({length:20},(_,i)=>String(i)),3).ids.length,20);assert.throws(()=>createGame(Array.from({length:21},(_,i)=>String(i)),3));});
test('bot returns a legal choice',()=>assert.ok(['higher','lower','tie'].includes(botChoice(5,4,12))));

// The number of rounds is fixed by the initial room size, not by survivors.
for (const count of [2, 5, 20]) {
  test(`${count} players play exactly ${6 + count} rounds`, () => {
    const ids = Array.from({ length: count }, (_, i) => `player-${i}`);
    const g = createGame(ids, 4);
    assert.equal(g.maxRounds, 6 + count);
    // Force correct guesses, so no one is eliminated before the round limit.
    for (let move = 1; move < count * g.maxRounds; move++) {
      const player = currentPlayer(g);
      const next = g.previous === 6 ? 5 : 6;
      const choice = next > g.previous ? 'higher' : 'lower';
      guess(g, player, choice, next);
      assert.equal(g.over, move === count * g.maxRounds - 1);
    }
    assert.equal(g.round, g.maxRounds + 1);
    assert.equal(g.moves, count * g.maxRounds - 1);
  });
}

test('eliminations and old room snapshots preserve initial round limit', () => {
  const g = createGame(['a', 'b', 'c'], 6);
  assert.equal(g.maxRounds, 9);
  guess(g, 'b', 'higher', 1); // Opening loss: zero, but still alive.
  guess(g, 'c', 'higher', 1); // Opening loss: zero, but still alive.
  assert.equal(g.round, 2);
  guess(g, 'a', 'higher', 1); // Lose 1, remain alive.
  guess(g, 'b', 'higher', 1); // Eliminate b, 0 - 1 < 0.
  assert.equal(g.alive.length, 2);
  assert.equal(g.maxRounds, 9);
  // Prior deployed rooms might have no maxRounds property.
  delete g.maxRounds;
  guess(g, 'c', 'higher', 1); // Eliminates c; rehydrates maxRounds.
  assert.equal(g.maxRounds, 9);
});
