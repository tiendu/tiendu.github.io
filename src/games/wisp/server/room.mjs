import {createRound} from '../../../../public/games/wisp/core/simulation.mjs';
import {tickRound} from '../../../../public/games/wisp/core/session.mjs';
import {createBotBrain} from '../../../../public/games/wisp/core/bots.mjs';
import {WISPS,HUNTERS} from '../../../../public/games/wisp/core/characters.mjs';
import {cardinal} from '../../../../public/games/wisp/core/movement.mjs';
import {isOpen} from '../../../../public/games/wisp/core/maze.mjs';
import {HZ} from '../../../../public/games/wisp/core/config.mjs';

const characters=[...WISPS,...HUNTERS];
export const MAX_PLAYERS=4;
export const PROTOCOL=2;
export const ROOM_TTL=60*60*1000;
export const ROOM_LIMIT=5;
export function newRoom(code,ownerToken,expires){return {code,ownerToken,expires,host:null,players:[],state:'lobby'};}
export function rosterView(room,connected){return {type:'lobby',code:room.code,state:room.state,host:room.host,players:room.players.map(({id,character})=>({id,character,connected:connected.has(id)}))};}
export function joinRoom(room,{token,character},id,newToken){
  const existing=room.players.find(p=>p.token===token);
  if(existing)return existing;
  if(room.state!=='lobby'||room.players.length>=MAX_PLAYERS||!characters.some(c=>c.id===character)||room.players.some(p=>p.character===character))return null;
  if(!room.players.length&&token!==room.ownerToken)return null;
  // A supplied but unknown token is never treated as an anonymous join.
  if(token&&token!==room.ownerToken)return null;
  if(token===room.ownerToken&&room.players.length)return null;
  const player={id,token:newToken,character,seq:0};room.players.push(player);room.host??=id;return player;
}
export function migrateHost(room,connected){if(!connected.has(room.host))room.host=room.players.find(p=>connected.has(p.id))?.id??null;}
export function startRound(room,connected,seed){
  if(room.state!=='lobby'||!connected.has(room.host)||room.players.some(p=>!connected.has(p.id)))return null;
  // All reserved seats must be present at start; disconnected players then
  // remain reserved until the end of the round.
  const humans=room.players.filter(p=>connected.has(p.id)).map(p=>({id:p.id,character:p.character}));
  const round=createRound({seed,humans});room.state='running';
  return {round,brain:createBotBrain('normal'),pending:new Map(),pings:new Map(),owners:new Map(humans.map(p=>[p.character,p.id]))};
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
