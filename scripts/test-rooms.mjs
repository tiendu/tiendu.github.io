import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomRegistry } from '../server/unfold/rooms.mjs';
import { newGame, canReclaim, occupied, legalPlacements, canPlace } from '../public/games/unfold/engine.mjs';

function fixture(){let now=10000,counter=0;const rooms=new RoomRegistry({clock:()=>now,randomCode:()=>String(++counter).padStart(6,'0'),seed:()=>1234+counter});return {rooms,setNow:n=>now=n,now:()=>now};}
function start(){const t=fixture(),host=t.rooms.create({name:'Alice',mode:'competitive'}),guest=t.rooms.join({code:host.code,name:'Bob'});t.rooms.start({code:host.code,token:host.token});return {...t,host,guest};}

test('new multiplayer maps contain neutral six-plate modules, crates and permanent scrap',()=>{
  for(const mode of ['coop','competitive'])for(const count of [2,3,4]){
    const s=newGame({mode,count,seed:41414});
    assert(s.cubes.length>=1,`${mode}/${count} neutral cubes`);
    assert(s.cubes.every(c=>c.owner===null&&c.cells.length===6));
    assert(s.obstacles.some(o=>o.type==='rubble'));
    assert(s.obstacles.some(o=>o.type==='permanent'));
    assert.deepEqual(newGame({mode,count,seed:41414}),s);
    const cells=occupied(s);assert.equal(cells.size,s.players.length+(s.goal?1:0)+s.cubes.length*6+s.obstacles.length);
    for(const p of s.players){
      const openings=Array.from({length:11},(_,n)=>[false,true].some(flip=>[0,1,2,3].some(rot=>legalPlacements(s,p.id,n,rot,flip).length>0)));
      assert(openings.filter(Boolean).length>=9,`${mode}/${count} player ${p.id} should have fair start`);
    }
  }
});
test('Competitive can remove adjacent crates but not permanent scrap',()=>{
  const s=newGame({mode:'competitive',count:2,seed:24});s.obstacles=[];s.cubes=[];
  const [x,y]=s.players[0].base;
  s.obstacles=[{id:999,type:'rubble',cells:[[x+1,y]]},{id:1000,type:'permanent',cells:[[x-1,y]]}];
  assert(canReclaim(s,0,999));assert(!canReclaim(s,0,1000));
});
test('room creation, joining, state, and reconnect retain the same seat',()=>{
  const {rooms}=fixture();const a=rooms.create({name:'Alice',mode:'coop'}),b=rooms.join({code:a.code,name:'Bob'});
  assert.match(a.code,/^\d{6}$/);assert.notEqual(a.token,b.token);
  assert.deepEqual(rooms.status({code:a.code,token:a.token}).seats.map(s=>s.name),['Alice','Bob']);
  assert.equal(rooms.join({code:a.code,token:b.token}).snapshot.seat,1);
  assert.throws(()=>rooms.status({code:a.code,token:'nonsense'}),/Invalid room session/);
});
test('only host can start with two players and only active seat can act',()=>{
  const {rooms,host,guest}=start();const s=rooms.status({code:host.code,token:host.token});
  assert(s.game&&s.game.players.length===2);
  assert.throws(()=>rooms.action({code:host.code,token:guest.token,turn:1,payload:{}}),/Wait for your turn/);
  assert.throws(()=>rooms.start({code:host.code,token:guest.token}),/Only the host/);
  assert.throws(()=>rooms.join({code:host.code,name:'Charlie'}),/progress/);
});
test('server controls 60-second deadline beginning after public reel completes',()=>{
  const {rooms,setNow,now,host,guest}=start();const state=rooms.status({code:host.code,token:host.token});
  assert.equal(state.deadline-state.revealAt,60_000);
  assert.throws(()=>rooms.pass({code:host.code,token:host.token,turn:1}),/reel has not stopped/);
  setNow(state.revealAt+1);
  assert.throws(()=>rooms.pass({code:host.code,token:guest.token,turn:1}),/Wait for your turn/);
  const after=rooms.pass({code:host.code,token:host.token,turn:1});
  assert.equal(after.game.turn,2);assert.equal(after.game.active,1);
  assert.throws(()=>rooms.pass({code:host.code,token:host.token,turn:1}),/Wait for your turn/);
  setNow(after.deadline+1);
  assert.equal(rooms.status({code:host.code,token:guest.token}).game.turn,3);
});
test('server validates turn/replay and owns the public reel & net',()=>{
  const {rooms,setNow,host}=start();const state=rooms.status({code:host.code,token:host.token});setNow(state.revealAt+1);
  // Supply an illegal move: the client must not dictate game state.
  assert.throws(()=>rooms.action({code:host.code,token:host.token,turn:1,payload:{x:-90,y:-90,netIndex:0}}));
  assert.equal(rooms.status({code:host.code,token:host.token}).game.turn,1);
  assert.throws(()=>rooms.pass({code:host.code,token:host.token,turn:99}),/Stale turn/);
  const next=rooms.pass({code:host.code,token:host.token,turn:1});
  assert.equal(next.game.acted,false);
});
test('host starts NEXT only on completed match',()=>{
  const {rooms,host,guest}=start();
  assert.throws(()=>rooms.next({code:host.code,token:host.token}),/Finish/);
  const r=rooms.requireRoom(host.code),oldLayout=r.game.layoutId;
  r.game.winner={kind:'competitive',players:[0]};
  assert.throws(()=>rooms.next({code:host.code,token:guest.token}),/Only the host/);
  const next=rooms.next({code:host.code,token:host.token});assert.equal(next.round,2);
  assert.equal(next.game.winner,null);assert.equal(next.seats.length,2);
  // The fixture's seed provider returns the same seed for both rounds.
  assert.notEqual(next.game.layoutId,oldLayout);
});
