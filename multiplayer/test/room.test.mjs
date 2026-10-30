// Exercise shared room handlers and the Cloudflare adapter with runtime doubles.
// test:integration separately checks real workerd/WebSocket transport in CI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {RoomSession as NumberRoom} from '../src/room-service.mjs';
const file = new URL('../src/index.mjs',import.meta.url);
const rules = new URL('../src/rules.mjs',import.meta.url).href;
const source=(await readFile(file,'utf8'))
 .replace('import { DurableObject } from "cloudflare:workers";', 'class DurableObject { constructor(ctx) { this.ctx = ctx; } }')
 .replace('"./rules.mjs"',JSON.stringify(rules))
 .replace('"./room-service.mjs"',JSON.stringify(new URL('../src/room-service.mjs',import.meta.url).href))
 .replace('"./admission.mjs"',JSON.stringify(new URL('../src/admission.mjs',import.meta.url).href));
const {RoomLobby,NumberRoom:CloudflareRoom,default:worker}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
class Socket {
  readyState=1; sent=[]; attachment=null;
  setAttachment(v){this.attachment=structuredClone(v);}
  getAttachment(){return structuredClone(this.attachment);}
  send(text){this.sent.push(JSON.parse(text));}
  close(code){this.code=code;this.readyState=3;}
}
function context(data=new Map(),sockets=[]) {
  let pending=Promise.resolve();
  const ctx={storage:{get:async k=>structuredClone(data.get(k)),put:async(k,v)=>data.set(k,structuredClone(v)),setAlarm:async()=>{},deleteAll:async()=>data.clear()},
    sockets:()=>sockets.filter(s=>s.readyState===1), addSocket:s=>sockets.push(s),
    setWebSocketAutoResponse:()=>{}, runExclusive(fn){pending=pending.then(fn);return pending;}, data,socketsList:sockets};
  ctx.load=()=>ctx.storage.get("game");ctx.save=v=>ctx.storage.put("game",v);ctx.remove=()=>ctx.storage.deleteAll();ctx.schedule=()=>{};
  ctx.blockConcurrencyWhile=ctx.runExclusive;return ctx;
}
const oldPair=globalThis.WebSocketRequestResponsePair;
globalThis.WebSocketRequestResponsePair=class {};
const send=async(room,ws,message)=>{
  ws.attachment.last=0;
  await room.webSocketMessage(ws,JSON.stringify(message));
};
const state=ws=>ws.sent.filter(m=>m.type==='state').at(-1);
test('room handlers synchronize a group, restore sockets and persist host transfer',async()=>{
 const ctx=context();const room=new NumberRoom(ctx,{});await ctx.runExclusive(async()=>{});
 const {newRoom}=await import(rules);room.state=newRoom('host');await room.persist();
 const socket=()=>{const s=new Socket();s.setAttachment({player:null,last:0,joinBy:Date.now()+10000});ctx.addSocket(s);return s;};
 const host=socket();await send(room,host,{type:'join',token:'host',name:'Tien'});
 const guests=[];
 for(let i=0;i<19;i++) {const g=socket();await send(room,g,{type:'join',name:'Guest '+i});guests.push(g);}
 const extra=socket();await send(room,extra,{type:'join',name:'Extra'});assert.equal(extra.code,4003);
 await send(room,host,{type:'start',revision:room.state.revision});room.state.target=42;await room.persist();
 assert.equal(state(host).players.length,20);assert.equal('target' in state(host),false);
 const resumed=new NumberRoom(ctx,{});await ctx.runExclusive(async()=>{});
 const token=guests[0].sent.find(m=>m.type==='joined').token;
 const again=socket();await send(resumed,again,{type:'join',token});assert.equal(guests[0].code,4002);
 await resumed.disconnect(guests[0],4002,'Replaced');
 assert.equal(resumed.state.players[1].connected,true);
 await send(resumed,host,{type:'guess',value:42,revision:resumed.state.revision});
 for(const g of [host,again,...guests.slice(1)]) assert.equal(state(g).loserName,'Tien');
 await send(resumed,host,{type:'leave'});assert.equal(resumed.state.players.length,19);
 assert.equal(state(again).host,state(again).player);
 resumed.state.expires=0;await resumed.alarm();assert.equal(ctx.data.size,0);assert.equal(again.code,4004);
});
test('room alarm skips disconnected turns and closes unauthenticated sockets',async()=>{
 const ctx=context();const room=new NumberRoom(ctx,{});await ctx.runExclusive(async()=>{});
 const {newRoom,joinPlayer,move,GRACE}=await import(rules);room.state=newRoom('host');
 joinPlayer(room.state,'host','Host');joinPlayer(room.state,null,'Guest');joinPlayer(room.state,null,'Third');
 move(room.state,room.state.host,{type:'start',revision:room.state.revision});
 room.state.players[0].connected=false;room.state.players[0].away=Date.now()-GRACE;
 const ws=new Socket();ws.setAttachment({player:null,last:0,joinBy:0});ctx.addSocket(ws);
 await room.alarm();assert.equal(ws.code,4001);assert.equal(room.state.turn,room.state.players[1].id);
});
test('malformed and oversized frames are closed',async()=>{
 const ctx=context();const room=new NumberRoom(ctx,{});await ctx.runExclusive(async()=>{});
 const {newRoom}=await import(rules);room.state=newRoom('host');
 for(const raw of ['null','{','x'.repeat(513)]) {
  const ws=new Socket();ws.setAttachment({player:null,last:0,joinBy:Date.now()+10000});
  await room.webSocketMessage(ws,raw);assert.equal(ws.code,4000);
 }
});
function lobbyEnv(cap='2', fail=false) {
  const initialized=[];
  return {MAX_ROOMS:cap, initialized, ROOMS:{getByName:id=>({fetch:async request=>{
    initialized.push({id,...await request.json()});
    return new Response(null,{status:fail?503:200});
  }})}};
}
const createRoom=lobby=>lobby.fetch(new Request('https://lobby/create',{method:'POST'}));
test('global room cap survives concurrent creation and coordinator restart',async()=>{
  const ctx=context();const env=lobbyEnv();const lobby=new RoomLobby(ctx,env);
  const results=await Promise.all(Array.from({length:20},()=>createRoom(lobby)));
  assert.equal(results.filter(r=>r.ok).length,2);
  assert.equal(results.filter(r=>r.status===503).length,18);
  assert.equal(env.initialized.length,2);
  const first=await results[0].json();
  assert.equal((await lobby.fetch(new Request('https://lobby/rooms/'+first.room))).status,200);
  const resumed=new RoomLobby(ctx,env);
  assert.equal((await createRoom(resumed)).status,503);
  assert.equal(env.initialized.length,2);
});
test('expired leases reclaim capacity without waiting for alarms',async()=>{
  const ctx=context();const env=lobbyEnv('1');const lobby=new RoomLobby(ctx,env);
  const first=await (await createRoom(lobby)).json();
  lobby.leases[first.room].expires=Date.now()-1;await lobby.save();
  const resumed=new RoomLobby(ctx,env);
  assert.equal((await createRoom(resumed)).status,200);
  assert.equal((await resumed.fetch(new Request('https://lobby/rooms/'+first.room))).status,410);
  for(const id of Object.keys(resumed.leases)) resumed.leases[id].expires=0;
  await resumed.alarm();assert.deepEqual(ctx.data.get('leases'),{});
});
test('failed initialization retains its reservation; invalid caps fail closed',async()=>{
  const env=lobbyEnv('1',true);const lobby=new RoomLobby(context(),env);
  assert.equal((await createRoom(lobby)).status,503);
  assert.equal((await createRoom(lobby)).status,503);
  assert.equal(env.initialized.length,1);
  for(const cap of ['0','-1','NaN','1.5','1001']) {
    const bad=lobbyEnv(cap);assert.equal((await createRoom(new RoomLobby(context(),bad))).status,503);
    assert.equal(bad.initialized.length,0);
  }
});
test('unknown public room IDs never allocate room objects',async()=>{
  let allocated=false;
  const env={ALLOWED_ORIGINS:'https://tiendu.github.io',CONNECT_LIMIT:{limit:async()=>({success:true})},
    LOBBY:{getByName:()=>({fetch:async()=>new Response(null,{status:410})})},
    ROOMS:{getByName:()=>{allocated=true;throw new Error('unexpected allocation');}}};
  const result=await worker.fetch(new Request('https://worker/rooms/123456',{
    headers:{Origin:'https://tiendu.github.io',Upgrade:'websocket'}
  }),env);
  assert.equal(result.status,410);assert.equal(allocated,false);
});

test('Cloudflare adapter delegates protocol and persistence to the shared room service',async()=>{
 const ctx=context();ctx.getWebSockets=ctx.sockets;ctx.acceptWebSocket=ctx.addSocket;
 const room=new CloudflareRoom(ctx,{});
 await room.fetch(new Request('https://room/init',{method:'POST',body:JSON.stringify({token:'host-token',created:Date.now()})}));
 const ws=new Socket();ws.serializeAttachment=ws.setAttachment;ws.deserializeAttachment=ws.getAttachment;
 ws.setAttachment({player:null,last:0,joinBy:Date.now()+10000});ctx.addSocket(ws);
 await room.webSocketMessage(ws,JSON.stringify({type:'join',token:'host-token',name:'Tien'}));
 assert.equal(state(ws).players[0].name,'Tien');assert.equal(ctx.data.get('game').players[0].connected,true);
 await room.webSocketClose(ws,1000,'Closed');assert.equal(ctx.data.get('game').players[0].connected,false);
});
