import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../../../../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');

test('menu defaults to selected spirit, and exposes five unique room slots',()=>{
  const menu=read('public/games/wisp/menu.js');
  const worker=read('src/games/wisp/server/worker.mjs');
  const core=read('src/games/wisp/server/room-core.mjs');
  assert.match(menu,/placeholder="Optional/);
  assert.doesNotMatch(menu,/value="Wisp"/);
  assert.match(menu,/for\(const spirit of names\)/);
  assert.match(menu,/\$\{s\.players\.length\}\/5 wisps/);
  assert.match(core,/MAX_PLAYERS = 5/);
  assert.match(core,/already taken/);
  assert.match(worker,/'rematch'/);
});

test('HUD exposes energy and distance without revealing pursuit proximity',()=>{
  const html=read('public/games/wisp/play.html');
  const game=read('public/games/wisp/game.js');
  assert.match(html,/id="wisp-hud"/);
  for(const id of ['energyText','energyFill','distance'])assert.match(html,new RegExp(`id="${id}"`));
  for(const id of ['chaseDistance','chaseThreat','restart']){
    assert.doesNotMatch(html,new RegExp(`id="${id}"`));
    assert.equal(game.includes(`el('${id}')`),false);
  }
});

test('solo end waits for terminal state and online rematch is server-mediated',()=>{
  const game=read('public/games/wisp/game.js');
  const menu=read('public/games/wisp/menu.js');
  const online=read('public/games/wisp/online.js');
  assert.match(game,/wisp:solo-finished/);
  assert.match(game,/!game\.isOnlineRun/);
  assert.match(menu,/online\.rematch\(\)/);
  assert.match(online,/request\('rematch',expected\)/);
  assert.doesNotMatch(game,/Choose TRY AGAIN or MENU/);
});
