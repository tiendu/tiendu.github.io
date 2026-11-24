import {createRound} from '../../../../public/games/wisp/core/simulation.mjs';
import {tickRound,levelDifficulty,levelSeed} from '../../../../public/games/wisp/core/session.mjs';
import {createBotBrain} from '../../../../public/games/wisp/core/bots.mjs';
import {WISPS,HUNTERS} from '../../../../public/games/wisp/core/characters.mjs';
import {cardinal} from '../../../../public/games/wisp/core/movement.mjs';
import {isOpen} from '../../../../public/games/wisp/core/maze.mjs';
import {HZ} from '../../../../public/games/wisp/core/config.mjs';

const characters=[...WISPS,...HUNTERS];
export const MAX_PLAYERS=4;
export const PROTOCOL=3;
export const ROOM_TTL=60*60*1000;
export const ROOM_LIMIT=5;
export const MODES=['coop','competitive'];
const faction=character=>characters.find(c=>c.id===character)?.faction;
export function newRoom(code,ownerToken,expires,mode='competitive'){
  if(!MODES.includes(mode))throw new Error('Invalid mode');
  return {code,ownerToken,expires,host:null,players:[],state:'lobby',mode,side:null,series:null,result:null};
}
export function canStart(room,connected){
  return room.state==='lobby'&&room.players.length>=2&&connected.has(room.host)&&room.players.every(p=>connected.has(p.id)&&p.ready)&&
    (room.mode==='coop'?room.players.every(p=>faction(p.character)===room.side):new Set(room.players.map(p=>faction(p.character))).size===2);
}
export function rosterView(room,connected){return {type:'lobby',code:room.code,state:room.state,host:room.host,mode:room.mode,side:room.side,
  canStart:canStart(room,connected),series:room.series&&{mode:room.mode,level:room.series.level,cleared:room.series.cleared,score:room.series.score,history:room.series.history,last:room.series.last,winner:room.series.winner},
  players:room.players.map(({id,character,ready,wins,clears})=>({id,character,ready:!!ready,wins,clears,connected:connected.has(id)}))};}
