import {HZ, STEP, RULES} from './config.mjs';
import {DIRS, isOpen, distances, openCells, degree} from './maze.mjs';
import {advance, cardinal, centered} from './movement.mjs';

// Initial tuning, in seconds and tiles. No browser state or wall clock.
export const ABILITIES = Object.freeze({
  Orb: {cooldown:8, range:2, stun:1, push:1, description:'Push and stun hunters within 2 walking tiles.'},
  Prism: {cooldown:8, description:'Face one wall with a corridor directly beyond it, then phase.'}, Ember: {cooldown:8, duration:2, multiplier:2, description:'Double movement speed for 2 seconds.'},
  Rune: {cooldown:12, duration:8, description:'Absorb one contact hit within 8 seconds.'}, Nova: {cooldown:10, duration:3, description:'Split into a convincing decoy for 3 seconds.'},
  Hex: {cooldown:12, range:3, duration:3, multiplier:.5, description:'Slow hunters within 3 walking tiles for 3 seconds.'},
  Stalker: {cooldown:18, charge:.25, duration:1, multiplier:2.5, description:'Charge, then rush straight for up to 1 second.'},
  Interceptor: {cooldown:12, duration:3, description:'Face an empty corridor to block it for 3 seconds, if alternate routes remain.'}, Wanderer: {cooldown:6, description:'Face one wall with a corridor directly beyond it, then phase.'},
  Warden: {cooldown:10, range:2, description:'Consume energy particles within 2 walking tiles.'}, Leech: {cooldown:12, range:2, duration:3, drain:5, description:'Drain nearby Wisps for 3 seconds. Stay within 2 walking tiles.'},
  Sentinel: {cooldown:15, range:2, duration:3, description:'Prevent nearby Wisps from activating abilities for 3 seconds.'},
});
export const ticks = seconds => Math.ceil(seconds*HZ);
const active = a => a.status==='active';
const same = (a,b) => a.x===b.x&&a.y===b.y;
const point = a => ({x:a.x,y:a.y});
const anchor = a => ({x:Math.round(a.x),y:Math.round(a.y)});
const portalCell = s => s.portal?[s.portal.x,s.portal.y]:null;
const validDir = a => cardinal(a.wanted)?a.wanted:cardinal(a.dir)?a.dir:null;
export const blockedCells = s => s.blocks.filter(b=>s.tick<b.until);
const blockedAt = (s,x,y) => blockedCells(s).some(b=>b.x===x&&b.y===y);
export function abilityState() {
  return {readyAt:0, stunUntil:0, slowUntil:0, surgeUntil:0, barrierUntil:0,
    silenceUntil:0, drainUntil:0, lunge:null, warp:0};
}
// A position lies on an open cardinal edge. Measure distance from each endpoint,
// including fractional edge lengths, rather than using Euclidean proximity through walls.
function endpoints(a) {
  const x=Math.round(a.x),y=Math.round(a.y);
  if(centered(a))return [[x,y,0]];
  if(Math.abs(a.x-x)>1e-8)return [[Math.floor(a.x),y,a.x-Math.floor(a.x)],[Math.ceil(a.x),y,Math.ceil(a.x)-a.x]];
  return [[x,Math.floor(a.y),a.y-Math.floor(a.y)],[x,Math.ceil(a.y),Math.ceil(a.y)-a.y]];
}
export function corridorDistance(board,a,b) {
  const ea=endpoints(a),eb=endpoints(b);
  if(Math.hypot(a.x-b.x,a.y-b.y)<1e-8)return 0;
  if(ea.length===2&&eb.length===2&&ea.every(([x,y])=>eb.some(([u,v])=>x===u&&y===v)))return Math.hypot(a.x-b.x,a.y-b.y);
  let best=Infinity;
  for(const [x,y,f] of ea){const map=distances(board,[x,y]);for(const [u,v,g] of eb)best=Math.min(best,f+g+(map[v]?.[u]??Infinity));}
  return best;
}
function inRange(s,a,b,r) {
  return Math.abs(a.x-b.x)+Math.abs(a.y-b.y)<=r+1e-8&&corridorDistance(s.board,a,b)<=r+1e-8;
}
function targets(s,a,r) {return s.actors.filter(b=>active(b)&&b.faction!==a.faction&&inRange(s,a,b,r));}
function event(s,a,kind,extra={}) {
  s.effects.push({kind,actor:a.id,color:a.color,...point(a),start:s.tick,until:s.tick+ticks(.45),...extra});
}
function phaseTarget(s,a) {
  const d=validDir(a); if(!d)return null;
  const p=anchor(a),[dx,dy]=d,x=p.x+2*dx,y=p.y+2*dy;
  if(s.board[p.y+dy]?.[p.x+dx]!==1||!isOpen(s.board,x,y))return null;
  if(a.faction==='hunter'&&s.portal&&same({x,y},s.portal))return null;
  if(a.faction==='wisp'&&blockedAt(s,x,y))return null;
  return {x,y,d};
}
function lockdownTarget(s,a) {
  const d=validDir(a);if(!d)return null;
  const p=anchor(a),x=p.x+d[0],y=p.y+d[1];
  if(!isOpen(s.board,x,y)||blockedAt(s,x,y)||s.portal&&same({x,y},s.portal))return null;
  // Reject any Wisp on the tile or on an edge entering/leaving it.
  if([...s.actors.filter(w=>active(w)&&w.faction==='wisp'),...s.decoys].some(w=>endpoints(w).some(([u,v])=>u===x&&v===y)))return null;
  const board=s.board.map(row=>[...row]);
  for(const b of blockedCells(s))board[b.y][b.x]=1;
  board[y][x]=1;
  const cells=openCells(board),map=distances(board,cells[0]);
  // No disconnected pocket or new dead end: a second escape route stays open.
  if(cells.some(([u,v])=>!Number.isFinite(map[v][u])||degree(board,u,v)<2))return null;
  return {x,y};
}
function pushHunter(s,a,h,amount) {
  const p=anchor(h);
  const old=point(h), oldDir=h.dir,oldWanted=h.wanted;
  // Mid-edge: choose an endpoint away from the caster. At centers choose a legal exit.
  const options=centered(h)?DIRS.filter(([dx,dy])=>isOpen(s.board,p.x+dx,p.y+dy)&&!(s.portal&&same({x:p.x+dx,y:p.y+dy},s.portal))):[h.dir,[-h.dir[0],-h.dir[1]]].filter(cardinal);
  const score=([dx,dy])=>corridorDistance(s.board,a,{x:h.x+dx*.01,y:h.y+dy*.01});
  options.sort((u,v)=>score(v)-score(u));
  if(options.length){h.dir=[...options[0]];h.wanted=[...options[0]];advance(h,s.board,amount,portalCell(s));}
  h.wanted=oldWanted; if(!options.length)h.dir=oldDir;
  if(!same(old,h))h.warp++;
  h.lunge=null;
}
export function abilityAvailability(s,a) {
  if(!a||!active(a)||!['survive','escape'].includes(s.phase))return 'Not active';
  if(s.tick<a.silenceUntil)return 'Silenced';
  if(s.tick<a.stunUntil)return 'Stunned';
  if(s.tick<a.readyAt)return 'Cooling down';
  if(a.energy!==null&&a.energy<=a.cost)return 'Not enough energy';
  return '';
}
// Called on a simulation tick boundary. Failed activation leaves energy, cooldown and world unchanged.
export function activateAbility(s,id) {
  const a=s.actors.find(c=>c.id===id),reason=abilityAvailability(s,a);
  if(reason)return {ok:false,reason};
  const spec=ABILITIES[a.id];
  let affected, target, d;
  switch(a.id){
    case 'Orb': case 'Hex': case 'Sentinel':
      affected=targets(s,a,spec.range);if(!affected.length)return {ok:false,reason:'No opponent in range'};break;
    case 'Prism': case 'Wanderer':
      target=phaseTarget(s,a);if(!target)return {ok:false,reason:'Face a single wall with an open corridor beyond'};break;
    case 'Interceptor':
      target=lockdownTarget(s,a);if(!target)return {ok:false,reason:'No safe corridor to block'};break;
    case 'Warden':
      affected=s.pickups.filter(p=>p.active&&inRange(s,a,p,spec.range));if(!affected.length)return {ok:false,reason:'No energy in range'};break;
    case 'Stalker': {
      d=centered(a)?validDir(a):a.dir;
      if(!cardinal(d))return {ok:false,reason:'Choose a direction'};
      const p=anchor(a);
      if(centered(a)&&(!isOpen(s.board,p.x+d[0],p.y+d[1])||s.portal&&same({x:p.x+d[0],y:p.y+d[1]},s.portal)))return {ok:false,reason:'No clear corridor'};
      break;
    }
  }
  a.readyAt=s.tick+ticks(spec.cooldown);if(a.energy!==null)a.energy-=a.cost;
  switch(a.id){
    case 'Orb': for(const h of affected){pushHunter(s,a,h,spec.push);h.stunUntil=s.tick+ticks(spec.stun);}event(s,a,'repulse',{range:spec.range});break;
    case 'Prism': case 'Wanderer': {
      const from=point(a);Object.assign(a,{x:target.x,y:target.y,dir:[...target.d],wanted:[...target.d]});a.warp++;
      event(s,a,'phase',{from});break;
    }
    case 'Ember': a.surgeUntil=s.tick+ticks(spec.duration);event(s,a,'surge');break;
    case 'Rune': a.barrierUntil=s.tick+ticks(spec.duration);event(s,a,'barrier');break;
    case 'Nova': {
      // Identical silhouette, glow and movement. No pickups or true Wisp state.
      s.decoys.push({id:'echo:'+a.id,owner:a.id,character:a.id,...point(a),dir:[...a.dir],wanted:a.wanted&&[...a.wanted],energy:a.energy,until:s.tick+ticks(spec.duration),lastTurn:null});
      event(s,a,'echo');break;
    }
    case 'Hex': for(const h of affected)h.slowUntil=s.tick+ticks(spec.duration);event(s,a,'stasis',{range:spec.range});break;
    case 'Stalker': a.lunge={dir:[...d],chargeUntil:s.tick+ticks(spec.charge),until:s.tick+ticks(spec.charge+spec.duration)};event(s,a,'lunge');break;
    case 'Interceptor': s.blocks.push({...target,owner:a.id,until:s.tick+ticks(spec.duration)});event(s,a,'lockdown',{target});break;
    case 'Warden': for(const p of affected){event(s,a,'devour',{from:point(p)});p.active=false;p.readyAt=s.tick+ticks(RULES.pickupRespawn);}break;
    case 'Leech': a.drainUntil=s.tick+ticks(spec.duration);event(s,a,'drain',{range:spec.range});break;
    case 'Sentinel': for(const w of affected)w.silenceUntil=s.tick+ticks(spec.duration);event(s,a,'silence',{range:spec.range});break;
  }
  return {ok:true,reason:''};
}
export function expireAbilities(s) {
  s.blocks=blockedCells(s);s.decoys=s.decoys.filter(d=>s.tick<d.until);s.effects=s.effects.filter(e=>s.tick<e.until);
  for(const a of s.actors)if(a.lunge&&s.tick>=a.lunge.until)a.lunge=null;
}
export function moveActor(s,a,amount) {
  if(s.tick<a.stunUntil)return;
  const hunter=a.faction==='hunter',portal=hunter?portalCell(s):null,blocks=hunter?[]:s.blocks;
  let multiplier=(s.tick<a.surgeUntil?ABILITIES.Ember.multiplier:1)*(s.tick<a.slowUntil?ABILITIES.Hex.multiplier:1);
  if(a.lunge){
    if(s.tick<a.lunge.chargeUntil)return;
    const wanted=a.wanted; a.dir=[...a.lunge.dir];a.wanted=[...a.lunge.dir];
    advance(a,s.board,amount*multiplier*ABILITIES.Stalker.multiplier,portal,blocks);
    a.wanted=wanted;if(!cardinal(a.dir))a.lunge=null;
  }else advance(a,s.board,amount*multiplier,portal,blocks);
}
export function moveDecoys(s,amount) {
  for(const d of s.decoys){
    const [dx,dy]=d.dir, x=centered(d)?Math.round(d.x):dx>0?Math.ceil(d.x):dx<0?Math.floor(d.x):Math.round(d.x), y=centered(d)?Math.round(d.y):dy>0?Math.ceil(d.y):dy<0?Math.floor(d.y):Math.round(d.y);
    if(Math.abs(x-d.x)+Math.abs(y-d.y)<=amount+1e-8&&d.lastTurn!==`${x},${y}`){
      const options=DIRS.filter(([u,v])=>isOpen(s.board,x+u,y+v)&&!blockedAt(s,x+u,y+v)&&!(s.portal&&same({x:x+u,y:y+v},s.portal)));
      const turns=options.filter(([u,v])=>u!==-dx||v!==-dy).filter(([u,v])=>u!==dx||v!==dy);
      const choices=turns.length?turns:options.filter(([u,v])=>u===dx&&v===dy);
      if(choices.length||options.length)d.wanted=[...(choices[0]??options[0])];d.lastTurn=`${x},${y}`;
    }
    advance(d,s.board,amount,portalCell(s),s.blocks);
    d.energy=Math.max(0,d.energy-RULES.drain*STEP/4);
  }
}
export function drainTargets(s,a){return active(a)&&s.tick<a.drainUntil&&s.tick>=a.stunUntil?targets(s,a,ABILITIES.Leech.range):[];}
export function applyDrain(s,eliminate){
  const h=s.actors.find(a=>a.id==='Leech');if(!h)return;
  for(const w of drainTargets(s,h)){w.energy=Math.max(0,w.energy-ABILITIES.Leech.drain*STEP);if(w.energy<1e-8){w.energy=0;eliminate(w,'eliminated','Leech drain');}}
}
