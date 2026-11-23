// Pure, dependency-free SVG dice. Numbered polyhedra show one readable face;
// cosmetic roll frames never decide the actual result.
const pips = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};
const shared = `<defs>
  <linearGradient id="six-ivory" x1="0" y1="0" x2=".85" y2="1">
    <stop stop-color="#fffefa"/><stop offset=".5" stop-color="#eee9e2"/>
    <stop offset="1" stop-color="#c8c0b8"/>
  </linearGradient>
</defs>`;
const D12_FACES = [
  ['42,20 80,8 80,35 41,63 13,47', '#e8ded3'],
  ['80,8 118,20 147,47 119,63 80,35', '#c9bdb2'],
  ['119,63 147,47 154,84 136,122 105,109', '#b1a59a'],
  ['105,109 136,122 101,150', '#a69b90'],
  ['55,109 105,109 101,150 59,150 24,122', '#ac9d90'],
  ['13,47 41,63 55,109 24,122 6,84', '#c5b7ab'],
  ['80,35 119,63 105,109 55,109 41,63', 'url(#six-ivory)'],
];
const D20_FACES = [
  ['80,8 22,31 80,35', '#e7dbcf'],
  ['80,8 80,35 138,31', '#c8bbb0'],
  ['22,31 5,83 80,35', '#b4a79a'],
  ['5,83 35,118 80,35', '#c9bdb2'],
  ['80,35 125,118 138,31', '#b0a397'],
  ['138,31 125,118 155,83', '#a99d92'],
  ['35,118 27,131 80,155', '#afa093'],
  ['35,118 80,155 125,118', '#c7b8ab'],
  ['125,118 80,155 133,131', '#998e83'],
  ['125,118 133,131 155,83', '#b6a89c'],
  ['80,35 35,118 125,118', 'url(#six-ivory)'],
];
function poly(faces) {
  return faces.map(([points, fill]) => `<polygon points="${points}" fill="${fill}" stroke="#7f756d" stroke-width="1.35" stroke-linejoin="round"/>`).join('');
}
export function dieSvg(face, sides = 12) {
  if (![6, 12, 20].includes(sides) || !Number.isInteger(face) || face < 1 || face > sides) return '';
  if (sides === 6) {
    return `<svg class="six-die-svg" data-sides="6" viewBox="0 0 100 100" focusable="false" aria-hidden="true">
      ${shared}
      <rect x="3" y="3" width="94" height="94" rx="20" fill="url(#six-ivory)" stroke="#bcb3aa" stroke-width="2"/>
      <path d="M15 43V24Q15 14 27 14H71" stroke="#fff" stroke-opacity=".8" stroke-width="4" stroke-linecap="round" fill="none"/>
      ${pips[face].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="8" fill="#242326" stroke="#77716f" stroke-width="1"/>`).join('')}
    </svg>`;
  }
  const faces = sides === 12 ? D12_FACES : D20_FACES;
  const y = sides === 12 ? 83 : 96;
  const fontSize = sides === 12 ? 47 : 40;
  return `<svg class="six-die-svg" data-sides="${sides}" viewBox="0 0 160 160" focusable="false" aria-hidden="true">
    ${shared}
    ${poly(faces)}
    <text x="80" y="${y}" text-anchor="middle" dominant-baseline="middle"
      font-family="system-ui, Arial, sans-serif" font-weight="850" font-size="${fontSize}"
      letter-spacing="-2" fill="#282321">${face}</text>
    <path d="M44 22 L80 11 L115 23" stroke="#fff" stroke-opacity=".58" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  </svg>`;
}
