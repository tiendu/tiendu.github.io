import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, guess, currentPlayer, botChoice} from '../core/rules.mjs';
test('opening roll gives first player a score', () => {const g=createGame(['a','b'],4); assert.equal(g.scores.a,4);assert.equal(currentPlayer(g),'b');});
test('first round wrong guess resets score to zero', () => {const g=createGame(['a','b'],4);guess(g,'b','higher',2);assert.equal(g.scores.b,0);assert.equal(g.round,2);assert.deepEqual(g.alive,['a','b']);});
test('tie doubles winning roll', () => {const g=createGame(['a','b'],6);guess(g,'b','tie',6);assert.equal(g.scores.b,12);});
test('wrong guess eliminates only when below zero after opening round', () => {const g=createGame(['a','b'],6);guess(g,'b','higher',3);guess(g,'a','higher',1);assert.equal(g.scores.a,5);guess(g,'b','higher',1);assert.equal(g.over,true);assert.equal(g.winner,'a');});
test('twenty players admitted, twenty one rejected',()=>{assert.equal(createGame(Array.from({length:20},(_,i)=>String(i)),3).ids.length,20);assert.throws(()=>createGame(Array.from({length:21},(_,i)=>String(i)),3));});
test('bot returns a legal choice',()=>assert.ok(['higher','lower','tie'].includes(botChoice(5,4,12))));

// The configurable round limit is checked in rounds-settings.test.mjs.
