// WISP rooms: same isolated Cloudflare Worker + SQLite Durable Object pattern
// as UNFOLD, without modifying any existing game's backend.
import { WispRegistry } from './room-core.mjs';
const BASE='/api/wisp/';
const OPS=new Set(['create','join','state','start','sync','leave']);
const MAX_BYTES=2048;
const ORIGINS=['https://tiendu.github.io','http://localhost:4321','http://127.0.0.1:4321'];
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const response=(status,obj,headers={})=>new Response(JSON.stringify(obj),{status,
  headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',...headers}});
function originHeaders(request,env){
  const origin=request.headers.get('Origin');
  const allowed=String(env.WISP_ALLOWED_ORIGINS||ORIGINS.join(',')).split(',').map(s=>s.trim());
  if(origin&&!allowed.includes(origin))return null;
  return origin?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'}:{};
}
async function body(request){
  const raw=await request.text();
  if(raw.length>MAX_BYTES)throw fail('Request too large',413);
  try{const obj=JSON.parse(raw);if(!obj||Array.isArray(obj)||typeof obj!=='object')throw Error();return obj;}
  catch{throw fail('Invalid JSON body');}
}
export default {
  async fetch(request,env){
    const headers=originHeaders(request,env);
    if(!headers)return response(403,{error:'Origin not allowed'});
    const path=new URL(request.url).pathname;
    if(request.method==='GET'&&path===BASE+'health')return response(200,{ok:true,service:'wisp'},headers);
    if(request.method==='OPTIONS'&&path.startsWith(BASE))return new Response(null,{status:204,headers});
    const op=path.startsWith(BASE)?path.slice(BASE.length):'';
    if(request.method!=='POST'||!OPS.has(op))return response(404,{error:'Not found'},headers);
    try{
      if(!env.WISP_ROOMS)throw fail('WISP room storage unavailable',503);
      const payload=await body(request);
      const stub=env.WISP_ROOMS.get(env.WISP_ROOMS.idFromName('wisp-global-registry-v1'));
      const result=await stub.fetch(new Request('https://room.invalid/'+op,{method:'POST',body:JSON.stringify(payload),
        headers:{'Content-Type':'application/json','X-Wisp-IP':request.headers.get('CF-Connecting-IP')||'local'}}));
      return response(result.status,await result.json(),headers);
    }catch(err){return response(err.status||500,{error:err.message||'Room service error'},headers);}
  }
};
export class WispRooms {
  constructor(ctx,env){
    this.ctx=ctx;this.env=env;this.rooms=new WispRegistry();this.queue=Promise.resolve();
    this.hits=new Map();this.dirty=false;this.lastSave=0;
    this.ready=ctx.blockConcurrencyWhile(async()=>{
      const previous=await ctx.storage.get('rooms');
      if(previous) this.rooms.rooms=new Map(previous);
      this.rooms.prune();
    });
  }
  throttle(req,op){
    const key=(req.headers.get('X-Wisp-IP')||'local')+':'+op;
    const now=Date.now();const r=this.hits.get(key)||{t:now,n:0};
    if(now-r.t>60_000){r.t=now;r.n=0;}
    if(++r.n>(op==='create'?8:op==='join'?32:op==='sync'?900:240))throw fail('Too many requests',429);
    this.hits.set(key,r);
    if(this.hits.size>3000)for(const [k,v] of this.hits)if(now-v.t>60_000)this.hits.delete(k);
  }
  async persist(){
    this.rooms.prune();
    await this.ctx.storage.put('rooms',[...this.rooms.rooms]);
    this.dirty=false;this.lastSave=Date.now();
    await this.ctx.storage.setAlarm(Date.now()+30_000);
  }
  async fetch(req){
    const op=new URL(req.url).pathname.slice(1);
    if(!OPS.has(op))return response(404,{error:'Not found'});
    let payload;
    try{payload=await body(req);}catch(e){return response(e.status||400,{error:e.message});}
    const perform=async()=>{
      try{
        await this.ready;this.throttle(req,op);
        const answer=this.rooms[op](payload);
        if(op!=='state')this.dirty=true;
        if(this.dirty && (op!=='sync'||Date.now()-this.lastSave>1500))await this.persist();
        return response(200,answer);
      }catch(e){return response(e.status||400,{error:e.message||'Room request failed'});}
    };
    const next=this.queue.then(perform,perform);
    this.queue=next.then(()=>{},()=>{});
    return next;
  }
  async alarm(){
    await this.ready;
    for(const room of this.rooms.rooms.values())this.rooms.evaluate(room);
    await this.persist();
  }
}
