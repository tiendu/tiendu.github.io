import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,advanceWorld,worldSnapshot,authoritativeContacts} from '../server/world.mjs';
import {WispRegistry} from '../server/room-core.mjs';
import {readFileSync} from 'node:fs';
const trio=()=>[
  {id:'moss',x:155,y:380,alive:true,reason:null},
  {id:'ember',x:176,y:345,alive:true,reason:null},
  {id:'gale',x:186,y:380,alive:true,reason:null}
];

test('one room world, one clock: updates never depend on who polled it',()=>{
  const start=1800000000000,seed=12345;
  const a=createWorld(seed,start),b=createWorld(seed,start);
  const p=trio();
  for(const when of [start+3100,start+3400,start+3650,start+4020]){
    advanceWorld(a,p,when);
    advanceWorld(b,p,when);
  }
  assert.deepEqual(worldSnapshot(a,p),worldSnapshot(b,p));
  assert.ok(a.time>0);
  assert.equal(a.cutter.targetId,'moss');
});

test('the same falling obstacle is scheduled for the whole room',()=>{
  const start=1800000000000,world=createWorld(2026,start),p=trio();
  for(let i=2;i<18&&Object.keys(world.hazards).length===0;i++){
    p.forEach((player,index)=>{player.x=i*1040+460+index*22;});
    advanceWorld(world,p,start+3000+i*250);
  }
  const events=Object.values(world.hazards);
  assert.ok(events.length>0,'shared hazard events should be generated');
  assert.ok(events.every(e=>typeof e.phase==='string'));
  const all=worldSnapshot(world,p).hazards;
  assert.ok(all.every(e=>typeof e.id==='string'));
});

test('fire, storm and regrowth are room-wide, not per-character',()=>{
  const start=1800000000000,world=createWorld(2026,start),p=trio();
  p.forEach((v,i)=>v.x=6750+i*50);
  advanceWorld(world,p,start+4500);
  assert.equal(world.fire.active,true);
  assert.ok(['warning','advance'].includes(world.fire.phase));
  let now=start+4500;
  for(let i=0;i<24;i++){now+=5000;advanceWorld(world,p,now);}
  assert.equal(world.fire.active,false);
  assert.equal(world.weather==='rain'||world.weather==='clearing'||world.weather==='clear',true);
  assert.equal(world.milestones.length,1);
  assert.equal(world.completed,1);
});

test('server validates wildfire contact; client cannot hide the fire',()=>{
  const world=createWorld(2026,1000),p=trio();
  world.fire={...world.fire,active:true,phase:'advance',x:160};
  assert.equal(authoritativeContacts(world,p),1);
  assert.equal(p[0].reason,'Wildfire');
  assert.equal(p[1].alive,true);
});

test('room rematch makes a fresh world and server snapshot contains world state',()=>{
  let now=1800000000000,count=0;
  const registry=new WispRegistry({now:()=>now,random:()=>.23,token:()=>`aaaaaaaa-bbbb-4ccc-8ddd-${String(++count).padStart(12,'0')}`});
  const h=registry.create({wisp:'Moss'}),code=h.snapshot.code;
  const guest=registry.join({code,wisp:'Gale'});
  const running=registry.start({code,token:h.token});
  assert.ok(running.world);assert.equal(running.world.time,0);
  now+=3100;
  const state=registry.state({code,token:guest.token});
  assert.ok(state.world.time>=0);
  registry.sync({code,token:guest.token,sequence:0,x:175,y:380,energy:95,eliminated:true});
  const reset=registry.rematch({code,token:h.token});
  assert.equal(reset.world,null);
  assert.equal(registry.start({code,token:h.token}).world.time,0);
});

test('browser only visualizes server-driven threats in online mode',()=>{
  // The local simulation remains in place for solo play, not for shared races.
  // This contract makes accidental reintroduction of duplicate local fires visible.
  const game=readFileSync(new URL('../../../../public/games/wisp/game.js',import.meta.url),'utf8');
  const online=readFileSync(new URL('../../../../public/games/wisp/online.js',import.meta.url),'utf8');
  assert.match(game,/sharedWorld/);
  assert.match(game,/applyOnlineSnapshot/);
  assert.match(online,/WispRemoteMotion/);
  assert.match(online,/WebSocket/);
});
