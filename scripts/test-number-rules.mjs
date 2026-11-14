// Regression tests for NUMBER's local, dependency-free rules.
// Keep the browser and server protocols unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/scripts/games/number-rules.ts', import.meta.url), 'utf8');
const {outputText, diagnostics} = ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022},
  reportDiagnostics: true,
});
assert.equal(diagnostics?.length ?? 0, 0, 'NUMBER rules must transpile');
const {createNumberRound, guessNumber, restoreNumberSession} =
  await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));

test('NUMBER starts with exclusive boundaries and validates targets', () => {
  assert.deepEqual(createNumberRound(1), {target:1,low:0,high:100,guesses:0,over:false});
  assert.deepEqual(createNumberRound(99), {target:99,low:0,high:100,guesses:0,over:false});
  for (const target of [0,100,-4,5.5,NaN,Infinity,'42',null]) {
    assert.throws(() => createNumberRound(target), RangeError);
  }
});

test('NUMBER ignores guesses outside exclusive bounds without mutating state', () => {
  const start = Object.freeze(createNumberRound(37));
  for (const guess of [0,100,-1,101,12.5,NaN,Infinity,'37']) {
    assert.strictEqual(guessNumber(start,guess), start);
  }
  const low = guessNumber(start,12);
  assert.equal(low.low,12);
  assert.equal(low.high,100);
  assert.equal(low.guesses,1);
  assert.equal(start.low,0);
  assert.strictEqual(guessNumber(low,12),low);
  assert.strictEqual(guessNumber(low,0),low);
  const high = guessNumber(low,75);
  assert.deepEqual(high, {target:37,low:12,high:75,guesses:2,over:false});
  assert.strictEqual(guessNumber(high,75),high);
  const win = guessNumber(high,37);
  assert.deepEqual(win, {target:37,low:12,high:75,guesses:3,over:true});
  assert.strictEqual(guessNumber(win,40),win);
});

test('NUMBER can resolve every possible target without changing its secret', () => {
  for (let target=1;target<=99;target++) {
    let round=createNumberRound(target);
    let steps=0;
    while (!round.over && steps<8) {
      const guess=Math.floor((round.low+round.high)/2);
      const next=guessNumber(round,guess);
      assert.equal(next.target,target);
      assert(next.low>=round.low);
      assert(next.high<=round.high);
      assert.equal(next.guesses,round.guesses+1);
      round=next;steps++;
    }
    assert.equal(round.over,true,`Target ${target} should be reachable`);
    assert(steps<=7);
  }
});

test('NUMBER restores version 2 saves without changing their meaning', () => {
  const round=guessNumber(createNumberRound(42),25);
  const save={version:2,input:'38',round};
  assert.deepEqual(restoreNumberSession(save),{round,input:'38'});
  const won=guessNumber(round,42);
  assert.deepEqual(restoreNumberSession({version:2,input:'',round:won}),{round:won,input:''});
});

test('NUMBER refuses corrupt and incompatible saved rounds', () => {
  const round=createNumberRound(42);
  for (const value of [
    null, false, {},
    {version:1,input:'',round},
    {version:2,input:'hello',round},
    {version:2,input:'1234',round},
    {version:2,input:'',round:{...round,target:0}},
    {version:2,input:'',round:{...round,low:42}},
    {version:2,input:'',round:{...round,high:42}},
    {version:2,input:'',round:{...round,guesses:-1}},
    {version:2,input:'',round:{...round,guesses:100}},
    {version:2,input:'',round:{...round,over:true}},
  ]) assert.equal(restoreNumberSession(value),null);
});
