// Browser room lifecycle for UNFOLD. The server remains authoritative.
// DOM and game callbacks are supplied by app.mjs; no game rules live here.
import { oriented } from '../nets.mjs';
import { REEL_FACES, reelFace } from '../ui/reel.mjs';
import { escapeText } from '../ui/dom.mjs';
import { saveRoom } from '../ui/storage.mjs';
import { makeRoomRequest } from './transport.mjs';

const ROOM_SESSION_KEY='unfold-room-v13';
const PLAYER_COLORS=['#ae5845','#4f829f','#628569','#bc994d'];

export function createRoomController({$,getGame,setGame,getBusy,setBusy,getRolling,setRolling,
  clearLocalClock,resetSelection,activateAction,render,finishFoldVisual,
  animateFold,moveClosedBox,updateClock,request=null}){
  const base=request?'':(typeof window!=='undefined'&&window.UNFOLD_ROOM_API||
    (['localhost','127.0.0.1'].includes(location.hostname)?`${location.protocol}//${location.hostname}:8787`:'' )).replace(/\/$/,'');
  const roomRequest=request??makeRoomRequest(base);
  let roomSession=null,roomSnapshot=null,roomInterval=null,roomBusy=false,roomShownRevision=-1;
  let remoteAnimateId=null,clockSkew=0,roomRenderedRound=null;
  const isRemote=()=>Boolean(roomSession);
  const myTurn=()=>!isRemote()||Boolean(roomSnapshot?.game&&!roomSnapshot.game.winner&&roomSnapshot.seat===roomSnapshot.game.active);
  const nowServer=()=>Date.now()+clockSkew;
  const roomArgs=(extra={})=>({...roomSession,...extra});
  const saveRoomSession=()=>saveRoom(ROOM_SESSION_KEY,roomSession);

  function roomError(error){
    const msg=error?.message||String(error);
    $('room-entry-note').textContent=msg;
    $('lobby-hint').textContent=msg;
    const note=$('room-game-note');if(note){note.hidden=false;note.textContent=`Connection: ${msg}`;}
  }
  function renderLobby(){if(!roomSnapshot||roomSnapshot.game)return;
    $('setup').hidden=true;$('game').hidden=true;$('room-lobby').hidden=false;document.body.classList.remove('playing');
    $('lobby-code').textContent=roomSnapshot.code;
    $('lobby-mode').textContent=roomSnapshot.mode==='coop'?'CO-OP':'COMPETITIVE';
    $('lobby-seats').innerHTML=roomSnapshot.seats.map((p,i)=>`<div class="lobby-seat" style="--seat:${PLAYER_COLORS[i]}"><span class="seat-badge"></span><strong>${escapeText(p.name)}</strong><em>${p.connected?'CONNECTED':'AWAY'}${i===0?' · HOST':''}</em></div>`).join('')+Array.from({length:4-roomSnapshot.seats.length},()=>'<div class="lobby-seat"><span>＋ OPEN SEAT</span></div>').join('');
    $('start-room').hidden=!roomSnapshot.host;
    $('start-room').disabled=roomSnapshot.seats.length<2;
    $('lobby-hint').textContent=roomSnapshot.host?(roomSnapshot.seats.length<2?'Invite at least one friend to start.':'Ready. Start whenever everyone has joined.'):'Waiting for the host to start…';
  }
  async function playRemoteMove(move){
    if(!move||remoteAnimateId===move.id)return;
    remoteAnimateId=move.id;
    const {action,payload,beforeCube}=move;
    if(!['deploy','special','refold'].includes(action))return;
    const game=getGame(),net=action==='deploy'?game.die.net:Number(payload.netIndex);
    if(!Number.isInteger(net))return;
    const {x,y,rotation=0,flipped=false}=payload;
    const origin=oriented(net,rotation,flipped)[0];
    const contact=[x+origin[0],y+origin[1]];
    setBusy(true);try{
      if(beforeCube){
        await animateFold(beforeCube.net,beforeCube.rotation,beforeCube.flipped,beforeCube.cells[0],true);
        beforeCube.cells.forEach(([cx,cy])=>$('board').querySelector(`[data-x="${cx}"][data-y="${cy}"]`)?.classList.add('fold-lifting'));
        await moveClosedBox(beforeCube.cells[0],contact,beforeCube.net,beforeCube.rotation,beforeCube.flipped,PLAYER_COLORS[game.active]);
      }
      await animateFold(net,rotation,flipped,contact);
    }finally{setBusy(false);}
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
      const previousGame=getGame();
      if(previousGame&&snapshot.lastMove&&!snapshot.lastMove.wasLocal&&remoteAnimateId!==snapshot.lastMove.id&&snapshot.game.acted){
        await playRemoteMove(snapshot.lastMove);
      }
      const previousTurn=getGame()?.turn,previousRound=roomRenderedRound;
      setGame(snapshot.game);roomShownRevision=snapshot.revision;roomRenderedRound=snapshot.round;
      const game=getGame(),newTurn=previousTurn!==game.turn||previousRound!==snapshot.round;
      if(newTurn){
        resetSelection();setRolling(nowServer()<snapshot.revealAt);
        if(getRolling()){
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
      if(game.winner||game.acted||!myTurn())resetSelection();
      else if(!getRolling()&&!getBusy())activateAction();
      render();
      finishFoldVisual();
      $('room-game-note').hidden=false;
      $('room-game-note').textContent=`ROOM ${snapshot.code} · YOU: ${snapshot.seats[snapshot.seat]?.name||'GUEST'} · ${snapshot.seats.length}/4 PLAYERS`;
      $('next-game').hidden=!snapshot.host;
      if(getRolling()){
        // The public reel reveal is server-timed; the 60s clock starts afterwards.
        const ms=Math.max(0,snapshot.revealAt-nowServer());
        setTimeout(()=>{if(!roomSession||!getGame()||roomShownRevision!==snapshot.revision)return;setRolling(false);
          reelFace(getGame().die.face);
          if(myTurn()&&!getGame().acted)activateAction();render();},ms);
      }
    }finally{roomBusy=false;}
  }
  async function refreshRoom(){if(!roomSession||roomBusy||getBusy())return;
    try{const s=await roomRequest('state',roomArgs());await receiveRoom(s);}
    catch(error){roomError(error);}
  }
  async function attachRoom(data){
    roomSession={code:data.code,token:data.token};saveRoomSession();roomShownRevision=-1;roomRenderedRound=null;remoteAnimateId=null;clearLocalClock();
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
  function disconnect(){
    roomSession=null;roomSnapshot=null;saveRoomSession();
    if(roomInterval)clearInterval(roomInterval);
    roomInterval=null;
  }
  async function startMatch(){
    try{const s=await roomRequest('start',roomArgs());await receiveRoom(s);}
    catch(error){roomError(error);}
  }
  async function copyInvite(){
    const url=new URL(location.href);url.searchParams.set('room',roomSession.code);
    try{await navigator.clipboard.writeText(url.toString());$('lobby-hint').textContent='Invite link copied.';}
    catch{$('lobby-hint').textContent=`Invite link: ${url.toString()}`;}
  }
  async function leaveRoom(){
    if(roomSession&&roomSnapshot&&!roomSnapshot.game){try{await roomRequest('leave',roomArgs());}catch(e){roomError(e);}}
    disconnect();
    $('room-lobby').hidden=true;$('setup').hidden=false;document.body.classList.remove('playing');
  }
  function installUI(setEntryTab){
    $('create-room').addEventListener('click',()=>createOrJoin('create'));
    $('join-room').addEventListener('click',()=>createOrJoin('join'));
    $('join-code').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,6);});
    $('start-room').addEventListener('click',startMatch);
    $('copy-room').addEventListener('click',copyInvite);
    $('leave-room').addEventListener('click',leaveRoom);
    const invited=new URLSearchParams(location.search).get('room');
    if(invited&&/^\d{6}$/.test(invited)){setEntryTab('join');$('join-code').value=invited;$('room-entry-note').textContent='Invite detected. Enter your name and Join Room.';}
    try{
      const existing=JSON.parse(localStorage.getItem(ROOM_SESSION_KEY)||'null');
      if(existing&&/^\d{6}$/.test(existing.code)&&typeof existing.token==='string'&&(!invited||invited===existing.code)){
        roomSession={code:existing.code,token:existing.token};
        refreshRoom();roomInterval=setInterval(refreshRoom,950);
      }
    }catch{/* offline/local play is always available */}
  }
  return {
    get session(){return roomSession;},get snapshot(){return roomSnapshot;},
    isRemote,myTurn,nowServer,request:roomRequest,args:roomArgs,error:roomError,
    receive:receiveRoom,refresh:refreshRoom,createOrJoin,installUI,disconnect,
    setSnapshot(value){roomSnapshot=value;},
    markMove(id){remoteAnimateId=id;},
    syncRevision(){roomShownRevision=roomSnapshot?.revision??roomShownRevision;},
  };
}
