import { NETS, oriented } from './nets.mjs';
import { newGame, newDistinctGame, player, occupied, canPlace, legalPlacements, canReclaim, refoldable, placedCells, act, endTurn, LABELS, connectedCells } from './engine.mjs';
import { foldedFaces } from './fold.mjs';
import { paintFoldCanvas } from './render/canvas.mjs';
import { paintTubeFrame } from './render/tubes.mjs';
import { paintLatchFrame } from './render/latches.mjs';
import { legalFits } from './guided.mjs';
import { installMechanicalPress } from './ui/press.mjs';
import { REEL_FACES, reelFace } from './ui/reel.mjs';
import { makeRoomRequest } from './online/transport.mjs';
import { saveSolo, loadSolo, saveRoom } from './ui/storage.mjs';
import { installCamera } from './ui/camera.mjs';
import { escapeText } from './ui/dom.mjs';

const $=id=>document.getElementById(id);
const UNFOLD_VERSION='1.9.3';
document.querySelectorAll('.version').forEach(label=>label.textContent=UNFOLD_VERSION);
document.title='UNFOLD · Ironworks v1.9.3';
// Works on both the original v1.6 Astro page and checkouts where the menu
// cleanup was already applied. Never duplicate or reconstruct the setup form.
const setupHeading=$('setup-title');
if(setupHeading&&setupHeading.textContent.trim().toUpperCase()!=='PLAY')setupHeading.textContent='PLAY';
for(const selector of ['#setup > .intro-mark','#setup > .eyebrow','#setup > .intro'])document.querySelector(selector)?.remove();

installMechanicalPress();

function latchFrame(){
  let canvas=$('latch-frame');
  if(!canvas){canvas=document.createElement('canvas');canvas.id='latch-frame';canvas.className='latch-frame';canvas.setAttribute('aria-hidden','true');tubeFrame().after(canvas);}
  return canvas;
}
function updateLatches(settling=[]){
  if(!game)return;
  const roads=game.cubes.flatMap(c=>c.cells);
  const lifted=new Set([...document.querySelectorAll('.tile.fold-lifting')].map(t=>`${t.dataset.x},${t.dataset.y}`));
  paintLatchFrame(latchFrame(),game.size,roads,{hidden:lifted,settling});
}
function tubeFrame(){
  let canvas=$('tube-frame');
  if(!canvas){canvas=document.createElement('canvas');canvas.id='tube-frame';canvas.className='tube-frame';canvas.setAttribute('aria-hidden','true');$('board').after(canvas);}
  return canvas;
}

const SAVE_KEY='unfold-v05'; // Keep game-state saves compatible with v0.7.
const COLORS=['red','blue','green','gold'];
const ARROWS=[[1,0],[-1,0],[0,1],[0,-1]];
let game=null,selected=false,selectedNet=0,rotation=0,flipped=false,anchor=null,sourceId=null,fitIndex=0,fitCache=null,rollToken=0;
let busy=false,rolling=false,deadline=0,timer=null,lockingCubeId=null;
let animationFastForward=false,foldOriginId=null;
const ROOM_SESSION_KEY='unfold-room-v13';
const ROOM_API=(window.UNFOLD_ROOM_API||(['localhost','127.0.0.1'].includes(location.hostname)?`${location.protocol}//${location.hostname}:8787`:'' )).replace(/\/$/,'');
let roomSession=null,roomSnapshot=null,roomInterval=null,roomBusy=false,roomShownRevision=-1;
let remoteAnimateId=null,clockSkew=0,roomRenderedRound=null;
const PLAYER_COLORS=['#ae5845','#4f829f','#628569','#bc994d'];
const isRemote=()=>Boolean(roomSession);
const myTurn=()=>!isRemote()||Boolean(roomSnapshot?.game&&!roomSnapshot.game.winner&&roomSnapshot.seat===roomSnapshot.game.active);
const nowServer=()=>Date.now()+clockSkew;
function saveRoomSession(){saveRoom(ROOM_SESSION_KEY,roomSession);}
const roomRequest=makeRoomRequest(ROOM_API);
function roomArgs(extra={}){return {...roomSession,...extra};}
function roomError(error){const msg=error?.message||String(error);$('room-entry-note').textContent=msg;$('lobby-hint').textContent=msg;
  const note=$('room-game-note');if(note){note.hidden=false;note.textContent=`Connection: ${msg}`;}}
