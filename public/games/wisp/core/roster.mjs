import {WISPS, HUNTERS} from './characters.mjs';
import {rng} from './maze.mjs';
export function teams(humans = [], seed = 0, tutorial = false) {
  const allowed = [...WISPS, ...HUNTERS].filter(c => !tutorial || c.id !== 'Stalker');
  if (humans.length > 4 || humans.some(p => typeof p.id !== 'string' || !p.id || !allowed.some(c => c.id === p.character)) ||
      new Set(humans.map(p => p.id)).size !== humans.length || new Set(humans.map(p => p.character)).size !== humans.length) {
    throw new Error('Invalid human roster');
  }
  const random = rng(seed);
  return [WISPS, HUNTERS].flatMap(roster => {
    const pool = roster.filter(c => allowed.includes(c));
    const chosen = humans.filter(p => pool.some(c => c.id === p.character));
    const result = chosen.map(p => ({...pool.find(c => c.id === p.character), player: p.id}));
    const rest = pool.filter(c => !chosen.some(p => p.character === c.id));
    while (result.length < 4) result.push({...rest.splice(Math.floor(random() * rest.length), 1)[0], player: null});
    return result;
  });
}
