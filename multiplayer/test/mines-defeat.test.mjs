import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard, frontier, play } from '../src/mines/board.mjs';
import { mineEndingPhase } from '../../src/scripts/games/mines-elevator.mjs';

function setup() {
  const board = createBoard(['red', 'blue']);
  const tile = [...frontier(board, 'red')][0];
  assert.ok(Number.isInteger(tile));
  board.clues[tile] = -1; // Force a deterministic bomb on the legal frontier.
  return { board, tile };
}

test('no fuse + bomb = defeat, with exact miner and crater', () => {
  const { board, tile } = setup();
  play(board, 'red', 'dig', tile);
  assert.equal(board.status, 'lost');
  assert.equal(board.fatalSeat, 0);
  assert.equal(board.fatalCell, tile);
  assert.equal(mineEndingPhase(board), 'lost');
});

test('unprotected bomb after connecting elevator is still defeat', () => {
  const { board, tile } = setup();
  board.status = 'connected';
  play(board, 'red', 'dig', tile);
  assert.equal(board.status, 'lost');
  assert.equal(board.fatalSeat, 0);
});

test('team fuse absorbs bomb, but next unprotected bomb is fatal', () => {
  const { board, tile } = setup();
  board.fuses = 1;
  play(board, 'red', 'dig', tile);
  assert.equal(board.fuses, 0);
  assert.equal(board.fusesUsed, 1);
  assert.equal(board.status, 'digging');
  assert.equal(board.fatalSeat, undefined);
  const next = [...frontier(board, 'blue')][0];
  board.clues[next] = -1;
  play(board, 'blue', 'dig', next);
  assert.equal(board.status, 'lost');
  assert.equal(board.fatalSeat, 1);
  assert.equal(board.fatalCell, next);
});

test('legacy one-fuse board also marks a fatal hit', () => {
  const { board, tile } = setup();
  delete board.fuseCells;
  board.fuseCell = tile + 1;
  board.fuses = 0;
  play(board, 'red', 'dig', tile);
  assert.equal(board.status, 'lost');
  assert.equal(board.fatalSeat, 0);
});

test('endings distinguish defeat, normal escape, and flawless escape', () => {
  assert.equal(mineEndingPhase({ status: 'digging' }), 'digging');
  assert.equal(mineEndingPhase({ status: 'connected' }), 'connected');
  assert.equal(mineEndingPhase({ status: 'lost', cells: [0, -1] }), 'lost');
  assert.equal(mineEndingPhase({ status: 'won', cells: [0, null], fusesUsed: 0 }), 'perfect');
  assert.equal(mineEndingPhase({ status: 'won', cells: [0, -1], fusesUsed: 1 }), 'won');
});
