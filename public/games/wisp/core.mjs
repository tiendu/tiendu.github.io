export const WIDTH = 13;
export const HEIGHT = 19;
export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const w = (id, color, path, ability, cost) => ({id, color, path, ability, cost, faction: 'wisp'});
const h = (id, color, path, ability, damage, cooldown) => ({id, color, path, ability, damage, cooldown, faction: 'hunter'});
const durian = Array.from({length: 24}, (_, i) => {
  const a = i * Math.PI / 12, r = i % 2 ? 22 : 30;
  return `${i ? 'L' : 'M'}${40 + r * Math.cos(a)} ${40 + r * Math.sin(a)}`;
}).join(' ') + 'Z';
export const WISPS = [
  w('Orb', '#59dfff', 'M40 17A23 23 0 1 1 39.99 17Z', 'Repulse', 20),
  w('Prism', '#bb8cff', 'M40 13L65 40L40 67L15 40Z', 'Phase', 25),
  w('Ember', '#ffad42', 'M40 13L66 63H14Z', 'Surge', 20),
  w('Rune', '#53e6a0', 'M18 18H62V62H18Z', 'Barrier', 30),
  w('Nova', '#ff79b9', 'M40 12L49 31L68 40L49 49L40 68L31 49L12 40L31 31Z', 'Echo', 20),
  w('Hex', '#f2e477', 'M40 14L63 27V53L40 66L17 53V27Z', 'Stasis', 25),
];
export const HUNTERS = [
  h('Stalker', '#ff4564', durian, 'Lunge', 100, 18),
  h('Interceptor', '#ac65ff', 'M40 4L50 25L76 14L59 40L76 66L50 55L40 76L30 55L4 66L21 40L4 14L30 25Z', 'Lockdown', 35, 12),
  h('Wanderer', '#39c9ef', 'M40 4L72 34H60L70 70L40 57L10 70L20 34H8Z', 'Phase', 15, 6),
  h('Warden', '#ffca42', 'M9 8L27 17L40 5L53 17L71 8L63 27L75 40L63 53L71 72L53 63L40 75L27 63L9 72L17 53L5 40L17 27Z', 'Devour', 25, 10),
  h('Leech', '#ef78c8', 'M8 7L32 22L40 12L48 22L72 7L63 34L72 49L57 72L40 62L23 72L8 49L17 34Z', 'Drain', 20, 12),
  h('Sentinel', '#79e59a', 'M8 5L30 19L40 9L50 19L72 5L62 33L75 40L58 51L65 69L47 61L40 77L33 61L15 69L22 51L5 40L18 33Z', 'Silence', 20, 15),
];
export function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}
export function maze(seed, tutorial = false) {
  const random = rng(seed);
  const a = Array.from({length: HEIGHT}, () => Array(WIDTH).fill(1));
  const stack = [[1, 1]];
  a[1][1] = 0;
  while (stack.length) {
    const [x, y] = stack.at(-1);
    const options = DIRS.map(([dx, dy]) => [x + 2 * dx, y + 2 * dy])
      .filter(([u, v]) => u > 0 && v > 0 && u < WIDTH - 1 && v < HEIGHT - 1 && a[v][u]);
    if (!options.length) { stack.pop(); continue; }
    const [u, v] = options[Math.floor(random() * options.length)];
    a[v][u] = a[(y + v) / 2][(x + u) / 2] = 0;
    stack.push([u, v]);
  }
  // Braid the spanning tree: removing interior walls adds alternative routes.
  const candidates = [];
  for (let y = 1; y < HEIGHT - 1; y++) {
    for (let x = 1; x < WIDTH - 1; x++) {
      if (a[y][x] && ((!a[y][x-1] && !a[y][x+1]) || (!a[y-1][x] && !a[y+1][x]))) candidates.push([x, y]);
    }
  }
  for (let i = 0; i < (tutorial ? 25 : 18) && candidates.length; i++) {
    const [x, y] = candidates.splice(Math.floor(random() * candidates.length), 1)[0];
    a[y][x] = 0;
  }
  return a;
}
export function view(x, y, landscape) { return landscape ? [HEIGHT - 1 - y, x] : [x, y]; }
export function unview(x, y, landscape) { return landscape ? [y, HEIGHT - 1 - x] : [x, y]; }
export function direction(dx, dy, landscape) { return landscape ? [dy, -dx] : [dx, dy]; }
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
