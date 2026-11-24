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