function renderLobby(){if(!roomSnapshot||roomSnapshot.game)return;
  $('setup').hidden=true;$('game').hidden=true;$('room-lobby').hidden=false;document.body.classList.remove('playing');
  $('lobby-code').textContent=roomSnapshot.code;
  $('lobby-mode').textContent=roomSnapshot.mode==='coop'?'CO-OP':'COMPETITIVE';
  $('lobby-seats').innerHTML=roomSnapshot.seats.map((p,i)=>`<div class="lobby-seat" style="--seat:${PLAYER_COLORS[i]}"><span class="seat-badge"></span><strong>${escapeText(p.name)}</strong><em>${p.connected?'CONNECTED':'AWAY'}${i===0?' · HOST':''}</em></div>`).join('')+Array.from({length:4-roomSnapshot.seats.length},()=>'<div class="lobby-seat"><span>＋ OPEN SEAT</span></div>').join('');
  $('start-room').hidden=!roomSnapshot.host;
  $('start-room').disabled=roomSnapshot.seats.length<2;
  $('lobby-hint').textContent=roomSnapshot.host?(roomSnapshot.seats.length<2?'Invite at least one friend to start.':'Ready. Start whenever everyone has joined.'):'Waiting for the host to start…';
}

function updateClock(){if(!game||game.mode==='solo')return;
  if(isRemote()&&roomSnapshot?.deadline){const left=Math.max(0,Math.ceil((roomSnapshot.deadline-nowServer())/1000));$('clock').textContent=String(left);$('clock-box').classList.toggle('urgent',left<=10);$('turn-clock').textContent=game.winner?'FINISHED':`${left}s`;
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
async function playRemoteMove(move){
  if(!move||remoteAnimateId===move.id)return;
  remoteAnimateId=move.id;
  const {action,payload,beforeCube}=move;
  if(!['deploy','special','refold'].includes(action))return;
  const net=action==='deploy'?game.die.net:Number(payload.netIndex);
  if(!Number.isInteger(net))return;
  const {x,y,rotation=0,flipped=false}=payload;
  const origin=oriented(net,rotation,flipped)[0];
  const contact=[x+origin[0],y+origin[1]];
  busy=true;try{
    if(beforeCube){
      await animateFold(beforeCube.net,beforeCube.rotation,beforeCube.flipped,beforeCube.cells[0],true);
      beforeCube.cells.forEach(([cx,cy])=>$('board').querySelector(`[data-x="${cx}"][data-y="${cy}"]`)?.classList.add('fold-lifting'));
      await moveClosedBox(beforeCube.cells[0],contact,beforeCube.net,beforeCube.rotation,beforeCube.flipped,PLAYER_COLORS[game.active]);
    }
    await animateFold(net,rotation,flipped,contact);
  }finally{busy=false;}
}
async function receiveRoom(snapshot){
  if(!roomSession)return;
  clockSkew=snapshot.now-Date.now();roomSnapshot=snapshot;
  if(!snapshot.game){roomShownRevision=snapshot.revision;renderLobby();return;}
  $('room-lobby').hidden=true;
  if(snapshot.revision===roomShownRevision){updateClock();return;}
  if(roomBusy)return;
  roomBusy=true;
  try{
    if(game&&snapshot.lastMove&&!snapshot.lastMove.wasLocal&&remoteAnimateId!==snapshot.lastMove.id&&snapshot.game.acted){
      await playRemoteMove(snapshot.lastMove);
    }
    const previousTurn=game?.turn,previousRound=roomRenderedRound;
    game=snapshot.game;roomShownRevision=snapshot.revision;roomRenderedRound=snapshot.round;
    const newTurn=previousTurn!==game.turn||previousRound!==snapshot.round;
    if(newTurn){
      resetSelection();rolling=nowServer()<snapshot.revealAt;
      if(rolling){
        const track=$('reel-track'),stop=game.die.face-1;
        document.querySelector('.reel-scene')?.classList.add('spinning');
        track.classList.remove('spinning');track.style.transition='none';track.style.transform='translateY(0)';
        track.innerHTML=Array.from({length:4},()=>REEL_FACES).flat().map(x=>`<span>${x}</span>`).join('');
        const px=parseFloat(getComputedStyle(track).getPropertyValue('--reel-cell'))||38;
        void track.offsetHeight;track.classList.add('spinning');
        track.style.transition=`transform ${Math.max(100,snapshot.revealAt-nowServer())}ms cubic-bezier(.12,.68,.12,1)`;
        track.style.transform=`translateY(-${(18+stop)*px}px)`;
      }else reelFace(game.die.face);
    }
    if(game.winner||game.acted||!myTurn()){selected=false;resetSelection();}
    else if(!rolling&&!busy){activateAction();}
    render();
    finishFoldVisual();
    $('room-game-note').hidden=false;
    $('room-game-note').textContent=`ROOM ${snapshot.code} · YOU: ${snapshot.seats[snapshot.seat]?.name||'GUEST'} · ${snapshot.seats.length}/4 PLAYERS`;
    $('next-game').hidden=!snapshot.host;
    if(rolling){
      // The public reel reveal is server-timed; the 60s clock starts afterwards.
      const ms=Math.max(0,snapshot.revealAt-nowServer());
      setTimeout(()=>{if(!roomSession||!game||roomShownRevision!==snapshot.revision)return;rolling=false;
        reelFace(game.die.face);
        if(myTurn()&&!game.acted)activateAction();render();},ms);
    }
  }finally{roomBusy=false;}
}
async function refreshRoom(){if(!roomSession||roomBusy||busy)return;
  try{const s=await roomRequest('state',roomArgs());await receiveRoom(s);}
  catch(error){roomError(error);}
}
async function attachRoom(data){
  roomSession={code:data.code,token:data.token};saveRoomSession();roomShownRevision=-1;roomRenderedRound=null;remoteAnimateId=null;clearInterval(timer);
  if(roomInterval)clearInterval(roomInterval);
  await receiveRoom(data.snapshot);
  roomInterval=setInterval(refreshRoom,950);
}
async function createOrJoin(op){
  const name=$('room-name').value.trim(),mode=$('room-mode').value,code=$('join-code').value.trim();
  try{
    const data=await roomRequest(op,op==='create'?{name,mode}:{name,code});
    await attachRoom(data);
  }catch(error){roomError(error);}
}

const ANIMATION_MS={normal:1600,quick:700,instant:0};
let currentAnimationSpeed='normal';
try{const v=localStorage.getItem('unfold-animation-speed');if(Object.hasOwn(ANIMATION_MS,v))currentAnimationSpeed=v;}catch{/* memory-only setting in private browsers */}
function animationSpeed(){return currentAnimationSpeed;}

const gameAction=()=>game?.die?.action;
function actionAvailable(){
  if(!game||game.acted||game.winner)return false;
  switch(gameAction()){
    case 'reclaim': return [...game.obstacles,...game.cubes].some(o=>canReclaim(game,game.active,o.id));
    case 'refold': return game.cubes.some(c=>refoldable(game,game.active,c.id));
    // Players get the rolled cube/action even when there isn't a legal landing:
    // A blocked fixed net may still have no legal contact. Skip stays available.
    default: return true;
  }
}
function cannotUseReason(){
  if(gameAction()==='reclaim')return 'No adjacent obstacle or reclaimable cube. Skip this roll.';
  if(gameAction()==='refold')return 'No removable rear cube. Skip this roll.';
  return 'Nothing to use this turn. Skip this roll.';
}
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
function netThumbnail(n){const cells=NETS[n],maxX=Math.max(...cells.map(c=>c[0])),maxY=Math.max(...cells.map(c=>c[1]));
  const scale=16,offsetX=(96-(maxX+1)*scale)/2,offsetY=(80-(maxY+1)*scale)/2;
  return `<svg viewBox="0 0 96 80" aria-hidden="true">${cells.map(([x,y],i)=>`<rect x="${offsetX+x*scale}" y="${offsetY+y*scale}" width="${scale-1}" height="${scale-1}" rx="0" fill="${i?'#70847c':'#d5ab63'}" stroke="#e1eff6" stroke-width="1"/>`).join('')}</svg>`;
}
// Use the same rules as tapTile(), and calculate them per object rather than per cell.
function actionTargets(action){
  if(action==='reclaim')return [...game.obstacles,...game.cubes].filter(o=>canReclaim(game,game.active,o.id));
  if(action==='refold'&&sourceId===null)return game.cubes.filter(c=>refoldable(game,game.active,c.id));
  return [];
}
function drawBoard(){const used=occupied(game),spots=new Set(busy?[]:validContacts().map(key)),preview=new Map();
  const action=selected&&!busy&&!rolling&&!game.acted&&!game.winner&&myTurn()?gameAction():null;
  const targets=new Set(actionTargets(action).map(o=>o.id));
  if(!busy&&inPlacement()&&anchor){const [x,y]=fromContact(anchor),valid=canAt(anchor),cells=placedCells(selectedNet,rotation,flipped,x,y);
    cells.forEach((c,i)=>{if(c[0]>=0&&c[1]>=0&&c[0]<game.size&&c[1]<game.size)preview.set(key(c),{valid,contact:i===0});});
  }
  const tiles=[];for(let y=0;y<game.size;y++)for(let x=0;x<game.size;x++){
    const k=`${x},${y}`,cell=used.get(k),p=preview.get(k),classes=['tile'],hasMark=spots.has(k);
    if(cell?.kind==='base')classes.push('base-'+(COLORS[cell.owner]||'neutral'));
    if(cell?.kind==='cube')classes.push('road-'+(COLORS[cell.owner]||'neutral'));
    if(cell?.kind==='goal')classes.push('goal');
    if(cell?.kind==='cube'&&cell.id===lockingCubeId)classes.push('latch-lock');
    if(cell?.kind==='cube'&&cell.id===foldOriginId)classes.push('fold-origin');
    if(cell?.kind==='obstacle')classes.push(cell.type);
    if(p)classes.push(p.valid?'preview-good':'preview-bad');
    if(hasMark)classes.push('legal-anchor');
    if(anchor&&key(anchor)===k&&inPlacement())classes.push('selected-anchor');
    const available=cell&&['obstacle','cube'].includes(cell.kind)&&targets.has(cell.id);
    if(available)classes.push(action==='reclaim'?'reclaim-target':'refold-target');
    const cubeNumber=cell?.kind==='cube'&&cell.contact?cell.number:null;
    let content=cubeNumber?`<span class="contact-label" aria-label="Cube ${cubeNumber}">${cubeNumber}</span>`:'';
    if(cell?.kind==='base')content=`<strong>${game.mode==='solo'?'S':cell.id+1}</strong>`;
    if(cell?.kind==='goal')content='<strong>★</strong>';
    if(cell?.kind==='obstacle')content=['ruin','permanent'].includes(cell.type)?'<span class="obstacle-mark scrap-mark" aria-hidden="true">✕</span>':'<span class="obstacle-mark crate-mark" aria-hidden="true"><span class="crate-x"></span></span>';
    if(hasMark)content+='<span class="anchor-dot"></span>';
    tiles.push(`<button type="button" role="gridcell" class="${classes.join(' ')}" ${cell?.kind==='cube'?`data-cube-id="${cell.id}"`:''} data-x="${x}" data-y="${y}" aria-label="${cell?.kind||'Empty'} square ${x+1},${y+1}${cubeNumber?`, cube ${cubeNumber} contact square`:''}${available?`, ${action.toUpperCase()} available`:''}" title="${cell?.kind||'Empty'} · ${x+1},${y+1}${available?` · ${action.toUpperCase()} available`:''}">${content}</button>`);
  }
  $('board').style.setProperty('--size',game.size);$('board').innerHTML=tiles.join('');
  paintTubeFrame(tubeFrame(),game.size);
  updateLatches();
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
      const count=actionTargets(action).length;
      hint.textContent=`${count} ${action.toUpperCase()} ${count===1?'TARGET':'TARGETS'}`;
      hint.title=action==='reclaim'?'Tap an amber target to reclaim it':'Tap a green rear cube to refold it';
    }else{
      hint.textContent=game.acted?'Action complete':!rolling&&action==='reclaim'&&!actionAvailable()?'NO RECLAIM TARGETS':!rolling&&action==='refold'&&!actionAvailable()?'NO REFOLD TARGETS':'Action ready';
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
  const available=actionAvailable();
  updateTurnBanner();
  $('frame-skip').disabled=busy||rolling||Boolean(game.winner)||!myTurn()||Boolean(game.acted&&isRemote());
  $('frame-skip').textContent=game.acted?'LOCKED':'SKIP ↷';
  $('clock-box').hidden=game.mode==='solo';
  $('result').hidden=!game.winner;
  if(game.winner)$('result-title').textContent=game.announcement||'Route complete';
  if(!selected&&!game.acted)announce(rolling?'The reel is spinning…':available?'Tap a marked landing spot, or skip this turn.':cannotUseReason());
  if(game.acted)announce(game.announcement);
  if(selected&&!game.acted){
    if(action==='reclaim')announce('Tap a pulsing amber obstacle or cube to reclaim it.');
    else if(action==='refold'&&sourceId===null)announce('Tap a pulsing green rear cube to refold it.');
    else announce('Tap a marked socket · NEXT FIT cycles legal orientations · UNFOLD installs it.');
  }
  showPicker();drawBoard();positionContextTools();persist();
}
function activateAction(){if(!game||rolling||busy||game.acted||!actionAvailable())return;
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
function createGrit(cells){
  const layer=$('grit-layer'),surface=$('board-surface'),sr=surface.getBoundingClientRect();
  layer.replaceChildren();
  const positions=[[.13,.12], [.87,.08], [.08,.85], [.91,.88]];
  cells.forEach(([x,y],index)=>{
    if(index>5)return;
    const tile=$('board').querySelector(`[data-x="${x}"][data-y="${y}"]`);
    if(!tile)return;
    const r=tile.getBoundingClientRect();
    const [rx,ry]=positions[index%4];
    for(let j=0;j<2;j++){
      const bit=document.createElement('i');bit.className='grit-bit';
      bit.style.left=`${r.left-sr.left+r.width*rx}px`;
      bit.style.top=`${r.top-sr.top+r.height*ry}px`;
      bit.style.setProperty('--dx',`${((index*7+j*13)%27)-13}px`);
      bit.style.setProperty('--dy',`${-6-(index+j)%10}px`);
      bit.style.animationDelay=`${(j*45+index*21)}ms`;
      layer.append(bit);
    }
  });
  setTimeout(()=>layer.replaceChildren(),680);
}

// Stable renderer: one canvas for the entire operation, no filtered SVG DOM
// reconstruction. For Refold, individual sockets uncover the black void only
// once that particular rigid plate has lifted off the table. The frame canvas
// stays mounted and is never repainted while an animation is running.
function finishFoldVisual(){
  const stage=$('fold-stage');
  stage.hidden=true;stage.replaceChildren();
  document.querySelectorAll('.tile.fold-lifting').forEach(tile=>tile.classList.remove('fold-lifting'));
  $('game').classList.remove('is-unfolding');
  updateLatches();
  animationFastForward=false;
}
function prepareFoldStage(contact){
  const stage=$('fold-stage'),board=$('board'),surface=$('board-surface');
  const tile=board.querySelector(`[data-x="${contact[0]}"][data-y="${contact[1]}"]`);
  if(!tile)return null;
  const surfaceRect=surface.getBoundingClientRect(),rect=tile.getBoundingClientRect();
  const first=board.querySelector('[data-x="0"][data-y="0"]')?.getBoundingClientRect();
  const second=board.querySelector('[data-x="1"][data-y="0"]')?.getBoundingClientRect();
  const pitch=first&&second?second.left-first.left:board.getBoundingClientRect().width/game.size;
  stage.style.setProperty('--fx',`${rect.left+rect.width/2-surfaceRect.left}px`);
  stage.style.setProperty('--fy',`${rect.top+rect.height/2-surfaceRect.top}px`);
  stage.style.setProperty('--cube-canvas',`${pitch*10}px`);
  const canvas=document.createElement('canvas');canvas.width=200;canvas.height=200;
  const mechanism=document.createElement('div');mechanism.className='mechanism';mechanism.append(canvas);
  stage.replaceChildren(mechanism);stage.hidden=false;
  $('game').classList.add('is-unfolding');
  return canvas;
}
function liftedSockets(net,rot,flip,contact,open){
  const faces=foldedFaces(net,rot,flip,open),root=faces[0].flat;
  for(const face of faces){
    if(face.number===1)continue; // Contact face holds the closed cube in place.
    const x=contact[0]+face.flat[0]-root[0],y=contact[1]+face.flat[1]-root[1];
    const tile=$('board').querySelector(`[data-x="${x}"][data-y="${y}"]`);
    if(!tile)continue;
    tile.classList.toggle('fold-lifting',face.center[2]>.035);
  }
  updateLatches();
}
// Remain at the same fixed camera position. Closed box relocation is a brief
// motion of the box, NOT a camera pan or six disconnected tiles teleporting.
async function moveClosedBox(from,to,net,rot,flip,color){
  if(animationSpeed()==='instant')return;
  const canvas=prepareFoldStage(from);if(!canvas)return;
  paintFoldCanvas(canvas,net,rot,flip,0,{color,release:0});
  const stage=$('fold-stage'),originX=parseFloat(stage.style.getPropertyValue('--fx')),originY=parseFloat(stage.style.getPropertyValue('--fy'));
  const rect=$('board').querySelector(`[data-x="${to[0]}"][data-y="${to[1]}"]`)?.getBoundingClientRect();
  const sr=$('board-surface').getBoundingClientRect();if(!rect)return;
  const targetX=rect.left+rect.width/2-sr.left,targetY=rect.top+rect.height/2-sr.top;
  const duration=animationSpeed()==='quick'?130:230,start=performance.now();
  await new Promise(resolve=>{
    const step=now=>{
      const t=animationFastForward?1:Math.min(1,(now-start)/duration),ease=t*t*(3-2*t);
      stage.style.setProperty('--fx',`${originX+(targetX-originX)*ease}px`);
      stage.style.setProperty('--fy',`${originY+(targetY-originY)*ease}px`);
      if(t<1)requestAnimationFrame(step);else resolve();
    };requestAnimationFrame(step);
  });
}
async function animateFold(net,rot,flip,contact,reverse=false){
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||animationSpeed()==='instant')return;
  const canvas=prepareFoldStage(contact);if(!canvas)return;
  animationFastForward=false;
  const ownerColor=['#b85f54','#548aa6','#64937b','#bb984c'][game.active]||'#b85f54';
  const duration=ANIMATION_MS[animationSpeed()]*(reverse?.83:1);
  await new Promise(resolve=>{
    const start=performance.now();
    const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
    const step=now=>{
      const t=animationFastForward?1:Math.min(1,(now-start)/duration);
      const progress=ease(Math.max(0,Math.min(1,(t-.12)/.75)));
      const openness=reverse?1-progress:progress;
      const release=reverse?1-progress:ease(Math.min(1,t/.15));
      paintFoldCanvas(canvas,net,rot,flip,openness,{color:ownerColor,release});
      if(reverse)liftedSockets(net,rot,flip,contact,openness);
      else{
        // Catchers close on each plate only as it settles. Never cover the
        // cell early, and never rebuild the steel frame below it.
        const faces=foldedFaces(net,rot,flip,openness),root=faces[0].flat;
        const seating=t>.76?faces.filter(f=>f.center[2]<.045).map(f=>[
          contact[0]+f.flat[0]-root[0],contact[1]+f.flat[1]-root[1]
        ]):[];
        updateLatches(seating);
      }
      if(t<1)requestAnimationFrame(step);else resolve();
    };requestAnimationFrame(step);
  });
  // Do NOT remove the canvas here. It stays in place until the new game state
  // has rendered, so there cannot be one blank frame at the phase boundary.
}

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
      const snapshot=await roomRequest('action',roomArgs({turn:game.turn,payload:to}));
      roomSnapshot=snapshot;next=snapshot.game;
      remoteAnimateId=snapshot.lastMove?.id;
    }catch(error){busy=false;roomError(error);render();return;}
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
    if(isRemote()){roomShownRevision=roomSnapshot?.revision??roomShownRevision;refreshRoom();}
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
  rolling=false;activateAction();render();startClock();
}

