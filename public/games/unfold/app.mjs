import { NETS, oriented } from './nets.mjs';
import { newGame, newDistinctGame, player, occupied, canPlace, legalPlacements, canReclaim, refoldable, placedCells, act, endTurn, LABELS, connectedCells } from './engine.mjs';
import { createFoldAnimator, ANIMATION_MS } from './render/animation.mjs';
import { legalFits } from './guided.mjs';
import { installMechanicalPress } from './ui/press.mjs';
import { REEL_FACES, reelFace } from './ui/reel.mjs';
import { createRoomController } from './online/rooms.mjs';
import { saveSolo, loadSolo } from './ui/storage.mjs';
import { installCamera } from './ui/camera.mjs';
import { installDesktopPlacement } from './ui/desktop-layout.mjs';
import { actionAvailable, actionTargets, cannotUseReason } from './ui/actions.mjs';
import { netThumbnail } from './ui/net-thumbnail.mjs';
import { renderBoardTiles } from './ui/board-tiles.mjs';
import { gameIcon } from './ui/icons.mjs';
import { circuitPulseCells } from './ui/circuit-pulse.mjs';

const $=id=>document.getElementById(id);
const UNFOLD_VERSION='1.9.3';
document.querySelectorAll('.version').forEach(label=>label.textContent=UNFOLD_VERSION);
document.title='UNFOLD · Neon Grid';
// Works on both the original v1.6 Astro page and checkouts where the menu
// cleanup was already applied. Never duplicate or reconstruct the setup form.
for(const selector of ['#setup > .intro-mark','#setup > .eyebrow','#setup > .intro'])document.querySelector(selector)?.remove();

installMechanicalPress();

const SAVE_KEY='unfold-v05'; // Keep game-state saves compatible with v0.7.
const ARROWS=[[1,0],[-1,0],[0,1],[0,-1]];
let game=null,selected=false,selectedNet=0,rotation=0,flipped=false,anchor=null,sourceId=null,fitIndex=0,fitCache=null,rollToken=0;
let busy=false,rolling=false,deadline=0,timer=null,lockingCubeId=null;
let foldOriginId=null;
// Room state, polling, synchronization, and lobby UI live in online/rooms.mjs.
const PLAYER_COLORS=['#49ddf5','#ff68bd','#ffcd65','#b3f36d'];
const room=createRoomController({$,
  getGame:()=>game,setGame:value=>{game=value;},
  getBusy:()=>busy,setBusy:value=>{busy=value;},
  getRolling:()=>rolling,setRolling:value=>{rolling=value;},
  clearLocalClock:()=>clearInterval(timer),
  resetSelection,activateAction,render,
  finishFoldVisual:()=>finishFoldVisual(),
  animateFold:(...args)=>animateFold(...args),
  moveClosedBox:(...args)=>moveClosedBox(...args),updateClock,
});
const isRemote=()=>room.isRemote();
const myTurn=()=>room.myTurn();
function updateClock(){if(!game||game.mode==='solo')return;
  if(isRemote()&&room.snapshot?.deadline){const left=Math.max(0,Math.ceil((room.snapshot.deadline-room.nowServer())/1000));$('clock').textContent=String(left);$('clock-box').classList.toggle('urgent',left<=10);$('turn-clock').textContent=game.winner?'FINISHED':`${left}s`;
  }else if(!isRemote())$('turn-clock').textContent=$('clock').textContent+'s';
}
function updateTurnBanner(){if(!game)return;
  const p=player(game),banner=$('turn-banner'),index=game.active;
  banner.style.setProperty('--active',PLAYER_COLORS[index]||PLAYER_COLORS[0]);
  banner.classList.toggle('waiting',!myTurn());
  $('turn-label').textContent=game.winner?'ROUND ENDED':game.mode==='solo'?'SOLO':myTurn()?(isRemote()?'YOUR TURN':'LOCAL TURN'):`WAITING FOR ${p.name.toUpperCase()}`;
  $('turn-player').textContent=p.name.toUpperCase();
  $('turn-clock').textContent=game.mode==='solo'?'NO TIMER':isRemote()?'60s':$('clock').textContent+'s';
  updateClock();
}
let currentAnimationSpeed='normal';
try{const v=localStorage.getItem('unfold-animation-speed');if(Object.hasOwn(ANIMATION_MS,v))currentAnimationSpeed=v;}catch{/* memory-only setting in private browsers */}
function animationSpeed(){return currentAnimationSpeed;}
const {createGrit,finishFoldVisual,moveClosedBox,animateFold,fastForwardAnimation}=
  createFoldAnimator({$,getGame:()=>game,animationSpeed});

