import { DurableObject } from "cloudflare:workers";
import { RoomSession } from "./room-service.mjs";
import { roomRouter, roomLobbyClass } from "./cloudflare-rooms.mjs";
import { chickenRoomClass } from "./chicken/cloudflare-room.mjs";

export default roomRouter("");
export class RoomLobby extends roomLobbyClass(DurableObject, "number") {}
// Retain the old v3 class so existing objects can finish and expire.
export class ChickenRoom extends chickenRoomClass(DurableObject) {}

// Cloudflare adapter: storage, alarms and hibernating socket attachments only.
export class NumberRoom extends DurableObject {
  constructor(ctx,env) {
    super(ctx,env);this.ctx=ctx;
    const wrap=ws=>({
      native:ws,get readyState(){return ws.readyState;},
      send:text=>ws.send(text),close:(code,reason)=>ws.close(code,reason),
      getAttachment:()=>ws.deserializeAttachment(),setAttachment:value=>ws.serializeAttachment(value)
    });
    // Preserve socket wrapper identity for replacement/disconnect checks.
    const wrappers=new WeakMap();
    this.socket=ws=>{if(!wrappers.has(ws))wrappers.set(ws,wrap(ws));return wrappers.get(ws);};
    this.room=new RoomSession({
      runExclusive:fn=>ctx.blockConcurrencyWhile(fn),
      load:()=>ctx.storage.get('game'),save:value=>ctx.storage.put('game',value),
      remove:()=>ctx.storage.deleteAll(),schedule:deadline=>ctx.storage.setAlarm(deadline),
      sockets:()=>ctx.getWebSockets().map(this.socket),addSocket:socket=>ctx.acceptWebSocket(socket.native)
    });
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));
  }
  async fetch(request) {
    if(new URL(request.url).pathname==='/init') {
      const {token,created}=await request.json();await this.room.initialize(token,created);
      return new Response('Created');
    }
    const [client,server]=Object.values(new WebSocketPair());
    // Admission runs within the room's serialized queue. Accept only on success.
    const socket=this.socket(server);
    const status=await this.room.accept(socket);
    return status===101?new Response(null,{status:101,webSocket:client}):new Response('Room unavailable',{status});
  }
  webSocketMessage(ws,raw){return this.room.webSocketMessage(this.socket(ws),raw);}
  webSocketClose(ws,code,reason){return this.room.disconnect(this.socket(ws),code,reason);}
  webSocketError(ws){return this.room.disconnect(this.socket(ws),1011,'Connection failed');}
  alarm(){return this.room.alarm();}
}
