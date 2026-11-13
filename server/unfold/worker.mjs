// Cloudflare Worker + Durable Object transport for UNFOLD.
// All room decisions use the same authoritative RoomRegistry as the Node server.
// One Durable Object serializes requests and stores the room registry durably.
import { RoomRegistry } from './rooms.mjs';

const PREFIX='/api/unfold/';
const ROUTES=new Set(['create','join','state','start','action','pass','next','leave']);
const BODY_LIMIT=8192;
const WRITE_INTERVAL_MS=10_000;
const DEFAULT_ORIGINS=['https://tiendu.github.io','http://localhost:4321','http://127.0.0.1:4321'];
const failure=(message,status=400)=>Object.assign(new Error(message),{status});

function allowedOrigins(env){
  const custom=String(env.UNFOLD_ALLOWED_ORIGINS||'').trim();
  return custom?custom.split(',').map(s=>s.trim()).filter(Boolean):DEFAULT_ORIGINS;
}
function cors(request,env){
  const origin=request.headers.get('Origin');
  if(!origin)return {};
  if(!allowedOrigins(env).includes(origin))return null;
  return {
    'Access-Control-Allow-Origin':origin,
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type',
    'Access-Control-Max-Age':'600',
    'Vary':'Origin'
  };
}
function response(status,body,headers={}){
  return new Response(status===204?null:JSON.stringify(body),{
    status,headers:{'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}
  });
}
async function parseBody(request){
  if(Number(request.headers.get('Content-Length')||0)>BODY_LIMIT)throw failure('Request too large',413);
  // Don't buffer an arbitrarily large body into memory.
  const reader=request.body?.getReader();
  if(!reader)throw failure('Missing JSON body');
  const chunks=[];let size=0;
  try{
    while(true){
      const {value,done}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>BODY_LIMIT)throw failure('Request too large',413);
      chunks.push(value);
    }
  }finally{reader.releaseLock();}
  const joined=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.byteLength;}
  let payload;
  try{payload=JSON.parse(new TextDecoder().decode(joined));}
  catch{throw failure('Invalid JSON');}
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw failure('Invalid request body');
  return payload;
}

// Invoked by Cloudflare's edge. This keeps CORS and health outside Durable Object storage.
export default {
  async fetch(request,env){
    const headers=cors(request,env);
    if(headers===null)return response(403,{error:'Origin not allowed'});
    const path=new URL(request.url).pathname;
    if(request.method==='OPTIONS'){
      if(!path.startsWith(PREFIX))return response(404,{error:'Not found'},headers);
      return response(204,null,headers);
    }
    if(request.method==='GET'&&path===PREFIX+'health')
      return response(200,{ok:true,service:'UNFOLD rooms',backend:'cloudflare-durable-object'},headers);
    const operation=path.startsWith(PREFIX)?path.slice(PREFIX.length):'';
    if(request.method!=='POST'||!ROUTES.has(operation))return response(404,{error:'Not found'},headers);
    try{
      if(!env.UNFOLD_ROOMS)throw failure('Room storage is not configured',503);
      const payload=await parseBody(request);
      // Every room lives in one durable coordinator: room codes cannot collide and
      // all mutations are serialized. Fine for a small public game, not limitless scale.
      const id=env.UNFOLD_ROOMS.idFromName('unfold-room-registry-v1');
      const stub=env.UNFOLD_ROOMS.get(id);
      const upstream=await stub.fetch(new Request('https://internal.invalid/'+operation,{
        method:'POST',body:JSON.stringify(payload),headers:{'Content-Type':'application/json',
          'X-Unfold-Client-IP':request.headers.get('CF-Connecting-IP')||'unknown'}
      }));
      return response(upstream.status,await upstream.json(),headers);
    }catch(error){return response(error.status||500,{error:error.message||'Room service error'},headers);}
  }
};

// Use a SQLite-backed Durable Object (see wrangler.unfold.toml).
// No module-global Map: the room registry survives worker restarts/evictions.
export class UnfoldRooms {
  constructor(ctx,env){
    this.ctx=ctx;this.env=env;
    this.registry=new RoomRegistry();
    this.hits=new Map();this.lastSaved=new Map();
    this.queue=Promise.resolve();
    this.ready=ctx.blockConcurrencyWhile(async()=>{
      // Store one room per key, not the entire registry in a single KV value.
      // Durable Object KV values have size limits and rooms are polled often.
      const saved=await ctx.storage.list({prefix:'room:'});
      this.registry.rooms=new Map([...saved].map(([key,room])=>[key.slice(5),room]));
      this.registry.prune();
      for(const key of saved.keys())if(!this.registry.rooms.has(key.slice(5)))await ctx.storage.delete(key);
    });
  }
  throttle(request,operation){
    const client=request.headers.get('X-Unfold-Client-IP')||'unknown';
    const now=Date.now(),key=`${client}:${operation}`;
    const entry=this.hits.get(key)||{start:now,count:0};
    if(now-entry.start>60_000){entry.start=now;entry.count=0;}
    if(++entry.count>(operation==='create'?8:operation==='join'?30:180))throw failure('Too many requests',429);
    this.hits.set(key,entry);
    if(this.hits.size>10_000){for(const [k,v] of this.hits)if(now-v.start>60_000)this.hits.delete(k);}
  }
  async fetch(request){
    const operation=new URL(request.url).pathname.slice(1);
    if(!ROUTES.has(operation))return response(404,{error:'Not found'});
    let payload;
    try{payload=await parseBody(request);}catch(error){return response(error.status||400,{error:error.message});}
    // DO request body parsing is async; explicitly serialize every room operation.
    const execute=async()=>{
      try{
        await this.ready;
        this.throttle(request,operation);
        const requestedCode=String(payload.code??'');
        const previousRevision=operation==='state'?this.registry.rooms.get(requestedCode)?.revision:null;
        const result=this.registry[operation==='state'?'status':operation](payload);
        const code=operation==='create'?result.code:requestedCode;
        const room=this.registry.rooms.get(code);
        const now=Date.now();
        const mustSave=operation!=='state'||previousRevision!==room?.revision||now-(this.lastSaved.get(code)||0)>=WRITE_INTERVAL_MS;
        if(!room){
          await this.ctx.storage.delete('room:'+code);
          this.lastSaved.delete(code);
        }else if(mustSave){
          await this.ctx.storage.put('room:'+code,room);
          this.lastSaved.set(code,now);
        }
        return response(200,result);
      }catch(error){return response(error.status||400,{error:error.message||'Unable to process request'});}
    };
    const next=this.queue.then(execute,execute);
    this.queue=next.then(()=>{},()=>{});
    return next;
  }
}