const gameAction=()=>game?.die?.action;
const ACTION_TIPS={deploy:'Place the assigned six-panel net on a mint socket.',special:'Choose any cube net, then place its six panels.',reclaim:'Select an amber target touching your connected road.',refold:'Choose an eligible rear module and reposition it.'};
const inPlacement=()=>selected&&['deploy','special','refold'].includes(gameAction())&&(gameAction()!=='refold'||sourceId!==null);
const key=([x,y])=>`${x},${y}`;
const rootOffset=()=>oriented(selectedNet,rotation,flipped)[0];
const fromContact=([x,y])=>{const [dx,dy]=rootOffset();return [x-dx,y-dy];};
const contactFromOrigin=([x,y])=>{const [dx,dy]=rootOffset();return [x+dx,y+dy];};
function choices(){
  if(!inPlacement())return new Map();
  if(fitCache?.game===game&&fitCache.net===selectedNet&&fitCache.sourceId===sourceId)return fitCache.positions;
  const positions=legalFits(game,game.active,selectedNet,gameAction()==='refold'?sourceId:null);
  fitCache={game,net:selectedNet,sourceId,positions};
  return positions;
}
const canAt=contact=>choices().has(key(contact));
const validContacts=()=>[...choices().values()].map(p=>p.contact);
function setPose(){const fits=anchor&&choices().get(key(anchor))?.fits;
  if(!fits?.length){rotation=0;flipped=false;fitIndex=0;return;}
  fitIndex=((fitIndex%fits.length)+fits.length)%fits.length;
  ({rotation,flipped}=fits[fitIndex]);
}
function selectContact(contact){
  if(!choices().has(key(contact)))return false;
  anchor=contact;fitIndex=0;setPose();return true;
}
const timing=ms=>new Promise(r=>setTimeout(r,ms));
function persist(){if(!isRemote())saveSolo(SAVE_KEY,game);}
function stored(){return loadSolo(SAVE_KEY);}
function resetSelection(){selected=false;selectedNet=0;rotation=0;flipped=false;anchor=null;sourceId=null;fitIndex=0;fitCache=null;}
function announce(text){$('instruction').textContent=text;}
function chooseSpot(){
  const positions=validContacts();
  if(!positions.length){anchor=null;fitIndex=0;return;}
  if(anchor&&canAt(anchor)){setPose();return;}
  const base=player(game).base;
  positions.sort((a,b)=>((Math.abs(a[0]-base[0])+Math.abs(a[1]-base[1]))-(Math.abs(b[0]-base[0])+Math.abs(b[1]-base[1])))||a[1]-b[1]||a[0]-b[0]);
  selectContact(positions[0]);
}
function nextFit(){
  if(!inPlacement()||busy||rolling||!anchor)return;
  const count=choices().get(key(anchor))?.fits.length||0;
  if(count<2)return;
  fitIndex=(fitIndex+1)%count;setPose();render();
}
let previousGateLayout=null,previousOpenGates=new Set();
function drawBoard(){const used=occupied(game),spots=new Set(busy?[]:validContacts().map(key)),preview=new Map();
  const action=selected&&!busy&&!rolling&&!game.acted&&!game.winner&&myTurn()?gameAction():null;
  const targets=new Set(actionTargets(game,action,sourceId).map(o=>o.id));
  if(!busy&&inPlacement()&&anchor){const [x,y]=fromContact(anchor),valid=canAt(anchor),cells=placedCells(selectedNet,rotation,flipped,x,y);
    cells.forEach((c,i)=>{if(c[0]>=0&&c[1]>=0&&c[0]<game.size&&c[1]<game.size)preview.set(key(c),{valid,contact:i===0});});
  }
  const gateMarks=new Map();
  const layout=`${game.mode}/${game.seed}/${game.layoutId||game.size}`;
  const gateList=game.obstacles.filter(o=>o.type==='gate');
  if(layout!==previousGateLayout){
    previousGateLayout=layout;
    previousOpenGates=new Set(gateList.filter(g=>g.open).map(g=>g.id));
  }
  for(const gate of gateList){
    for(const cell of gate.cells)gateMarks.set(key(cell),{kind:'gate',open:gate.open,opening:gate.open&&!previousOpenGates.has(gate.id)});
    gate.terminals?.forEach((cell,i)=>gateMarks.set(key(cell),
      {kind:'terminal',sign:i===0?'+':'−',open:gate.open}));
  }
  const openingGates=gateList.filter(g=>g.open&&!previousOpenGates.has(g.id));
  const pulseCells=circuitPulseCells(game,openingGates,connectedCells);
  previousOpenGates=new Set(gateList.filter(g=>g.open).map(g=>g.id));
  const placing=inPlacement();
  $('board').style.setProperty('--size',game.size);
  $('board').innerHTML=renderBoardTiles({size:game.size,mode:game.mode,used,spots,preview,action,targets,
    anchor,placing,lockingCubeId,foldOriginId,gateMarks,pulseCells});
  $('board-viewport').classList.toggle('large-board',game.size>=17);
}
function showPicker(){
  const action=gameAction(),shown=selected&&inPlacement()&&!busy;
  $('board-shape-slot').hidden=!shown;
  $('cube-offer').hidden=!shown||action!=='deploy';
  $('shape-picker').hidden=!shown||action==='deploy';
  $('placement-tools').hidden=!shown||!anchor;
  if(!shown){
    const hint=$('board-hint');
    if(selected&&['reclaim','refold'].includes(action)&&!busy&&!rolling&&!game.acted&&myTurn()){
      const count=actionTargets(game,action,sourceId).length;
      hint.textContent=`${count} ${action.toUpperCase()} ${count===1?'TARGET':'TARGETS'}`;
      hint.title=action==='reclaim'?'Tap an amber target to reclaim it':'Tap a green rear cube to refold it';
    }else{
      hint.textContent=game.acted?'Action complete':!rolling&&action==='reclaim'&&!actionAvailable(game)?'NO RECLAIM TARGETS':!rolling&&action==='refold'&&!actionAvailable(game)?'NO REFOLD TARGETS':'Action ready';
      hint.title='';
    }
    return;
  }
  if(action==='deploy'){
    $('cube-visual').innerHTML=netThumbnail(selectedNet);
    $('cube-name').textContent=`NET ${String(selectedNet+1).padStart(2,'0')} · FIXED`;
    $('cube-help').textContent='One assigned net · tap any marked socket';
  }else{
    $('shape-list').innerHTML=NETS.map((_,i)=>`<button type="button" data-net="${i}" class="net-option ${i===selectedNet?'active':''}" aria-pressed="${i===selectedNet}" aria-label="Net ${i+1}">${netThumbnail(i)}<small>${String(i+1).padStart(2,'0')}</small></button>`).join('');
  }
  const positions=choices(),count=anchor?positions.get(key(anchor))?.fits.length||0:0;
  $('placement-info').textContent=anchor?`SOCKET ${anchor[0]+1},${anchor[1]+1}  ·  FIT ${fitIndex+1}/${count}`:'NO VALID LANDING';
  $('fit-count').textContent=count?`${fitIndex+1} / ${count} FITS`:'NO FITS';
  $('next-fit').disabled=count<2||busy||rolling||game.acted;
  $('confirm').disabled=!anchor||!canAt(anchor)||busy||rolling||game.acted;
  $('board-hint').textContent=`${positions.size} ${positions.size===1?'FIT':'FITS'}`;
  $('board-hint').title=`${positions.size} legal landing ${positions.size===1?'spot':'spots'}`;
  $('context-cube').textContent=action==='refold'&&sourceId!==null?String(game.cubes.find(c=>c.id===sourceId)?.number||'?').padStart(2,'0'):String(game.nextCubeNumber||1).padStart(2,'0');
}
function render(){if(!game)return;
  $('setup').hidden=true;$('room-lobby').hidden=true;$('game').hidden=false;document.body.classList.add('playing');
  const p=player(game),action=gameAction();
  $('mode-label').textContent=`${game.mode==='competitive'?'VERSUS':game.mode.toUpperCase()} · ${game.mode==='solo'&&game.level!=='open'?game.level.toUpperCase()+' · ':''}${game.size}×${game.size} · TURN ${game.turn}`;
  $('mission-title').textContent=game.mode==='solo'?'Connect S to ★':game.mode==='coop'?'Connect all bases to ★':`${p.name} · conquer an opponent`;
  $('roll-count').textContent=`TURN ${game.turn} · REEL ${game.die.face}/6`;
  $('rolled-action').textContent=rolling?'ROLLING':LABELS[action].toUpperCase();
  $('action-tip').textContent=game.winner?'Round complete.':game.crisis?'Construction crisis: a teammate must restore a legal route.':ACTION_TIPS[action]||'Select your next move.';
  $('current-action-icon').innerHTML=gameIcon(({deploy:'deploy',special:'super',reclaim:'reclaim',refold:'refold'})[action]||'deploy');
  const available=actionAvailable(game);
  $('board-note').classList.toggle('crisis',Boolean(game.crisis&&!game.winner));
  updateTurnBanner();
  if(game.crisis&&!game.winner)$('mission-title').textContent=`CONSTRUCTION CRISIS · ${game.crisis.remaining} TEAM TURN${game.crisis.remaining===1?'':'S'} LEFT`;
  $('frame-skip').disabled=busy||rolling||Boolean(game.winner)||!myTurn()||Boolean(game.acted&&isRemote());
  $('frame-skip').textContent=game.acted?'LOCKED':'SKIP ↷';
  $('clock-box').hidden=game.mode==='solo';
  $('result').hidden=!game.winner;
  $('result').classList.toggle('is-defeat',Boolean(game.winner?.kind==='stuck'));
  if(game.winner)$('result-title').textContent=game.announcement||'Route complete';
  if(!selected&&!game.acted)announce(rolling?'The reel is spinning…':available?'Tap a marked landing spot, or skip this turn.':cannotUseReason(gameAction()));
  if(game.acted)announce(game.announcement);
  if(selected&&!game.acted){
    if(action==='reclaim')announce('Tap a highlighted amber obstacle or cube to reclaim it.');
    else if(action==='refold'&&sourceId===null)announce('Tap a highlighted mint rear cube to refold it.');
    else announce('Tap a marked socket · NEXT FIT cycles legal orientations · UNFOLD installs it.');
  }
  showPicker();drawBoard();positionContextTools();persist();
}
function activateAction(){if(!game||rolling||busy||game.acted||!actionAvailable(game))return;
  selected=true;selectedNet=game.die.net??0;rotation=0;flipped=false;anchor=null;sourceId=null;fitIndex=0;fitCache=null;
  if(gameAction()==='deploy'||gameAction()==='special')chooseSpot();
  render();
}
function chooseNet(n){if(!selected||!inPlacement()||gameAction()==='deploy')return;
  const lastAnchor=anchor;selectedNet=n;fitCache=null;rotation=0;flipped=false;fitIndex=0;
  anchor=lastAnchor&&canAt(lastAnchor)?lastAnchor:null;chooseSpot();render();
}
function tapTile(x,y){if(!selected||busy||rolling||game.acted||!myTurn())return;
  const at=occupied(game).get(`${x},${y}`),action=gameAction();
  if(action==='reclaim'){
    if(at&&canReclaim(game,game.active,at.id))commit({targetId:at.id});
    else announce('Only adjacent reclaimable targets are allowed.');
    return;
  }
  if(action==='refold'&&sourceId===null){
    if(at?.kind==='cube'&&refoldable(game,game.active,at.id)){
      sourceId=at.id;selectedNet=game.cubes.find(c=>c.id===at.id).net;fitCache=null;anchor=null;chooseSpot();render();
    }else announce('Choose a highlighted rear cube.');
    return;
  }
  if(inPlacement()){
    if(selectContact([x,y]))render();
    else announce('Choose one of the marked contact sockets.');
  }
}
// Controls are a viewport-sized overlay attached to the selected footprint,
// not the old frame toolbar. Keep it off the six occupied preview cells and
// within the viewport even when the player pans/zooms the table.
function positionContextTools(){
  const tools=$('placement-tools');
  if(tools.parentElement?.id==='desktop-placement-slot')return;
  if(tools.hidden||!anchor||!inPlacement()||busy)return;
  const viewport=$('board-viewport'),vr=viewport.getBoundingClientRect();
  const preview=[...$('board').querySelectorAll('.tile.preview-good,.tile.preview-bad')];
  if(!preview.length)return;
  const relative=t=>{const r=t.getBoundingClientRect();return {l:r.left-vr.left,t:r.top-vr.top,r:r.right-vr.left,b:r.bottom-vr.top};};
  const box=preview.reduce((a,t)=>{const r=relative(t);return {l:Math.min(a.l,r.l),t:Math.min(a.t,r.t),r:Math.max(a.r,r.r),b:Math.max(a.b,r.b)};},{l:Infinity,t:Infinity,r:-Infinity,b:-Infinity});
  // Never cover the selected six panels. Prefer not to obscure *other* green
  // contact markers either: otherwise tapping a legal cell could accidentally
  // hit UNFOLD and commit the wrong placement on a touch screen.
  const markers=[...$('board').querySelectorAll('.tile.legal-anchor')].map(relative);
  const w=tools.offsetWidth,h=tools.offsetHeight,edge=4,gap=6;
  const maxX=Math.max(edge,vr.width-w-edge),maxY=Math.max(edge,vr.height-h-edge);
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const cx=(box.l+box.r-w)/2,cy=(box.t+box.b-h)/2;
  const candidates=[];
  for(const offset of [-w/2,0,w/2]){
    candidates.push([cx+offset,box.t-h-gap],[cx+offset,box.b+gap]);
  }
  for(const offset of [-h/2,0,h/2]){
    candidates.push([box.r+gap,cy+offset],[box.l-w-gap,cy+offset]);
  }
  // Fallback to the nearest clear rail of empty cells if legal anchors crowd
  // the selected contact. These are still ON the table, never in a popup.
  const step=Math.max(10,vr.width/game.size/2);
  for(let y=edge;y<=maxY;y+=step)for(const x of [cx,edge,vr.width-w-edge])candidates.push([x,y]);
  for(const x of [cx,edge,vr.width-w-edge])candidates.push([x,maxY]);
  let best=null,bestScore=Infinity;
  const overlap=(a,b)=>Math.max(0,Math.min(a.r,b.r)-Math.max(a.l,b.l))*Math.max(0,Math.min(a.b,b.b)-Math.max(a.t,b.t));
  for(const [x,y] of candidates){
    const left=clamp(x,edge,maxX),top=clamp(y,edge,maxY),r={l:left,t:top,r:left+w,b:top+h};
    const obscured=markers.reduce((sum,m)=>sum+overlap(r,m),0);
    const movement=Math.abs(x-left)+Math.abs(y-top);
    const distance=Math.abs((left+w/2)-(box.l+box.r)/2)+Math.abs((top+h/2)-(box.t+box.b)/2);
    const score=overlap(r,box)*500+obscured*10+movement*2+distance*.045;
    if(score<bestScore){best=[left,top];bestScore=score;}
  }
  if(best){tools.style.left=`${best[0]+viewport.scrollLeft}px`;tools.style.top=`${best[1]+viewport.scrollTop}px`;}
}
function cancelPreview(){if(!inPlacement()||busy)return;anchor=null;render();}
async function commit(payload={}){
  if(!game||busy||rolling||game.acted||!selected)return;
  const action=gameAction();let to=payload,old=null;
  if(inPlacement()){
    if(!anchor||!canAt(anchor))return;
    const [x,y]=fromContact(anchor);
    to={x,y,rotation,flipped,netIndex:selectedNet,targetId:sourceId};
    if(action==='refold')old=game.cubes.find(c=>c.id===sourceId);
  }
  let next;try{next=act(game,to);}catch(error){announce(error.message);return;}
  if(isRemote()){
    busy=true;render();
    try{
      const snapshot=await room.request('action',room.args({turn:game.turn,payload:to}));
      room.setSnapshot(snapshot);next=snapshot.game;
      room.markMove(snapshot.lastMove?.id);
    }catch(error){busy=false;room.error(error);render();return;}
  }
  busy=true;foldOriginId=old?.id??null;$('confirm').disabled=true;$('frame-skip').disabled=true;$('placement-tools').hidden=true;
  // Remove only transient selection paint. The actual board cells and the
  // permanent tubing canvas remain mounted throughout the entire operation.
  $('board').querySelectorAll('.preview-good,.preview-bad,.legal-anchor,.selected-anchor').forEach(tile=>{
    tile.classList.remove('preview-good','preview-bad','legal-anchor','selected-anchor');
    tile.querySelector('.anchor-dot')?.remove();
  });
  const net=selectedNet,contact=anchor&&[...anchor],movedId=sourceId;
  try{
    if(old){
      await animateFold(old.net,old.rotation,old.flipped,old.cells[0],true);
      // All six sockets are now empty while the sealed box moves. Keep the
      // frame canvas and old board DOM; only change each old tile's surface.
      old.cells.forEach(([x,y])=>$('board').querySelector(`[data-x="${x}"][data-y="${y}"]`)?.classList.add('fold-lifting'));
      if(contact)await moveClosedBox(old.cells[0],contact,old.net,old.rotation,old.flipped,PLAYER_COLORS[game.active]);
    }
    if(inPlacement())await animateFold(net,rotation,flipped,contact);
    else await timing(280);
  }finally{
    game=next;busy=false;foldOriginId=null;resetSelection();
    if(['deploy','special','refold'].includes(action)){
      lockingCubeId=action==='refold'?movedId:next.cubes.at(-1)?.id;
    }
    render();
    finishFoldVisual();
    if(['deploy','special','refold'].includes(action)){
      const installed=next.cubes.find(c=>c.id===lockingCubeId);
      if(installed)createGrit(installed.cells);
    }
    if(!game.winner&&!isRemote()){
      const finishedGame=game;
      setTimeout(()=>{if(game===finishedGame&&!busy&&game.acted)advance();},850);
    }
    if(isRemote()){room.syncRevision();room.refresh();}
    if(lockingCubeId!==null){
      const id=lockingCubeId;
      setTimeout(()=>{
        if(lockingCubeId===id){lockingCubeId=null;document.querySelectorAll('.tile.latch-lock').forEach(el=>el.classList.remove('latch-lock'));}
      },800);
    }
  }
}
function startClock(){clearInterval(timer);if(!game||game.mode==='solo'||game.winner||isRemote())return;
  deadline=performance.now()+60000;
  $('clock').textContent='60';
  timer=setInterval(()=>{
    if(!game||game.winner||rolling||busy||game.acted)return;
    const left=Math.max(0,Math.ceil((deadline-performance.now())/1000));
    $('clock').textContent=String(left);$('clock-box').classList.toggle('urgent',left<=10);
    if(left<=0){clearInterval(timer);advance();}
  },200);
}
async function rollAnimation(){
  const token=++rollToken;rolling=true;selected=false;
  const track=$('reel-track');
  const housing=document.querySelector('.reel-scene');
  housing?.classList.remove('clunk');housing?.classList.add('spinning');
  // Animate a six-stop reel with exactly the probabilities generated by engine.mjs.
  const stop=game.die.face-1;
  const sequence=Array.from({length:4},()=>REEL_FACES).flat();
  track.classList.remove('spinning');track.style.transition='none';
  track.style.transform='translateY(0)';
  track.innerHTML=sequence.map((label,i)=>`<span data-stop="${(i%6)+1}">${label}</span>`).join('');
  render();
  const px=parseFloat(getComputedStyle(track).getPropertyValue('--reel-cell'))||38;
  void track.offsetHeight;
  track.classList.add('spinning');track.style.transition='transform 900ms cubic-bezier(.10,.63,.09,1)';
  track.style.transform=`translateY(-${(18+stop)*px}px)`;
  await timing(930);
  if(!game||token!==rollToken){housing?.classList.remove('spinning');return;}
  reelFace(game.die.face);
  housing?.classList.remove('spinning','action-arrival');
  if(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){void housing?.offsetWidth;housing?.classList.add('action-arrival');}
  rolling=false;activateAction();render();startClock();
}

