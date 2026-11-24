import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {maze, WIDTH, HEIGHT, DIRS} from '../../../../public/games/wisp/core/maze.mjs';
import {view, unview, direction} from '../../../../public/games/wisp/client/orientation.mjs';
import {teams} from '../../../../public/games/wisp/core/roster.mjs';
import {WISPS, HUNTERS} from '../../../../public/games/wisp/core/characters.mjs';
import {characterSVG} from '../../../../public/games/wisp/characters.mjs';
test('600 deterministic connected, braided mazes with closed boundaries', () => {
  for (let s = 0; s < 300; s++) for (const tutorial of [false, true]) {
    const a = maze(s, tutorial);
    assert.deepEqual(a, maze(s, tutorial));
    assert.equal(a.length, HEIGHT); assert.ok(a.every(r => r.length === WIDTH));
    const q = [[1,1]], seen = new Set(['1,1']); let edges = 0;
    for (let i = 0; i < q.length; i++) {
      const [x,y] = q[i];
      for (const [dx,dy] of DIRS) {
        const u = x+dx, v = y+dy, k = `${u},${v}`;
        if (a[v]?.[u] !== 0) continue;
        edges++;
        if (!seen.has(k)) { seen.add(k); q.push([u,v]); }
      }
    }
    assert.equal(seen.size, a.flat().filter(v => !v).length);
    assert.ok(edges / 2 >= seen.size, 'at least one cycle');
    assert.ok(a[0].every(Boolean) && a.at(-1).every(Boolean) && a.every(r => r[0] && r.at(-1)));
  }
  assert.notDeepEqual(maze(1), maze(2));
});
test('every cell and input direction round-trips in both orientations', () => {
  for (const landscape of [false,true]) for (let y=0;y<HEIGHT;y++) for(let x=0;x<WIDTH;x++) {
    const a = view(x,y,landscape);
    assert.deepEqual(unview(...a,landscape),[x,y]);
    for(const [dx,dy] of DIRS) {
      const [u,v] = direction(dx,dy,landscape), b = view(x+u,y+v,landscape);
      assert.deepEqual([b[0]-a[0],b[1]-a[1]],[dx,dy]);
    }
  }
});
test('unique 4v4 roster, tutorial and invalid human selections', () => {
  assert.equal(WISPS.length,6); assert.equal(HUNTERS.length,6);
  for(const c of [...WISPS,...HUNTERS]) {
    const a = teams([{id:'p',character:c.id}],42);
    assert.equal(a.length,8); assert.equal(new Set(a.map(c=>c.id)).size,8);
    assert.equal(a.filter(c=>c.faction==='wisp').length,4);
    assert.equal(a.filter(c=>c.player==='p').length,1);
    assert.equal(a.find(c=>c.player==='p').id,c.id);
  }
  assert.ok(!teams([],42,true).some(c=>c.id==='Stalker'));
  assert.throws(()=>teams([{id:'p',character:'Stalker'}],42,true));
  assert.throws(()=>teams([{id:'p',character:'Unknown'}]));
  assert.throws(()=>teams([{id:'p',character:'Orb'},{id:'q',character:'Orb'}]));
  assert.throws(()=>teams([{id:'p',character:'Orb'},{id:'p',character:'Rune'}]));
});
test('all 12 silhouettes are distinct and use their agreed eyes', () => {
  const all = [...WISPS,...HUNTERS];
  assert.equal(new Set(all.map(c=>c.path)).size,12);
  for (const c of all) {
    const svg=characterSVG(c);
    assert.ok(svg.includes(c.path)); assert.ok(svg.includes(c.color));
    assert.equal((svg.match(/<ellipse /g)||[]).length,c.faction==='wisp'?2:0);
  }
});
test('release route is listed in Games', async () => {
  const source = p => readFile(new URL('../../../../'+p,import.meta.url),'utf8');
  const [catalog, route, page] = await Promise.all(['src/pages/games/index.astro','src/pages/games/wisp/index.astro','public/games/wisp/play.html'].map(source));
  assert.match(catalog,/href:\s*["']\/games\/wisp\//i);
  assert.match(route,/\/games\/wisp\/play\.html/);
  assert.doesNotMatch(route,/noindex/); assert.doesNotMatch(page,/noindex/);
  assert.match(route,/PUBLIC_WISP_BACKEND_URL/);
  assert.match(page,/game\.mjs/);
});
