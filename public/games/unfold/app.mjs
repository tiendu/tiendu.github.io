import { NETS, oriented } from './nets.mjs';
import { newGame, player, occupied, canPlace, legalPlacements, canReclaim, refoldable, placedCells, act, endTurn, LABELS, connectedCells } from './engine.mjs';
import { foldSvg } from './fold.mjs';
import { legalFits } from './guided.mjs';

const $=id=>document.getElementById(id);
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
let zoom=1,pinchStart=null;
const PLAYER_COLORS=['#ae5845','#4f829f','#628569','#bc994d'];
const isRemote=()=>Boolean(roomSession);
const myTurn=()=>!isRemote()||Boolean(roomSnapshot?.game&&!roomSnapshot.game.winner&&roomSnapshot.seat===roomSnapshot.game.active);
const nowServer=()=>Date.now()+clockSkew;
function saveRoomSession(){try{if(roomSession)localStorage.setItem(ROOM_SESSION_KEY,JSON.stringify(roomSession));else localStorage.removeItem(ROOM_SESSION_KEY);}catch{}}
async function roomRequest(op,details={}){
  if(!ROOM_API)throw new Error('Online rooms need a room server. Configure window.UNFOLD_ROOM_API.');
  const body=JSON.stringify(details);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
  try{const res=await fetch(`${ROOM_API}/api/unfold/${op}`,{method:'POST',headers:{'Content-Type':'application/json'},body,signal:controller.signal});
    const data=await res.json();if(!res.ok)throw new Error(data.error||`Room error (${res.status})`);return data;
  }finally{clearTimeout(timer);}
}
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
function escapeText(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
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
    if(beforeCube)await animateFold(beforeCube.net,beforeCube.rotation,beforeCube.flipped,beforeCube.cells[0],true);
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

const REEL_FACES=['DEPLOY','DEPLOY','SUPER','RECLAIM','RECLAIM','REFOLD'];
const ANIMATION_MS={normal:1600,quick:700,instant:0};
let currentAnimationSpeed='normal';
try{const v=localStorage.getItem('unfold-animation-speed');if(Object.hasOwn(ANIMATION_MS,v))currentAnimationSpeed=v;}catch{/* memory-only setting in private browsers */}
function animationSpeed(){return currentAnimationSpeed;}
function reelFace(face){const label=REEL_FACES[face-1]||'DEPLOY';const reel=$('reel-track');reel.classList.remove('spinning');reel.style.transition='none';reel.style.transform='none';void reel.offsetHeight;reel.innerHTML=`<span>${label}</span>`;reel.setAttribute('data-face',String(face));}

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
function persist(){if(isRemote())return;try{localStorage.setItem(SAVE_KEY,JSON.stringify(game));}catch{/* storage can be disabled */}}
function stored(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(s?.version!==5||!s.players?.length||!s.die||!Array.isArray(s.cubes))return null;
    s.cubes.forEach((c,i)=>{if(!Number.isInteger(c.number))c.number=i+1;});
    s.nextCubeNumber=Math.max(0,...s.cubes.map(c=>c.number))+1;
    return s;}catch{return null;}}
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
function drawBoard(){const used=occupied(game),spots=new Set(busy?[]:validContacts().map(key)),preview=new Map();
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
    if(selected&&gameAction()==='reclaim'&&cell&&['obstacle','cube'].includes(cell.kind)&&canReclaim(game,game.active,cell.id))classes.push('target');
    if(selected&&gameAction()==='refold'&&sourceId===null&&cell?.kind==='cube'&&refoldable(game,game.active,cell.id))classes.push('target');
    const cubeNumber=cell?.kind==='cube'&&cell.contact?cell.number:null;
    let content=cubeNumber?`<span class="contact-label" aria-label="Cube ${cubeNumber}">${cubeNumber}</span>`:'';
    if(cell?.kind==='base')content=`<strong>${game.mode==='solo'?'S':cell.id+1}</strong>`;
    if(cell?.kind==='goal')content='<strong>★</strong>';
    if(cell?.kind==='obstacle')content=['ruin','permanent'].includes(cell.type)?'<span class="obstacle-mark scrap-mark" aria-hidden="true">✕</span>':'<span class="obstacle-mark crate-mark" aria-hidden="true"><span class="crate-x"></span></span>';
    if(hasMark)content+='<span class="anchor-dot"></span>';
    tiles.push(`<button type="button" role="gridcell" class="${classes.join(' ')}" ${cell?.kind==='cube'?`data-cube-id="${cell.id}"`:''} data-x="${x}" data-y="${y}" aria-label="${cell?.kind||'Empty'} square ${x+1},${y+1}${cubeNumber?`, cube ${cubeNumber} contact square`:''}" title="${cell?.kind||'Empty'} · ${x+1},${y+1}">${content}</button>`);
  }
  $('board').style.setProperty('--size',game.size);$('board').innerHTML=tiles.join('');
  $('board-viewport').classList.toggle('large-board',game.size>=17);
}
function showPicker(){
  const action=gameAction(),shown=selected&&inPlacement()&&!busy;
  $('board-shape-slot').hidden=!shown;
  $('cube-offer').hidden=!shown||action!=='deploy';
  $('shape-picker').hidden=!shown||action==='deploy';
  $('placement-tools').hidden=!shown||!anchor;
  if(!shown){$('board-hint').textContent=game.acted?'Action complete':selected&&action==='reclaim'?'Tap a highlighted target':selected&&action==='refold'?'Choose a rear cube':'Action ready';return;}
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
  $('board-hint').textContent=`${positions.size} legal landing ${positions.size===1?'spot':'spots'}`;
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
    if(action==='reclaim')announce('Tap a highlighted adjacent obstacle or cube.');
    else if(action==='refold'&&sourceId===null)announce('Choose a highlighted rear cube.');
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

// The camera never moves; only the six linked metal plates move within the frame.
async function animateFold(net,rot,flip,contact,reverse=false){
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||animationSpeed()==='instant')return;
  const stage=$('fold-stage'),board=$('board'),surface=$('board-surface');
  const tile=board.querySelector(`[data-x="${contact[0]}"][data-y="${contact[1]}"]`);
  if(!tile)return;
  const surfaceRect=surface.getBoundingClientRect(),rect=tile.getBoundingClientRect();
  const first=board.querySelector('[data-x="0"][data-y="0"]')?.getBoundingClientRect();
  const second=board.querySelector('[data-x="1"][data-y="0"]')?.getBoundingClientRect();
  const pitch=first&&second?second.left-first.left:board.getBoundingClientRect().width/game.size;
  stage.style.setProperty('--fx',`${rect.left+rect.width/2-surfaceRect.left}px`);
  stage.style.setProperty('--fy',`${rect.top+rect.height/2-surfaceRect.top}px`);
  stage.style.setProperty('--cube-canvas',`${pitch*10}px`);
  stage.hidden=false;animationFastForward=false;
  $('game').classList.add('is-unfolding');
  const ownerColor=['#b85f54','#548aa6','#64937b','#bb984c'][game.active]||'#b85f54';
  try{
    await new Promise(resolve=>{
      const start=performance.now(),duration=ANIMATION_MS[animationSpeed()]*(reverse?.83:1);
      // Heavy acceleration/deceleration, staggered hinges inside foldSvg.
      const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
      let lastFrame=-100;
      const step=now=>{
        const t=animationFastForward?1:Math.min(1,(now-start)/duration);
        const progress=ease(Math.max(0,Math.min(1,(t-.12)/.75)));
        const openness=reverse?1-progress:progress;
        const release=reverse?1-progress:ease(Math.min(1,t/.15));
        if(now-lastFrame>=24||t>=1){
          stage.innerHTML=`<div class="mechanism">${foldSvg(net,rot,flip,openness,{color:ownerColor,release})}</div>`;
          lastFrame=now;
        }
        if(t<1)requestAnimationFrame(step);else resolve();
      };
      requestAnimationFrame(step);
    });
  }finally{
    stage.hidden=true;stage.replaceChildren();
    $('game').classList.remove('is-unfolding');
    animationFastForward=false;
  }
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
  busy=true;foldOriginId=old?.id??null;$('confirm').disabled=true;$('frame-skip').disabled=true;drawBoard();$('placement-tools').hidden=true;
  const net=selectedNet,contact=anchor&&[...anchor],movedId=sourceId;
  try{
    if(old)await animateFold(old.net,old.rotation,old.flipped,old.cells[0],true);
    if(inPlacement())await animateFold(net,rotation,flipped,contact);
    else await timing(280);
  }finally{
    game=next;busy=false;foldOriginId=null;resetSelection();
    if(['deploy','special','refold'].includes(action)){
      lockingCubeId=action==='refold'?movedId:next.cubes.at(-1)?.id;
    }
    render();
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
  // Animate a six-stop reel with exactly the probabilities generated by engine.mjs.
  const stop=game.die.face-1;
  const sequence=Array.from({length:4},()=>REEL_FACES).flat();
  track.classList.remove('spinning');track.style.transition='none';
  track.style.transform='translateY(0)';
  track.innerHTML=sequence.map((label,i)=>`<span data-stop="${(i%6)+1}">${label}</span>`).join('');
  render();
  const px=parseFloat(getComputedStyle(track).getPropertyValue('--reel-cell'))||38;
  void track.offsetHeight;
  track.classList.add('spinning');track.style.transition='transform 720ms cubic-bezier(.12,.68,.12,1)';
  track.style.transform=`translateY(-${(18+stop)*px}px)`;
  await timing(755);
  if(!game||token!==rollToken)return;
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
function begin(config){
  roomSession=null;roomSnapshot=null;saveRoomSession();if(roomInterval)clearInterval(roomInterval);roomInterval=null;
  rollToken++;clearInterval(timer);game=newGame(config);resetSelection();busy=false;render();rollAnimation();
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
document.querySelectorAll('.brand .version,.frame-topbar .version').forEach(el=>{el.textContent='1.4';});
document.title='UNFOLD · Foundry Routes';
const style=document.createElement('link');style.rel='stylesheet';style.href='/games/unfold/v14.css';document.head.append(style);

function setZoom(level,clientX=null,clientY=null){
  const v=$('board-viewport'),before=zoom,box=v.getBoundingClientRect();
  const x=clientX===null?box.width/2:clientX-box.left,y=clientY===null?box.height/2:clientY-box.top;
  const contentX=(v.scrollLeft+x)/before,contentY=(v.scrollTop+y)/before;
  zoom=Math.max(1,Math.min(3,Math.round(level*100)/100));
  $('board-surface').style.setProperty('--board-magnification',String(zoom));
  $('zoom-level').textContent=`${Math.round(zoom*100)}%`;
  v.scrollLeft=Math.max(0,contentX*zoom-x);v.scrollTop=Math.max(0,contentY*zoom-y);
  positionContextTools();
}
$('zoom-in').addEventListener('click',()=>setZoom(zoom+.25));
$('zoom-out').addEventListener('click',()=>setZoom(zoom-.25));
$('zoom-fit').addEventListener('click',()=>setZoom(1));
$('board-viewport').addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*(e.deltaY<0?1.12:.89),e.clientX,e.clientY);},{passive:false});
$('board-viewport').addEventListener('touchstart',e=>{
  if(e.touches.length===2){const a=e.touches[0],b=e.touches[1];pinchStart={distance:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),zoom};}
},{passive:true});
$('board-viewport').addEventListener('touchmove',e=>{
  if(e.touches.length===2&&pinchStart){e.preventDefault();const a=e.touches[0],b=e.touches[1];const d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
    setZoom(pinchStart.zoom*d/Math.max(1,pinchStart.distance),(a.clientX+b.clientX)/2,(a.clientY+b.clientY)/2);
  }
},{passive:false});
$('board-viewport').addEventListener('touchend',e=>{if(e.touches.length<2)pinchStart=null;});
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
$('next-game').addEventListener('click',async()=>{if(!game?.winner)return;if(isRemote()){if(!roomSnapshot?.host)return;try{const s=await roomRequest('next',roomArgs());await receiveRoom(s);}catch(e){roomError(e);}return;}const {mode,level,players,seed}=game;let nextSeed=0;try{nextSeed=crypto.getRandomValues(new Uint32Array(1))[0];}catch{nextSeed=(Date.now()+Math.floor(Math.random()*65536))>>>0;}if(!nextSeed||nextSeed===seed)nextSeed=(seed+1)>>>0||1;begin({mode,level,count:players.length,seed:nextSeed});});
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