async function advance(){if(!game||rolling||busy||game.winner)return;
  if(isRemote()){
    if(!myTurn()||game.acted)return;
    busy=true;render();
    try{const snapshot=await roomRequest('pass',roomArgs({turn:game.turn}));busy=false;resetSelection();await receiveRoom(snapshot);}catch(error){busy=false;roomError(error);render();}
    return;
  }
  clearInterval(timer);
  game=endTurn(game);resetSelection();
  if(game.winner){render();return;}
  rollAnimation();
}
function begin(config,previous=null){
  const next=previous?newDistinctGame(config,previous):newGame(config);
  roomSession=null;roomSnapshot=null;saveRoomSession();if(roomInterval)clearInterval(roomInterval);roomInterval=null;
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


installCamera($,positionContextTools);
$('board').addEventListener('click',e=>{const b=e.target.closest('[data-x]');if(b)tapTile(Number(b.dataset.x),Number(b.dataset.y));});
$('shape-list').addEventListener('click',e=>{const b=e.target.closest('[data-net]');if(b)chooseNet(Number(b.dataset.net));});
$('next-fit').addEventListener('click',nextFit);
$('frame-skip').addEventListener('click',advance);
$('board-viewport').addEventListener('click',()=>{if(busy)animationFastForward=true;});
$('confirm').addEventListener('click',()=>commit());
$('placement-tools').addEventListener('click',e=>e.stopPropagation());

$('board-viewport').addEventListener('scroll',positionContextTools,{passive:true});
window.addEventListener('resize',positionContextTools,{passive:true});

$('new-game').addEventListener('click',()=>{
  if(game&&!game.winner&&!confirm('Leave this match? You can still resume it.'))return;
  if(isRemote()){roomSession=null;roomSnapshot=null;saveRoomSession();clearInterval(roomInterval);roomInterval=null;}
  clearInterval(timer);rollToken++;rolling=false;busy=false;game=null;resetSelection();document.body.classList.remove('playing');$('game').hidden=true;$('setup').hidden=false;$('resume').hidden=!stored();
});
$('resume').addEventListener('click',()=>{const s=stored();if(!s)return;rollToken++;rolling=false;game=s;resetSelection();activateAction();render();reelFace(game.die.face);startClock();});
$('next-game').addEventListener('click',async()=>{
  if(!game?.winner)return;
  if(isRemote()){
    if(!roomSnapshot?.host)return;
    try{const s=await roomRequest('next',roomArgs());await receiveRoom(s);}
    catch(e){roomError(e);}
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
$('create-room').addEventListener('click',()=>createOrJoin('create'));
$('join-room').addEventListener('click',()=>createOrJoin('join'));
$('join-code').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,6);});
$('start-room').addEventListener('click',async()=>{
  try{const s=await roomRequest('start',roomArgs());await receiveRoom(s);}catch(e){roomError(e);}
});
$('copy-room').addEventListener('click',async()=>{
  const url=new URL(location.href);url.searchParams.set('room',roomSession.code);
  try{await navigator.clipboard.writeText(url.toString());$('lobby-hint').textContent='Invite link copied.';}
  catch{$('lobby-hint').textContent=`Invite link: ${url.toString()}`;}
});
$('leave-room').addEventListener('click',async()=>{
  if(roomSession&&roomSnapshot&&!roomSnapshot.game){try{await roomRequest('leave',roomArgs());}catch(e){roomError(e);}}
  roomSession=null;roomSnapshot=null;saveRoomSession();clearInterval(roomInterval);roomInterval=null;
  $('room-lobby').hidden=true;$('setup').hidden=false;document.body.classList.remove('playing');
});
const invited=new URLSearchParams(location.search).get('room');
if(invited&&/^\d{6}$/.test(invited)){setEntryTab('join');$('join-code').value=invited;$('room-entry-note').textContent='Invite detected. Enter your name and Join Room.';}
try{
  const existing=JSON.parse(localStorage.getItem(ROOM_SESSION_KEY)||'null');
  if(existing&&/^\d{6}$/.test(existing.code)&&typeof existing.token==='string'&&(!invited||invited===existing.code)){
    roomSession={code:existing.code,token:existing.token};
    refreshRoom();roomInterval=setInterval(refreshRoom,950);
  }
}catch{/* offline/local play is always available */}
setInterval(()=>{if(isRemote()&&game)updateClock();},250);
