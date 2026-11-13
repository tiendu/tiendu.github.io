// Dependency-free, authoritative HTTP room service for the static Astro game.
// Set UNFOLD_ALLOWED_ORIGINS and run this as a persistent HTTPS service.
import http from 'node:http';
import { RoomRegistry } from './rooms.mjs';
const registry=new RoomRegistry();
const port=Number(process.env.UNFOLD_ROOM_PORT||8787);
const allowed=(process.env.UNFOLD_ALLOWED_ORIGINS||'http://localhost:4321,http://127.0.0.1:4321').split(',').map(v=>v.trim());
const hits=new Map();
function rateLimit(req,route){
  const id=`${req.socket.remoteAddress}:${route}`,now=Date.now();
  const entry=hits.get(id)||{start:now,count:0};
  if(now-entry.start>60000){entry.start=now;entry.count=0;}
  hits.set(id,entry);if(++entry.count>(route==='create'?8:route==='join'?30:180))throw Object.assign(new Error('Too many requests'),{status:429});
  if(hits.size>10000)for(const [k,v] of hits)if(now-v.start>60000)hits.delete(k);
}
const json=(res,status,payload)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(payload));};
const endpoints={create:p=>registry.create(p),join:p=>registry.join(p),state:p=>registry.status(p),start:p=>registry.start(p),action:p=>registry.action(p),pass:p=>registry.pass(p),next:p=>registry.next(p),leave:p=>registry.leave(p)};
const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(origin){if(!allowed.includes(origin)&&!allowed.includes('*'))return json(res,403,{error:'Origin not allowed'});
    res.setHeader('Access-Control-Allow-Origin',allowed.includes('*')?'*':origin);
    res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
  }
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  if(req.method==='GET'&&req.url==='/api/unfold/health')return json(res,200,{ok:true,service:'UNFOLD rooms'});
  const match=req.url?.match(/^\/api\/unfold\/(create|join|state|start|action|pass|next|leave)$/);
  if(req.method!=='POST'||!match)return json(res,404,{error:'Not found'});
  const endpoint=match[1];
  try{
    rateLimit(req,endpoint);
    let body='',bytes=0;
    for await(const chunk of req){bytes+=chunk.length;if(bytes>8192)throw Object.assign(new Error('Request too large'),{status:413});body+=chunk;}
    let payload;try{payload=JSON.parse(body);}catch{throw new Error('Invalid JSON');}
    if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Invalid request body');
    const result=endpoints[endpoint](payload);
    json(res,200,result);
  }catch(e){json(res,e.status||400,{error:e.message||'Unable to process request'});}
});
server.listen(port,process.env.UNFOLD_ROOM_HOST||'0.0.0.0',()=>{
  console.log(`UNFOLD room server listening on :${port}. Allowed origins: ${allowed.join(', ')}`);
});
