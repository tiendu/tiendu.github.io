import test from 'node:test';
import assert from 'node:assert/strict';
import {newRoom,joinRoom,setReady,canStart,selectCharacter,setMode,startRound,completeRound,nextRound,rematch,rosterView,setConnected,acceptInput} from '../server/room.mjs';
const fixture=(mode='competitive',characters=['Orb','Leech'])=>{
  const room=newRoom('123456','owner',1e12,mode);
  const players=characters.map((character,i)=>joinRoom(room,{character,...(i===0?{token:'owner'}:{})},String(i),'secret'+i));
  const online=new Set(players.map(p=>p.id));return {room,players,online};
};
function begin(f){for(const p of f.players)setReady(f.room,p,true);return startRound(f.room,f.online,123);}
function resolve(match,escaped,preferred=[]){
  const wisps=match.round.actors.filter(a=>a.faction==='wisp').sort((a,b)=>Number(preferred.includes(b.id))-Number(preferred.includes(a.id)));
  wisps.forEach((a,i)=>a.status=i<escaped?'escaped':'eliminated');match.round.phase='finished';match.round.result={escaped,eliminated:4-escaped};
}
test('lobby requires 2–4 connected ready players, unique characters and opposing competitive factions',()=>{
  const f=fixture('competitive',['Orb','Rune']),{room,players:[a,b],online}=f;
  assert.equal(begin(f),null);assert.equal(selectCharacter(room,b,'Orb'),false);assert.ok(selectCharacter(room,b,'Leech'));assert.equal(b.ready,false);
  assert.equal(canStart(room,online),false);setReady(room,b,true);assert.equal(canStart(room,new Set([a.id])),false);assert.ok(canStart(room,online));
  const m=startRound(room,online,123);assert.equal(m.round.actors.length,8);assert.equal(selectCharacter(room,a,'Nova'),false);assert.equal(setReady(room,a,false),false);
});
test('co-op faction locked; mode changes clear ready and reject mixed co-op roster',()=>{
  const {room,players:[a,b]}=fixture('coop',['Orb','Rune']);
  assert.equal(joinRoom(room,{character:'Leech'},'x','x'),null);assert.equal(selectCharacter(room,a,'Warden'),false);
  assert.ok(setReady(room,a,true));assert.ok(setMode(room,'competitive'));assert.equal(a.ready,false);assert.ok(selectCharacter(room,b,'Leech'));
  assert.equal(setMode(room,'coop'),false);assert.ok(selectCharacter(room,b,'Hex'));assert.ok(setMode(room,'coop'));assert.equal(room.side,'wisp');
});
test('competitive five rounds cumulative, tie extends, winning players credited exactly once and rematch retains counters',()=>{
  const f=fixture(),{room,players:[a,b],online}=f;let m=begin(f);const seeds=new Set(),roster=m.round.actors.map(a=>a.id);
  for(let i=1;i<=5;i++){
    seeds.add(m.round.seed);assert.equal(m.round.actors.length,8);assert.deepEqual(m.round.actors.map(a=>a.id),roster);
    resolve(m,2);assert.ok(completeRound(room,m));assert.equal(completeRound(room,m),false);assert.equal(room.state,'between');assert.equal(a.wins,0);assert.equal(b.wins,0);
    m=nextRound(room,online);assert.ok(m);assert.equal(m.round.actors.find(a=>a.id==='Orb').energy,100);
  }
  assert.equal(seeds.size,5);assert.equal(room.series.level,6);resolve(m,3);completeRound(room,m);assert.equal(room.state,'finished');assert.deepEqual(room.series.score,{wisp:13,hunter:11});assert.equal(a.wins,1);assert.equal(b.wins,0);
  assert.equal(nextRound(room,online),null);assert.ok(rematch(room));assert.equal(a.ready,false);assert.equal(a.wins,1);assert.equal(room.series,null);assert.ok(selectCharacter(room,a,'Hex'));assert.equal(a.wins,1);
});
test('Wisp co-op only advances when a human seat escapes; tutorial only first level',()=>{
  const f=fixture('coop',['Orb','Rune']),{room,players:[a,b],online}=f;let m=begin(f);assert.equal(m.round.tutorial,true);
  resolve(m,1,['Orb']);completeRound(room,m);assert.equal(room.state,'between');assert.equal(a.clears,1);assert.equal(b.clears,1);assert.equal(a.wins,0);
  const old=m.round.seed;m=nextRound(room,online);assert.equal(m.round.tutorial,false);assert.notEqual(m.round.seed,old);assert.equal(room.series.level,2);
  const bot=m.round.actors.find(a=>a.faction==='wisp'&&!a.player);resolve(m,1,[bot.id]);completeRound(room,m);assert.equal(room.state,'finished');assert.equal(room.series.cleared,1);assert.equal(a.clears,1);
});
test('Hunter co-op must eliminate all four; Stalker skips tutorial',()=>{
  const f=fixture('coop',['Stalker','Warden']),{room,online}=f;let m=begin(f);assert.equal(room.series.level,2);assert.equal(m.round.tutorial,false);
  resolve(m,0);completeRound(room,m);assert.equal(room.series.cleared,1);m=nextRound(room,online);resolve(m,1);completeRound(room,m);assert.equal(room.state,'finished');assert.equal(room.series.cleared,1);
});
test('offline player becomes bot next round, reconnect restores ownership and sequence stays monotonic',()=>{
  const f=fixture(),{room,players:[a,b],online}=f;let m=begin(f);assert.ok(acceptInput(m,b,{seq:1,direction:[1,0]}));resolve(m,2);completeRound(room,m);online.delete(b.id);
  m=nextRound(room,online);assert.equal(m.round.actors.find(a=>a.id==='Leech').player,null);assert.equal(acceptInput(m,b,{seq:2,direction:[1,0]}),false);setConnected(m,b,true);assert.equal(acceptInput(m,b,{seq:1,direction:[1,0]}),false);assert.ok(acceptInput(m,b,{seq:2,direction:[1,0]}));
  assert.doesNotMatch(JSON.stringify(rosterView(room,online)),/secret|owner|"seed"/);
});
test('departed Wisp seat does not count toward co-op survival',()=>{
  const f=fixture('coop',['Orb','Rune']),{room}=f,m=begin(f);room.players.shift();resolve(m,1,['Orb']);completeRound(room,m);assert.equal(room.state,'finished');assert.equal(room.series.cleared,0);
});
