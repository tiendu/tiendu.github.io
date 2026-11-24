// Both the gallery and the board draw the same vector geometry.
export const HUNTER_EYES = 'M19 30Q29 37 37 42Q24 47 19 30Z M61 30Q51 37 43 42Q56 47 61 30Z';
const eyeY = c => c.id === 'Ember' ? 45 : 40;
export function characterSVG(c) {
  const face = c.faction === 'hunter'
    ? `<path d="${HUNTER_EYES}" fill="${c.color}"/>`
    : [34, 46].map(x => `<ellipse cx="${x}" cy="${eyeY(c)}" rx="2.5" ry="5" fill="white"/>`).join('');
  return `<svg viewBox="0 0 80 80" aria-hidden="true"><path d="${c.path}" stroke="${c.color}" stroke-width="8" opacity=".09" fill="none"/><path d="${c.path}" stroke="${c.color}" stroke-width="2.5" fill="${c.color}" fill-opacity=".14" stroke-linejoin="round"/>${face}</svg>`;
}
const cache = new Map();
let hunterEyes;
export function drawCharacter(ctx, c, x, y, size, {energy = 100, dim = false} = {}) {
  if (!cache.has(c.id)) cache.set(c.id, new Path2D(c.path));
  const p = cache.get(c.id);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 80, size / 80);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ctx.fillStyle = c.color;
  const glow = c.faction === 'wisp' ? Math.max(.12, energy / 100) : 1;
  const opacity = dim ? .48 : 1;
  ctx.globalAlpha = .20 * glow * opacity; ctx.lineWidth = 8; ctx.stroke(p);
  ctx.globalAlpha = (.08 + .20 * glow) * opacity; ctx.fill(p);
  ctx.globalAlpha = opacity; ctx.lineWidth = 3.5; ctx.stroke(p);
  if (c.faction === 'hunter') ctx.fill(hunterEyes ??= new Path2D(HUNTER_EYES));
  else {
    ctx.fillStyle = 'white';
    for (const x of [34, 46]) {
      ctx.beginPath(); ctx.ellipse(x, eyeY(c), 2.5, 5, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}
