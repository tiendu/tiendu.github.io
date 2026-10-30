import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {join} from 'node:path';
import WebSocket from 'ws';
import {startServer} from '../src/node-server.mjs';
const origin='http://localhost:4321';
const base=app=>`http://127.0.0.1:${app.server.address().port}`;
async function connect(app,code,token,name='Player') {
 const ws=new WebSocket(base(app).replace('http','ws')+'/rooms/'+code,{origin});
 const state=await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(new Error('No state received')),3000);
  ws.on('error',reject);
  ws.on('open',()=>ws.send(JSON.stringify({type:'join',token,name})));
  ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='state'){clearTimeout(timeout);resolve(m);}});
 });
 return {ws,state};
}
test('SQLite preserves game state, tokens and the global cap across restart',{timeout:10000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'number-node-'));
 const options={port:0,database:join(dir,'game.sqlite'),origins:origin,maxRooms:2};
 let app=await startServer(options);
 try {
  const requests=await Promise.all(Array.from({length:8},()=>fetch(base(app)+'/rooms',{method:'POST',headers:{Origin:origin}})));
  assert.equal(requests.filter(r=>r.status===200).length,2);assert.equal(requests.filter(r=>r.status===503).length,6);
  const {room,token}=await requests.find(r=>r.status===200).json();
  const host=await connect(app,room,token,'Tien');const id=host.state.player;
  const guest=await connect(app,room,undefined,'Guest');
  const action=async(type,value,revision)=>{
    await delay(120);
    const received=new Promise(resolve=>{const handler=raw=>{const s=JSON.parse(raw);if(s.type==='state' && s.revision>revision){host.ws.off('message',handler);resolve(s);}};host.ws.on('message',handler);});
    host.ws.send(JSON.stringify({type,value,revision}));return received;
  };
  const started=await action('start',undefined,guest.state.revision);
  const played=await action('guess',50,started.revision);
  host.ws.close();guest.ws.close();await app.close();app=await startServer(options);
  const restored=await connect(app,room,token,'Tien');
  assert.equal(restored.state.round,played.round);assert.equal(restored.state.guesses,1);
  assert.equal(restored.state.high,played.high);assert.equal(restored.state.low,played.low);
  assert.equal(restored.state.player,id);assert.equal(restored.state.players.find(p=>p.id===id).name,'Tien');
  assert.equal((await fetch(base(app)+'/rooms',{method:'POST',headers:{Origin:origin}})).status,503);
  assert.equal((await fetch(base(app)+'/rooms',{method:'POST',headers:{Origin:'https://untrusted.example'}})).status,403);
  restored.ws.close();
 } finally {await app.close();await rm(dir,{recursive:true,force:true});}
});