async function advance(){if(!game||rolling||busy||game.winner)return;
  if(isRemote()){
    if(!myTurn()||game.acted)return;
    busy=true;render();
    try{const snapshot=await room.request('pass',room.args({turn:game.turn}));busy=false;resetSelection();await room.receive(snapshot);}catch(error){busy=false;room.error(error);render();}
    return;
  }
  clearInterval(timer);
  game=endTurn(game);resetSelection();
  if(game.winner){render();return;}
  rollAnimation();
}
function begin(config,previous=null){
  const next=previous?newDistinctGame(config,previous):newGame(config);
  room.disconnect();
  rollToken++;clearInterval(timer);game=next;resetSelection();busy=false;render();rollAnimation();
}
$('start-form').addEventListener('submit',e=>{
  e.preventDefault();const mode=$('mode').value,seed=Number($('seed').value)||(Date.now()>>>0);
  try{begin({mode,count:Number($('players').value),level:$('level').value,seed});}
  catch(error){$('boot-note').textContent=`Unable to start: ${error.message}`;console.error(error);}
});
$('mode').addEventListener('change',()=>{const solo=$('mode').value==='solo';$('local-options').hidden=solo;$('level-options').hidden=!solo;refreshModeHelp();});
// v1.4: concise, mode-specific help; preserve the user's compact PLAY screen.
// No Astro template dependency: these improvements also work after the v1.3
// checkout-aware menu hotfix.
const mapOptions=$('level');
mapOptions.innerHTML=`<option value="starter">Starter · 13×13</option>
  <option value="standard" selected>Standard · 15×15</option>
  <option value="hard">Hard · 19×19</option>
  <option value="open">Open field · 11×11</option>`;
