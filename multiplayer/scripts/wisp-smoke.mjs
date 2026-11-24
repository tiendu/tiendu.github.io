// Run with a LOCAL Wrangler instance. Creates a real room and uses two real
// WebSockets, including forced transport loss and session-token reconnection.
import assert from 'node:assert/strict';
import WebSocket from 'ws';
const base=new URL(process.argv[2]??'http://127.0.0.1:8787');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(base.hostname),'Smoke test is restricted to local workers');
const origin='http://localhost:4321';
const health=await fetch(new URL('/v2/health',base));assert.equal((await health.json()).protocol,2);
const created=await fetch(new URL('/v2/rooms',base),{method:'POST',headers:{Origin:origin}});assert.equal(created.status,201);
const {code,token}=await created.json();
const address=new URL(`/v2/rooms/${code}/socket`,base);address.protocol=base.protocol==='https:'?'wss:':'ws:';
const clients=[];
function open(character,session){
  const ws=new WebSocket(address,{origin});clients.push(ws);
  const messages=[],waiters=new Set();let closed=false;
  ws.on('error',()=>{});
  ws.on('message',data=>{const msg=JSON.parse(data);messages.push(msg);if(messages.length>256)messages.shift();for(const w of waiters)w();});
  ws.on('close',()=>{closed=true;for(const w of waiters)w();});
  function wait(predicate,timeout=10000){return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{waiters.delete(check);reject(new Error('Timed out waiting for socket message'));},timeout);
    function check(){const found=messages.find(predicate);if(found||closed){clearTimeout(timer);waiters.delete(check);found?resolve(found):reject(new Error('Socket closed before expected message'));}}
    waiters.add(check);check();
  });}
  const send=msg=>ws.send(JSON.stringify(msg));
  ws.once('open',()=>send({type:'hello',protocol:2,character,token:session}));
  return {ws,wait,send};
}
try{
  const host=open('Orb',token),a=await host.wait(m=>m.type==='welcome');
  const guest=open('Leech'),b=await guest.wait(m=>m.type==='welcome');
  await host.wait(m=>m.type==='lobby'&&m.players.length===2);
  host.send({type:'start'});
  const first=await host.wait(m=>m.type==='snapshot'&&m.phase==='survive');
  const p=first.actors.find(a=>a.player==='local');assert.equal(p.id,'Orb');assert.equal(first.actors.length,8);
  const same=await guest.wait(m=>m.type==='snapshot'&&m.seed===first.seed);assert.deepEqual(same.board,first.board);
  host.send({type:'input',seq:a.seq+1,direction:[1,0],x:99999,y:99999});
  const moved=await host.wait(m=>m.type==='snapshot'&&m.ack===a.seq+1&&m.tick>first.tick);assert.ok(moved.actors.every(a=>a.x<13&&a.y<19));
  guest.ws.terminate();await host.wait(m=>m.type==='lobby'&&m.players.some(p=>p.id===b.id&&!p.connected));
  const again=open('Leech',b.token),resumed=await again.wait(m=>m.type==='welcome');assert.equal(resumed.id,b.id);
  const resumedState=await again.wait(m=>m.type==='snapshot');assert.equal(resumedState.seed,first.seed);assert.ok(resumedState.tick>=first.tick);
  again.send({type:'leave'});host.send({type:'leave'});
  console.log('WISP live WebSocket smoke passed: create/join/start, shared maze, input acknowledgement, disconnect and reconnect.');
}finally{for(const ws of clients){if(ws.readyState===WebSocket.OPEN)ws.close();else if(ws.readyState===WebSocket.CONNECTING)ws.terminate();}}
