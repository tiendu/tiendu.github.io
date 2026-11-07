import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {WebSocketServer} from 'ws';
import {RoomSession} from './room-service.mjs';
import {reserveRoom} from './admission.mjs';
import {openFlock} from './chicken/server.mjs';
import {lobby} from './chicken/room.mjs';
import {newRoom} from './rules.mjs';

// One process / one replica. SQLite stores rooms across process restarts.
export async function startServer(options={}) {
  const port=Number(options.port ?? process.env.PORT ?? 8787);
  const host=options.host ?? process.env.HOST ?? '127.0.0.1';
  const filename=options.database ?? process.env.DATABASE_PATH ?? './data/number.sqlite';
  const origins=(options.origins ?? process.env.ALLOWED_ORIGINS ?? 'http://localhost:4321').split(',').map(s=>s.trim());
  const cap=options.maxRooms ?? process.env.MAX_ROOMS ?? 50;
  if(!Number.isInteger(Number(cap)) || Number(cap)<1 || Number(cap)>1000) throw new Error('MAX_ROOMS must be 1–1000');
  if(filename!==':memory:') mkdirSync(dirname(resolve(filename)),{recursive:true});
  const db=new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, expires INTEGER NOT NULL, state TEXT NOT NULL)');
  const lookup=db.prepare('SELECT * FROM rooms WHERE code=? AND expires>?');
  const select=db.prepare('SELECT state FROM rooms WHERE id=?');
  const update=db.prepare('UPDATE rooms SET state=? WHERE id=?');
  const remove=db.prepare('DELETE FROM rooms WHERE id=?');
  const rooms=new Map(),buckets=new Map();let stopping=false;
  const allowed=req=>origins.includes(req.headers.origin);
  const ip=req=>process.env.TRUST_PROXY==='1' ? String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress).split(',').at(-1).trim() : req.socket.remoteAddress;
  const limit=(req,kind,max)=>{
    const now=Date.now(),key=kind+':'+ip(req);let bucket=buckets.get(key);
    if(!bucket || now>=bucket.until) {
      if(buckets.size>=10000 && !bucket) return false;
      bucket={count:0,until:now+60_000};buckets.set(key,bucket);
    }
    return ++bucket.count<=max;
  };
  const session=id=>{
    if(rooms.has(id)) return rooms.get(id);
    let queue=Promise.resolve(),timer;const sockets=new Set();
    const ctx={
      runExclusive(fn){const task=queue.then(fn);queue=task.catch(()=>{});return task;},
      load:()=>{const row=select.get(id);return row?JSON.parse(row.state):null;},
      save:s=>update.run(JSON.stringify(s),id),
      remove:()=>{remove.run(id);clearTimeout(timer);rooms.delete(id);},
      schedule:deadline=>{clearTimeout(timer);if(!stopping)timer=setTimeout(()=>room.alarm().catch(failed),Math.max(1,deadline-Date.now()));},
      sockets:()=>[...sockets].filter(ws=>ws.readyState===1),addSocket:ws=>sockets.add(ws)
    };
    const room=new RoomSession(ctx);
    const value={room,sockets,close:()=>clearTimeout(timer),drain:()=>queue};rooms.set(id,value);return value;
  };
  const failed=error=>{console.error('Room operation failed:',error.message);};
  const server=createServer((req,res)=>{
    req.resume();
    if(!allowed(req)) {res.writeHead(403);res.end('Origin not allowed');return;}
    const headers={'Access-Control-Allow-Origin':req.headers.origin,Vary:'Origin','Cache-Control':'no-store'};
    const reply=(status,body,extra={})=>{res.writeHead(status,{...headers,...extra});res.end(body);};
    if(req.method==='OPTIONS') {reply(204,'',{'Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return;}
    const chicken=req.url==='/chicken/rooms';
    if(req.method!=='POST'||(!chicken && req.url!=='/rooms')) {reply(404,'Not found');return;}
    if(!limit(req,'create',10)) {reply(429,'Too many rooms');return;}
    try {
      // No await within admission: transaction + single event loop make it atomic.
      db.exec('BEGIN IMMEDIATE');
      const leases=Object.fromEntries(db.prepare("SELECT id,code,expires,json_extract(state, '$.game') AS game FROM rooms WHERE expires>?").all(Date.now()).map(r=>[r.code,{id:r.id,expires:r.expires,game:r.game}]));
      const reservation=reserveRoom(leases,cap,Date.now(),chicken?"chicken":"number");
      if(!reservation) {db.exec('ROLLBACK');reply(503,'All rooms are busy',{'Retry-After':'60'});return;}
      const {room,id,token,created}=reservation;
      // Remove expired code collisions; active old sessions still expire by time.
      db.prepare('DELETE FROM rooms WHERE code=? AND expires<=?').run(room,created);
      const state=chicken?{...lobby(token),game:"chicken",expires:leases[room].expires}:newRoom(token,created);
      db.prepare('INSERT INTO rooms VALUES (?,?,?,?)').run(id,room,state.expires,JSON.stringify(state));
      db.exec('COMMIT');if(!chicken)session(id);
      reply(200,JSON.stringify({room,token}),{'Content-Type':'application/json'});
    } catch(error) {try{db.exec('ROLLBACK');}catch{}failed(error);reply(503,'Room creation unavailable');}
  });
  const wss=new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false});
  server.on('upgrade',(req,socket,head)=>{
    const reject=status=>{socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);};
    if(stopping||!allowed(req)) {reject(403);return;}
    if(!limit(req,'connect',120)) {reject(429);return;}
    const chicken=req.url?.startsWith("/chicken/");
    const code=(chicken?req.url.slice(8):req.url)?.match(/^\/rooms\/(\d{6})$/)?.[1];
    const record=code && lookup.get(code,Date.now());
    if(!record) {reject(410);return;}
    if ((JSON.parse(record.state).game==="chicken")!==chicken){reject(404);return;}
    if(chicken){
      let entry=rooms.get(record.id);
      if(!entry){
        const destroy=()=>{entry.close();remove.run(record.id);rooms.delete(record.id);};
        const flock=openFlock(JSON.parse(record.state),s=>update.run(JSON.stringify(s),record.id),destroy);
        const expiry=setTimeout(destroy,Math.max(1,record.expires-Date.now()));
        entry={flock,close:()=>{clearTimeout(expiry);flock.close();},drain:()=>Promise.resolve()};rooms.set(record.id,entry);
      }
      const {flock}=entry;
      wss.handleUpgrade(req,socket,head,ws=>{
        if(!flock.attach(ws)){ws.close(4003,"Room busy");return;}
        ws.on("message",(data,binary)=>flock.receive(ws,binary?null:data.toString()).catch(failed));
        ws.on("close",()=>flock.detach(ws).catch(failed));
        ws.on("error",()=>ws.terminate());
      });return;
    }
    const {room,sockets}=session(record.id);
    wss.handleUpgrade(req,socket,head,ws=>{
      let attachment=null,alive=true;
      const port={get readyState(){return ws.readyState;},
        send:text=>{if(ws.bufferedAmount>65536){ws.terminate();return;}ws.send(text);},
        close:(code,reason)=>ws.close(code,reason),
        getAttachment:()=>attachment,setAttachment:value=>{attachment=structuredClone(value);}};
      room.accept(port).then(status=>{if(status!==101)ws.close(4004,'Room unavailable');}).catch(error=>{failed(error);ws.terminate();});
      ws.on('message',(data,binary)=>{
        if(!binary && data.toString()==='ping') {ws.send('pong');return;}
        room.webSocketMessage(port,binary?data:data.toString()).catch(error=>{failed(error);ws.terminate();});
      });
      ws.on('pong',()=>{alive=true;});
      const heartbeat=setInterval(()=>{if(!alive){ws.terminate();return;}alive=false;ws.ping();},30_000);
      ws.on('close',(code,reason)=>{
        clearInterval(heartbeat);sockets.delete(port);
        room.disconnect(port,code,reason.toString()).catch(failed);
      });
      ws.on('error',()=>ws.terminate());
    });
  });
  // Race positions are in memory; reclaim interrupted races on a process restart.
  db.prepare("DELETE FROM rooms WHERE expires<=? OR json_extract(state,'$.game')='chicken'").run(Date.now());
  for(const row of db.prepare("SELECT id FROM rooms WHERE json_extract(state,'$.game') IS NULL").all()) session(row.id);
  const sweep=setInterval(()=>{for(const [key,b] of buckets)if(b.until<=Date.now())buckets.delete(key);},60_000);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
  return {server, async close(){
    stopping=true;clearInterval(sweep);
    const stopped=new Promise(resolve=>server.close(resolve));
    const closed=[...wss.clients].filter(ws=>ws.readyState!==3).map(ws=>new Promise(resolve=>{
      ws.once('close',resolve);ws.terminate();
    }));
    await Promise.all(closed);await stopped;
    const sessions=[...rooms.values()];for(const s of sessions)s.close();
    await Promise.all(sessions.map(s=>s.drain()));db.close();
  }};
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const app=await startServer();console.log(`Number backend listening on ${JSON.stringify(app.server.address())}`);
  for(const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>app.close().then(()=>process.exit(0)));
}
