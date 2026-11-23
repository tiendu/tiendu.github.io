export const MAX_PLAYERS = 20;
export const DEFAULT_ROUNDS = 10;
export const DICE_SIDES = [6, 12, 20];
export const DEFAULT_SIDES = 12;
export const TIE_JACKPOTS = Object.freeze({ 6: 12, 12: 36, 20: 80 });
export const validRounds = n => Number.isInteger(n) && n >= 1 && n <= 99;
export const validSides = n => DICE_SIDES.includes(n);
export const CHOICES = ['higher', 'lower', 'tie'];

// Rejection sampling avoids modulo bias for any supported die.
export function rollDie(sides = DEFAULT_SIDES) {
  if (!validSides(sides)) throw Error('Die must be D6, D12, or D20.');
  const n = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / sides) * sides;
  do { crypto.getRandomValues(n); } while (n[0] >= limit);
  return 1 + n[0] % sides;
}

export function createGame(ids, firstRoll = rollDie(), maxRounds = DEFAULT_ROUNDS, dieSides = DEFAULT_SIDES) {
  if (!Array.isArray(ids) || ids.length < 2 || ids.length > MAX_PLAYERS || new Set(ids).size !== ids.length)
    throw Error('Need 2–20 unique players.');
  if (!validRounds(maxRounds)) throw Error('Rounds must be 1–99.');
  if (!validSides(dieSides)) throw Error('Die must be D6, D12, or D20.');
  if (!Number.isInteger(firstRoll) || firstRoll < 1 || firstRoll > dieSides) throw Error('Invalid roll.');
  // Opening player gets the first die for free. Everyone else predicts against it.
  return {
    ids: [...ids], maxRounds, dieSides,
    scores: Object.fromEntries(ids.map(id => [id, id === ids[0] ? firstRoll : 0])),
    alive: [...ids], previous: firstRoll, turn: 1, moves: 0, round: 1,
    over: false, winner: null,
    last: { player: ids[0], roll: firstRoll, opening: true, delta: firstRoll },
  };
}

export function currentPlayer(game) { return game.over ? null : game.ids[game.turn]; }
export function allowedChoice(previous, choice, sides) {
  return CHOICES.includes(choice) && (choice !== 'higher' || previous < sides) && (choice !== 'lower' || previous > 1);
}

export function guess(game, id, choice, die) {
  if (game.over || currentPlayer(game) !== id) throw Error('Not your turn.');
  // In-flight rooms created before polyhedral dice existed are D6 matches.
  const legacy = game.dieSides == null;
  const sides = legacy ? 6 : game.dieSides;
  if (!validSides(sides) || !Number.isInteger(die) || die < 1 || die > sides) throw Error('Invalid roll.');
  if (!CHOICES.includes(choice) || (!legacy && !allowedChoice(game.previous, choice, sides)))
    throw Error('Prediction is unavailable for this die.');
  // Old active snapshots may not include a maxRounds property.
  game.maxRounds ??= DEFAULT_ROUNDS;
  const correct = choice === 'tie' ? die === game.previous
    : choice === 'higher' ? die > game.previous : die < game.previous;
  const before = game.scores[id];
  // Keep the old variable ×2 scoring for already-running pre-upgrade D6 rooms.
  const reward = choice === 'tie' ? (legacy ? die * 2 : TIE_JACKPOTS[sides]) : die;
  const delta = correct ? reward : game.round === 1 ? -before : -die;
  game.scores[id] = Math.max(0, before + delta);
  const eliminated = game.round > 1 && before + delta < 0;
  if (eliminated) game.alive = game.alive.filter(p => p !== id);
  game.last = {
    player: id, choice, previous: game.previous, roll: die, correct,
    delta: game.scores[id] - before, eliminated,
  };
  // Every roll becomes the next player's reference, including failed predictions.
  game.previous = die;
  game.moves++;
  if (game.alive.length <= 1) {
    game.over = true;
    game.winner = game.alive[0] ?? null;
    return game;
  }
  let next = (game.turn + 1) % game.ids.length;
  while (!game.alive.includes(game.ids[next])) next = (next + 1) % game.ids.length;
  game.turn = next;
  if (next <= game.ids.indexOf(id)) game.round++;
  if (game.round > game.maxRounds) {
    game.over = true;
    const best = Math.max(...game.alive.map(p => game.scores[p]));
    const leaders = game.alive.filter(p => game.scores[p] === best);
    game.winner = leaders.length === 1 ? leaders[0] : null;
  }
  return game;
}

export function botChoice(previous, score, leaderScore = score, sides = DEFAULT_SIDES) {
  if (!validSides(sides) || !Number.isInteger(previous) || previous < 1 || previous > sides)
    throw Error('Invalid die.');
  const outcomes = CHOICES.filter(choice => allowedChoice(previous, choice, sides)).map(choice => {
    const deltas = Array.from({ length: sides }, (_, i) => {
      const n = i + 1;
      const win = choice === 'tie' ? n === previous : choice === 'higher' ? n > previous : n < previous;
      return win ? (choice === 'tie' ? TIE_JACKPOTS[sides] : n) : -n;
    });
    const survival = deltas.filter(d => score + d >= 0).length / sides;
    const mean = deltas.reduce((a, b) => a + b, 0) / sides;
    return { choice, value: mean + survival * (score < leaderScore ? 1 : 3) };
  });
  outcomes.sort((a, b) => b.value - a.value);
  return outcomes[0].choice;
}
