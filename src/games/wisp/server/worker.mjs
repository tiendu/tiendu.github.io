import {newRoom,joinRoom,migrateHost,rosterView,startRound,acceptInput,setConnected,tickMatch,addPing,snapshot,ROOM_TTL,ROOM_LIMIT,PROTOCOL} from './room.mjs';
import {HZ} from '../../../../public/games/wisp/core/config.mjs';
const PREFIX='maze-v2:';
const json=(v,status=200,headers={})=>Response.json(v,{status,headers});
const token=()=>crypto.randomUUID();
const random=()=>crypto.getRandomValues(new Uint32Array(1))[0];
const roomStub=(env,id)=>env.WISP_ROOMS.get(env.WISP_ROOMS.idFromName(PREFIX+id));
const registry=env=>roomStub(env,'registry');
const originOK=(request,env)=>(env.WISP_ALLOWED_ORIGINS??'').split(',').map(s=>s.trim()).includes(request.headers.get('Origin')??'');
const cors=request=>({'Access-Control-Allow-Origin':request.headers.get('Origin')??'',Vary:'Origin','Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});
export default {async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/v2/health')return json({protocol:PROTOCOL});
  if(!originOK(request,env))return json({error:'Origin not allowed'},403);
  const headers=cors(request);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(url.pathname==='/v2/rooms'&&request.method==='POST'){
    const res=await registry(env).fetch('https://internal/create',{method:'POST'});
    return new Response(res.body,{status:res.status,headers:{...headers,'Content-Type':'application/json'}});
  }
  const m=url.pathname.match(/^\/v2\/rooms\/(\d{6})\/socket$/);
  if(!m||request.method!=='GET'||request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'Not found'},404,headers);
  const lookup=await registry(env).fetch('https://internal/lookup/'+m[1]);
  if(!lookup.ok)return json({error:'Room not found or expired'},404,headers);
  const {id}=await lookup.json();
  return roomStub(env,id).fetch(new Request('https://internal/socket',request));
}};

