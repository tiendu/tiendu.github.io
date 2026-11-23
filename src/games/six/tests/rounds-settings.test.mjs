import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, guess, currentPlayer, DEFAULT_ROUNDS } from '../core/rules.mjs';
import { roomRounds, setRoomRounds } from '../server/settings.mjs';

const playSafe = (game) => {
  const next = game.previous === 6 ? 5 : 6;
  guess(game, currentPlayer(game), next > game.previous ? 'higher' : 'lower', next);
};

test('ten rounds by default, independent of player count', () => {
  for (const count of [2, 5, 20]) {
    const g = createGame(Array.from({length:count}, (_,i)=>String(i)), 4);
    assert.equal(g.maxRounds, DEFAULT_ROUNDS);
    for (let i=1; i<count*DEFAULT_ROUNDS; i++) playSafe(g);
    assert.equal(g.over,true);
    assert.equal(g.moves,count*DEFAULT_ROUNDS-1);
  }
});

test('custom rounds 1, 8, 26 and 99 run the specified number of seat cycles', () => {
  for (const rounds of [1,8,26,99]) {
    const g=createGame(['a','b','c'],4,rounds);
    for(let i=1; i<rounds*3; i++) {
      assert.equal(g.over,false);
      playSafe(g);
    }
    assert.equal(g.over,true);
    assert.equal(g.moves,rounds*3-1);
    assert.equal(g.maxRounds,rounds);
  }
});

test('rounds settings reject bad types, fractions, negatives, zero and excessively long games', () => {
  for(const bad of [0,100,-1,1.1,'10',null,undefined,Infinity,NaN,[],{}]) {
    // Omitted undefined defaults to 10 by design.
    if(bad === undefined) continue;
    assert.throws(()=>createGame(['a','b'],4,bad), /Rounds must be/);
  }
});

test('host can set rounds before or after a game but not while it is running', () => {
  const room={host:'host',game:null,rounds:10};
  assert.equal(roomRounds(room),10);
  assert.equal(setRoomRounds(room,'host',26),26);
  assert.equal(roomRounds(room),26);
  room.game=createGame(['host','guest'],4,roomRounds(room));
  assert.throws(()=>setRoomRounds(room,'host',8),/during a match/);
  assert.throws(()=>setRoomRounds(room,'guest',8),/Only the host/);
  assert.equal(room.rounds,26);
  room.game.over=true;
  assert.equal(setRoomRounds(room,'host',8),8);
  assert.equal(roomRounds(room),8);
  assert.equal(room.game.maxRounds,26); // Existing game is immutable.
});

test('reject unauthorized settings and malformed limits without altering room state', () => {
  const room={host:'host',game:null,rounds:10};
  for(const wrong of [0,100,7.5,'9',null,NaN])
    assert.throws(()=>setRoomRounds(room,'host',wrong),/Rounds must be/);
  assert.throws(()=>setRoomRounds(room,'guest',17),/Only the host/);
  assert.equal(room.rounds,10);
  assert.equal(roomRounds({}),10); // Old room lease
});

test('opening roll and elimination still work with a short match', () => {
  const g=createGame(['a','b'],6,2);
  guess(g,'b','higher',1); // first-round wrong => 0 not eliminated
  assert.equal(g.over,false);
  assert.equal(g.scores.b,0);
  guess(g,'a','higher',1); // round 2 losing 1, still alive
  assert.equal(g.over,false);
  guess(g,'b','higher',1); // score goes negative -> out
  assert.equal(g.over,true);
  assert.equal(g.winner,'a');
});
