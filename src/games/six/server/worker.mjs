import { DurableObject } from 'cloudflare:workers';
import { roomRouter, roomLobbyClass } from '../../shared/server/cloudflare-rooms.mjs';
import { cleanName } from '../../shared/server/name.mjs';
import { createGame, guess, rollDie, MAX_PLAYERS, DEFAULT_ROUNDS, DEFAULT_SIDES } from '../core/rules.mjs';
import { roomRounds, roomDieSides, setRoomSettings } from './settings.mjs';

export default roomRouter('/six');
export class SixLobby extends roomLobbyClass(DurableObject, 'six') {}
export class SixRoom extends DurableObject {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/init') {
      const {room,id,token,expires} = await request.json();
      await this.ctx.storage.put('room',{room,id,token,expires,players:[],host:null,game:null,round:0,rounds:DEFAULT_ROUNDS,dieSides:DEFAULT_SIDES});
      await this.ctx.storage.setAlarm(expires);
      return new Response(null,{status:204});
    }
    const room = await this.ctx.storage.get('room');
    if (!room || room.expires <= Date.now()) return new Response('Room expired',{status:410});
    if (path !== '/socket' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('Not found',{status:404});
    if (this.ctx.getWebSockets().filter(s=>s.readyState===1).length >= MAX_PLAYERS + 5) return new Response('Room full',{status:429});
    const [client,server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({at:Date.now(),count:0});
    return new Response(null,{status:101,webSocket:client});
  }
  online() {return this.ctx.getWebSockets().filter(ws=>ws.readyState===1 && ws.deserializeAttachment()?.id);}
  async broadcast(room) {
    const online = new Set(this.online().map(ws=>ws.deserializeAttachment().id));
    const message = JSON.stringify({type:'state',players:room.players.map(({id,name})=>({id,name,online:online.has(id)})),host:room.host,round:room.round,rounds:roomRounds(room),dieSides:roomDieSides(room),game:room.game});
    for(const ws of this.online()) ws.send(message);
  }
  async webSocketMessage(ws,raw) {
    return this.ctx.blockConcurrencyWhile(async()=>{
      try {
        const peer = ws.deserializeAttachment(),now=Date.now();
        if(now-peer.at>=1000){peer.at=now;peer.count=0;}
        peer.count++;ws.serializeAttachment(peer);
        if(typeof raw!=='string'||raw.length>512||peer.count>16) return ws.close(1008,'Input limit');
        const msg=JSON.parse(raw),room=await this.ctx.storage.get('room');
        if(!room||room.expires<=now)return ws.close(1001,'Room expired');
        if(!peer.id){
          if(msg.type!=='join')throw Error('Join first.');
          let player=room.players.find(p=>p.key===msg.key);
          if(!player){
            if(room.players.length>=MAX_PLAYERS)throw Error('Room full.');
            const name=cleanName(msg.name);if(!name)throw Error('Enter a name (1–16 characters).');
            player={id:crypto.randomUUID(),key:crypto.randomUUID(),name};room.players.push(player);
            if(msg.token===room.token && !room.host)room.host=player.id;
          }
          for(const old of this.online())if(old.deserializeAttachment().id===player.id)old.close(1000,'Reconnected elsewhere');
          if(!room.host)room.host=player.id;
          peer.id=player.id;ws.serializeAttachment(peer);
          ws.send(JSON.stringify({type:'identity',you:player.id,key:player.key}));
        } else if(msg.type==='settings') {
          setRoomSettings(room, peer.id, Object.fromEntries(
            Object.entries(msg).filter(([key]) => key === 'rounds' || key === 'dieSides')
          ));
        } else if(msg.type==='start') {
          if(peer.id!==room.host)throw Error('Only the host can start.');
          if(room.game&&!room.game.over)throw Error('Game already running.');
          const online=new Set(this.online().map(s=>s.deserializeAttachment().id));
          const seats=room.players.filter(p=>online.has(p.id)).map(p=>p.id);
          if(seats.length<2)throw Error('Need at least two connected players.');
          const sides=roomDieSides(room);
          room.game=createGame(seats,rollDie(sides),roomRounds(room),sides);room.round++;
        } else if(msg.type==='guess') {
          if(!room.game)throw Error('Start the game first.');
          if(msg.move!==room.game.moves)throw Error('Outdated turn.');
          guess(room.game,peer.id,msg.choice,rollDie(room.game.dieSides ?? 6));
        } else if(msg.type==='leave') {
          if(room.game&&!room.game.over&&room.game.alive.includes(peer.id))throw Error('Finish the game before leaving.');
          room.players=room.players.filter(p=>p.id!==peer.id);
          if(room.host===peer.id)room.host=room.players[0]?.id??null;
          ws.close(1000,'Left room');
        } else throw Error('Unknown action.');
        await this.ctx.storage.put('room',room);
        await this.broadcast(room);
      }catch(error){if(ws.readyState===1)ws.send(JSON.stringify({type:'error',error:error.message}));}
    });
  }
  async webSocketClose(ws) {
    ws.close();
    await this.ctx.blockConcurrencyWhile(async()=>{
      const room=await this.ctx.storage.get('room');if(!room)return;
      const online=this.online();
      if(room.host&&!online.some(s=>s.deserializeAttachment().id===room.host))room.host=online[0]?.deserializeAttachment().id??null;
      await this.ctx.storage.put('room',room);await this.broadcast(room);
    });
  }
  async alarm(){for(const ws of this.ctx.getWebSockets())ws.close(1001,'Room expired');await this.ctx.storage.deleteAll();}
}
