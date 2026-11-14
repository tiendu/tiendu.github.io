import {BIRDS,newRun,jump,step,activeDisaster,disasterWarning,bestKey} from './engine.mjs';
import {draw,paintBird} from './render.mjs';
const $=id=>document.getElementById(id);
const root=$('neon-chicken'),canvas=$('neon-canvas');
if(!root||!canvas)throw Error('Neon Chicken markup missing');
const ctx=canvas.getContext('2d',{alpha:false});
if(!ctx)throw Error('Canvas 2D not supported');
let selected=2,game=null,paused=false,finished=false,lastFrame=0,acc=0,previousCorn=0,lastEvent=null;
let soundEnabled=false,audio=null,records={};
try{records=JSON.parse(localStorage.getItem(bestKey())||'{}')||{};}catch{records={};}
const pad=n=>String(n).padStart(2,'0');
function clock(t){return `${pad(Math.floor(t/60))}:${pad(Math.floor(t%60))}`;}
function tone(hz=440,duration=.08,type='sine'){
 if(!soundEnabled)return;
 try{
  audio??=new (window.AudioContext||window.webkitAudioContext)();
  if(audio.state==='suspended')audio.resume();
  const osc=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;
  osc.type=type;osc.frequency.setValueAtTime(hz,now);
  gain.gain.setValueAtTime(.045,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);
  osc.connect(gain).connect(audio.destination);osc.start(now);osc.stop(now+duration+.01);
 }catch{/* Sound is optional; keep the run playable. */}
}
function selectBird(id){
 selected=id;for(const card of root.querySelectorAll('[data-bird]'))card.setAttribute('aria-pressed',String(Number(card.dataset.bird)===id));
 $('neon-selected').textContent=`${BIRDS[id].name.toUpperCase()} · ${BIRDS[id].role}`;
 $('neon-best').textContent=clock(records[id]?.time||0);
}
root.querySelectorAll('[data-bird]').forEach(button=>button.addEventListener('click',()=>selectBird(Number(button.dataset.bird))));
for(const preview of root.querySelectorAll('[data-bird-preview]')){
 const id=Number(preview.dataset.birdPreview),p=preview.getContext('2d');
 if(!p)continue;
 p.clearRect(0,0,100,90);
 p.save();p.translate(3,6);p.scale(1.25,1.25);
 paintBird(p,38,66,BIRDS[id],{elapsed:0,speed:245,y:0,grounded:true,alive:true,boostPulse:0,fuel:100});
 p.restore();
}
function start(){
 let seed=Date.now()>>>0;
 try{seed=crypto.getRandomValues(new Uint32Array(1))[0]||seed;}catch{}
 game=newRun(selected,seed);step(game,0);
 paused=false;finished=false;acc=0;previousCorn=0;lastEvent=null;lastFrame=0;
 $('neon-menu').hidden=true;$('neon-run').hidden=false;$('neon-end').hidden=true;
 $('neon-pause').textContent='PAUSE';$('neon-jump').disabled=false;
 $('neon-run').dataset.running='true';updateHud();requestAnimationFrame(frame);
 tone(510,.14,'triangle');
}
function jumpNow(){
 if(!game||finished)return;
 if(paused){togglePause();return;}
 const wasGrounded=game.grounded;
 if(jump(game))tone(wasGrounded?510:760,.11,'triangle');
}
function finish(){
 if(!game||finished)return;
 finished=true;paused=false;
 const prior=records[game.bird];
 const record=!prior||game.elapsed>prior.time;
 if(record){records[game.bird]={time:game.elapsed,distance:game.distance};try{localStorage.setItem(bestKey(),JSON.stringify(records));}catch{}}
 $('neon-final').textContent=clock(game.elapsed);
 $('neon-death').textContent=game.reason.toUpperCase();
 $('neon-new-best').hidden=!record;
 $('neon-end').hidden=false;$('neon-jump').disabled=true;
 $('neon-pause').textContent='PAUSE';$('neon-run').dataset.running='false';
 tone(165,.33,'sawtooth');
}
function updateHud(){
 if(!game)return;
 $('neon-time').textContent=clock(game.elapsed);
 $('neon-distance').textContent=`${Math.floor(game.distance/10)} m`;
 $('neon-fuel').style.width=`${Math.max(0,game.fuel)}%`;
 $('neon-fuel-value').textContent=`${Math.floor(game.fuel)}%`;
 $('neon-fuel').dataset.low=String(game.fuel<25);
 $('neon-chicken-name').textContent=BIRDS[game.bird].name.toUpperCase();
 $('neon-fox').style.width=`${Math.floor(game.fox*100)}%`;
 const d=disasterWarning(game);
 $('neon-status').textContent=paused?'PAUSED':d?.hint||(game.fuel<20?'LOW CORN ENERGY — COLLECT FUEL':'AUTO-RUN · TAP JUMP / TAP AGAIN TO BOOST');
 $('neon-status').dataset.alert=String(Boolean(d||game.fuel<20));
 $('neon-jump').textContent=paused?'RESUME':game.grounded?'JUMP':game.boostReady&&game.fuel>=12&&activeDisaster(game)?.id!=='emp'?'JETPACK':'JUMP';
 $('neon-jump').dataset.boost=String(!game.grounded);
}
function frame(time){
 if(!game||finished)return;
 if(!lastFrame)lastFrame=time;
 const elapsed=Math.min(.05,(time-lastFrame)/1000);lastFrame=time;
 if(!paused){
  acc+=elapsed;
  let steps=0;
  while(acc>=1/60&&steps<5&&game.alive){step(game,1/60);acc-=1/60;steps++;}
  if(game.collected!==previousCorn){previousCorn=game.collected;tone(880,.045,'sine');}
  const current=activeDisaster(game)?.id;
  if(current&&current!==lastEvent)tone(220,.3,'sawtooth');
  lastEvent=current||null;
  if(!game.alive)finish();
 }
 const dpr=Math.min(window.devicePixelRatio||1,2);
 const box=canvas.getBoundingClientRect();
 const width=Math.max(1,Math.round(box.width*dpr)),height=Math.max(1,Math.round(box.height*dpr));
 if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
 draw(ctx,game,{width:box.width,height:box.height,dpr});
 updateHud();
 if(!finished)requestAnimationFrame(frame);
}
function togglePause(){
 if(!game||finished)return;
 paused=!paused;lastFrame=0;acc=0;
 $('neon-pause').textContent=paused?'RESUME':'PAUSE';
 updateHud();
}
function menu(){
 if(!game)return;
 game=null;paused=false;finished=false;lastFrame=0;
 $('neon-run').hidden=true;$('neon-menu').hidden=false;
 selectBird(selected);
}
$('neon-start').addEventListener('click',start);
$('neon-retry').addEventListener('click',start);
$('neon-pause').addEventListener('click',togglePause);
$('neon-menu-button').addEventListener('click',menu);
$('neon-jump').addEventListener('click',jumpNow);
canvas.addEventListener('pointerdown',event=>{if(event.button===0){event.preventDefault();jumpNow();}});
$('neon-sound').addEventListener('click',()=>{soundEnabled=!soundEnabled;$('neon-sound').textContent=soundEnabled?'SOUND ON':'SOUND OFF';$('neon-sound').setAttribute('aria-pressed',String(soundEnabled));tone(760,.12);});
document.addEventListener('keydown',event=>{
 if(event.target?.closest?.('button,input,select,textarea')&&!['Escape'].includes(event.key))return;
 if(['Space','ArrowUp','KeyW'].includes(event.code)&&game&&!finished){event.preventDefault();jumpNow();}
 else if(event.code==='KeyP'&&game&&!finished){event.preventDefault();togglePause();}
 else if(event.code==='Escape'&&game&&!finished){event.preventDefault();if(!paused)togglePause();}
});
window.addEventListener('blur',()=>{if(game&&!paused&&!finished)togglePause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game&&!paused&&!finished)togglePause();});
selectBird(selected);
$('neon-boot').textContent='SELECT A PILOT AND RUN';
