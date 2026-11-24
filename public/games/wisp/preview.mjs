import {WISPS,HUNTERS} from './core/characters.mjs';
import {isOpen} from './core/maze.mjs';
import {createRound,setDirection,step,secondsLeft} from './core/simulation.mjs';
import {ABILITIES,abilityAvailability} from './core/abilities.mjs';
import {STEP,HZ} from './core/config.mjs';
import {createBotBrain,planBots} from './core/bots.mjs';
import {direction} from './client/orientation.mjs';
import {renderer} from './client/renderer.mjs';
import {installInput} from './client/input.mjs';
import {characterSVG} from './characters.mjs';
const $=id=>document.getElementById(id);
const canvas=$('board'), render=renderer(canvas), orientation=matchMedia('(orientation: landscape)');
const freshSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
let seed=freshSeed(), landscape=orientation.matches, tutorial=false, selected='Orb';
let s, previous, ping, brain, pendingAbility=false, running=false, paused=false, accumulator=0, last=0;
for(const [id,roster] of [['wisps',WISPS],['hunters',HUNTERS]])for(const c of roster) {
  const b=document.createElement('button');b.innerHTML=`${characterSVG(c)}<span>${c.id}</span><small>${c.ability}</small>`;
  b.dataset.character=c.id;b.onclick=()=>{selected=c.id;if(selected==='Stalker')tutorial=false;reset();};$(id).append(b);
}
const local=()=>s.actors.find(a=>a.player==='local');
const positions=()=>new Map([...s.actors,...s.decoys].map(a=>[a.id,{x:a.x,y:a.y,warp:a.warp}]));
function reset() {
  s=createRound({seed,tutorial,humans:[{id:'local',character:selected}]});
  previous=positions();brain=createBotBrain($('difficulty').value);ping=null;pendingAbility=false;running=false;paused=false;accumulator=0;
  for(const b of document.querySelectorAll('[data-character]'))b.setAttribute('aria-pressed',String(b.dataset.character===selected));
  $('tutorial').setAttribute('aria-pressed',String(tutorial));$('seed').textContent=`Seed ${seed}`;
  updateHUD();
}
function updateHUD() {
  const a=local();
  const phase={prepare:'Get ready',survive:'Survive',escape:'Portal open',finished:'Round complete'}[s.phase];
  $('phase').textContent=!running&&s.phase==='prepare'?'Ready':paused?'Paused':phase;
  $('clock').textContent=`${secondsLeft(s)}s`;
  $('identity').textContent=`${a.id} · ${a.faction==='wisp'?'Wisp':'Hunter'}`;
  $('energy').hidden=a.energy===null;$('energy').value=a.energy??0;
  $('condition').textContent=a.status==='active'?(a.energy===null?'Unlimited energy':`${Math.ceil(a.energy)} / 100`):a.status==='escaped'?'Escaped':`Eliminated · ${a.reason}`;
  const spec=ABILITIES[a.id], wait=Math.max(0,(a.readyAt-s.tick)/HZ);
  const reason=abilityAvailability(s,a);
  $('ability').textContent=`${a.ability}${wait>0?` · ${Math.ceil(wait)}s`:a.energy!==null?` · ${a.cost} energy`:''}`;
  $('ability').style.setProperty('--ability-color',a.color);
  $('ability').style.setProperty('--ready',`${100*(1-Math.min(1,wait/spec.cooldown))}%`);
  $('ability').disabled=!running||paused||!!reason;
  const statuses=[['Silenced',a.silenceUntil],['Stunned',a.stunUntil],['Slowed',a.slowUntil],['Surge',a.surgeUntil],['Barrier',a.barrierUntil],['Drain',a.drainUntil]].filter(([,until])=>s.tick<until).map(([label,until])=>`${label} ${Math.ceil((until-s.tick)/HZ)}s`);
  if(a.lunge)statuses.push(s.tick<a.lunge.chargeUntil?'Charging':'Lunging');
  $('ability-help').textContent=spec.description;
  const feedback=a.lastAbility&&s.tick-a.lastAbility.tick<2*HZ?(a.lastAbility.ok?'Activated':a.lastAbility.reason):'';
  $('ability-status').textContent=[...statuses,feedback||(!reason?'Ready':reason)].join(' · ');
  $('alive').textContent=`${s.actors.filter(a=>a.faction==='wisp'&&a.status==='active').length}/4 Wisps active`;
  $('result').textContent=s.result?`${s.result.escaped} escaped · ${s.result.eliminated} eliminated`:'';
  $('start').textContent=s.phase==='finished'?'Replay':!running?'Start':paused?'Resume':'Pause';
}
function frame(now) {
  const elapsed=last?Math.min(.25,(now-last)/1000):0;last=now;
  if(running&&!paused&&s.phase!=='finished') {
    accumulator+=elapsed;
    while(accumulator>=STEP) {
      previous=positions();const cast=pendingAbility;pendingAbility=false;
      const casts=cast?[selected]:[];
      for(const intent of planBots(s,brain)) {
        if(intent.direction)setDirection(s,intent.id,intent.direction);
        if(intent.ability)casts.push(intent.id);
      }
      step(s,casts);accumulator-=STEP;
      if(cast||s.tick%5===0||s.phase==='finished')updateHUD();
      if(s.phase==='finished'){accumulator=0;previous=positions();break;}
    }
  }
  render.draw(s,landscape,previous,running&&!paused&&s.phase!=='finished'?accumulator/STEP:1,ping,now);
  requestAnimationFrame(frame);
}
$('start').onclick=()=>{
  if(s.phase==='finished')reset();
  if(!running){running=true;paused=false;}else paused=!paused;
  pendingAbility=false;accumulator=0;previous=positions();updateHUD();
  if(!paused)canvas.focus({preventScroll:true});
};
$('new').onclick=()=>{seed=freshSeed();reset();};
$('rotate').onclick=()=>{landscape=!landscape;};
$('tutorial').onclick=()=>{tutorial=!tutorial;if(tutorial&&selected==='Stalker')selected='Orb';$('difficulty').value=tutorial?'easy':'normal';reset();};
$('difficulty').onchange=()=>reset();
orientation.addEventListener('change',e=>{landscape=e.matches;});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&s.phase!=='finished'){paused=true;pendingAbility=false;accumulator=0;previous=positions();updateHUD();}last=0;});
function castAbility(){if(running&&!paused&&!abilityAvailability(s,local()))pendingAbility=true;}
$('ability').onclick=()=>{castAbility();canvas.focus({preventScroll:true});};
installInput(canvas,(dx,dy)=>{
  if(s.phase==='finished')return;
  setDirection(s,selected,direction(dx,dy,landscape));
  if(document.activeElement?.matches('[data-d]'))canvas.focus({preventScroll:true});
},(x,y)=>{
  const [u,v]=render.hit(x,y,landscape);
  if(isOpen(s.board,u,v))ping={x:u,y:v,until:performance.now()+3000};
},castAbility);
reset();requestAnimationFrame(frame);
