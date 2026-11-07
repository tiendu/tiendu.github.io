import { Flock } from "./room.mjs";

// One active clock per room. Lobby sockets carry only player actions.
export function openFlock(state, persist, empty = async () => {}) {
  const peers = new Map();
  let timer;
  const flock = new Flock(
    state,
    persist,
    (text) => {
      for (const ws of flock.members.values())
        if (ws.readyState === 1) ws.send(text);
    },
    (running) => {
      clearInterval(timer);
      if (running) timer = setInterval(() => flock.tick(), 100);
    },
  );
  return {
    attach(ws, restoredId) {
      if (peers.size >= 7) return false;
      const known = state.players.some((p) => p.id === restoredId);
      if (known) flock.members.set(restoredId, ws);
      const peer = {
        since: Date.now(),
        count: 0,
        timeout: known
          ? null
          : setTimeout(() => ws.close(4000, "Join timeout"), 8000),
      };
      peers.set(ws, peer);
      return true;
    },
    async receive(ws, text) {
      const p = peers.get(ws);
      if (!p) return;
      if (Date.now() - p.since >= 1000) {
        p.since = Date.now();
        p.count = 0;
      }
      if (typeof text !== "string" || text.length > 512 || ++p.count > 32) {
        ws.close(4000, "Input limit");
        return;
      }
      let msg;
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }
      await flock.message(ws, msg);
      if (p.timeout) {
        for (const [id, socket] of flock.members)
          if (socket === ws) {
            clearTimeout(p.timeout);
            p.timeout = null;
            ws.serializeAttachment?.({ id });
            break;
          }
      }
    },
    async detach(ws) {
      const p = peers.get(ws);
      if (!p) return;
      clearTimeout(p.timeout);
      peers.delete(ws);
      await flock.disconnect(ws);
      if (!peers.size && !state.players.length) await empty();
    },
    close() {
      clearInterval(timer);
      for (const [ws, p] of peers) {
        clearTimeout(p.timeout);
        ws.close(1001, "Room closed");
      }
      peers.clear();
    },
  };
}
