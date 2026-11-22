import test from 'node:test';
import assert from 'node:assert/strict';
import { WispRegistry } from '../server/room-core.mjs';
function setup(){
  let clock=1_800_000_000_000, n=0, rand=0;
  const registry=new WispRegistry({now:()=>clock,random:()=>{rand=(rand+.271)%1;return rand;},
    token:()=>`aaaaaaaa-bbbb-4ccc-8ddd-${String(++n).padStart(12,'0')}`});
  return {r:registry,now:()=>clock,tick:ms=>clock+=ms};
}
test('lobby admission, authorization, host start and shared seed',()=>{
  const {r}=setup();const host=r.create({name:'Moss & friends',wisp:'Moss'});
  const code=host.snapshot.code;assert.match(code,/^\d{6}$/);
  assert.throws(()=>r.start({code,token:host.token}),/two wisps/);
  assert.throws(()=>r.state({code,token:'wrong'}),/Invalid room session/);
  const guest=r.join({code,name:'Ember',wisp:'Ember'});
  assert.throws(()=>r.start({code,token:guest.token}),/host/);
  const started=r.start({code,token:host.token});
  assert.equal(started.state,'running');assert.equal(started.players.length,2);
  assert.ok(Number.isInteger(started.seed));
  assert.equal(r.state({code,token:guest.token}).seed,started.seed);
  assert.throws(()=>r.join({code,name:'Late',wisp:'Dew'}),/already started/);
});
test('room limit and illegal character rejected',()=>{
  const {r}=setup();
  assert.throws(()=>r.create({name:'X',wisp:'Ghost'}),/five wisps/);
  const a=r.create({name:'A',wisp:'Moss'}),code=a.snapshot.code;
  for(let i=0;i<3;i++)r.join({code,name:String(i),wisp:'Dew'});
  assert.throws(()=>r.join({code,name:'Too many',wisp:'Gale'}),/full/);
});
test('sequence, speed cap, energy zero, elimination and winner',()=>{
  const {r,tick}=setup();
  const h=r.create({name:'Moss',wisp:'Moss'}),code=h.snapshot.code;
  const g=r.join({code,name:'Gale',wisp:'Gale'});r.start({code,token:h.token});tick(3100);
  let s=r.sync({code,token:h.token,sequence:0,x:999999,y:380,energy:0});
  assert.ok(s.players[0].x<1000,'speed cap prevents teleport');
  assert.equal(s.players[0].energy,0);assert.equal(s.players[0].alive,true,'zero energy not fatal');
  let oldx=s.players[0].x;
  s=r.sync({code,token:h.token,sequence:0,x:999999,y:380,energy:0});
  assert.equal(s.players[0].x,oldx,'old sequence ignored');
  tick(250);
  s=r.sync({code,token:h.token,sequence:1,x:oldx+63,y:350,energy:0});
  assert.ok(s.players[0].x>oldx);
  s=r.sync({code,token:g.token,sequence:1,x:200,y:380,energy:60,eliminated:true,reason:'Cutter'});
  assert.equal(s.state,'finished');assert.equal(s.winnerId,s.players[0].id);
});
test('disconnect timeout is elimination, expired rooms pruned',()=>{
  const {r,tick}=setup();
  const h=r.create({name:'A',wisp:'Moss'}),code=h.snapshot.code;
  const g=r.join({code,name:'B',wisp:'Gale'});r.start({code,token:h.token});tick(4000);
  r.sync({code,token:h.token,sequence:0,x:200,y:380,energy:100});
  tick(36_000);
  r.state({code,token:h.token});
  const room=r.rooms.get(code);
  assert.equal(room.state,'finished'); // Both offline long enough; highest distance takes it.
  assert.equal(room.winnerId,room.players[0].id);
  tick(46*60_000);r.prune();assert.equal(r.rooms.size,0);
});