// Keep the existing deployed class and migration. New object names and storage
// keys isolate the maze protocol from retired forest-runner room records.
export class WispRooms {
  constructor(ctx,env){
    this.ctx=ctx;this.env=env;this.room=null;this.match=null;this.timer=null;this.sockets=new Map();
    ctx.blockConcurrencyWhile(async()=>{
      this.room=await ctx.storage.get('maze-v2-room')??null;
      // An evicted/redeployed active simulation is an aborted match, not a win.
      if(this.room?.state==='running'){this.room.state='aborted';await this.save();}
      for(const ws of ctx.getWebSockets()){
        const a=ws.deserializeAttachment();if(a)this.sockets.set(ws,a);
      }
    });
  }
  save(){return this.ctx.storage.put('maze-v2-room',this.room);}
  connected(){return new Set([...this.sockets.values()].map(a=>a.id).filter(Boolean));}
  send(ws,value){try{if(ws.bufferedAmount>256*1024){ws.close(1013,'Slow connection');return;}ws.send(JSON.stringify(value));}catch{try{ws.close(1011,'Connection lost');}catch{}}}
  broadcastLobby(){const msg=rosterView(this.room,this.connected());for(const [ws,a] of this.sockets)if(a.id)this.send(ws,msg);}
  async fetch(request){
    const path=new URL(request.url).pathname;
    if(path==='/create')return this.ctx.blockConcurrencyWhile(async()=>{
      const now=Date.now(),leases=await this.ctx.storage.get('maze-v2-leases')??{};
      for(const [code,l] of Object.entries(leases))if(l.expires<=now)delete leases[code];
      if(Object.keys(leases).length>=ROOM_LIMIT)return json({error:'Room capacity reached'},429);
      let code;do{code=String(random()%1000000).padStart(6,'0');}while(leases[code]);
      const id=token(),ownerToken=token(),expires=now+ROOM_TTL;
      const res=await roomStub(this.env,id).fetch('https://internal/init',{method:'POST',body:JSON.stringify({code,ownerToken,expires,id})});
      if(!res.ok)return json({error:'Could not create room'},503);
      leases[code]={id,expires};await this.ctx.storage.put('maze-v2-leases',leases);
      return json({code,token:ownerToken,protocol:PROTOCOL},201);
    });
    if(path==='/release'&&request.method==='POST')return this.ctx.blockConcurrencyWhile(async()=>{
      const {code,id}=await request.json(),leases=await this.ctx.storage.get('maze-v2-leases')??{};
      if(leases[code]?.id===id){delete leases[code];await this.ctx.storage.put('maze-v2-leases',leases);}
      return json({ok:true});
    });
    if(path.startsWith('/lookup/')){
      const leases=await this.ctx.storage.get('maze-v2-leases')??{},l=leases[path.slice(8)];
      return l&&l.expires>Date.now()?json({id:l.id}):json({error:'Expired'},404);
    }
    if(path==='/init'&&request.method==='POST'){
      if(this.room)return json({error:'Already initialized'},409);
      const {code,ownerToken,expires,id}=await request.json();this.room={...newRoom(code,ownerToken,expires),leaseId:id};
      await this.save();await this.ctx.storage.setAlarm(expires);return json({ok:true});
    }
    if(path!=='/socket'||!this.room||this.room.expires<=Date.now())return json({error:'Expired'},404);
    // Unauthenticated sockets are short-lived, bounded and pruned on new upgrades.
    for(const [ws,a] of this.sockets)if(!a.id&&Date.now()-a.opened>10000){this.sockets.delete(ws);ws.close(1008,'Hello timeout');}
    if(this.sockets.size>=8)return json({error:'Too many connections'},429);
    const [client,server]=Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);const a={id:null,opened:Date.now(),window:0,count:0};server.serializeAttachment(a);this.sockets.set(server,a);
    return new Response(null,{status:101,webSocket:client});
  }
  async webSocketMessage(ws,raw){
    const a=this.sockets.get(ws);if(!a||!this.room)return;
    if(this.room.expires<=Date.now()){ws.close(1008,'Room expired');return;}
    if(typeof raw!=='string'||raw.length>1024){ws.close(1009,'Invalid message');return;}
    const now=Date.now();if(now-a.window>=1000){a.window=now;a.count=0;}if(++a.count>60){ws.close(1008,'Rate limit');return;}
    let msg;try{msg=JSON.parse(raw);}catch{ws.close(1007,'Invalid JSON');return;}
    if(!msg||typeof msg!=='object'||Array.isArray(msg))return;
    if(!a.id){
      if(now-a.opened>10000||msg.type!=='hello'||msg.protocol!==PROTOCOL){ws.close(1008,'Protocol or hello rejected');return;}
      const p=joinRoom(this.room,msg,token(),token());if(!p){this.send(ws,{type:'error',error:'Room full, character taken, or invalid session'});ws.close(1008,'Join rejected');return;}
      a.id=p.id;ws.serializeAttachment(a);
      // Replace an older socket for this player; its close cannot revoke the new connection.
      for(const [other,meta] of this.sockets)if(other!==ws&&meta.id===p.id){this.sockets.delete(other);other.close(1000,'Reconnected elsewhere');}
      setConnected(this.match,p,true);migrateHost(this.room,this.connected());await this.save();
      this.send(ws,{type:'welcome',id:p.id,token:p.token,seq:p.seq,character:p.character,protocol:PROTOCOL});this.broadcastLobby();
      if(this.match)this.send(ws,snapshot(this.match,p));
      else if(this.room.result)this.send(ws,{type:'result',result:this.room.result});return;
    }
    const p=this.room.players.find(p=>p.id===a.id);if(!p)return;
    if(msg.type==='start'&&p.id===this.room.host){
      const match=startRound(this.room,this.connected(),random());if(!match){this.send(ws,{type:'notice',message:'All joined players must be connected before starting.'});return;}
      this.match=match;await this.save();this.broadcastLobby();this.broadcastSnapshot();this.startTimer();
    }else if(msg.type==='input')acceptInput(this.match,p,msg);
    else if(msg.type==='ping')addPing(this.match,p,msg.x,msg.y);
    else if(msg.type==='heartbeat')this.send(ws,{type:'heartbeat'});
    else if(msg.type==='leave'){await this.disconnect(ws,true);ws.close(1000,'Left room');}
  }
  broadcastSnapshot(){for(const [ws,a] of this.sockets){const p=this.room.players.find(p=>p.id===a.id);if(p)this.send(ws,snapshot(this.match,p));}}
  startTimer(){
    if(this.timer)return;
    // Fixed steps; bounded catch-up avoids unbounded work on delayed callbacks.
    let next=performance.now()+1000/HZ;
    this.timer=setInterval(()=>{
      if(!this.match||this.room.state!=='running'){this.stopTimer();return;}
      const now=performance.now();let n=0;
      while(now>=next&&n++<4){next+=1000/HZ;if(tickMatch(this.match)){this.room.state='finished';this.room.result=this.match.round.result;this.stopTimer();this.ctx.waitUntil(this.save());break;}}
      if(n>4)next=now+1000/HZ;
      if(n)this.broadcastSnapshot();
      if(this.room.state==='finished')this.broadcastLobby();
    },1000/HZ);
  }
  stopTimer(){if(this.timer!==null)clearInterval(this.timer);this.timer=null;}
  async disconnect(ws,leave=false){
    const a=this.sockets.get(ws);this.sockets.delete(ws);if(!a?.id||!this.room)return;
    const p=this.room.players.find(p=>p.id===a.id);if(!p||this.connected().has(p.id))return;
    setConnected(this.match,p,false);
    if(leave){
      this.room.players=this.room.players.filter(v=>v!==p);
      if(!this.room.players.length){
        this.stopTimer();this.match=null;
        const {code,leaseId}=this.room;this.room=null;
        for(const other of this.sockets.keys())other.close(1000,'Room closed');this.sockets.clear();
        await this.ctx.storage.deleteAll();await this.ctx.storage.deleteAlarm();
        if(leaseId)await registry(this.env).fetch('https://internal/release',{method:'POST',body:JSON.stringify({code,id:leaseId})});
        return;
      }
    }
    migrateHost(this.room,this.connected());await this.save();this.broadcastLobby();
  }
  async webSocketClose(ws){await this.disconnect(ws);}
  async webSocketError(ws){await this.disconnect(ws);try{ws.close(1011,'Socket error');}catch{}}
  async alarm(){this.stopTimer();for(const ws of this.sockets.keys())ws.close(1000,'Room expired');this.sockets.clear();this.match=null;this.room=null;await this.ctx.storage.deleteAll();}
}
