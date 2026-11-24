import {HZ, STEP, RULES} from './config.mjs';
import {maze, openCells, degree, distances, spawnCells} from './maze.mjs';
import {teams} from './roster.mjs';
import {advance, cardinal} from './movement.mjs';
const near = (a,b,r) => (a.x-b.x)**2+(a.y-b.y)**2<=r*r;
const active = a => a.status==='active';
const ticks = seconds => Math.ceil(seconds*HZ);
const point = ([x,y]) => ({x,y});
const sameCell = (a,b) => a.x===b.x && a.y===b.y;
function random(s) {
  s.random=(Math.imul(s.random,1664525)+1013904223)>>>0;
  return s.random/4294967296;
}
function spawnPickup(s,p) {
  const old=p.x===undefined ? null : p;
  const options=s.cells.filter(c => (!old||!sameCell(c,old)) &&
    !s.actors.some(a=>active(a)&&near(a,c,.8)) &&
    !s.pickups.some(q=>q!==p&&q.active&&sameCell(q,c)) &&
    !(s.portal&&sameCell(c,s.portal)));
  if (!options.length) return;
  const c=options[Math.floor(random(s)*options.length)];
  const roll=random(s);
  Object.assign(p,c,{value:RULES.pickupValues[roll<.72?0:roll<.94?1:2],active:true,readyAt:0});
}
export function createRound({seed=0, tutorial=false, humans=[]}={}) {
  const board=maze(seed,tutorial), spawns=spawnCells(board,seed^0x91c119);
  const s={seed:seed>>>0, tutorial, board, cells:openCells(board).map(point), random:(seed^0xcafe1234)>>>0,
    tick:0, phase:'prepare', portal:null, result:null, contacts:[], pickups:[],
    actors:teams(humans,seed,tutorial).map((c,i)=>({...c,...point(spawns[i]),dir:[0,0],wanted:null,
      energy:c.faction==='wisp'?RULES.energy:null,status:'active',immuneUntil:0,recoverUntil:0,reason:null}))};
  for(let i=0;i<(tutorial?RULES.tutorialPickups:RULES.pickupCount);i++) {
    const p={id:i,active:false,readyAt:0}; s.pickups.push(p); spawnPickup(s,p);
  }
  return s;
}
// All callers send intent, not coordinates. No DOM, wall clock or Math.random.
export function setDirection(s,id,d) {
  const a=s.actors.find(c=>c.id===id);
  if (s.phase==='finished'||!a||!active(a)||!cardinal(d)) return false;
  a.wanted=[...d]; return true;
}
function resolveWisp(a,status,reason) { a.status=status; a.reason=reason; a.dir=[0,0]; a.wanted=null; }
function revealPortal(s) {
  const hunters=s.actors.filter(a=>a.faction==='hunter');
  const maps=hunters.map(a=>distances(s.board,[Math.round(a.x),Math.round(a.y)]));
  const options=s.cells.filter(c=>degree(s.board,c.x,c.y)>=2 && !s.actors.some(a=>active(a)&&near(a,c,1.1)))
    .map(c=>({c,d:Math.min(...maps.map(m=>m[c.y][c.x]))}));
  const safe=options.filter(o=>o.d>=4);
  const pool=safe.length?safe:options.sort((a,b)=>b.d-a.d).slice(0,1);
  const {c}=pool[Math.floor(random(s)*pool.length)];
  const max=Math.max(...distances(s.board,[c.x,c.y]).flat().filter(Number.isFinite));
  s.portal={...c,closeAt:s.tick+ticks(Math.max(RULES.escape,max/RULES.speed+3))};
  for (const p of s.pickups) if (p.active&&sameCell(p,c)) { p.active=false; p.readyAt=s.tick+ticks(RULES.pickupRespawn); }
  s.phase='escape';
}
function resolveContacts(s) {
  const contacts=[];
  for(const w of s.actors.filter(a=>a.faction==='wisp'&&active(a))) {
    for(const h of s.actors.filter(a=>a.faction==='hunter'&&active(a))) {
      if(!active(w)||!near(w,h,RULES.contactRadius)) continue;
      const key=w.id+':'+h.id; contacts.push(key);
      if(s.contacts.includes(key)||s.tick<w.immuneUntil||s.tick<h.recoverUntil) continue;
      w.energy=Math.max(0,w.energy-h.damage);
      h.recoverUntil=s.tick+ticks(RULES.recovery[h.id]);
      if(w.energy===0) resolveWisp(w,'eliminated',h.id);
      else w.immuneUntil=s.tick+ticks(RULES.immunity);
    }
  }
  s.contacts=contacts;
}
function finish(s) {
  const wisps=s.actors.filter(a=>a.faction==='wisp');
  if(wisps.some(active)) return;
  const escaped=wisps.filter(a=>a.status==='escaped').length;
  s.result={escaped,eliminated:4-escaped}; s.phase='finished';
}
export function step(s) {
  if(s.phase==='finished') return s;
  s.tick++;
  if(s.phase==='prepare') {
    if(s.tick>=ticks(RULES.prepare)) s.phase='survive';
    return s;
  }
  if(s.phase==='survive'&&s.tick>=ticks(RULES.prepare+RULES.reveal)) revealPortal(s);
  for(const p of s.pickups) if(!p.active&&s.tick>=p.readyAt) spawnPickup(s,p);
  // Two movement substeps prevent crossing actors without contact at base speed.
  for(let i=0;i<2;i++) {
    for(const a of s.actors) if(active(a)) advance(a,s.board,RULES.speed*STEP/2,a.faction==='hunter'&&s.portal?[s.portal.x,s.portal.y]:null);
    for(const w of s.actors.filter(a=>a.faction==='wisp'&&active(a))) {
      // Escape takes precedence over contact at the portal itself.
      if(s.portal&&near(w,s.portal,RULES.pickupRadius)) { resolveWisp(w,'escaped','portal'); continue; }
      for(const p of s.pickups) if(p.active&&w.energy<RULES.energy&&near(w,p,RULES.pickupRadius)) {
        w.energy=Math.min(RULES.energy,w.energy+p.value); p.active=false; p.readyAt=s.tick+ticks(RULES.pickupRespawn);
      }
    }
    resolveContacts(s);
  }
  for(const w of s.actors.filter(a=>a.faction==='wisp'&&active(a))) {
    w.energy=Math.max(0,w.energy-RULES.drain*STEP);
    if(w.energy<1e-8) { w.energy=0; resolveWisp(w,'eliminated','energy'); }
    else if(s.portal&&s.tick>=s.portal.closeAt) resolveWisp(w,'eliminated','timeout');
  }
  finish(s); return s;
}
export function secondsLeft(s) {
  const deadline=s.phase==='prepare'?ticks(RULES.prepare):s.phase==='survive'?ticks(RULES.prepare+RULES.reveal):s.portal?.closeAt??s.tick;
  return s.phase==='finished'?0:Math.max(0,Math.ceil((deadline-s.tick)/HZ));
}
