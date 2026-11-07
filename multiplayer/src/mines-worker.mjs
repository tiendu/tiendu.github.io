import { DurableObject } from "cloudflare:workers";
import { roomRouter, roomLobbyClass } from "./cloudflare-rooms.mjs";
import { cleanName } from "./rules.mjs";
import { createBoard, play } from "./mines/board.mjs";

export default roomRouter("/mines");
export class MinesLobby extends roomLobbyClass(DurableObject, "mines") {}

export class MinesRoom extends DurableObject {
  async fetch(request) {
    const store = this.ctx.storage;
    if (new URL(request.url).pathname === "/init") {
      const { room, id, token, expires } = await request.json();
      await store.put("room", {
        room,
        id,
        token,
        expires,
        players: [],
        host: null,
        board: null,
        round: 0,
      });
      await store.setAlarm(expires);
      return new Response(null, { status: 204 });
    }
    const room = await store.get("room");
    if (!room || room.expires <= Date.now())
      return new Response("Room expired", { status: 410 });
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      const peer = ws.deserializeAttachment();
      if (!peer.id && Date.now() - peer.at > 10000)
        ws.close(1008, "Join timeout");
    }
    if (sockets.filter((ws) => ws.readyState === 1).length >= 10)
      return new Response("Room busy", { status: 429 });
    const [client, ws] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(ws);
    ws.serializeAttachment({ at: Date.now(), count: 0 });
    return new Response(null, { status: 101, webSocket: client });
  }

  online() {
    return this.ctx
      .getWebSockets()
      .filter((ws) => ws.readyState === 1 && ws.deserializeAttachment()?.id);
  }

  advance(room, online) {
    const seats = room.board.players;
    const index = seats.indexOf(room.turn);
    for (let step = 1; step <= seats.length; step++) {
      const next = seats[(index + step) % seats.length];
      if (online.includes(next)) {
        room.turn = next;
        room.move = (room.move ?? 0) + 1;
        break;
      }
    }
    room.skipAt = null;
  }

  async save(room) {
    const online = this.online().map((ws) => ws.deserializeAttachment().id);
    const board = room.board;
    const active = board && ["digging", "connected"].includes(board.status);
    if (active) room.turn ??= board.players[0];
    if (!active || online.includes(room.turn)) room.skipAt = null;
    else if (online.some((id) => board.players.includes(id))) {
      room.skipAt ??= Date.now() + 15000;
      if (room.skipAt <= Date.now()) this.advance(room, online);
    } else room.skipAt = null;
    await this.ctx.storage.put("room", room);
    await this.ctx.storage.setAlarm(
      Math.min(room.expires, room.skipAt ?? Infinity),
    );
  }

  broadcast(room, ping) {
    const sockets = this.online();
    const online = new Set(sockets.map((ws) => ws.deserializeAttachment().id));
    const players = room.players.map(({ id, name }) => ({
      id,
      name,
      online: online.has(id),
    }));
    const board = room.board && { ...room.board, clues: undefined };
    const message = JSON.stringify({
      players,
      board,
      host: room.host,
      round: room.round,
      turn: room.turn ?? board?.players[0],
      move: room.move ?? 0,
      ping,
    });
    for (const ws of sockets) ws.send(message);
  }

  async webSocketMessage(ws, data) {
    return this.ctx.blockConcurrencyWhile(async () => {
      try {
        const peer = ws.deserializeAttachment();
        if (Date.now() - peer.at >= 1000) {
          peer.at = Date.now();
          peer.count = 0;
        }
        peer.count++;
        ws.serializeAttachment(peer);
        if (typeof data !== "string" || data.length > 512 || peer.count > 16)
          return ws.close(1008, "Input limit");
        const msg = JSON.parse(data);
        const room = await this.ctx.storage.get("room");
        if (!room || room.expires <= Date.now())
          return ws.close(1001, "Room expired");
        const online = this.online().map((s) => s.deserializeAttachment().id);
        if (!peer.id) {
          if (msg.type !== "join") throw Error("Join first.");
          let p = room.players.find((p) => p.key === msg.key);
          if (!p) {
            const capacity = room.host || msg.token === room.token ? 5 : 4;
            if (room.players.length >= capacity) throw Error("Room full.");
            const name = cleanName(msg.name);
            if (!name) throw Error("Enter a name (1–16 characters).");
            p = { name, key: crypto.randomUUID(), id: crypto.randomUUID() };
            room.players.push(p);
            if (msg.token === room.token) room.host = p.id;
          }
          for (const old of this.online())
            if (old.deserializeAttachment().id === p.id)
              old.close(1000, "Reconnected elsewhere");
          if (room.host && !online.includes(room.host)) room.host = p.id;
          peer.id = p.id;
          ws.serializeAttachment(peer);
          await this.save(room);
          ws.send(JSON.stringify({ you: p.id, key: p.key }));
        } else if (msg.type === "ping") {
          if (
            !room.board?.players.includes(peer.id) ||
            msg.round !== room.round ||
            !Number.isInteger(msg.cell) ||
            !(room.board?.cells[msg.cell] >= 0) ||
            room.board.cells[msg.cell] === null
          )
            throw Error("Ping an open clue.");
          this.broadcast(room, { cell: msg.cell, id: peer.id });
          return;
        } else {
          if (!room.players.some((p) => p.id === peer.id))
            throw Error("Rejoin the room.");
          if (msg.round !== room.round) throw Error("Round changed.");
          if (msg.type === "start") {
            if (
              room.host !== peer.id ||
              (room.board &&
                !["perfect", "lost", "won"].includes(room.board.status))
            )
              throw Error("Host starts the next round.");
            const active = room.players.filter((p) => online.includes(p.id));
            room.board = createBoard(active.map((p) => p.id));
            room.players = active;
            room.turn = active[0].id;
            room.move = 0;
            room.round++;
          } else if (
            msg.type === "finish" &&
            room.host === peer.id &&
            room.board?.status === "connected"
          ) {
            if (
              room.board.players.filter((id) => online.includes(id)).length < 2
            )
              throw Error("Round paused.");
            room.board.status = "won";
          } else if (msg.type === "leave") {
            room.players = room.players.filter((p) => p.id !== peer.id);
            if (room.host === peer.id)
              room.host =
                room.players.find((p) => online.includes(p.id))?.id ??
                room.players[0]?.id ??
                null;
            if (
              room.board &&
              room.board.players.filter((id) =>
                room.players.some((p) => p.id === id),
              ).length < 2
            )
              room.board = null;
            if (room.board && room.turn === peer.id)
              this.advance(
                room,
                online.filter((id) => id !== peer.id),
              );
            ws.close(1000, "Left room");
            if (!room.players.length) {
              await this.env.LOBBY.getByName("global").fetch(
                new Request("https://lobby/rooms/" + room.room, {
                  method: "DELETE",
                  body: room.id,
                }),
              );
              await this.expire();
              return;
            }
          } else if (room.board) {
            const b = room.board;
            if (!b.players.includes(peer.id))
              throw Error("You’re in next round.");
            if (b.players.filter((id) => online.includes(id)).length < 2)
              throw Error("Waiting for a teammate to reconnect.");
            const takesTurn = msg.type === "dig" || msg.type === "pass";
            if (
              takesTurn &&
              (peer.id !== (room.turn ?? b.players[0]) ||
                (msg.move !== undefined && msg.move !== (room.move ?? 0)))
            )
              throw Error("Wait for your turn.");
            if (msg.type !== "pass") play(b, peer.id, msg.type, msg.cell);
            else if (!["digging", "connected"].includes(b.status))
              throw Error("Round finished.");
            if (takesTurn) this.advance(room, online);
          } else throw Error("Start the round first.");
          await this.save(room);
        }
        this.broadcast(room);
      } catch (error) {
        if (ws.readyState === 1)
          ws.send(JSON.stringify({ error: error.message }));
      }
    });
  }

  async webSocketClose(ws) {
    ws.close();
    await this.ctx.blockConcurrencyWhile(async () => {
      const room = await this.ctx.storage.get("room");
      if (!room) return;
      const online = this.online().map((s) => s.deserializeAttachment().id);
      if (room.host && !online.includes(room.host) && online.length) {
        room.host = online[0];
      }
      await this.save(room);
      this.broadcast(room);
    });
  }
  async alarm() {
    await this.ctx.blockConcurrencyWhile(async () => {
      const room = await this.ctx.storage.get("room");
      if (!room || room.expires <= Date.now()) return this.expire();
      await this.save(room);
      this.broadcast(room);
    });
  }

  async expire() {
    for (const ws of this.ctx.getWebSockets()) ws.close(1001, "Room expired");
    await this.ctx.storage.deleteAll();
  }
}
