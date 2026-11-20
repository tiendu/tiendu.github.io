// Hosting port: load/save/remove, schedule(deadline), sockets/addSocket,
// runExclusive(callback). Socket port: readyState, send/close, get/setAttachment.
// Hosts must serialize initialization, messages, disconnects and timer events.
import {newRoom,move,publicState,GRACE,joinPlayer,reconcile,leavePlayer} from './rules.mjs';
export class RoomSession {
  constructor(ctx) {
    this.ctx=ctx; this.state=null;
    ctx.runExclusive(async()=>{
      this.state=await ctx.load() ?? null;
      if(this.state) {
        // Reconcile persisted presence with sockets restored after hibernation.
        for(const p of this.state.players) {
          const connected=ctx.sockets().some(ws=>ws.readyState===1 && ws.getAttachment()?.player===p.id);
          if(p.connected && !connected) {p.connected=false;p.away=Date.now();}
        }
        reconcile(this.state);await this.persist();
      }
    });
  }
  async persist() {
    await this.ctx.save(this.state);
    const now=Date.now();
    const deadlines=[this.state.expires];
    for(const p of this.state.players) if(!p.connected && p.away+GRACE>now) deadlines.push(p.away+GRACE);
    for(const ws of this.ctx.sockets()) {
      const a=ws.getAttachment();
      if(ws.readyState===1 && a?.player===null) deadlines.push(a.joinBy);
    }
    await this.ctx.schedule(Math.min(...deadlines));
  }
  broadcast() {
    if(!this.state) return;
    for(const ws of this.ctx.sockets()) {
      const id=ws.getAttachment()?.player;
      if(this.state.players.some(p=>p.id===id)) {
        try {ws.send(JSON.stringify(publicState(this.state,id)));} catch { /* close event handles presence */ }
      }
    }
  }
  async initialize(token, created) {
    return this.ctx.runExclusive(async()=>{
      if(!this.state) {this.state=newRoom(token,created);await this.persist();}
    });
  }
  async accept(ws) {
    return this.ctx.runExclusive(async()=>{
      if(!this.state || Date.now()>=this.state.expires) return 410;
      if(this.ctx.sockets().length>=40) return 429;
      this.ctx.addSocket(ws);
      ws.setAttachment({player:null,last:0,joinBy:Date.now()+10_000});
      await this.persist();return 101;
    });
  }
  async webSocketMessage(ws,raw) {
    return this.ctx.runExclusive(async()=>{
      if(!this.state || Date.now()>=this.state.expires) {ws.close(4004,'Room expired');return;}
      if(typeof raw!=='string' || raw.length>512) {ws.close(4000,'Invalid message');return;}
      let message;try {message=JSON.parse(raw);} catch {ws.close(4000,'Invalid JSON');return;}
      if(!message || typeof message!=='object') {ws.close(4000,'Invalid message');return;}
      const a=ws.getAttachment();
      if(message.type!=='leave' && Date.now()-a.last<100) {ws.send(JSON.stringify({type:'error',message:'Slow down.'}));return;}
      a.last=Date.now();ws.setAttachment(a);
      if(a.player===null) {
        if(message.type!=='join' || Date.now()>a.joinBy) {ws.close(4001,'Join first');return;}
        const joined=joinPlayer(this.state,message.token,message.name);
        if(joined.error) {ws.close(joined.code,joined.error);return;}
        const p=joined.player;
        for(const old of this.ctx.sockets()) if(old!==ws && old.getAttachment()?.player===p.id) {
          old.setAttachment({player:null,last:0,joinBy:Date.now()});old.close(4002,'Connected elsewhere');
        }
        a.player=p.id;ws.setAttachment(a);reconcile(this.state);
        await this.persist();ws.send(JSON.stringify({type:'joined',token:p.token}));this.broadcast();return;
      }
      if(message.type==='leave') {
        leavePlayer(this.state,a.player);a.player=null;ws.setAttachment(a);
        await this.persist();ws.close(4005,'Left room');this.broadcast();return;
      }
      reconcile(this.state);
      const error=move(this.state,a.player,message);
      await this.persist();
      if(error) ws.send(JSON.stringify({type:'error',message:error}));
      this.broadcast();
    });
  }
  async disconnect(ws,code=1000,reason='') {
    return this.ctx.runExclusive(async()=>{
      const id=ws.getAttachment()?.player;
      try {ws.close(code,reason);} catch { /* Already closed. */ }
      if(!this.state) return;
      const p=this.state.players.find(p=>p.id===id);
      const replaced=this.ctx.sockets().some(other=>other!==ws && other.readyState===1 && other.getAttachment()?.player===id);
      if(p && !replaced) {p.connected=false;p.away=Date.now();this.state.revision++;}
      reconcile(this.state);await this.persist();this.broadcast();
    });
  }
  webSocketClose(ws,code,reason) {return this.disconnect(ws,code,reason);}
  webSocketError(ws) {return this.disconnect(ws,1011,'Connection failed');}
  async alarm() {
    return this.ctx.runExclusive(async()=>{
      if(!this.state || Date.now()>=this.state.expires) {
        for(const ws of this.ctx.sockets()) ws.close(4004,'Room expired');
        this.state=null;await this.ctx.remove();return;
      }
      for(const ws of this.ctx.sockets()) {
        const a=ws.getAttachment();
        if(a?.player===null && a.joinBy<=Date.now()) ws.close(4001,'Join timed out');
      }
      reconcile(this.state);await this.persist();this.broadcast();
    });
  }
}
