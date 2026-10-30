import { DurableObject } from "cloudflare:workers";
import { RoomSession } from "./room-service.mjs";
import { pruneLeases, reserveRoom } from "./admission.mjs";

const roomCode = /^\d{6}$/;
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const allowed = env.ALLOWED_ORIGINS.split(",").map(s => s.trim());
    if (!origin || !allowed.includes(origin)) return new Response("Origin not allowed", { status: 403 });
    const headers = { "Access-Control-Allow-Origin": origin, "Vary": "Origin", "Cache-Control": "no-store" };
    if (request.method === "OPTIONS") return new Response(null, { headers: { ...headers,
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
    if (url.pathname === "/rooms" && request.method === "POST") {
      if (!(await env.CREATE_LIMIT.limit({key: request.headers.get("CF-Connecting-IP") || "local"})).success) return new Response("Too many rooms", {status:429, headers});
      const result = await env.LOBBY.getByName("global").fetch(new Request("https://lobby/create", {method:"POST"}));
      return new Response(result.body, {status:result.status, headers:{...Object.fromEntries(result.headers), ...headers}});
    }
    const id = url.pathname.match(/^\/rooms\/([^/]+)$/)?.[1];
    if (id && roomCode.test(id) && request.method === "GET" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      if (!(await env.CONNECT_LIMIT.limit({key: request.headers.get("CF-Connecting-IP") || "local"})).success) return new Response("Too many connections", {status:429, headers});
      // Reject invented IDs before allocating a room Durable Object.
      const admitted = await env.LOBBY.getByName("global").fetch(new Request(`https://lobby/rooms/${id}`));
      if (!admitted.ok) return new Response("Room expired", {status:410, headers});
      return env.ROOMS.getByName((await admitted.json()).id).fetch(new Request("https://room/socket", request));
    }
    return new Response("Not found", { status: 404, headers });
  }
};

// One persistent coordinator serializes admissions across every Worker instance.
export class RoomLobby extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    ctx.blockConcurrencyWhile(async () => { this.leases = await ctx.storage.get("leases") ?? {}; });
  }
  prune() {
    pruneLeases(this.leases);
  }
  async save() {
    await this.ctx.storage.put("leases", this.leases);
    const deadlines = Object.values(this.leases).map(lease => lease.expires);
    if (deadlines.length) await this.ctx.storage.setAlarm(Math.min(...deadlines));
  }
  async fetch(request) {
    return this.ctx.blockConcurrencyWhile(async () => {
      this.prune();
      const path = new URL(request.url).pathname;
      if (request.method === "GET" && path.startsWith("/rooms/")) {
        const lease = this.leases[path.slice(7)];
        return lease ? Response.json({id:lease.id}) : new Response(null,{status:410});
      }
      if (path !== "/create" || request.method !== "POST") return new Response(null, {status:404});
      const reservation=reserveRoom(this.leases,this.env.MAX_ROOMS);
      if(!reservation) return new Response("All rooms are busy or unavailable",{status:503,headers:{"Retry-After":"60"}});
      const {room,id,token,created}=reservation;
      // Persist before creating the room. A failed/ambiguous initialization keeps
      // its reservation until expiry, so retries can never overbook the cap.
      await this.save();
      const result = await this.env.ROOMS.getByName(id).fetch(new Request("https://room/init", {
        method:"POST", body:JSON.stringify({token, created})
      }));
      if (!result.ok) return new Response("Room creation unavailable", {status:503});
      return Response.json({room, token});
    });
  }
  async alarm() {
    return this.ctx.blockConcurrencyWhile(async () => { this.prune(); await this.save(); });
  }
}

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