export function joinRoom(room,{token,character},id,newToken){
  const existing=room.players.find(p=>p.token===token);
  if(existing)return existing;
  if(room.state!=='lobby'||room.players.length>=MAX_PLAYERS||!faction(character)||room.players.some(p=>p.character===character))return null;
  if(!room.players.length&&token!==room.ownerToken)return null;
  if(token&&token!==room.ownerToken)return null;
  if(token===room.ownerToken&&room.players.length)return null;
  if(room.mode==='coop'&&room.side&&faction(character)!==room.side)return null;
  const player={id,token:newToken,character,seq:0,ready:false,wins:0,clears:0};room.players.push(player);room.host??=id;
  if(room.mode==='coop')room.side??=faction(character);
  return player;
}
export function selectCharacter(room,p,character){
  if(room.state!=='lobby'||!faction(character)||room.players.some(q=>q!==p&&q.character===character))return false;
  if(room.mode==='coop'&&faction(character)!==room.side){if(room.players.length!==1)return false;room.side=faction(character);}
  p.character=character;p.ready=false;return true;
}
export function setMode(room,mode){
  if(room.state!=='lobby'||!MODES.includes(mode))return false;
  const sides=new Set(room.players.map(p=>faction(p.character)));
  if(mode==='coop'&&sides.size>1)return false;
  if(mode!==room.mode){room.mode=mode;room.side=mode==='coop'?[...sides][0]??null:null;for(const p of room.players)p.ready=false;}
  return true;
}
export function setReady(room,p,ready){if(room.state!=='lobby'||typeof ready!=='boolean')return false;p.ready=ready;return true;}
export function migrateHost(room,connected){if(!connected.has(room.host))room.host=room.players.find(p=>connected.has(p.id))?.id??null;}
function makeMatch(room,connected){
  const series=room.series, humans=series.roster;
  const tutorial=room.mode==='coop'&&series.level===1;
  const round=createRound({seed:levelSeed(series.seed,series.level),tutorial,rosterSeed:levelSeed(series.seed,2),humans});
  room.state='running';room.result=null;
  const match={round,brain:createBotBrain(room.mode==='coop'?levelDifficulty(series.level):'normal'),pending:new Map(),pings:new Map(),owners:new Map(humans.map(p=>[p.character,p.id]))};
  for(const p of humans)if(!connected.has(p.id))setConnected(match,p,false);
  return match;
}
export function startRound(room,connected,seed){
  if(!canStart(room,connected))return null;
  const roster=room.players.map(({id,character})=>({id,character}));
  room.series={seed,roster,level:room.mode==='coop'&&roster.some(p=>p.character==='Stalker')?2:1,cleared:0,score:{wisp:0,hunter:0},history:[],last:null,winner:null};
  return makeMatch(room,connected);
}
export function completeRound(room,match){
  if(room.state!=='running'||match.round.phase!=='finished'||!match.round.result)return false;
  const series=room.series,{escaped,eliminated}=match.round.result;
  series.score.wisp+=escaped;series.score.hunter+=eliminated;
  const humanEscapes=match.round.actors.filter(a=>a.faction==='wisp'&&a.status==='escaped'&&room.players.some(p=>p.id===match.owners.get(a.id))).length;
  const cleared=room.mode==='coop'&&(room.side==='wisp'?humanEscapes>0:eliminated===4);
  series.last={level:series.level,escaped,eliminated,humanEscapes,cleared};
  series.history.push(series.last);if(series.history.length>10)series.history.shift();
  room.result={escaped,eliminated};
  if(room.mode==='coop'){
    if(cleared){series.cleared++;for(const p of room.players)p.clears++;room.state='between';}
    else{series.winner='opponents';room.state='finished';}
  }else if(series.level>=5&&series.score.wisp!==series.score.hunter){
    series.winner=series.score.wisp>series.score.hunter?'wisp':'hunter';room.state='finished';
    for(const p of room.players)if(faction(p.character)===series.winner)p.wins++;
  }else room.state='between';
  return true;
}
export function nextRound(room,connected){
  if(room.state!=='between'||!connected.has(room.host))return null;
  room.series.level++;return makeMatch(room,connected);
}
export function rematch(room){
  if(!['finished','aborted','between'].includes(room.state))return false;
  room.state='lobby';room.series=null;room.result=null;for(const p of room.players)p.ready=false;return true;
}
export function acceptInput(match,player,msg){
  if(!match||!player||!Number.isSafeInteger(msg.seq)||msg.seq<=player.seq||msg.seq>player.seq+10000)return false;
  if(match.owners.get(player.character)!==player.id||match.round.phase==='finished')return false;
  if(msg.direction!==undefined&&!cardinal(msg.direction)||msg.ability!==undefined&&typeof msg.ability!=='boolean'||msg.direction===undefined&&msg.ability!==true)return false;
  const a=match.round.actors.find(a=>a.id===player.character);
  if(a.player!==player.id||a.status!=='active')return false;
  player.seq=msg.seq;
  const old=match.pending.get(player.id)??{id:a.id};
  match.pending.set(player.id,{id:a.id,direction:msg.direction??old.direction,ability:!!(msg.ability||old.ability)});
  return true;
}
export function setConnected(match,player,connected){
  if(!match||match.owners.get(player.character)!==player.id)return;
  const a=match.round.actors.find(a=>a.id===player.character);
  a.player=connected?player.id:null;match.pending.delete(player.id);delete match.brain.memory[a.id];
}
export function tickMatch(match){
  tickRound(match.round,match.brain,[...match.pending.values()]);match.pending.clear();
  for(const [id,p] of match.pings)if(p.until<=match.round.tick)match.pings.delete(id);
  return match.round.phase==='finished';
}
export function addPing(match,player,x,y){
  if(!match||!Number.isInteger(x)||!Number.isInteger(y)||!isOpen(match.round.board,x,y))return false;
  if(!['survive','escape'].includes(match.round.phase)||match.owners.get(player.character)!==player.id)return false;
  const a=match.round.actors.find(a=>a.id===player.character),old=match.pings.get(player.id);
  if(a.status!=='active'||a.player!==player.id||old&&old.until>match.round.tick+2*HZ)return false;
  match.pings.set(player.id,{x,y,faction:a.faction,until:match.round.tick+3*HZ});return true;
}
// No credentials, bot planning state, random state, contact history, or precise
// opponent energy/readiness in the wire snapshot. The client reuses definitions.
export function snapshot(match,player){
  const s=match.round,own=match.owners.get(player.character)===player.id?player.character:null;
  const faction=characters.find(c=>c.id===player.character)?.faction;
  const actors=s.actors.map(a=>{
    const {path,color,ability,cost,damage,cooldown,faction:side,player:owner,wanted,lastAbility,readyAt,energy,...rest}=a;
    const mine=a.id===own;
    return {...rest,player:mine&&owner===player.id?'local':null,energy:energy===null?null:mine||side===faction?energy:Math.round(energy/10)*10,
      ...(mine?{wanted,lastAbility,readyAt}:{})};
  });
  return {type:'snapshot',ack:player.seq,tick:s.tick,seed:s.seed,phase:s.phase,board:s.board,actors,
    pickups:s.pickups.filter(p=>p.active).map(({id,x,y,value})=>({id,x,y,value,active:true})),portal:s.portal,result:s.result,
    blocks:s.blocks,decoys:s.decoys.map(({id,character,x,y,energy})=>({id,character,x,y,energy:faction==='hunter'?Math.round(energy/10)*10:energy})),effects:s.effects,
    pings:[...match.pings.values()].filter(p=>p.faction===faction).map(({x,y,until})=>({x,y,until}))};
}
