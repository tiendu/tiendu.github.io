import {HEIGHT} from '../core/maze.mjs';
export function view(x, y, landscape) { return landscape ? [HEIGHT - 1 - y, x] : [x, y]; }
export function unview(x, y, landscape) { return landscape ? [y, HEIGHT - 1 - x] : [x, y]; }
export function direction(dx, dy, landscape) { return landscape ? [dy, -dx] : [dx, dy]; }