const summaryLine=document.createElement('p');
summaryLine.className='mode-tagline';
$('setup-title').insertAdjacentElement('afterend',summaryLine);
const roomLine=document.createElement('p');
roomLine.className='room-mode-tagline';
$('room-mode').insertAdjacentElement('afterend',roomLine);
function refreshModeHelp(){
  const descriptions={solo:'Connect your base to the goal.',coop:'Build from your base. Join paths to reach the goal.',competitive:'Capture rival bases.'};
  const activeTab=document.querySelector('.entry-tabs button.active')?.id;
  summaryLine.textContent=activeTab==='tab-create'?'Create a room and invite friends.':
    activeTab==='tab-join'?'Join friends with a room code.':
    descriptions[$('mode').value]||descriptions.solo;
  roomLine.textContent=descriptions[$('room-mode').value]||descriptions.coop;
}
$('room-mode').addEventListener('change',refreshModeHelp);
refreshModeHelp();


installDesktopPlacement($,positionContextTools);
installCamera($,positionContextTools);
$('board').addEventListener('click',e=>{const b=e.target.closest('[data-x]');if(b)tapTile(Number(b.dataset.x),Number(b.dataset.y));});
$('shape-list').addEventListener('click',e=>{const b=e.target.closest('[data-net]');if(b)chooseNet(Number(b.dataset.net));});
$('next-fit').addEventListener('click',nextFit);
$('frame-skip').addEventListener('click',advance);
$('board-viewport').addEventListener('click',()=>{if(busy)fastForwardAnimation();});
$('confirm').addEventListener('click',()=>commit());
$('placement-tools').addEventListener('click',e=>e.stopPropagation());

