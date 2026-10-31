import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newRoom,joinPlayer,move,publicState,reconcile,leavePlayer,TTL,GRACE,cleanName} from '../src/rules.mjs';
function group(n=3) {
 const s=newRoom('host');joinPlayer(s,'host','Tien');
 for(let i=1;i<n;i++) joinPlayer(s,undefined,`Guest ${i}`);
 assert.equal(move(s,s.host,{type:'start',revision:s.revision}),null);s.target=42;return s;
}
const command=(s,type,value)=>({type,value,revision:s.revision});
test('lobby requires two players and host approval; names are bounded',()=>{
 const s=newRoom('host');joinPlayer(s,'host','Tien');
 assert.ok(move(s,s.host,command(s,'start')));
 const guest=joinPlayer(s,null,'Guest').player;
 assert.ok(move(s,guest.id,command(s,'start')));
 assert.equal(move(s,s.host,command(s,'start')),null);
 assert.equal(cleanName(' x\n y '),'x y');assert.equal(cleanName('x'.repeat(17)),'');
 assert.ok(joinPlayer(s,'wrong','Name').error);
});
test('20 seats, stable reconnect identity, no token or target disclosure',()=>{
 const s=group(20);assert.equal(s.players.length,20);assert.equal(joinPlayer(s,null,'Extra').code,4003);
 const p=s.players[5];assert.equal(joinPlayer(s,p.token,'Different').player.id,p.id);
 assert.equal(s.players.length,20);assert.equal(p.name,'Guest 5');
 const view=publicState(s,p.id);assert.equal('target' in view,false);
 for(const person of s.players) assert.equal(JSON.stringify(view).includes(':'+JSON.stringify(person.token)),false);
});
test('join-order turns, stale commands and strict boundaries',()=>{
 const s=group();const ids=s.players.map(p=>p.id);const initial=structuredClone(s);
 for(const value of [0,100,1.5,'42',null]) assert.ok(move(s,ids[0],command(s,'guess',value)));
 assert.ok(move(s,ids[1],command(s,'guess',50)));assert.deepEqual(s,initial);
 const old=command(s,'guess',70);assert.equal(move(s,ids[0],old),null);assert.equal(s.turn,ids[1]);
 assert.ok(move(s,ids[1],old));move(s,ids[1],command(s,'guess',20));assert.equal(s.turn,ids[2]);
 move(s,ids[2],command(s,'guess',30));assert.equal(s.turn,ids[0]);
});
test('explosion ends the group round; host restarts with loser first and late arrivals',()=>{
 const s=group();const late=joinPlayer(s,null,'Late').player;
 assert.equal(s.order.includes(late.id),false);
 const loser=s.turn;move(s,loser,command(s,'guess',42));
 for(const p of s.players) {const v=publicState(s,p.id);assert.equal(v.target,42);assert.equal(v.loserName,'Tien');assert.equal(v.over,true);}
 assert.ok(move(s,late.id,command(s,'start')));
 assert.equal(move(s,s.host,command(s,'start')),null);
 assert.equal(s.turn,loser);assert.equal(s.order.includes(late.id),true);assert.equal(s.round,2);
 assert.equal('target' in publicState(s,late.id),false);
});
test('disconnect grace skips offline turns, transfers host, pauses with one player',()=>{
 const s=group();const [a,b,c]=s.players;const now=Date.now();
 b.connected=false;b.away=now;
 move(s,a.id,command(s,'guess',70),now);assert.equal(s.turn,b.id);
 reconcile(s,now+GRACE-1);assert.equal(s.turn,b.id);
 reconcile(s,now+GRACE);assert.equal(s.turn,c.id);
 a.connected=false;a.away=now;reconcile(s,now+GRACE);assert.equal(s.host,c.id);
 assert.ok(move(s,c.id,command(s,'guess',30),now+GRACE));
 joinPlayer(s,b.token,'',now+GRACE);assert.equal(move(s,c.id,command(s,'guess',30),now+GRACE),null);
 assert.equal(s.turn,b.id);
});
test('explicit leave frees a seat and transfers the current turn and host',()=>{
 const s=group(20);const first=s.turn;leavePlayer(s,first);
 assert.equal(s.players.length,19);assert.notEqual(s.host,first);assert.notEqual(s.turn,first);
 assert.ok(joinPlayer(s,null,'New').player);assert.equal(s.players.length,20);
 assert.equal(s.order.includes(s.players.at(-1).id),false);
});
test('all 99 targets reachable and fixed room expiry survives rematches',()=>{
 for(let target=1;target<=99;target++) {
  const s=group();s.target=target;
  for(let n=1;n<=target;n++) assert.equal(move(s,s.turn,command(s,'guess',n)),null);
  assert.equal(s.phase,'over');assert.equal(s.expires,s.created+TTL);
 }
});

test('explosion totals increment once, persist across rounds and reconnects, and stay public',()=>{
 const s=group();const loser=s.players[0];
 assert.deepEqual(s.players.map(p=>p.explosions),[0,0,0]);
 const winning=command(s,'guess',42);
 assert.equal(move(s,loser.id,winning),null);
 assert.equal(loser.explosions,1);
 assert.ok(move(s,loser.id,winning));
 assert.ok(move(s,loser.id,command(s,'guess',42)));
 assert.equal(loser.explosions,1);
 for(const p of s.players) assert.equal(publicState(s,p.id).players[0].explosions,1);
 const restored=JSON.parse(JSON.stringify(s));
 const rejoined=joinPlayer(restored,loser.token,'Tien').player;
 assert.equal(rejoined.explosions,1);
 assert.equal(move(restored,restored.host,command(restored,'start')),null);
 assert.equal(rejoined.explosions,1);restored.target=42;
 assert.equal(move(restored,rejoined.id,command(restored,'guess',42)),null);
 assert.equal(rejoined.explosions,2);
 assert.deepEqual(restored.players.slice(1).map(p=>p.explosions),[0,0]);
 assert.equal(joinPlayer(restored,null,'Late').player.explosions,0);
 assert.equal(newRoom('new').players[0].explosions,0);
});
test('rooms saved before counters start at zero and increment safely',()=>{
 const s=group();for(const p of s.players) delete p.explosions;
 assert.deepEqual(publicState(s,s.host).players.map(p=>p.explosions),[0,0,0]);
 assert.equal(move(s,s.turn,command(s,'guess',42)),null);
 assert.equal(s.players[0].explosions,1);
});
