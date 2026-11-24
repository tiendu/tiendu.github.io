import {WISPS,HUNTERS} from './core/characters.mjs';
import {isOpen} from './core/maze.mjs';
import {secondsLeft} from './core/simulation.mjs';
import {ABILITIES,abilityAvailability} from './core/abilities.mjs';
import {STEP,HZ} from './core/config.mjs';
import {createSolo,tickSolo,nextLevel,soloRecord,betterRecord} from './core/session.mjs';
import {direction} from './client/orientation.mjs';
import {renderer} from './client/renderer.mjs';
import {installInput} from './client/input.mjs';
import {characterSVG} from './characters.mjs';
import {backendURL,socketClient} from './client/socket.mjs';
const $=id=>document.getElementById(id);
const canvas=$('board'),render=renderer(canvas),orientation=matchMedia('(orientation: landscape)');
const freshSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
const api=backendURL(new URLSearchParams(location.search).get('api'));
let landscape=orientation.matches,selected='Orb',run,s,previous,ping,pendingAbility=false,pendingDirection=null;
let running=false,paused=false,accumulator=0,last=0,online=false,onlineReady=false,myId=null,lobby=null,arrived=0,snapshotGap=50,onlineSnapshot=null, tutorialSeen={};
const positions=state=>new Map([...state.actors,...state.decoys].map(a=>[a.id,{x:a.x,y:a.y,warp:a.warp}]));
const local=()=>s.actors.find(a=>a.player==='local');
const recordKey=()=>`wisp-solo-v2:${selected}`;
function readRecord(){try{const r=JSON.parse(localStorage.getItem(recordKey()));return r&&Number.isSafeInteger(r.cleared)&&Number.isSafeInteger(r.level)?r:null;}catch{return null;}}
function saveRecord(){const r=soloRecord(run);try{if(betterRecord(r,readRecord()))localStorage.setItem(recordKey(),JSON.stringify(r));}catch{}}
for(const [id,roster] of [['wisps',WISPS],['hunters',HUNTERS]])for(const c of roster){
  const b=document.createElement('button');b.innerHTML=`${characterSVG(c)}<span>${c.id}</span><small>${c.ability}</small>`;
  b.dataset.character=c.id;b.onclick=()=>{if(online){if(onlineReady&&lobby?.state==='lobby')socket.select(c.id);return;}if(running)return;selected=c.id;reset();};$(id).append(b);
}
function setControls(){
  const inLobby=online&&(!lobby||lobby.state==='lobby'),host=lobby?.host===myId,mine=lobby?.players.find(p=>p.id===myId);
  document.body.dataset.screen=inLobby||online&&!onlineSnapshot&&['aborted','finished','between'].includes(lobby?.state)?'online-lobby':online?'online':running?'solo':'setup';
  for(const b of document.querySelectorAll('[data-character]')){
    b.setAttribute('aria-pressed',String(b.dataset.character===selected));
    const c=[...WISPS,...HUNTERS].find(c=>c.id===b.dataset.character);
    const taken=lobby?.players.some(p=>p.id!==myId&&p.character===c.id),wrongSide=lobby?.mode==='coop'&&lobby.side!==c.faction&&lobby.players.length>1;
    b.disabled=running||online&&(!onlineReady||!inLobby||taken||wrongSide);
  }
  $('skip').disabled=running||online;$('start').disabled=online;$('new').disabled=online||!running;
  $('create').disabled=online||running||!api;$('join').disabled=online||running||!api;$('room-code').disabled=online||running;$('mode').disabled=running||online&&(!onlineReady||!host||!inLobby);
  $('leave').hidden=!online;
  $('ready').hidden=!onlineReady||!inLobby||!mine;$('ready').textContent=mine?.ready?'Not ready':'Ready';
  $('online-start').hidden=!onlineReady||!host||!inLobby;$('online-start').disabled=!lobby?.canStart;
  $('next-round').hidden=!onlineReady||!host||lobby?.state!=='between';
  $('rematch').hidden=!onlineReady||!host||!['finished','aborted','between'].includes(lobby?.state);
}
function showLobby(){
  const node=$('room-roster');node.replaceChildren();
  if(!lobby){$('match-results').textContent='';return;}
  for(const p of lobby.players){
    const c=[...WISPS,...HUNTERS].find(c=>c.id===p.character),row=document.createElement('div');row.className='room-player';
    if(c){const icon=document.createElement('span');icon.innerHTML=characterSVG(c);row.append(icon);}
    const name=document.createElement('span');name.textContent=`${p.character}${p.id===myId?' (you)':''}${p.id===lobby.host?' · Host':''} · ${p.connected?p.ready?'Ready':'Connected':'Offline / bot'}`;row.append(name);
    const stats=document.createElement('small');stats.textContent=`Wins ${p.wins} · Co-op clears ${p.clears}`;row.append(stats);
    if(!p.connected&&lobby.host===myId&&lobby.state==='lobby'){const kick=document.createElement('button');kick.textContent='Remove';kick.onclick=()=>socket.kick(p.id);row.append(kick);}
    node.append(row);
  }
  const series=lobby.series;
  $('match-results').textContent=series?[
    lobby.mode==='coop'?`Co-op · ${series.cleared} levels cleared`:`Competitive · Wisps ${series.score.wisp} — ${series.score.hunter} Hunters`,
    series.last?`Round ${series.last.level}: ${series.last.escaped} escaped · ${series.last.eliminated} eliminated`:'',
    series.winner?series.winner==='opponents'?'Co-op run over':`${series.winner==='wisp'?'Wisps':'Hunters'} win the match!`:lobby.state==='between'?'Waiting for host to continue':lobby.state==='aborted'?'Match aborted; no win awarded.':''
  ].filter(Boolean).join('\n'):'';
}
function reset(){
  run=createSolo({seed:freshSeed(),character:selected,skipTutorial:$('skip').checked});s=run.round;
  previous=positions(s);ping=null;tutorialSeen={};pendingAbility=false;pendingDirection=null;running=false;paused=false;accumulator=0;
  setControls();updateHUD();
}
function tutorialHelp(a){
  if(online){if(lobby?.mode!=='coop'||lobby.series?.level!==1||lobby.state!=='running')return '';return s.phase==='escape'?(a.faction==='wisp'?'Reach the portal before it closes.':'Intercept Wisps before they escape.'):`Tutorial · ${a.faction==='wisp'?'Collect energy and avoid hunters.':'Touch Wisps to damage them.'} ${a.ability}: ${ABILITIES[a.id].description}`;}
  if(run.level!==1||run.status!=='playing')return '';
  if(s.phase==='escape')return a.faction==='wisp'?'The portal is open. Reach the glowing rings before time runs out.':'Intercept Wisps before they reach the portal.';
  if(s.phase==='prepare'||!tutorialSeen.moved)return 'Level 1 · Move with WASD, arrow keys, swipe or direction buttons.';
  if(!tutorialSeen.resource&&s.tick<12*HZ)return a.faction==='wisp'?'Energy is your health and ability fuel. Collect glowing circles.':'Touch Wisps to damage them. Wait for recovery between hits.';
  if(!tutorialSeen.cast)return `${a.ability}: ${ABILITIES[a.id].description} Press Space or the ability button.`;
  return '';
}
function updateHUD(){
  const a=local(),phase={prepare:'Get ready',survive:'Survive',escape:'Portal open',finished:'Round complete'}[s.phase];
  $('phase').textContent=online&&lobby?.state==='aborted'?'Match aborted':online&&lobby?.state==='finished'?'Match complete':online&&lobby?.state==='between'?'Round complete':online&&!onlineSnapshot?'Waiting for round':!online&&run.status==='lost'?'Run over':!online&&run.status==='cleared'?'Level cleared':!running&&!online&&s.phase==='prepare'?'Ready':paused?'Paused':phase;
  $('clock').textContent=`${secondsLeft(s)}s`;
  $('level').textContent=online?`${lobby?.mode==='coop'?'Level':'Round'} ${lobby?.series?.level??1}`:`Level ${run.level}${run.level===1?' · Tutorial':''}`;
  $('score').textContent=online?(lobby?.series?lobby.mode==='coop'?`${lobby.series.cleared} cleared`:`${lobby.series.score.wisp} — ${lobby.series.score.hunter}`:''):`${run.cleared} cleared`;
  const record=online?null:readRecord();$('record').textContent=record?`Best: ${record.cleared} cleared`:'';
  $('alive').textContent=`${s.actors.filter(a=>a.faction==='wisp'&&a.status==='active').length}/4 Wisps active`;
  $('start').textContent=!running?'Start solo':run.status==='cleared'?'Next level':run.status==='lost'?'New run':paused?'Resume':'Pause';
  const outcome=online?s.result:run.outcome;
  $('result').textContent=outcome?`${outcome.escaped} escaped · ${outcome.eliminated} eliminated${outcome.active?` · ${outcome.active} still active`:''}${!online?` · ${Math.floor(run.ticks/HZ)}s played`:''}`:'';
  if(!a){$('tutorial-help').textContent='';$('ability-help').textContent='';$('ability-status').textContent='';$('ability').disabled=true;$('identity').textContent=selected;$('condition').textContent='Spectating';$('energy').hidden=true;return;}
  $('identity').textContent=`${a.id} · ${a.faction==='wisp'?'Wisp':'Hunter'}`;
  $('energy').hidden=a.energy===null;$('energy').value=a.energy??0;
  $('condition').textContent=a.status==='active'?(a.energy===null?'Unlimited energy':`${Math.ceil(a.energy)} / 100`):a.status==='escaped'?'Escaped · spectating':`Eliminated · ${a.reason}`;
  const spec=ABILITIES[a.id],wait=Math.max(0,(a.readyAt-s.tick)/HZ),reason=abilityAvailability(s,a);
  $('ability').textContent=`${a.ability}${wait>0?` · ${Math.ceil(wait)}s`:a.energy!==null?` · ${a.cost} energy`:''}`;
  $('ability').style.setProperty('--ability-color',a.color);$('ability').style.setProperty('--ready',`${100*(1-Math.min(1,wait/spec.cooldown))}%`);
  $('ability').disabled=online?(!onlineReady||lobby?.state!=='running'||!onlineSnapshot||!!reason):(!running||paused||run.status!=='playing'||!!reason);
  const statuses=[['Silenced',a.silenceUntil],['Stunned',a.stunUntil],['Slowed',a.slowUntil],['Surge',a.surgeUntil],['Barrier',a.barrierUntil],['Drain',a.drainUntil]].filter(([,until])=>s.tick<until).map(([label,until])=>`${label} ${Math.ceil((until-s.tick)/HZ)}s`);
  if(a.lunge)statuses.push(s.tick<a.lunge.chargeUntil?'Charging':'Lunging');
  $('ability-help').textContent=spec.description;
  const feedback=a.lastAbility&&s.tick-a.lastAbility.tick<2*HZ?(a.lastAbility.ok?'Activated':a.lastAbility.reason):'';
  $('ability-status').textContent=[...statuses,feedback||(!reason?'Ready':reason)].join(' · ');
  $('tutorial-help').textContent=tutorialHelp(a)||(selected==='Stalker'&&!running&&!online?'Stalker starts at Level 2 (not available in the tutorial).':'');
}
const socket=api?socketClient(api,{
  onWelcome(msg,code){myId=msg.id;selected=msg.character;onlineReady=true;$('room-code').value=code;try{sessionStorage.setItem('wisp-room-v3',JSON.stringify({code,token:msg.token}));}catch{}setControls();},
  onStatus(msg){$('online-status').textContent=msg;if(msg!=='Connected')onlineReady=false;setControls();updateHUD();},
  onNotice(msg){$('online-status').textContent=msg;},
  onResult(result){$('result').textContent=`${result.escaped} escaped · ${result.eliminated} eliminated`;},
  onLobby(msg){
    const prior=lobby;lobby=msg;$('mode').value=msg.mode;const mine=msg.players.find(p=>p.id===myId);if(mine)selected=mine.character;
    if(msg.state==='lobby'||msg.state==='running'&&prior?.state!=='running'){onlineSnapshot=null;ping=null;}
    if(msg.state==='aborted')$('online-status').textContent='Match aborted by server restart. Host can return to lobby.';
    $('room-info').textContent=`Room ${msg.code} · ${msg.mode==='coop'?`Co-op (${msg.side})`:'Competitive'} · ${msg.state}`;
    showLobby();setControls();updateHUD();
  },
  onState(state,old,now){const same=old&&state.seed===old.seed&&state.tick>old.tick;previous=positions(same?old:state);snapshotGap=Math.max(25,Math.min(150,now-arrived));arrived=now;s=state;onlineSnapshot=state;updateHUD();},
}):null;
function enterOnline(){online=true;onlineReady=false;onlineSnapshot=null;lobby=null;myId=null;ping=null;setControls();updateHUD();}
function exitOnline(){socket?.leave();try{sessionStorage.removeItem('wisp-room-v3');}catch{}online=false;onlineReady=false;onlineSnapshot=null;lobby=null;myId=null;$('room-info').textContent='';showLobby();$('online-status').textContent=api?'':'Backend not configured';reset();}
function savedSession(){try{return JSON.parse(sessionStorage.getItem('wisp-room-v3'));}catch{return null;}}
const saved=savedSession();if(/^\d{6}$/.test(saved?.code??''))$('room-code').value=saved.code;
$('create').onclick=async()=>{enterOnline();try{await socket.create(selected,$('mode').value);if(!online)socket.stop();}catch(e){if(online){exitOnline();$('online-status').textContent=e.message;}}};
$('join').onclick=()=>{const code=$('room-code').value.trim();if(!/^\d{6}$/.test(code)){$('online-status').textContent='Enter six digits';return;}enterOnline();const old=savedSession();socket.join(code,selected,old?.code===code?old.token:undefined);};
$('mode').onchange=()=>{if(online)socket.mode($('mode').value);};$('online-start').onclick=()=>socket.start();$('ready').onclick=()=>socket.ready(!lobby?.players.find(p=>p.id===myId)?.ready);$('next-round').onclick=()=>socket.next();$('rematch').onclick=()=>socket.rematch();$('leave').onclick=exitOnline;
if(!api)$('online-status').textContent='Backend not configured';
function frame(now){
  const elapsed=last?Math.min(.25,(now-last)/1000):0;last=now;
  if(!online&&running&&!paused&&run.status==='playing'){
    accumulator+=elapsed;
    while(accumulator>=STEP){
      previous=positions(s);const cast=pendingAbility;pendingAbility=false;
      const before=local(),energy=before.energy,recovery=before.recoverUntil;
      tickSolo(run,{direction:pendingDirection,ability:cast});pendingDirection=null;accumulator-=STEP;
      if(run.level===1){const a=local(),p=previous.get(a.id);tutorialSeen.moved||=a.x!==p.x||a.y!==p.y;tutorialSeen.resource||=a.energy===null?a.recoverUntil>recovery:a.energy>energy;tutorialSeen.cast||=!!a.lastAbility?.ok;}
      if(cast||s.tick%5===0||run.status!=='playing')updateHUD();
      if(run.status!=='playing'){saveRecord();updateHUD();accumulator=0;previous=positions(s);break;}
    }
  }
  const alpha=online&&onlineSnapshot?Math.min(1,Math.max(0,(now-arrived)/snapshotGap)):running&&!paused&&run.status==='playing'?accumulator/STEP:1;
  const pings=online&&onlineSnapshot?s.pings.map(p=>({...p,until:arrived+(p.until-s.tick)*1000/HZ})):ping;
  render.draw(s,landscape,previous,alpha,pings,now,online&&onlineSnapshot&&onlineReady?socket.prediction(now):null);
  requestAnimationFrame(frame);
}
$('start').onclick=()=>{
  if(online)return;
  if(run.status==='lost')reset();
  if(run.status==='cleared'){nextLevel(run);s=run.round;ping=null;paused=false;}
  else if(!running){running=true;paused=false;}else paused=!paused;
  pendingAbility=false;pendingDirection=null;accumulator=0;previous=positions(s);setControls();updateHUD();
  if(!paused)canvas.focus({preventScroll:true});
};
$('new').onclick=()=>{if(!online)reset();};$('skip').onchange=reset;
$('rotate').onclick=()=>{landscape=!landscape;};
orientation.addEventListener('change',e=>{landscape=e.matches;});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!online&&running&&run.status==='playing'){paused=true;pendingAbility=false;pendingDirection=null;accumulator=0;previous=positions(s);updateHUD();}last=0;});
function castAbility(){if(online){if(onlineReady&&lobby?.state==='running'&&onlineSnapshot&&!abilityAvailability(s,local()))socket.input(null,true);}else if(running&&!paused&&run.status==='playing'&&!abilityAvailability(s,local()))pendingAbility=true;}
$('ability').onclick=()=>{castAbility();canvas.focus({preventScroll:true});};
installInput(canvas,(dx,dy)=>{
  const d=direction(dx,dy,landscape);
  if(online){if(onlineReady&&lobby?.state==='running'&&onlineSnapshot)socket.input(d);}else if(running&&!paused&&run.status==='playing')pendingDirection=d;
  if(document.activeElement?.matches('[data-d]'))canvas.focus({preventScroll:true});
},(x,y)=>{
  const [u,v]=render.hit(x,y,landscape);if(!isOpen(s.board,u,v))return;
  if(online){if(onlineReady&&lobby?.state==='running'&&onlineSnapshot)socket.ping(u,v);}else ping={x:u,y:v,until:performance.now()+3000};
},castAbility);
reset();requestAnimationFrame(frame);
