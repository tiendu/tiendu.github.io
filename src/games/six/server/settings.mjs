import { DEFAULT_ROUNDS, DEFAULT_SIDES, validRounds, validSides } from '../core/rules.mjs';

export function roomRounds(room) {
  return validRounds(room.rounds) ? room.rounds : DEFAULT_ROUNDS;
}
export function roomDieSides(room) {
  return validSides(room.dieSides) ? room.dieSides : DEFAULT_SIDES;
}

function canConfigure(room, player) {
  if (player !== room.host) throw Error('Only the host can change match settings.');
  if (room.game && !room.game.over) throw Error('Cannot change match settings during a match.');
}
export function setRoomRounds(room, player, rounds) {
  canConfigure(room, player);
  if (!validRounds(rounds)) throw Error('Rounds must be 1–99.');
  room.rounds = rounds;
  return room.rounds;
}
export function setRoomDieSides(room, player, sides) {
  canConfigure(room, player);
  if (!validSides(sides)) throw Error('Die must be D6, D12, or D20.');
  room.dieSides = sides;
  return room.dieSides;
}
// Partial updates are intentional: a delayed rounds edit must never overwrite
// a dice selection made by the same host in a separate request.
export function setRoomSettings(room, player, patch) {
  canConfigure(room, player);
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw Error('Invalid settings.');
  const keys = Object.keys(patch);
  if (!keys.length || keys.some(k => !['rounds', 'dieSides'].includes(k))) throw Error('Invalid settings.');
  if ('rounds' in patch && !validRounds(patch.rounds)) throw Error('Rounds must be 1–99.');
  if ('dieSides' in patch && !validSides(patch.dieSides)) throw Error('Die must be D6, D12, or D20.');
  // Validate all fields first, then mutate once.
  if ('rounds' in patch) room.rounds = patch.rounds;
  if ('dieSides' in patch) room.dieSides = patch.dieSides;
  return { rounds: roomRounds(room), dieSides: roomDieSides(room) };
}
