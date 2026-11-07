import { birds, course, input, newRace, step } from "./race.mjs";
import { cleanName } from "../rules.mjs";

// Transport supplies socket identity, persistence and the race clock.
export class Flock {
  constructor(saved, save, broadcast, clock) {
    this.state = saved;
    this.save = save;
    this.broadcast = broadcast;
    this.clock = clock;
    this.members = new Map();
    this.race = saved.result ?? null;
  }
  view() {
    const { players, host } = this.state;
    return {
      host,
      players: players.map(({ id, name, bird }) => ({
        id,
        name,
        bird,
        online: this.members.has(id),
      })),
      race: this.race,
    };
  }
  async message(ws, msg) {
    if (!msg || typeof msg !== "object") return;
    const s = this.state;
    let p = s.players.find((p) => this.members.get(p.id) === ws);
    const error = (message) => ws.send(JSON.stringify({ error: message }));
    if (!p) {
      if (msg.type !== "join") return;
      const name = cleanName(msg.name);
      if (!name) return error("Enter a name (1–16 characters).");
      p = msg.token ? s.players.find((p) => p.token === msg.token) : null;
      if (msg.token && !p) return error("Seat expired. Leave and rejoin.");
      if (!p) {
        if (s.players.length >= 5 || (this.race && !this.race.over))
          return error("Room full or racing.");
        const bird = birds.findIndex(
          (_, i) => !s.players.some((p) => p.bird === i),
        );
        p = { id: crypto.randomUUID(), token: crypto.randomUUID(), bird, name };
        s.players.push(p);
      }
      const old = this.members.get(p.id);
      this.members.set(p.id, ws);
      if (old && old !== ws) old.close(1000, "Reconnected");
      p.name = name;
      ws.send(JSON.stringify({ id: p.id, token: p.token }));
    } else if (msg.type === "input") {
      if (this.race && this.race.time >= 0 && !this.race.over)
        input(
          this.race.runners.find((r) => r.id === p.id),
          msg.key,
        );
      return;
    } else if (msg.type === "bird") {
      if (
        (this.race && !this.race.over) ||
        !Number.isInteger(msg.bird) ||
        !birds[msg.bird] ||
        s.players.some((q) => q.id !== p.id && q.bird === msg.bird)
      )
        return error("Chicken unavailable.");
      p.bird = msg.bird;
    } else if (msg.type === "start") {
      if (
        p.id !== s.host ||
        this.members.size < 3 ||
        (this.race && !this.race.over)
      )
        return error("Host needs 3–5 connected players.");
      this.race = newRace(
        [...this.members.keys()],
        crypto.getRandomValues(new Uint32Array(1))[0],
      );
      delete s.result;
      this.track = course(this.race.seed);
      this.clock(true);
    } else if (msg.type === "leave") {
      this.remove(p);
      ws.close(1000, "Left room");
    } else return;
    await this.save(s);
    this.publish();
  }
  remove(p) {
    this.members.delete(p.id);
    this.state.players = this.state.players.filter((q) => q.id !== p.id);
    const runner = this.race?.runners.find((q) => q.id === p.id);
    if (runner?.status === "running") runner.status = "away";
    if (this.state.host === p.id)
      this.state.host = this.members.keys().next().value ?? null;
    if (!this.members.size) this.clock(false);
  }
  async disconnect(ws) {
    const p = this.state.players.find((q) => this.members.get(q.id) === ws);
    if (!p) return;
    this.remove(p);
    await this.save(this.state);
    this.publish();
  }
  publish() {
    this.broadcast(JSON.stringify(this.view()));
  }
  tick() {
    if (!this.race || this.race.over) return;
    step(this.race, this.track);
    step(this.race, this.track);
    if (this.race.over) {
      this.clock(false);
      this.state.result = this.race;
      return Promise.resolve(this.save(this.state)).then(() => this.publish());
    }
    this.publish();
  }
}
export function lobby(token) {
  const id = crypto.randomUUID();
  return { host: id, players: [{ id, token, name: "Host", bird: 0 }] };
}