$('board-viewport').addEventListener('scroll',positionContextTools,{passive:true});
window.addEventListener('resize',positionContextTools,{passive:true});

$('new-game').addEventListener('click',()=>{
  if(game&&!game.winner&&!confirm('Leave this match? You can still resume it.'))return;
  if(isRemote())room.disconnect();
  clearInterval(timer);rollToken++;rolling=false;busy=false;game=null;resetSelection();document.body.classList.remove('playing');$('game').hidden=true;$('setup').hidden=false;$('resume').hidden=!stored();
});
$('resume').addEventListener('click',()=>{const s=stored();if(!s)return;rollToken++;rolling=false;game=s;resetSelection();activateAction();render();reelFace(game.die.face);startClock();});
$('next-game').addEventListener('click',async()=>{
  if(!game?.winner)return;
  if(isRemote()){
    if(!room.snapshot?.host)return;
    try{const s=await room.request('next',room.args());await room.receive(s);}
    catch(e){room.error(e);}
    return;
  }
  const previous=game,{mode,level,players,seed}=previous;
  let nextSeed=0;
  try{nextSeed=crypto.getRandomValues(new Uint32Array(1))[0];}
  catch{nextSeed=(Date.now()+Math.floor(Math.random()*65536))>>>0;}
  if(!nextSeed||nextSeed===seed)nextSeed=(seed+1)>>>0||1;
  try{begin({mode,level,count:players.length,seed:nextSeed},previous);}
  catch(e){console.error(e);announce('Unable to start a new board. Try again.');}
});
// Keyboard access on desktop; mobile uses the same tap controls.
document.addEventListener('keydown',e=>{
  if(!game||e.target.matches('input,select,textarea'))return;
  if(e.key==='Escape'&&inPlacement()){anchor=null;render();}
  if(e.key.toLowerCase()==='f'&&inPlacement())nextFit();
  if(e.key==='Enter'&&inPlacement()&&!$('confirm').disabled)commit();
});
$('animation-speed').value=animationSpeed();
$('animation-speed').addEventListener('change',e=>{currentAnimationSpeed=e.target.value;try{localStorage.setItem('unfold-animation-speed',e.target.value);}catch{/* memory-only setting */}});
$('resume').hidden=!stored();$('play').disabled=false;$('play').textContent='PLAY';$('boot-note').textContent='';

// Online sessions remain optional: local Solo and pass-and-play are untouched.
function setEntryTab(tab){
  for(const name of ['solo','create','join']){
    const button=$(`tab-${name}`);button.classList.toggle('active',tab===name);
    button.setAttribute('aria-selected',String(tab===name));
  }
  $('start-form').hidden=tab!=='solo';$('room-entry').hidden=tab==='solo';
  $('room-create-fields').hidden=tab!=='create';$('room-join-fields').hidden=tab!=='join';
  if(tab!=='solo')$('resume').hidden=true;
  else $('resume').hidden=!stored();
  refreshModeHelp();
}
for(const tab of ['solo','create','join'])$(`tab-${tab}`).addEventListener('click',()=>setEntryTab(tab));
room.installUI(setEntryTab);
setInterval(()=>{if(isRemote()&&game)updateClock();},250);
