import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, guess, currentPlayer, rollDie, botChoice, allowedChoice, TIE_JACKPOTS, DEFAULT_SIDES } from '../core/rules.mjs';
import { dieSvg } from '../client/dice.mjs';
import { roomDieSides, roomRounds, setRoomSettings } from '../server/settings.mjs';

test('new matches default to D12 and all dice roll strictly within their faces', () => {
  assert.equal(DEFAULT_SIDES, 12);
  assert.equal(createGame(['a','b']).dieSides, 12);
  for (const sides of [6, 12, 20]) {
    const observed = new Set(Array.from({length: 300}, () => rollDie(sides)));
    assert.ok([...observed].every(n => Number.isInteger(n) && n >= 1 && n <= sides));
    assert.ok(observed.size > 4);
  }
  for (const invalid of [0, 4, 8, 10, 21, '12', null]) assert.throws(() => rollDie(invalid));
});

test('fixed jackpots are independent of the value that tied', () => {
  for (const [sides, jackpot] of [[6,12], [12,36], [20,80]]) {
    assert.equal(TIE_JACKPOTS[sides], jackpot);
    for (const n of [1, Math.floor(sides/2), sides]) {
      const game = createGame(['a','b'], n, 10, sides);
      guess(game, 'b', 'tie', n);
      assert.equal(game.scores.b, jackpot, `D${sides} tie at ${n}`);
      assert.equal(game.previous, n);
      assert.equal(game.last.delta, jackpot);
    }
  }
});

test('wrong predictions lose the rolled value and still update the reference', () => {
  for (const sides of [6,12,20]) {
    const game = createGame(['a','b'], 2, 4, sides);
    guess(game, 'b', 'higher', 1);  // Opening miss: score remains zero.
    assert.equal(game.scores.b, 0);
    guess(game, 'a', 'higher', 2);  // A gains two.
    const before = game.scores.b;
    guess(game, 'b', 'higher', 1);  // Miss costs one, B eliminated.
    assert.equal(game.scores.b, 0);
    assert.equal(game.previous, 1);
    assert.equal(game.last.delta, 0); // clamped at zero on elimination
    assert.ok(game.over);
    assert.equal(before, 0);
  }
});

test('higher/lower are unavailable at the die limits for every mode', () => {
  for (const sides of [6,12,20]) {
    assert.equal(allowedChoice(sides, 'higher', sides), false);
    assert.equal(allowedChoice(1, 'lower', sides), false);
    assert.equal(allowedChoice(sides, 'lower', sides), true);
    assert.equal(allowedChoice(1, 'tie', sides), true);
    assert.equal(allowedChoice(1, 'higher', sides), true);
    const g = createGame(['a','b'], sides, 10, sides);
    assert.throws(() => guess(g, 'b', 'higher', sides), /unavailable/);
    assert.equal(g.moves, 0); // Invalid guess must not change state.
    assert.equal(botChoice(sides, 0, 1, sides) !== 'higher', true);
    assert.equal(botChoice(1, 0, 1, sides) !== 'lower', true);
  }
});

test('selectable modes preserve the round limit, multiplayer and rematch configuration', () => {
  for (const sides of [6,12,20]) {
    const ids = Array.from({ length:20 },(_,i)=>`p${i}`);
    const g = createGame(ids, Math.floor(sides/2), 1, sides);
    for (let n=1; n<20; n++) {
      const next = g.previous === sides ? 1 : sides;
      const choice = next > g.previous ? 'higher' : 'lower';
      guess(g, currentPlayer(g), choice, next);
    }
    assert.equal(g.over, true);
    assert.equal(g.maxRounds, 1);
    assert.equal(g.dieSides, sides);
    assert.equal(g.moves, 19);
  }
});

test('host-only dice settings are broadcast-safe, atomic and locked during play', () => {
  const room = { host:'host',game:null,rounds:10,dieSides:12 };
  assert.equal(roomDieSides(room),12);
  assert.equal(roomRounds(room),10);
  setRoomSettings(room,'host',{dieSides:20});
  assert.equal(roomDieSides(room),20);
  assert.equal(roomRounds(room),10);
  setRoomSettings(room,'host',{rounds:5});
  assert.equal(roomRounds(room),5);
  assert.throws(()=>setRoomSettings(room,'guest',{dieSides:6}),/Only the host/);
  for(const bad of [{dieSides:8},{dieSides:'20'},{rounds:999,dieSides:6},{dieSides:6,bad:true},{}])
    assert.throws(()=>setRoomSettings(room,'host',bad));
  assert.equal(roomDieSides(room),20); // Invalid patch does not mutate either field.
  assert.equal(roomRounds(room),5);
  room.game=createGame(['host','guest'],8,roomRounds(room),roomDieSides(room));
  assert.throws(()=>setRoomSettings(room,'host',{dieSides:6}),/during a match/);
  assert.equal(room.game.dieSides,20);
  room.game.over=true;
  setRoomSettings(room,'host',{dieSides:6});
  assert.equal(roomDieSides(room),6);
  assert.equal(room.game.dieSides,20); // Previous result is immutable.
  assert.equal(roomDieSides({}),12); // New configuration for old idle rooms.
});

test('legacy active rooms without dieSides continue using D6', () => {
  const g=createGame(['a','b'],5,10,6);
  delete g.dieSides;
  assert.throws(()=>guess(g,'b','higher',9),/Invalid roll/);
  guess(g,'b','tie',5);
  assert.equal(g.scores.b,10); // Existing in-progress D6 scoring remains variable ×2.
});

test('D12 and D20 SVG faces are numbered and distinct; D6 retains familiar pips', () => {
  for (const sides of [6,12,20]) {
    for(const face of [1,sides]) {
      const svg=dieSvg(face,sides);
      assert.match(svg,/<svg /);
      assert.match(svg,new RegExp(`data-sides="${sides}"`));
      if (sides===6) assert.match(svg,/<circle /);
      else { assert.match(svg,/<polygon /); assert.ok(svg.includes(`>${face}</text>`)); }
    }
  }
  assert.equal(dieSvg(21,20),'');
  assert.equal(dieSvg(0,6),'');
});
