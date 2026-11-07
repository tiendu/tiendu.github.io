import { lobby } from "./room.mjs";
import { openFlock } from "./server.mjs";
export function chickenRoomClass(DurableObject) {
  return class extends DurableObject {
    constructor(ctx, env) {
      super(ctx, env);
      this.ctx = ctx;
      this.env = env;
      ctx.blockConcurrencyWhile(async () => {
        const state = await ctx.storage.get("state");
        if (state) {
          this.setup(state);
          for (const ws of ctx.getWebSockets())
            this.session.attach(ws, ws.deserializeAttachment()?.id);
        }
      });
    }
    setup(state) {
      this.session = openFlock(
        state,
        (s) => this.ctx.storage.put("state", s),
        () => this.alarm(),
      );
    }
    async fetch(request) {
      if (new URL(request.url).pathname === "/init") {
        const { token, room, id, expires } = await request.json();
        const state = lobby(token);
        this.setup(state);
        await this.ctx.storage.put({ state, meta: { room, id, expires } });
        await this.ctx.storage.setAlarm(expires);
        return new Response(null, { status: 204 });
      }
      const meta = await this.ctx.storage.get("meta");
      if (!meta || meta.expires <= Date.now())
        return new Response("Expired", { status: 410 });
      if (!this.session) return new Response("Expired", { status: 410 });
      const [client, ws] = Object.values(new WebSocketPair());
      if (!this.session.attach(ws))
        return new Response("Room busy", { status: 429 });
      this.ctx.acceptWebSocket(ws);
      return new Response(null, { status: 101, webSocket: client });
    }
    webSocketMessage(ws, data) {
      return this.session?.receive(ws, data);
    }
    webSocketClose(ws, code, reason) {
      ws.close(code === 1000 ? 1000 : 1001, reason?.slice(0, 30));
      return this.session?.detach(ws);
    }
    webSocketError(ws) {
      return this.session?.detach(ws);
    }
    async alarm() {
      this.session?.close();
      this.session = null;
      const meta = await this.ctx.storage.get("meta");
      if (meta)
        await this.env.LOBBY.getByName("global").fetch(
          new Request("https://lobby/rooms/" + meta.room, {
            method: "DELETE",
            body: meta.id,
          }),
        );
      await this.ctx.storage.deleteAll();
    }
  };
}
