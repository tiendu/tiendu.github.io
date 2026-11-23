import {createGame,guess,botChoice,currentPlayer,rollDie} from '../core/rules.mjs';
const pipMap={1:[[50,50]],2:[[28,28],[72,72]],3:[[28,28],[50,50],[72,72]],4:[[28,28],[72,28],[28,72],[72,72]],5:[[28,28],[72,28],[50,50],[28,72],[72,72]],6:[[28,24],[72,24],[28,50],[72,50],[28,76],[72,76]]};
function dieSvg(n){return `<svg viewBox="0 0 100 100" role="img" aria-label="Die shows ${n}"><defs><linearGradient id="six-face" x2=".9" y2="1"><stop stop-color="#fffefa"/><stop offset=".55" stop-color="#eee9e2"/><stop offset="1" stop-color="#c8c0b8"/></linearGradient></defs><rect x="3" y="3" width="94" height="94" rx="20" fill="url(#six-face)" stroke="#bcb3aa" stroke-width="2"/><path d="M15 43V24Q15 14 27 14H71" stroke="#fff" stroke-opacity=".8" stroke-width="4" stroke-linecap="round" fill="none"/>${pipMap[n].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="8" fill="#242326" stroke="#77716f" stroke-width="1"/>`).join('')}</svg>`;}
export function mountSix(){
  const root=document.querySelector('[data-six]');if(!root||root.dataset.mounted)return;root.dataset.mounted='1';
  const $=s=>root.querySelector(s),menu=$('[data-menu]'),roomPanel=$('[data-room]'),stage=$('[data-stage]'),status=$('[data-status]');
  const buttons=[...root.querySelectorAll('[data-guess]')];
  let game=null,ws=null,me='you',host=null,players=[],roomCode='',session='',mode='menu',busy=false;
  const backend=root.dataset.backend.replace(/\/$/,'');
  const names=()=>Object.fromEntries(players.map(p=>[p.id,p.name]));
  function render(){
    const current=game&&currentPlayer(game),myTurn=mode==='solo'?current==='you':current===me;
    stage.hidden=!game;menu.hidden=mode!=='menu';roomPanel.hidden=mode!=='online';
    $('[data-start]').hidden=mode!=='online'||host!==me||!!game&&!game.over;
    if(game){
      $('[data-turn]').textContent=game.over?game.winner?`${names()[game.winner]||game.winner} WINS!`:'DRAW!':`ROUND ${game.round}/10 · ${names()[current]||current}'S TURN`;
      $('[data-die]').innerHTML=dieSvg(game.previous);
      const last=game.last;
      $('[data-last]').textContent=last.opening?`Opening roll: ${last.roll}`:`${names()[last.player]||last.player} guessed ${last.choice.toUpperCase()} · rolled ${last.roll} · ${last.delta>=0?'+':''}${last.delta}${last.eliminated?' · OUT':''}`;
    }
    buttons.forEach(b=>b.disabled=!game||game.over||!myTurn||busy);
    const scores=game?.ids||players.map(p=>p.id);
    $('[data-scores]').replaceChildren(...scores.map(id=>{const li=document.createElement('li');li.className=(id===current?'active ':'')+(game&&!game.alive.includes(id)?'out':'');const label=document.createElement('span');label.textContent=names()[id]||id;const score=document.createElement('strong');score.textContent=game?String(game.scores[id]):'—';li.append(label,score);return li;}));
  }
  function playSolo(choice){if(!game||game.over||currentPlayer(game)!=='you')return;guess(game,'you',choice,rollDie());render();if(!game.over){busy=true;render();setTimeout(()=>{busy=false;if(!game.over){const c=botChoice(game.previous,game.scores.bot,game.scores.you);guess(game,'bot',c,rollDie());}render();},550);}}
  $('[data-solo]').onclick=()=>{mode='solo';players=[{id:'you',name:'YOU'},{id:'bot',name:'COMPUTER'}];game=createGame(['bot','you']);status.textContent='You play second. The opening roll belongs to the computer.';render();};
  buttons.forEach(b=>b.onclick=()=>{const choice=b.dataset.guess;if(mode==='solo')playSolo(choice);else if(ws?.readyState===WebSocket.OPEN&&game)ws.send(JSON.stringify({type:'guess',choice,move:game.moves}));});
  function disconnect(){if(ws){ws.close();ws=null;}mode='menu';game=null;players=[];me='you';host=null;render();}
  $('[data-leave]').onclick=disconnect;
  function connect(code,token=''){
    if(!backend){status.textContent='Online backend not configured (PUBLIC_SIX_BACKEND_URL).';return;}
    disconnect();mode='online';roomCode=code;session=token;
    const url=new URL(backend);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname=url.pathname.replace(/\/$/,'')+'/six/rooms/'+code;
    ws=new WebSocket(url);
    ws.onopen=()=>{let key='';try{key=localStorage.getItem('six-room-'+code)||'';}catch{}ws.send(JSON.stringify({type:'join',name:$('[data-name]').value.trim()||'Player',key,token}));};
    ws.onmessage=e=>{const msg=JSON.parse(e.data);if(msg.type==='error'){status.textContent=msg.error;return;}if(msg.type==='identity'){me=msg.you;try{localStorage.setItem('six-room-'+code,msg.key);}catch{} }if(msg.type==='state'){players=msg.players;host=msg.host;game=msg.game;status.textContent=game?'':'Waiting for players…';render();}};
    ws.onclose=()=>{if(mode==='online'){status.textContent='Disconnected. Rejoin with your room code.';buttons.forEach(b=>b.disabled=true);}};
    $('[data-room-code]').textContent='ROOM '+code;history.replaceState(null,'',location.pathname+'?room='+code);render();
  }
  $('[data-create]').onclick=async()=>{if(!backend){status.textContent='Online backend not configured.';return;}try{const r=await fetch(backend+'/six/rooms',{method:'POST'});if(!r.ok)throw Error('Room unavailable ('+r.status+').');const {room,token}=await r.json();connect(room,token);}catch(e){status.textContent=e.message;}};
  $('[data-join]').onclick=()=>{const label=$('[data-code-label]');if(label.hidden){label.hidden=false;$('[data-code]').focus();return;}const code=$('[data-code]').value.trim();if(!/^\d{6}$/.test(code)){status.textContent='Enter a six-digit room code.';return;}connect(code);};
  $('[data-invite]').onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+location.pathname+'?room='+roomCode);status.textContent='Invite copied.';}catch{status.textContent='Copy the URL from your address bar.';}};
  $('[data-start]').onclick=()=>ws?.send(JSON.stringify({type:'start'}));
  const invited=new URLSearchParams(location.search).get('room');if(invited&&/^\d{6}$/.test(invited)){$('[data-code-label]').hidden=false;$('[data-code]').value=invited;status.textContent='Enter your name, then join the room.';}
  render();
}
