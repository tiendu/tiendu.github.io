import { pruneLeases, reserveRoom } from "./admission.mjs";
const roomCode = /^\d{6}$/;
export function roomRouter(prefix) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      const origin = request.headers.get("Origin");
      const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
      if (!origin || !allowed.includes(origin))
        return new Response("Origin not allowed", { status: 403 });
      const headers = {
        "Access-Control-Allow-Origin": origin,
        Vary: "Origin",
        "Cache-Control": "no-store",
      };
      if (request.method === "OPTIONS")
        return new Response(null, {
          headers: {
            ...headers,
            "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      if (!url.pathname.startsWith(prefix + "/"))
        return new Response("Not found", { status: 404 });
      const path = url.pathname.slice(prefix.length);
      if (path === "/rooms" && request.method === "POST") {
        if (
          !(
            await env.CREATE_LIMIT.limit({
              key: request.headers.get("CF-Connecting-IP") || "local",
            })
          ).success
        )
          return new Response("Too many rooms", { status: 429, headers });
        const result = await env.LOBBY.getByName("global").fetch(
          new Request("https://lobby/create", { method: "POST" }),
        );
        return new Response(result.body, {
          status: result.status,
          headers: { ...Object.fromEntries(result.headers), ...headers },
        });
      }
      const id = path.match(/^\/rooms\/([^/]+)$/)?.[1];
      if (
        id &&
        roomCode.test(id) &&
        request.method === "GET" &&
        request.headers.get("Upgrade")?.toLowerCase() === "websocket"
      ) {
        if (
          !(
            await env.CONNECT_LIMIT.limit({
              key: request.headers.get("CF-Connecting-IP") || "local",
            })
          ).success
        )
          return new Response("Too many connections", { status: 429, headers });
        // Reject invented IDs before allocating a room Durable Object.
        const admitted = await env.LOBBY.getByName("global").fetch(
          new Request(`https://lobby/rooms/${id}`),
        );
        if (!admitted.ok)
          return new Response("Room expired", { status: 410, headers });
        const lease = await admitted.json();
        if ((lease.game ?? "number") !== (prefix.slice(1) || "number"))
          return new Response("Wrong game", { status: 404 });
        return env.ROOMS.getByName(lease.id).fetch(
          new Request("https://room/socket", request),
        );
      }
      return new Response("Not found", { status: 404, headers });
    },
  };
}

// One persistent coordinator serializes admissions across every Worker instance.
export function roomLobbyClass(DurableObject, game) {
  return class extends DurableObject {
    constructor(ctx, env) {
      super(ctx, env);
      this.ctx = ctx;
      this.env = env;
      ctx.blockConcurrencyWhile(async () => {
        this.leases = (await ctx.storage.get("leases")) ?? {};
      });
    }
    prune() {
      pruneLeases(this.leases);
    }
    async save() {
      await this.ctx.storage.put("leases", this.leases);
      const deadlines = Object.values(this.leases).map(
        (lease) => lease.expires,
      );
      if (deadlines.length)
        await this.ctx.storage.setAlarm(Math.min(...deadlines));
    }
    async fetch(request) {
      return this.ctx.blockConcurrencyWhile(async () => {
        this.prune();
        const path = new URL(request.url).pathname;
        if (request.method === "DELETE" && path.startsWith("/rooms/")) {
          const code = path.slice(7);
          if (this.leases[code]?.id === (await request.text())) {
            delete this.leases[code];
            await this.save();
          }
          return new Response(null, { status: 204 });
        }
        if (request.method === "GET" && path.startsWith("/rooms/")) {
          const lease = this.leases[path.slice(7)];
          return lease
            ? Response.json({ id: lease.id, game: lease.game })
            : new Response(null, { status: 410 });
        }
        if (path !== "/create" || request.method !== "POST")
          return new Response(null, { status: 404 });
        const reservation = reserveRoom(
          this.leases,
          this.env.MAX_ROOMS,
          Date.now(),
          game,
        );
        if (!reservation)
          return new Response("All rooms are busy or unavailable", {
            status: 503,
            headers: { "Retry-After": "60" },
          });
        const { room, id, token, created } = reservation;
        // Persist before creating the room. A failed/ambiguous initialization keeps
        // its reservation until expiry, so retries can never overbook the cap.
        await this.save();
        const result = await this.env.ROOMS.getByName(id).fetch(
          new Request("https://room/init", {
            method: "POST",
            body: JSON.stringify({
              token,
              created,
              room,
              id,
              expires: this.leases[room].expires,
            }),
          }),
        );
        if (!result.ok)
          return new Response("Room creation unavailable", { status: 503 });
        return Response.json({ room, token });
      });
    }
    async alarm() {
      return this.ctx.blockConcurrencyWhile(async () => {
        this.prune();
        await this.save();
      });
    }
  };
}
