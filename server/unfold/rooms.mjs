// UNFOLD room authority: deterministic engine, no client-supplied board or die.
// Transport-independent; also used directly by the test suite.
import { randomInt, randomBytes } from 'node:crypto';
import { newDistinctGame, act, endTurn } from '../../public/games/unfold/engine.mjs';

const CODE_LENGTH=6, REEL_MS=760, TURN_MS=60_000, LOCK_MS=1700;
const cleanName=v=>String(v??'').trim().replace(/[<>\u0000-\u001f]/g,'').slice(0,22);
const newToken=()=>randomBytes(24).toString('base64url');
const fail=(message,status=400)=>{const e=new Error(message);e.status=status;throw e;};
export class RoomRegistry {
  constructor({clock=()=>Date.now(),randomCode=()=>String(randomInt(0,1_000_000)).padStart(CODE_LENGTH,'0'),seed=()=>randomInt(1,0x100000000),maxRooms=200}={}){
    this.clock=clock;this.randomCode=randomCode;this.seed=seed;this.rooms=new Map();this.maxRooms=maxRooms;
  }
  requireRoom(code){const room=this.rooms.get(String(code??''));if(!room)fail('Room not found or expired',404);if(this.clock()-room.touchedAt>2*60*60*1000){this.rooms.delete(room.code);fail('Room expired',404);}this.tick(room);return room;}
  requireSeat(room,token){const seat=room.seats.find(p=>p.token===token);if(!seat)fail('Invalid room session',403);seat.seenAt=this.clock();return seat;}
  advance(room){
    room.game=endTurn(room.game);
    room.advanceAt=null;
    room.revealAt=this.clock()+REEL_MS;
    room.deadline=room.revealAt+TURN_MS;
    room.lastMove=null;
    room.revision++;
  }
  tick(room){
    const now=this.clock();
    if(room.game&&!room.game.winner){
      if(room.game.acted&&room.advanceAt!==null&&now>=room.advanceAt)this.advance(room);
      if(!room.game.acted&&!room.game.winner&&now>=room.deadline)this.advance(room);
    }
  }
  prune(){const now=this.clock();for(const [code,r] of this.rooms)if(now-r.touchedAt>2*60*60*1000)this.rooms.delete(code);}
  create({name,mode='coop'}={}){
    this.prune();if(this.rooms.size>=this.maxRooms)fail('Room capacity reached',503);
    if(!['coop','competitive'].includes(mode))fail('Choose Co-op or Competitive');
    const safe=cleanName(name);if(!safe)fail('Enter your name');
    let code;for(let i=0;i<30;i++){code=this.randomCode();if(/^\d{6}$/.test(code)&&!this.rooms.has(code))break;code=null;}
    if(!code)fail('Unable to allocate room',503);
    const now=this.clock(),token=newToken();
    const room={code,mode,hostToken:token,seats:[{token,name:safe,seenAt:now}],game:null,revision:1,touchedAt:now,revealAt:null,deadline:null,advanceAt:null,lastMove:null,round:0};
    this.rooms.set(code,room);return {code,token,snapshot:this.snapshot(room,token)};
  }
  join({code,name,token}={}){
    const room=this.requireRoom(code),now=this.clock();
    if(token){const seat=room.seats.find(p=>p.token===token);
      if(seat){seat.seenAt=now;return {code:room.code,token,snapshot:this.snapshot(room,token)};}
    }
    if(room.game)fail('Match already in progress. Use your reconnect link.',409);
    if(room.seats.length>=4)fail('Room full',409);
    const safe=cleanName(name);if(!safe)fail('Enter your name');
    token=newToken();room.seats.push({token,name:safe,seenAt:now});room.revision++;room.touchedAt=now;
    return {code:room.code,token,snapshot:this.snapshot(room,token)};
  }
  snapshot(roomOrCode,token){
    const room=typeof roomOrCode==='string'?this.requireRoom(roomOrCode):roomOrCode;
    const seat=this.requireSeat(room,token);const now=this.clock();room.touchedAt=now;
    const seatIndex=room.seats.indexOf(seat);
    return {code:room.code,mode:room.mode,host:room.hostToken===token,seat:seatIndex,
      seats:room.seats.map((s,i)=>({id:i,name:s.name,connected:now-s.seenAt<12_000})),
      revision:room.revision,round:room.round,game:room.game,
      revealAt:room.revealAt,deadline:room.deadline,advanceAt:room.advanceAt,lastMove:room.lastMove,now};
  }
  status({code,token}){const room=this.requireRoom(code);return this.snapshot(room,token);}
  start({code,token}){
    const room=this.requireRoom(code);this.requireSeat(room,token);
    if(room.hostToken!==token)fail('Only the host can start',403);
    if(room.game)fail('Match already started',409);
    if(room.seats.length<2)fail('At least two players required');
    this.newRound(room);return this.snapshot(room,token);
  }
  newRound(room){
    const next=newDistinctGame({mode:room.mode,count:room.seats.length,seed:this.seed()},room.game);
    room.round++;
    room.game=next;
    room.game.players.forEach((p,i)=>{p.name=room.seats[i].name;});
    room.revealAt=this.clock()+REEL_MS;
    room.deadline=room.revealAt+TURN_MS;
    room.advanceAt=null;room.lastMove=null;room.revision++;
  }
  ready(room,token,turn){
    const p=this.requireSeat(room,token);
    if(!room.game)fail('Match has not started',409);
    if(room.game.winner)fail('Round has finished',409);
    if(p!==room.seats[room.game.active])fail('Wait for your turn',403);
    if(this.clock()<room.revealAt)fail('Action reel has not stopped',409);
    if(room.game.acted)fail('Action already completed',409);
    if(turn!==room.game.turn)fail('Stale turn, refresh the board',409);
  }
  action({code,token,turn,payload}){
    const room=this.requireRoom(code);this.ready(room,token,turn);
    if(!payload||typeof payload!=='object'||Array.isArray(payload))fail('Invalid move');
    const prior=room.game,action=prior.die.action;
    // Engine throws for illegal placements, remote targets, duplicate actions.
    try{room.game=act(prior,payload);}catch(e){fail(e.message);}
    room.lastMove={id:room.revision+1,turn:prior.turn,actor:prior.active,action,
      payload:structuredClone(payload),beforeCube:action==='refold'?prior.cubes.find(c=>c.id===Number(payload.targetId))??null:null};
    room.advanceAt=room.game.winner?null:this.clock()+LOCK_MS;
    room.revision++;return this.snapshot(room,token);
  }
  pass({code,token,turn}){
    const room=this.requireRoom(code);this.ready(room,token,turn);
    this.advance(room);return this.snapshot(room,token);
  }
  next({code,token}){
    const room=this.requireRoom(code);this.requireSeat(room,token);
    if(room.hostToken!==token)fail('Only the host can start the next round',403);
    if(!room.game?.winner)fail('Finish the match first',409);
    this.newRound(room);return this.snapshot(room,token);
  }
  leave({code,token}){
    const room=this.requireRoom(code);const seat=this.requireSeat(room,token);
    if(room.game)fail('In-progress players may disconnect and rejoin',409);
    const i=room.seats.indexOf(seat);room.seats.splice(i,1);
    if(!room.seats.length)this.rooms.delete(room.code);
    else{if(room.hostToken===token)room.hostToken=room.seats[0].token;room.revision++;}
    return {ok:true};
  }
}
