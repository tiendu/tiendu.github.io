// WISP multiplayer room state. Room membership and race results are held here;
// client physics remains a beta trust boundary until full server simulation lands.
export const WISPS = Object.freeze(['Ember', 'Moss', 'Dew', 'Gale', 'Dusk']);
export const MAX_PLAYERS = 4;
export const ROOM_TTL_MS = 45 * 60_000;
const CODE = /^\d{6}$/;
const TOKEN = /^[a-zA-Z0-9-]{20,100}$/;
const clean = (name) => String(name ?? '').trim().replace(/[\u0000-\u001F\u007F<>]/g, '').slice(0, 18) || 'Wisp';
const error = (reason, status = 400) => Object.assign(new Error(reason), { status });
const int = (v, lo, hi) => Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : lo;

export class WispRegistry {
  constructor({now = () => Date.now(), random = Math.random, token = () => crypto.randomUUID()} = {}) {
    this.rooms = new Map();
    this.now = now;
    this.random = random;
    this.token = token;
  }
  prune() {
    const now = this.now();
    for (const [code, room] of this.rooms) if (room.expires < now) this.rooms.delete(code);
  }
  require(code) {
    if (!CODE.test(String(code ?? ''))) throw error('Invalid room code');
    const room = this.rooms.get(code);
    if (!room) throw error('Room expired or not found', 404);
    return room;
  }
  player(room, token) {
    if (!TOKEN.test(String(token ?? ''))) throw error('Invalid room session', 403);
    const player = room.players.find(p => p.token === token);
    if (!player) throw error('Not a member of this room', 403);
    return player;
  }
  touch(room) { room.expires = this.now() + ROOM_TTL_MS; room.revision++; }
  allocateCode() {
    for (let i = 0; i < 50; i++) {
      const code = String(100000 + Math.floor(this.random() * 900000));
      if (!this.rooms.has(code)) return code;
    }
    throw error('Rooms are busy; try again', 503);
  }
  newPlayer(name, wisp, host = false) {
    if (!WISPS.includes(wisp)) throw error('Choose one of the five wisps');
    return { id: this.token(), token: this.token(), name: clean(name), wisp, host,
      connected: true, alive: true, distance: 0, x: 155, y: 380, energy: 100,
      submittedAt: 0, lastSeen: this.now(), lastEnergyGainX: 155, lastReportedEnergy: 100, sequence: -1, reason: null };
  }
  snapshot(room, player = null) {
    return {
      code: room.code, state: room.state, seed: room.seed, startAt: room.startAt,
      serverNow: this.now(), revision: room.revision, winnerId: room.winnerId,
      me: player?.id ?? null, host: Boolean(player?.host),
      players: room.players.map(p => ({id:p.id, name:p.name, wisp:p.wisp,
        host:p.host, connected:p.connected, alive:p.alive, distance:p.distance,
        x:p.x, y:p.y, energy:p.energy, reason:p.reason})),
    };
  }
  create({name, wisp = 'Moss'} = {}) {
    this.prune();
    if (this.rooms.size >= 40) throw error('All rooms are currently busy', 503);
    const code = this.allocateCode();
    const host = this.newPlayer(name, wisp, true);
    const room = {code, state:'lobby', seed:null, startAt:null,
      created:this.now(), expires:this.now()+ROOM_TTL_MS, revision:1,
      winnerId:null, players:[host]};
    this.rooms.set(code, room);
    return {token:host.token, snapshot:this.snapshot(room, host)};
  }
  join({code, name, wisp = 'Moss'} = {}) {
    const room = this.require(String(code));
    if (room.state !== 'lobby') throw error('This race has already started', 409);
    if (room.players.length >= MAX_PLAYERS) throw error('Room is full', 409);
    const p = this.newPlayer(name, wisp);
    room.players.push(p); this.touch(room);
    return {token:p.token, snapshot:this.snapshot(room, p)};
  }
  state({code, token} = {}) {
    const room = this.require(String(code));
    const p = this.player(room, token);
    p.lastSeen = this.now(); p.connected = true;
    this.evaluate(room);
    return this.snapshot(room,p);
  }
  start({code, token} = {}) {
    const room = this.require(String(code));
    const p = this.player(room, token);
    if (!p.host) throw error('Only the host can start', 403);
    if (room.state !== 'lobby') throw error('Race already started', 409);
    if (room.players.length < 2) throw error('At least two wisps are needed');
    room.state = 'running';
    room.startAt = this.now()+3000;
    room.seed = int(this.random()*2**31, 0, 2**31-1);
    for (const other of room.players) {
      Object.assign(other,{alive:true,connected:true,distance:0,x:155,y:380,energy:100,
        submittedAt:0,lastEnergyGainX:155,lastReportedEnergy:100,sequence:-1,reason:null,lastSeen:this.now()});
    }
    this.touch(room);return this.snapshot(room,p);
  }
  sync({code, token, sequence, x, y, energy, eliminated=false, reason=null}={}) {
    const room = this.require(String(code));
    const p = this.player(room, token);
    if (room.state !== 'running') return this.snapshot(room,p);
    const now = this.now();
    p.connected = true;p.lastSeen = now;
    if (now < room.startAt || !p.alive) return this.snapshot(room,p);
    if (!Number.isSafeInteger(sequence) || sequence <= p.sequence) return this.snapshot(room,p);
    if (!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(energy)) throw error('Invalid race state');
    // Prevent teleporting by chaining tiny requests or submitting a fake huge x.
    // The absolute race-time cap also limits cumulative speed across requests.
    // This is NOT authoritative simulation: client-side collisions still need a
    // trusted server implementation in a later milestone.
    const elapsed = p.submittedAt ? Math.min(2,(now-p.submittedAt)/1000) : Math.min(2,(now-room.startAt)/1000);
    const raceElapsed = Math.max(0,(now-room.startAt)/1000);
    const allowance = 285*Math.max(0,elapsed)+16;
    const raceLimit = 155+285*raceElapsed+45;
    const nextX = Math.max(p.x,Math.min(Math.max(155,x),p.x+allowance,raceLimit));
    if(energy<0 || energy>100)throw error('Invalid energy value');
    // No button or browser request may grant arbitrary full energy. A normal
    // pickup is +10; the risky Greater Essence is +25. Legitimate +25 gains
    // require movement between pickups. This bounds abuse, but cannot prove
    // the player actually touched an orb without server-side physics.
    const gain=energy-(Number.isFinite(p.lastReportedEnergy)?p.lastReportedEnergy:p.energy);
    if(gain>.05){
      const moved=nextX-p.x;
      const maxGain=25*Math.max(1,Math.ceil(moved/180))+1;
      if(gain>maxGain || nextX-(p.lastEnergyGainX??155)<55)
        throw error('Invalid energy refill');
      p.lastEnergyGainX=nextX;
    }
    p.x=nextX;
    p.y=int(y,-500,1200);
    p.energy=int(energy,0,100);
    p.lastReportedEnergy=energy;
    p.distance = Math.round(Math.max(0,p.x-155));
    p.sequence = sequence;p.submittedAt = now;
    if (eliminated) {p.alive=false;p.reason=String(reason ?? 'eliminated').slice(0,90);}
    this.evaluate(room);
    room.revision++;
    return this.snapshot(room,p);
  }
  evaluate(room) {
    if (room.state !== 'running') return;
    const now = this.now();
    if (now < room.startAt) return;
    for (const p of room.players) {
      p.connected = now-p.lastSeen < 12_000;
      if (p.alive && now-p.lastSeen > 35_000) {
        p.alive=false;p.reason='Disconnected';
      }
    }
    const alive = room.players.filter(p=>p.alive);
    if (alive.length <= 1) {
      room.state='finished';
      room.winnerId = alive[0]?.id ?? [...room.players].sort((a,b)=>b.distance-a.distance)[0]?.id ?? null;
      this.touch(room);
    }
  }
  leave({code,token}={}) {
    const room=this.require(String(code)), p=this.player(room,token);
    if (room.state==='lobby') {
      room.players=room.players.filter(x=>x!==p);
      if (!room.players.length) this.rooms.delete(room.code);
      else {if (p.host) room.players[0].host=true;this.touch(room);}
    } else if (room.state==='running') {
      p.alive=false;p.connected=false;p.reason='Left race';this.evaluate(room);this.touch(room);
    }
    return {ok:true};
  }
}
