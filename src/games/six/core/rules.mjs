export const MAX_PLAYERS = 20;
export const roundsForPlayers = count => 6 + count;
export const CHOICES = ['higher', 'lower', 'tie'];
export const rollDie = () => { const x = new Uint32Array(1); crypto.getRandomValues(x); return 1 + (x[0] % 6); };
export function createGame(ids, firstRoll = rollDie()) {
  if (!Array.isArray(ids) || ids.length < 2 || ids.length > MAX_PLAYERS || new Set(ids).size !== ids.length) throw Error('Need 2–20 unique players.');
  if (!Number.isInteger(firstRoll) || firstRoll < 1 || firstRoll > 6) throw Error('Invalid roll.');
  // Opening player gets the first die for free. All other players guess against it.
  return { ids: [...ids], maxRounds: roundsForPlayers(ids.length), scores: Object.fromEntries(ids.map(id => [id, id === ids[0] ? firstRoll : 0])), alive: [...ids], previous: firstRoll, turn: 1, moves: 0, round: 1, over: false, winner: null, last: { player: ids[0], roll: firstRoll, opening: true, delta: firstRoll } };
}
export function currentPlayer(game) { return game.over ? null : game.ids[game.turn]; }
export function guess(game, id, choice, die) {
  if (game.over || currentPlayer(game) !== id) throw Error('Not your turn.');
  if (!CHOICES.includes(choice) || !Number.isInteger(die) || die < 1 || die > 6) throw Error('Invalid guess or roll.');
  // Preserve the starting player count when upgrading older active rooms.
  game.maxRounds ??= roundsForPlayers(game.ids.length);
  const correct = choice === 'tie' ? die === game.previous : choice === 'higher' ? die > game.previous : die < game.previous;
  const delta = correct ? die * (choice === 'tie' ? 2 : 1) : game.round === 1 ? -game.scores[id] : -die;
  const before = game.scores[id];
  game.scores[id] = Math.max(0, before + delta);
  // A wrong guess in round 1 resets to zero; from round 2 a negative total eliminates.
  const eliminated = game.round > 1 && before + delta < 0;
  if (eliminated) game.alive = game.alive.filter(p => p !== id);
  game.last = { player: id, choice, previous: game.previous, roll: die, correct, delta: game.scores[id] - before, eliminated };
  game.previous = die;
  game.moves++;
  if (game.alive.length <= 1) { game.over = true; game.winner = game.alive[0] ?? null; return game; }
  // Each round is one seat-cycle. Eliminated seats are skipped.
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
export function botChoice(previous, score, leaderScore = score) {
  const outcomes = CHOICES.map(choice => {
    const deltas = Array.from({length: 6}, (_, i) => {
      const n = i + 1, win = choice === 'tie' ? n === previous : choice === 'higher' ? n > previous : n < previous;
      return win ? n * (choice === 'tie' ? 2 : 1) : -n;
    });
    const survival = deltas.filter(d => score + d >= 0).length / 6;
    const mean = deltas.reduce((a,b) => a+b, 0)/6;
    return { choice, value: mean + survival * (score < leaderScore ? 1 : 3) };
  });
  outcomes.sort((a,b) => b.value - a.value);
  return outcomes[0].choice;
}
