import test from 'node:test';
import assert from 'node:assert/strict';
import {newRoom,joinRoom,rosterView,migrateHost,startRound,acceptInput,setConnected,tickMatch,addPing,snapshot} from '../server/room.mjs';
import worker,{WispRooms} from '../server/worker.mjs';
import {hydrateSnapshot,predictLocal,backendURL} from '../../../../public/games/wisp/client/socket.mjs';
import {HZ} from '../../../../public/games/wisp/core/config.mjs';
function fixture(){
  const room=newRoom('123456','creator',Date.now()+3600000);
  const a=joinRoom(room,{token:'creator',character:'Orb'},'a','secret-a');
  const b=joinRoom(room,{character:'Rune'},'b','secret-b');
  const c=joinRoom(room,{character:'Leech'},'c','secret-c');
  const online=new Set(['a','b','c']);const match=startRound(room,online,123);
  return {room,a,b,c,online,match};
}
test('four unique humans maximum, creator token and reconnect validation',()=>{
  const r=newRoom('123456','creator',1000);assert.equal(joinRoom(r,{character:'Orb'},'x','x'),null);
  const a=joinRoom(r,{token:'creator',character:'Orb'},'a','secret-a');assert.equal(r.host,'a');assert.equal(joinRoom(r,{character:'Orb'},'x','x'),null);assert.equal(joinRoom(r,{token:'wrong',character:'Rune'},'x','x'),null);
  assert.equal(joinRoom(r,{token:'secret-a',character:'Stalker'},'x','x'),a);
  for(const [id,character] of [['b','Rune'],['c','Leech'],['d','Hex']])assert.ok(joinRoom(r,{character},id,id+'!'));
  assert.equal(joinRoom(r,{character:'Nova'},'e','e!'),null);assert.equal(startRound(r,new Set(['a']),1),null);
  const m=startRound(r,new Set(['a','b','c','d']),1);assert.equal(m.round.actors.length,8);assert.equal(m.round.actors.filter(a=>a.player).length,4);assert.equal(joinRoom(r,{character:'Nova'},'e','e!'),null);
  assert.doesNotMatch(JSON.stringify(rosterView(r,new Set(['a']))),/secret|creator/);
});
test('server only accepts sequenced intents for owned active characters, ignores arbitrary coordinates',()=>{
  const {match,a,b}=fixture(),actor=match.round.actors.find(v=>v.id==='Orb'),original=[actor.x,actor.y];
  assert.equal(acceptInput(match,a,{seq:1,direction:[1,1]}),false);assert.equal(acceptInput(match,a,{seq:1,ability:'true'}),false);
  assert.ok(acceptInput(match,a,{seq:1,direction:[1,0],x:900,y:900,id:b.character}));assert.equal(acceptInput(match,a,{seq:1,direction:[0,1]}),false);
  assert.ok(acceptInput(match,a,{seq:2,ability:true}));assert.deepEqual(match.pending.get(a.id),{id:'Orb',direction:[1,0],ability:true});
  tickMatch(match);assert.deepEqual([actor.x,actor.y],original);assert.equal(snapshot(match,a).ack,2);assert.equal(match.pending.size,0);
  assert.equal(acceptInput(match,a,{seq:999999,direction:[1,0]}),false);
});
test('host migration, bot takeover, same actor reconnect and late join refusal',()=>{
  const {match,room,a,online}=fixture();online.delete(a.id);migrateHost(room,online);assert.equal(room.host,'b');
  setConnected(match,a,false);const actor=match.round.actors.find(v=>v.id==='Orb');assert.equal(actor.player,null);assert.equal(acceptInput(match,a,{seq:1,direction:[1,0]}),false);
  for(let i=0;i<100;i++)tickMatch(match);assert.ok(match.brain.memory.Orb);
  const pos=[actor.x,actor.y];setConnected(match,a,true);assert.equal(actor.player,a.id);assert.deepEqual([actor.x,actor.y],pos);assert.equal(match.brain.memory.Orb,undefined);
  assert.equal(joinRoom(room,{token:'secret-a',character:'Hex'},'x','x'),a);
});
test('pings are valid cells, rate-limited, team-only and expire in ticks',()=>{
  const {match,a,b,c}=fixture();match.round.phase='survive';const {x,y}=match.round.cells[0];
  assert.equal(addPing(match,a,0,0),false);assert.equal(addPing(match,a,x+.5,y),false);assert.ok(addPing(match,a,x,y));assert.equal(addPing(match,a,x,y),false);
  assert.equal(snapshot(match,a).pings.length,1);assert.equal(snapshot(match,b).pings.length,1);assert.equal(snapshot(match,c).pings.length,0);
  match.round.tick=3*HZ;tickMatch(match);assert.equal(snapshot(match,a).pings.length,0);
});
test('snapshots omit server state, credentials and private opponent readiness; hydrate stable maze and predict without mutation',()=>{
  const {match,a,c}=fixture(),orb=match.round.actors.find(a=>a.id==='Orb');orb.energy=87.6;orb.readyAt=100;
  const wire=snapshot(match,c);assert.equal(wire.actors.find(a=>a.id==='Orb').energy,90);assert.equal('readyAt' in wire.actors.find(a=>a.id==='Orb'),false);
  assert.equal(snapshot(match,a).actors.find(a=>a.id==='Orb').energy,87.6);assert.equal(wire.random,undefined);assert.equal(wire.contacts,undefined);assert.doesNotMatch(JSON.stringify(wire),/secret|creator/);
  const local=hydrateSnapshot(JSON.parse(JSON.stringify(snapshot(match,a))));assert.equal(local.actors.find(a=>a.player==='local').faction,'wisp');
  const newer=hydrateSnapshot(JSON.parse(JSON.stringify(snapshot(match,a))),local);assert.equal(newer.board,local.board);
  local.phase='survive';const before=JSON.stringify(local);predictLocal(local,[1,0],1);assert.equal(JSON.stringify(local),before);
  assert.equal(backendURL('https://example.com'),'https://example.com');assert.equal(backendURL('http://localhost:8787'),'http://localhost:8787');assert.equal(backendURL('http://example.com'),null);assert.equal(backendURL('https://x:y@example.com'),null);
});
test('headless room advances 20 Hz and resolves an authoritative eight-actor match',()=>{
  const {match,a,b,c}=fixture();for(const p of [a,b,c])setConnected(match,p,false);
  for(let i=0;i<2400&&match.round.phase!=='finished';i++)tickMatch(match);
  assert.equal(match.round.phase,'finished');assert.equal(match.round.result.escaped+match.round.result.eliminated,4);
});
test('worker rejects untrusted origins and old protocol paths before reaching room namespace',async()=>{
  const env={WISP_ALLOWED_ORIGINS:'https://tiendu.github.io'};
  const health=await worker.fetch(new Request('https://worker/v2/health'),env);assert.deepEqual(await health.json(),{protocol:2});
  const denied=await worker.fetch(new Request('https://worker/v2/rooms',{method:'POST',headers:{Origin:'https://other.example'}}),env);assert.equal(denied.status,403);
  const old=await worker.fetch(new Request('https://worker/api',{headers:{Origin:'https://tiendu.github.io'}}),env);assert.equal(old.status,404);
  const options=await worker.fetch(new Request('https://worker/v2/rooms',{method:'OPTIONS',headers:{Origin:'https://tiendu.github.io'}}),env);assert.equal(options.status,204);assert.equal(options.headers.get('Access-Control-Allow-Origin'),'https://tiendu.github.io');
});
class FakeSocket{messages=[];attachment=null;closed=false;send(m){this.messages.push(JSON.parse(m));}serializeAttachment(a){this.attachment={...a};}deserializeAttachment(){return this.attachment;}close(){this.closed=true;}}
function fakeContext(initial){const data=new Map(initial?[['maze-v2-room',initial]]:[]);let ready;return {data,storage:{get:async k=>structuredClone(data.get(k)),put:async(k,v)=>data.set(k,structuredClone(v)),setAlarm:async()=>{},deleteAlarm:async()=>{},deleteAll:async()=>data.clear()},getWebSockets:()=>[],blockConcurrencyWhile(fn){ready=fn();return ready;},waitUntil(){},ready:()=>ready};}
test('Durable Object handshake, input authority, reconnect replacement and abort after restart',async()=>{
  const ctx=fakeContext(newRoom('123456','owner',Date.now()+60000)),worker=new WispRooms(ctx,{});await ctx.ready();worker.startTimer=()=>{};
  const attach=()=>{const ws=new FakeSocket();worker.sockets.set(ws,{id:null,opened:Date.now(),window:0,count:0});return ws;};
  const host=attach(),guest=attach();await worker.webSocketMessage(host,JSON.stringify({type:'hello',protocol:2,token:'owner',character:'Orb'}));
  await worker.webSocketMessage(guest,JSON.stringify({type:'hello',protocol:2,character:'Leech'}));
  await worker.webSocketMessage(guest,'{"type":"start"}');assert.equal(worker.match,null);
  await worker.webSocketMessage(host,'{"type":"start"}');assert.equal(worker.room.state,'running');assert.ok(worker.match);
  const welcome=host.messages.find(m=>m.type==='welcome');await worker.webSocketMessage(host,'{"type":"input","seq":1,"direction":[1,0],"x":999}');assert.equal(worker.match.pending.get(welcome.id).id,'Orb');
  const reconnect=attach();await worker.webSocketMessage(reconnect,JSON.stringify({type:'hello',protocol:2,token:welcome.token,character:'Hex'}));assert.ok(host.closed);assert.equal(reconnect.messages.find(m=>m.type==='welcome').character,'Orb');
  await worker.webSocketClose(host);assert.equal(worker.match.round.actors.find(a=>a.id==='Orb').player,welcome.id);
  await worker.webSocketClose(reconnect);assert.equal(worker.match.round.actors.find(a=>a.id==='Orb').player,null);assert.notEqual(worker.room.host,welcome.id);
  const restartCtx=fakeContext(ctx.data.get('maze-v2-room'));const restart=new WispRooms(restartCtx,{});await restartCtx.ready();assert.equal(restart.room.state,'aborted');assert.equal(restart.match,null);
});
test('registry admits five rooms, refuses sixth, and releases a matching lease only',async()=>{
  const ctx=fakeContext(),objects=new Map(),env={};
  env.WISP_ROOMS={idFromName:n=>n,get:n=>({fetch:async(url,init)=>{
    if(!objects.has(n)){const c=fakeContext(),o=new WispRooms(c,env);await c.ready();objects.set(n,o);}
    return objects.get(n).fetch(new Request(url,init));
  }})};
  const registry=new WispRooms(ctx,env);await ctx.ready();objects.set('maze-v2:registry',registry);
  const create=()=>registry.fetch(new Request('https://internal/create',{method:'POST'}));
  const leases=[];
  for(let i=0;i<5;i++){const res=await create();assert.equal(res.status,201);leases.push(await res.json());}
  assert.equal((await create()).status,429);
  const {code}=leases[0];const lookup=await registry.fetch(new Request(`https://internal/lookup/${code}`));const {id}=await lookup.json();
  const release=id=>registry.fetch(new Request('https://internal/release',{method:'POST',body:JSON.stringify({code,id})}));
  await release('incorrect');assert.equal((await create()).status,429);await release(id);
  assert.equal((await registry.fetch(new Request(`https://internal/lookup/${code}`))).status,404);assert.equal((await create()).status,201);
});
