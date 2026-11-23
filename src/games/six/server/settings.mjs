import { DEFAULT_ROUNDS, validRounds } from '../core/rules.mjs';

export function roomRounds(room) {
  return validRounds(room.rounds) ? room.rounds : DEFAULT_ROUNDS;
}

export function setRoomRounds(room, player, rounds) {
  if (player !== room.host) throw Error('Only the host can change rounds.');
  if (room.game && !room.game.over) throw Error('Cannot change rounds during a match.');
  if (!validRounds(rounds)) throw Error('Rounds must be 1–99.');
  room.rounds = rounds;
  return room.rounds;
}
