import {isOpen} from './maze.mjs';
const EPS=1e-8;
const same = (a,b) => a[0]===b[0] && a[1]===b[1];
export const cardinal = d => Array.isArray(d) && d.length===2 && d.every(Number.isInteger) && Math.abs(d[0])+Math.abs(d[1])===1;
export const centered = a => Math.abs(a.x-Math.round(a.x))<EPS && Math.abs(a.y-Math.round(a.y))<EPS;
// Position is a corridor center or a point on a cardinal edge, never diagonal.
// A requested turn persists until legal. Reversal works anywhere along an edge.
export function advance(a, board, amount, blocked = null, blocks = []) {
  const allowed = (x,y,d) => isOpen(board,x+d[0],y+d[1]) && !(blocked && blocked[0]===x+d[0] && blocked[1]===y+d[1]) && !blocks.some(b=>b.x===x+d[0]&&b.y===y+d[1]);
  if (a.wanted && same(a.wanted,[-a.dir[0],-a.dir[1]])) a.dir=[...a.wanted];
  while (amount>EPS) {
    if (centered(a)) {
      a.x=Math.round(a.x); a.y=Math.round(a.y);
      if (a.wanted && allowed(a.x,a.y,a.wanted)) a.dir=[...a.wanted];
      if (!cardinal(a.dir) || !allowed(a.x,a.y,a.dir)) { a.dir=[0,0]; break; }
    }
    const [dx,dy]=a.dir;
    if (!cardinal(a.dir)) break;
    const coord=dx ? a.x : a.y, sign=dx||dy;
    const next=sign>0 ? Math.floor(coord+EPS)+1 : Math.ceil(coord-EPS)-1;
    const move=Math.min(amount,Math.abs(next-coord));
    a.x+=dx*move; a.y+=dy*move; amount-=move;
    if (centered(a)) { a.x=Math.round(a.x); a.y=Math.round(a.y); }
  }
}
