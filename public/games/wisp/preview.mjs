import {WISPS, HUNTERS, WIDTH, HEIGHT, maze, view, unview, direction, teams} from './core.mjs';
import {characterSVG, drawCharacter} from './characters.mjs';
const $ = id => document.getElementById(id);
const canvas = $('board'), ctx = canvas.getContext('2d'), tile = 32;
const orientation = matchMedia('(orientation: landscape)');
let seed = crypto.getRandomValues(new Uint32Array(1))[0], landscape = orientation.matches;
let tutorial = false, selected = 'Orb', board, actors, ping, pingTimer;
for (const [id, roster] of [['wisps', WISPS], ['hunters', HUNTERS]]) {
  for (const c of roster) {
    const button = document.createElement('button');
    button.innerHTML = `${characterSVG(c)}<span>${c.id}</span><small>${c.ability}</small>`;
    button.dataset.character = c.id;
    button.onclick = () => { selected = c.id; if (selected === 'Stalker') tutorial = false; reset(); };
    $(id).append(button);
  }
}
function reset() {
  board = maze(seed, tutorial);
  clearTimeout(pingTimer); ping = null;
  const cells = board.flatMap((row, y) => row.flatMap((v, x) => v ? [] : [[x, y]]));
  actors = teams([{id: 'local', character: selected}], seed, tutorial).map((c, i) => ({...c, pos: cells[i < 4 ? i * 3 : cells.length - 1 - (i - 4) * 3]}));
  for (const b of document.querySelectorAll('[data-character]')) b.setAttribute('aria-pressed', String(b.dataset.character === selected));
  $('tutorial').setAttribute('aria-pressed', String(tutorial));
  $('seed').textContent = `Seed ${seed}`;
  draw();
}
function draw() {
  canvas.width = (landscape ? HEIGHT : WIDTH) * tile;
  canvas.height = (landscape ? WIDTH : HEIGHT) * tile;
  ctx.fillStyle = '#090d19'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  board.forEach((row, y) => row.forEach((v, x) => {
    const [u, w] = view(x, y, landscape);
    if (v) {
      ctx.fillStyle = '#20384d'; ctx.fillRect(u * tile + 1, w * tile + 1, tile - 2, tile - 2);
    } else if ((x * 7 + y * 11) % 5 === 0) {
      ctx.fillStyle = '#b5efff'; ctx.beginPath(); ctx.arc((u + .5) * tile, (w + .5) * tile, (x + y) % 3 === 0 ? 4 : 2, 0, Math.PI * 2); ctx.fill();
    }
  }));
  if (ping) {
    const [x, y] = view(...ping, landscape);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    for (const r of [8, 13]) { ctx.beginPath(); ctx.arc((x + .5) * tile, (y + .5) * tile, r, 0, Math.PI * 2); ctx.stroke(); }
  }
  for (const c of actors) {
    const [x, y] = view(...c.pos, landscape);
    drawCharacter(ctx, c, x * tile + 2, y * tile + 2, tile - 4);
  }
}
function move(dx, dy) {
  const [u, v] = direction(dx, dy, landscape), p = actors.find(c => c.player === 'local');
  const x = p.pos[0] + u, y = p.pos[1] + v;
  if (board[y]?.[x] === 0) { p.pos = [x, y]; draw(); }
}
$('new').onclick = () => { seed = crypto.getRandomValues(new Uint32Array(1))[0]; reset(); };
$('rotate').onclick = () => { landscape = !landscape; draw(); };
$('tutorial').onclick = () => { tutorial = !tutorial; if (tutorial && selected === 'Stalker') selected = 'Orb'; reset(); };
orientation.addEventListener('change', e => { landscape = e.matches; draw(); });
canvas.addEventListener('click', e => {
  const r = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / r.width * canvas.width / tile);
  const y = Math.floor((e.clientY - r.top) / r.height * canvas.height / tile);
  const [u, v] = unview(x, y, landscape);
  if (board[v]?.[u] !== 0) return;
  clearTimeout(pingTimer); ping = [u, v]; draw();
  pingTimer = setTimeout(() => { ping = null; draw(); }, 3000);
});
document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => move(...b.dataset.d.split(',').map(Number)));
const keys = {ArrowUp: [0,-1], w: [0,-1], ArrowDown: [0,1], s: [0,1], ArrowLeft: [-1,0], a: [-1,0], ArrowRight: [1,0], d: [1,0]};
addEventListener('keydown', e => { const d = keys[e.key] ?? keys[e.key.toLowerCase()]; if (d) { e.preventDefault(); move(...d); } });
reset();
