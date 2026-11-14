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


test('UNFOLD room controller owns session, reconnect, and lobby lifecycle',async()=>{
  const { createRoomController }=await import('../public/games/unfold/online/rooms.mjs');
  const saved=new Map(),calls=[],elements=new Map();
  const beforeStorage=globalThis.localStorage,beforeDocument=globalThis.document;
  const $=id=>{
    if(!elements.has(id))elements.set(id,{hidden:false,disabled:false,textContent:'',innerHTML:'',value:'',
      classList:{add(){},remove(){}},addEventListener(){}});
    return elements.get(id);
  };
  globalThis.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
  globalThis.document={body:{classList:{remove(){}}}};
  let game=null,clears=0;
  const controller=createRoomController({$,request:async(op,args)=>{
    calls.push({op,args});
    return {code:'123456',token:'secret',snapshot:{now:Date.now(),revision:1,
      mode:'coop',host:true,seats:[{name:'Alice',connected:true}],code:'123456',game:null}};
  },getGame:()=>game,setGame:v=>{game=v;},getBusy:()=>false,setBusy(){},getRolling:()=>false,
    setRolling(){},clearLocalClock(){clears++;},resetSelection(){},activateAction(){},
    render(){},finishFoldVisual(){},animateFold:async()=>{},moveClosedBox:async()=>{},updateClock(){}});
  try{
    assert.equal(controller.isRemote(),false);
    $('room-name').value='Alice';$('room-mode').value='coop';
    await controller.createOrJoin('create');
    assert.deepEqual(calls[0],{op:'create',args:{name:'Alice',mode:'coop'}});
    assert.deepEqual(controller.session,{code:'123456',token:'secret'});
    assert.equal(JSON.parse(saved.get('unfold-room-v13')).code,'123456');
    assert.equal($('lobby-code').textContent,'123456');
    assert.equal(clears,1);
    controller.setSnapshot({game:{active:1,winner:null},seat:1});
    assert.equal(controller.myTurn(),true);
    controller.setSnapshot({game:{active:1,winner:null},seat:0});
    assert.equal(controller.myTurn(),false);
    controller.disconnect();
    assert.equal(controller.isRemote(),false);
    assert.equal(saved.has('unfold-room-v13'),false);
  }finally{
    controller.disconnect();
    if(beforeStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=beforeStorage;
    if(beforeDocument===undefined)delete globalThis.document;else globalThis.document=beforeDocument;
  }
});

test('Neon Grid uses one visual system, preserves existing menu IDs and attention priority',async()=>{
  const [page,app,foundation,operator,canvas]=await Promise.all([
    source('src/pages/games/unfold/index.astro'),
    source('public/games/unfold/app.mjs'),
    source('public/games/unfold/styles/foundation.css'),
    source('public/games/unfold/styles/operator.css'),
    source('public/games/unfold/render/canvas.mjs')]);
  for(const id of ['tab-solo','tab-create','tab-join','start-form','play','resume','room-entry',
    'room-mode','join-code','room-lobby','board','board-viewport','placement-tools','confirm',
    'next-fit','frame-skip','reel-track','animation-speed','instruction','result']){
    assert(page.includes(`id="${id}"`),`missing runtime element #${id}`);
  }
  assert.match(page,/BUILD THE CONNECTION/);
  assert.doesNotMatch(page,/styles\/clarity\.css|IRONWORKS/);
  assert.doesNotMatch(app,/paintTubeFrame|paintLatchFrame|updateLatches/);
  assert.match(operator,/\.tile\.legal-anchor/);
  assert.match(operator,/\.tile\.gate-just-opened/);
  assert.match(operator,/prefers-reduced-motion/);
  assert.match(page,/PLAY LOCAL|CREATE ROOM|JOIN ROOM/);
  assert.match(canvas,/foldedFaces/);
});


test('powered gates receive one finite path pulse, not ambient grid animation',async()=>{
  const {circuitPulseCells}=await import('../public/games/unfold/ui/circuit-pulse.mjs');
  const game={players:[{id:0,alive:true,base:[0,0]}]};
  const connected=new Set(['0,0','1,0','2,0','3,0','3,1']);
  const gate={open:true,terminals:[[2,0],[3,1]],cells:[[2,1]]};
  assert.equal(circuitPulseCells(game,[],()=>connected).size,0);
  assert.equal(circuitPulseCells(game,[{...gate,open:false}],()=>connected).size,0);
  const pulse=circuitPulseCells(game,[gate],()=>connected);
  assert.equal(pulse.get('0,0'),0);
  assert(pulse.get('1,0')<pulse.get('2,0'));
  assert(pulse.get('2,1')>pulse.get('3,1'));
  assert.equal(circuitPulseCells(game,[gate],()=>new Set(['0,0'])).size,0);
});


test('desktop rail is responsive without changing game actions',async()=>{
  const page=await source('src/pages/games/unfold/index.astro');
  const app=await source('public/games/unfold/app.mjs');
  const styles=await source('public/games/unfold/styles/operator.css');
  assert.match(page,/class="desktop-play-grid"/);
  assert.match(page,/class="command-rail"/);
  assert.match(page,/id="desktop-placement-slot"/);
  assert.match(app,/installDesktopPlacement\(\$,positionContextTools\)/);
  assert.match(styles,/@media \(min-width: 1100px\)/);
  assert.equal((page.match(/id="placement-tools"/g)||[]).length,1);
});

test('neon icons have static SVG geometry and accessible text remains present',async()=>{
  const {gameIcon}=await import('../public/games/unfold/ui/icons.mjs');
  for(const name of ['local','create','join','deploy','super','reclaim','refold','hub','goal','crate','wall','gate']){
    assert.match(gameIcon(name),/viewBox="0 0 24 24"/);
  }
  const {renderBoardTiles}=await import('../public/games/unfold/ui/board-tiles.mjs');
  const html=renderBoardTiles({size:2,mode:'solo',used:new Map([['0,0',{kind:'base',owner:0,id:0}],['1,0',{kind:'goal'}],['0,1',{kind:'obstacle',id:7,type:'rubble'}]]),spots:new Set(),preview:new Map(),action:null,targets:new Set(),placing:false});
  assert.match(html,/game-symbol/);
  assert.match(html,/base-red/);
  assert.match(html,/aria-label="base square 1,1"/);
  assert.match(html,/aria-label="goal square 2,1"/);
});


test('UX guidance never asks for a missing RECLAIM or REFOLD target',async()=>{
  const {actionGuidance}=await import('../public/games/unfold/ui/ux.mjs');
  const {newGame}=await import('../public/games/unfold/engine.mjs');
  const s=newGame({mode:'solo',level:'open',seed:71});
  s.die={face:4,action:'reclaim',net:null};
  const empty=actionGuidance(s);
  assert.equal(empty.state,'unavailable');
  assert.match(empty.tip,/No adjacent obstacle or reclaimable cube/);
  assert.doesNotMatch(empty.tip,/Select one/);
  s.die={face:6,action:'refold',net:null};
  assert.equal(actionGuidance(s).state,'unavailable');
  s.die={face:1,action:'deploy',net:0};
  assert.equal(actionGuidance(s).state,'available');
  assert.match(actionGuidance(s,{rolling:true}).tip,/Rolling/);
  assert.equal(actionGuidance(s,{ownTurn:false}).state,'waiting');
  s.winner={kind:'stuck',players:[]};s.announcement='No legal placement for the rolled construction cube.';
  const finished=actionGuidance(s);
  assert.equal(finished.state,'finished');
  assert.match(finished.tip,/No legal placement/);
  assert.doesNotMatch(finished.tip,/Skip this roll/);
});

test('neon team labels leave saved/default engine names and custom names untouched',async()=>{
  const {displayTeamName,displayTeamMessage}=await import('../public/games/unfold/ui/ux.mjs');
  const players=['Red','Blue','Green','Gold'].map((name,id)=>({id,name}));
  assert.deepEqual(players.map(displayTeamName),['Cyan','Pink','Amber','Lime']);
  assert.equal(displayTeamName({id:0,name:'Alice'}),'Alice');
  assert.equal(displayTeamMessage({mode:'competitive',players},'Red conquered Blue.'),'Cyan conquered Pink.');
  assert.equal(players[0].name,'Red','display conversion does not mutate engine state');
});

test('board uses one roving tab stop and retains coordinates and native button semantics',async()=>{
  const {renderBoardTiles}=await import('../public/games/unfold/ui/board-tiles.mjs');
  const markup=renderBoardTiles({size:3,mode:'solo',used:new Map(),spots:new Set(),
    preview:new Map(),action:null,targets:new Set(),placing:false,focusCell:[1,2]});
  assert.equal((markup.match(/tabindex="0"/g)||[]).length,1);
  assert.equal((markup.match(/tabindex="-1"/g)||[]).length,8);
  assert.match(markup,/tabindex="0" data-x="1" data-y="2"/);
  const app=await source('public/games/unfold/app.mjs');
  assert.match(app,/\.addEventListener\('keydown',event=>/);
  assert.match(app,/ArrowLeft/);
  assert.doesNotMatch(app,/if\(e\.key==='Enter'&&inPlacement\(\)/);
});

test('one in-game header, consistent result placement, and accessible menu tabs',async()=>{
  const page=await source('src/pages/games/unfold/index.astro');
  const app=await source('public/games/unfold/app.mjs');
  const css=await source('public/games/unfold/styles/operator.css');
  assert.equal((page.match(/id="new-game"/g)||[]).length,1);
  assert.equal((page.match(/class="frame-games"/g)||[]).length,0);
  assert.equal((page.match(/<header class="masthead">/g)||[]).length,1);
  assert.match(page,/id="result" class="result" role="status"/);
  assert.match(app,/setAttribute\('aria-selected'/);
  assert.match(app,/tabIndex=tab===name\?0:-1/);
  assert.match(css,/\.desktop-play-grid \.result \{ order:3/);
});
