export const TTL = 60 * 60 * 1000;
export const GRACE = 30_000;
export const MAX_PLAYERS = 20;
export function secretNumber() {
  const value = new Uint32Array(1);
  do { crypto.getRandomValues(value); } while (value[0] >= 4294967292);
  return 1 + value[0] % 99;
}
export function cleanName(value) {
  if (typeof value !== 'string') return '';
  const name = value.normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu, '').trim().replace(/\s+/g, ' ');
  return [...name].length <= 16 ? name : '';
}
export function newRoom(token, now = Date.now()) {
  const id = crypto.randomUUID();
  return {players:[{id,token,name:'Host',explosions:0,connected:false,away:now}], host:id,
    order:[], turn:null, phase:'lobby', target:secretNumber(), low:0, high:100,
    revision:0, round:0, guesses:0, loser:null, loserName:'', lastGuess:null,
    expires:now+TTL, created:now};
}
export function joinPlayer(s, token, name, now = Date.now()) {
  let p = token ? s.players.find(p=>p.token===token) : undefined;
  if (token && !p) return {error:'Invalid player token',code:4001};
  if (!p) {
    if (s.players.length >= MAX_PLAYERS) return {error:'Room full',code:4003};
    name=cleanName(name);
    if (!name) return {error:'Enter a name of 1–16 characters',code:4001};
    p={id:crypto.randomUUID(),token:crypto.randomUUID(),name,explosions:0,connected:false,away:now};
    s.players.push(p);
  } else if (s.round===0 && cleanName(name)) p.name=cleanName(name);
  p.connected=true; p.away=null;
  s.revision++;
  return {player:p};
}
function available(s,id,now) {
  const p=s.players.find(p=>p.id===id);
  return p && (p.connected || now-p.away<GRACE);
}
export function nextTurn(s, after, now=Date.now()) {
  const start=s.order.indexOf(after);
  for(let n=1;n<=s.order.length;n++) {
    const id=s.order[(start+n)%s.order.length];
    if(available(s,id,now)) return id;
  }
  return null;
}
export function reconcile(s, now=Date.now()) {
  const before=JSON.stringify([s.host,s.turn]);
  if (!s.players.find(p=>p.id===s.host)?.connected)
    s.host=s.players.find(p=>p.connected)?.id ?? s.host;
  if(s.phase==='playing' && (!s.turn || !available(s,s.turn,now))) s.turn=nextTurn(s,s.turn,now);
  if(before!==JSON.stringify([s.host,s.turn])) s.revision++;
}
export function leavePlayer(s,id,now=Date.now()) {
  const next=nextTurn(s,id,now);
  s.players=s.players.filter(p=>p.id!==id);
  s.order=s.order.filter(p=>p!==id);
  if(s.turn===id) s.turn=next===id?null:next;
  s.revision++; reconcile(s,now);
}
export function move(s, player, message, now=Date.now()) {
  if(message.revision!==s.revision) return 'The room changed. Try again.';
  const p=s.players.find(p=>p.id===player);
  if(!p?.connected) return 'Reconnect first.';
  if(message.type==='start') {
    if(player!==s.host) return 'Only the host can start a round.';
    if(s.phase==='playing') return 'Finish the current round first.';
    const order=s.players.filter(p=>p.connected).map(p=>p.id);
    if(order.length<2) return 'At least two connected players are needed.';
    s.order=order; s.turn=order.includes(s.loser)?s.loser:order[0];
    s.target=secretNumber();s.low=0;s.high=100;s.guesses=0;s.lastGuess=null;
    s.phase='playing';s.round++;s.loser=null;s.loserName='';
  } else if(message.type==='guess') {
    if(s.phase!=='playing' || player!==s.turn) return 'It is not your turn.';
    if(s.order.filter(id=>s.players.find(p=>p.id===id)?.connected).length<2) return 'Waiting for another player to reconnect.';
    if(!Number.isInteger(message.value)||message.value<=s.low||message.value>=s.high) return 'Choose a number strictly inside the range.';
    const n=message.value;s.guesses++;s.lastGuess=n;
    if(n===s.target) {s.phase='over';s.loser=player;s.loserName=p.name;p.explosions=(p.explosions??0)+1;}
    else {if(n<s.target)s.low=n;else s.high=n;s.turn=nextTurn(s,player,now);}
  } else return 'Unknown action.';
  s.revision++;
  return null;
}
export function publicState(s,player) {
  return {type:'state',player,host:s.host,players:s.players.map(({id,name,connected,away,explosions=0})=>({id,name,connected,away,explosions})),
    order:s.order,phase:s.phase,turn:s.turn,low:s.low,high:s.high,revision:s.revision,
    round:s.round,guesses:s.guesses,over:s.phase==='over',loser:s.loser,loserName:s.loserName,
    lastGuess:s.lastGuess,expires:s.expires,...(s.phase==='over'?{target:s.target}:{})};
}
