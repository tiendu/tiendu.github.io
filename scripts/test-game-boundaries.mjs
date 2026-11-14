// Regression checks for game entry points and the first UNFOLD UI extraction.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { newGame, canReclaim } from '../public/games/unfold/engine.mjs';
import { NETS } from '../public/games/unfold/nets.mjs';
import { actionAvailable, actionTargets, cannotUseReason } from '../public/games/unfold/ui/actions.mjs';
import { netThumbnail } from '../public/games/unfold/ui/net-thumbnail.mjs';

const source = path => readFile(new URL('../'+path,import.meta.url),'utf8');

test('UNFOLD action presentation uses the engine, not duplicate UI rules',async()=>{
  const app=await source('public/games/unfold/app.mjs');
  assert.match(app,/from ['"]\.\/ui\/actions\.mjs['"]/);
  assert.match(app,/from ['"]\.\/ui\/net-thumbnail\.mjs['"]/);
  assert.doesNotMatch(app,/function actionAvailable\(/);
  assert.doesNotMatch(app,/function actionTargets\(/);
  assert.doesNotMatch(app,/function netThumbnail\(/);
  const s=newGame({mode:'solo',level:'open',seed:7});
  s.die={face:4,action:'reclaim',net:null};
  assert.equal(actionAvailable(s),false);
  assert.deepEqual(actionTargets(s,'reclaim'),[]);
  assert.equal(cannotUseReason('reclaim'),'No adjacent obstacle or reclaimable cube. Skip this roll.');
  s.die={face:1,action:'deploy',net:0};
  assert.equal(actionAvailable(s),true);
  s.acted=true;
  assert.equal(actionAvailable(s),false);
  assert.equal(typeof canReclaim,'function');
});

test('UNFOLD SVG previews still contain exactly six panels',()=>{
  assert.equal(NETS.length,11);
  for(let i=0;i<NETS.length;i++){
    const svg=netThumbnail(i);
    assert.equal((svg.match(/<rect /g)||[]).length,6);
    assert.match(svg,/viewBox="0 0 96 80"/);
  }
});

test('MINES and NUMBER retain separate page, logic, and online entry points',async()=>{
  const mines=await source('src/pages/games/mines.astro');
  const number=await source('src/pages/games/number.astro');
  assert.match(mines,/mountMines\(\)/);
  assert.match(number,/mountNumberGames\(\)/);
  const [mineLogic,numberLogic,numberOnline]=await Promise.all([
    source('src/scripts/games/mines.mjs'),
    source('src/scripts/games/number.ts'),
    source('src/scripts/games/number-online.ts'),
  ]);
  assert.match(mineLogic,/multiplayer\/src\/mines\/board\.mjs/);
  assert.match(numberLogic,/from ['"]\.\/number-rules['"]/);
  assert.match(numberLogic,/from ['"]\.\/number-online['"]/);
  assert.match(numberOnline,/export function mountNumberOnline/);
});

test('UNFOLD board tile renderer preserves grid, contact, preview, and capture markings',async()=>{
  const app=await source('public/games/unfold/app.mjs');
  assert.match(app,/from ['"]\.\/ui\/board-tiles\.mjs['"]/);
  assert.doesNotMatch(app,/const tiles=\[\];for\(let y=/);
  const {renderBoardTiles}=await import('../public/games/unfold/ui/board-tiles.mjs');
  const used=new Map([
    ['0,0',{kind:'base',id:0,owner:0}],
    ['1,0',{kind:'cube',id:8,owner:1,contact:true,number:4}],
    ['2,0',{kind:'obstacle',id:12,type:'permanent'}],
    ['3,0',{kind:'goal'}],
  ]);
  const html=renderBoardTiles({size:4,mode:'competitive',used,
    spots:new Set(['1,2']),preview:new Map([['1,2',{valid:true,contact:true}]]),
    action:'reclaim',targets:new Set([8]),anchor:[1,2],placing:true,
    lockingCubeId:8,foldOriginId:null});
  assert.equal((html.match(/role="gridcell"/g)||[]).length,16);
  assert.match(html,/class="tile base-red"/);
  assert.match(html,/class="tile road-blue latch-lock reclaim-target"/);
  assert.match(html,/class="tile permanent"/);
  assert.match(html,/class="tile goal"/);
  assert.match(html,/aria-label="Cube 4"/);
  assert.match(html,/cube 4 contact square/);
  assert.match(html,/class="tile preview-good legal-anchor selected-anchor"/);
  assert.match(html,/RECLAIM available/);
});
