import test from 'node:test';
import assert from 'node:assert/strict';
import {maze,spawnCells,distances,degree,openCells,isOpen,DIRS} from '../../../../public/games/wisp/core/maze.mjs';
import {createRound,step,setDirection,secondsLeft} from '../../../../public/games/wisp/core/simulation.mjs';
import {advance} from '../../../../public/games/wisp/core/movement.mjs';
import {RULES,HZ,STEP} from '../../../../public/games/wisp/core/config.mjs';
const run=(s,n)=>{for(let i=0;i<n;i++)step(s);return s;};
const actor=(s,id)=>s.actors.find(a=>a.id===id);
const near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function round(tutorial=false){return createRound({seed:42,tutorial,humans:[{id:'p',character:'Orb'},{id:'h',character:'Wanderer'}]});}
function ready(){return run(round(),RULES.prepare*HZ);}
function isolate(s){for(const a of s.actors)if(a.faction==='wisp'&&a.id!=='Orb')a.status='eliminated';}
function stationary(a,x,y){Object.assign(a,{x,y,dir:[0,0],wanted:null});}
function clearPickups(s){s.pickups=[];}
const corridor=[[1,1,1,1,1],[1,0,0,0,1],[1,1,0,1,1],[1,1,0,1,1],[1,1,1,1,1]];
test('2000 generated maps have safe, distinct spawn cells and no dead ends',()=>{
  for(let seed=0;seed<1000;seed++)for(const tutorial of [false,true]){
    const b=maze(seed,tutorial),p=spawnCells(b,seed);
    assert.equal(new Set(p.map(String)).size,8);
    assert.ok(openCells(b).every(([x,y])=>degree(b,x,y)>=2));
    for(const a of p.slice(0,4)){
      const d=distances(b,a);for(const [x,y] of p.slice(4))assert.ok(d[y][x]>=12);
    }
  }
});
test('buffered corner consumes remaining distance; reversal is immediate; wall stops at center',()=>{
  const a={x:1,y:1,dir:[0,0],wanted:[1,0]};advance(a,corridor,.6);assert.equal(a.x,1.6);
  a.wanted=[0,1];advance(a,corridor,.8);assert.ok(Math.abs(a.x-2)<1e-8&&Math.abs(a.y-1.4)<1e-8);
  a.wanted=[0,-1];advance(a,corridor,.2);assert.ok(Math.abs(a.y-1.2)<1e-8);
  advance(a,corridor,3);assert.deepEqual([a.x,a.y,a.dir],[2,1,[0,0]]);
});
test('preparation freezes motion and energy; energy has no effect on speed',()=>{
  const s=round(),a=actor(s,'Orb');const p=[a.x,a.y],d=DIRS.find(([x,y])=>isOpen(s.board,a.x+x,a.y+y));
  assert.equal(setDirection(s,'Orb',d),true);assert.equal(setDirection(s,'Orb',[1,1]),false);
  run(s,59);assert.deepEqual([a.x,a.y,a.energy],[...p,100]);step(s);assert.equal(s.phase,'survive');
  clearPickups(s);a.energy=30;step(s);assert.ok(Math.abs(Math.hypot(a.x-p[0],a.y-p[1])-RULES.speed*STEP)<1e-8);assert.ok(Math.abs(a.energy-29.9)<1e-8);
});
test('deterministic simulation and serializable state',()=>{
  const a=round(),b=JSON.parse(JSON.stringify(a));
  for(let i=0;i<1200;i++){
    if(i%13===0)for(const c of a.actors){const d=DIRS[(i+c.id.length)%4];setDirection(a,c.id,d);setDirection(b,c.id,d);}
    step(a);step(b);
    if(i%100===0)assert.deepEqual(a,b);
  }
  assert.deepEqual(a,b);
});
test('pickups are shared, full energy cannot consume, cap and delayed respawn',()=>{
  const s=ready(),a=actor(s,'Orb');s.pickups=[{id:0,x:a.x,y:a.y,value:30,active:true,readyAt:0}];
  step(s);assert.equal(s.pickups[0].active,true);a.energy=90;step(s);
  assert.ok(Math.abs(a.energy-99.9)<1e-8);const p=s.pickups[0],old=[p.x,p.y];assert.equal(p.active,false);
  run(s,RULES.pickupRespawn*HZ-1);assert.equal(p.active,false);step(s);assert.equal(p.active,true);assert.notDeepEqual([p.x,p.y],old);
  assert.ok(s.actors.filter(a=>a.status==='active').every(a=>near(a,p)>.8));
});
test('nonlethal hit grants immunity and recovery; sustained overlap cannot repeat damage',()=>{
  const s=ready(),w=actor(s,'Orb'),h=actor(s,'Wanderer');clearPickups(s);const start=[h.x,h.y];stationary(h,w.x,w.y);step(s);
  assert.ok(Math.abs(w.energy-84.9)<1e-8);assert.equal(w.immuneUntil,s.tick+2*HZ);assert.equal(h.recoverUntil,s.tick+HZ);
  run(s,3*HZ);assert.ok(Math.abs(w.energy-78.9)<1e-7);stationary(h,...start);step(s);stationary(h,w.x,w.y);step(s);
  assert.ok(Math.abs(w.energy-63.7)<1e-7);
});
test('head-on crossing registers contact; Stalker contact is lethal',()=>{
  const s=createRound({seed:7,humans:[{id:'p',character:'Orb'},{id:'h',character:'Stalker'}]});run(s,60);clearPickups(s);
  const w=actor(s,'Orb'),h=actor(s,'Stalker'),[x,y]=openCells(s.board).find(([x,y])=>isOpen(s.board,x+1,y));
  stationary(w,x,y);stationary(h,x+1,y);setDirection(s,w.id,[1,0]);setDirection(s,h.id,[-1,0]);run(s,3);
  assert.equal(w.status,'eliminated');assert.equal(w.energy,0);assert.equal(w.reason,'Stalker');
});
test('zero energy eliminates; no early portal if all wisps die; result immutable',()=>{
  const s=ready();isolate(s);clearPickups(s);const a=actor(s,'Orb');a.energy=.1;step(s);
  assert.equal(a.status,'eliminated');assert.equal(a.reason,'energy');assert.equal(s.phase,'finished');assert.deepEqual(s.result,{escaped:0,eliminated:4});
  const t=s.tick;run(s,100);assert.equal(s.tick,t);assert.equal(setDirection(s,'Orb',[1,0]),false);
});
test('portal appears after 45 seconds, has sufficient traversal time, escape beats contact',()=>{
  const s=ready();clearPickups(s);run(s,45*HZ-1);assert.equal(s.portal,null);step(s);
  assert.equal(s.phase,'escape');assert.ok(secondsLeft(s)>=20);const p=s.portal;
  assert.ok(degree(s.board,p.x,p.y)>=2);assert.ok(s.actors.every(a=>near(a,p)>1.1));
  const d=distances(s.board,[p.x,p.y]);assert.ok((p.closeAt-s.tick)/HZ>=Math.max(...d.flat().filter(Number.isFinite))/RULES.speed+3);
  isolate(s);const w=actor(s,'Orb');stationary(w,p.x,p.y);stationary(actor(s,'Wanderer'),p.x,p.y);step(s);
  assert.equal(w.status,'escaped');assert.deepEqual(s.result,{escaped:1,eliminated:3});
});
test('hunters cannot enter active portal, timeout resolves remaining wisps',()=>{
  const s=ready();clearPickups(s);run(s,45*HZ);const p=s.portal;
  const [dx,dy]=DIRS.find(([dx,dy])=>isOpen(s.board,p.x-dx,p.y-dy));const h=actor(s,'Wanderer');stationary(h,p.x-dx,p.y-dy);
  setDirection(s,h.id,[dx,dy]);run(s,8);assert.deepEqual([h.x,h.y],[p.x-dx,p.y-dy]);
  isolate(s);const w=actor(s,'Orb');w.energy=100;s.tick=p.closeAt-1;step(s);
  assert.equal(w.reason,'timeout');assert.equal(s.phase,'finished');assert.deepEqual(s.result,{escaped:0,eliminated:4});
});
