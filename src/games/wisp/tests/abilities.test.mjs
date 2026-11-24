import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,step,activateAbility,setDirection} from '../../../../public/games/wisp/core/simulation.mjs';
import {ABILITIES,corridorDistance,abilityAvailability} from '../../../../public/games/wisp/core/abilities.mjs';
import {WISPS,HUNTERS} from '../../../../public/games/wisp/core/characters.mjs';
import {openCells,isOpen} from '../../../../public/games/wisp/core/maze.mjs';
import {HZ,RULES} from '../../../../public/games/wisp/core/config.mjs';
const get=(s,id)=>s.actors.find(a=>a.id===id);
const place=(a,x,y,d=[0,0])=>Object.assign(a,{x,y,dir:[...d],wanted:null});
const run=(s,n)=>{for(let i=0;i<n;i++)step(s);return s;};
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const board=()=>Array.from({length:9},(_,y)=>Array.from({length:9},(_,x)=>Number(!x||!y||x===8||y===8)));
function lab(w='Orb',h='Wanderer'){
  const s=createRound({seed:42,humans:[{id:'w',character:w},{id:'h',character:h}]});
  run(s,RULES.prepare*HZ);s.board=board();s.cells=openCells(s.board).map(([x,y])=>({x,y}));s.pickups=[];
  for(const a of s.actors)if(a.id!==w&&a.id!==h)a.status='eliminated';
  place(get(s,w),2,3);place(get(s,h),6,6);return s;
}
const cast=(s,id)=>{const result=activateAbility(s,id);assert.equal(result.ok,true,result.reason);};
test('all 12 abilities have explicit cooldowns; invalid activation costs nothing',()=>{
  assert.deepEqual(Object.keys(ABILITIES).sort(),[...WISPS,...HUNTERS].map(a=>a.id).sort());
  const s=lab(),w=get(s,'Orb');const before=JSON.stringify(s);assert.equal(activateAbility(s,'Orb').ok,false);assert.equal(JSON.stringify(s),before);
  place(get(s,'Wanderer'),3,3);w.energy=20;assert.equal(activateAbility(s,'Orb').ok,false);w.energy=100;
  s.phase='prepare';assert.equal(activateAbility(s,'Orb').ok,false);s.phase='survive';cast(s,'Orb');assert.equal(w.energy,80);
  const snapshot=JSON.stringify(s);assert.equal(activateAbility(s,'Orb').ok,false);assert.equal(JSON.stringify(s),snapshot);
});
test('Orb repulses along corridors, stuns and cannot hit through a wall',()=>{
  const s=lab(),w=get(s,'Orb'),h=get(s,'Wanderer');place(h,3,3);cast(s,w.id);assert.equal(h.x,4);assert.equal(h.stunUntil,s.tick+HZ);assert.equal(h.warp,1);
  setDirection(s,h.id,[-1,0]);run(s,HZ-1);approx(h.x,4);step(s);assert.ok(h.x<4);
  const b=lab();b.board[3][3]=1;place(get(b,'Wanderer'),4,3);assert.equal(activateAbility(b,'Orb').ok,false);
  assert.ok(corridorDistance(b.board,get(b,'Orb'),get(b,'Wanderer'))>2);
});
test('Prism crosses exactly one wall; invalid phase is free and portal landing escapes',()=>{
  const s=lab('Prism');const a=get(s,'Prism');setDirection(s,a.id,[1,0]);assert.equal(activateAbility(s,a.id).ok,false);
  s.board[3][3]=1;s.board[3][4]=1;assert.equal(activateAbility(s,a.id).ok,false);s.board[3][4]=0;
  s.portal={x:4,y:3,closeAt:s.tick+400};s.phase='escape';step(s,[a.id]);assert.equal(a.status,'escaped');assert.equal(a.energy,75);assert.equal(a.warp,1);
});
test('Ember doubles speed for exactly 2 seconds and can turn normally',()=>{
  const s=lab('Ember');const a=get(s,'Ember');setDirection(s,a.id,[1,0]);step(s,[a.id]);approx(a.x,2.3);assert.equal(a.energy,79.9);
  setDirection(s,a.id,[0,-1]);run(s,3);approx(a.x,3);approx(a.y,2.8);
  // Isolate duration from the geometry and ensure speed multiplier expires.
  place(a,2,3,[1,0]);s.tick=a.surgeUntil-1;step(s);approx(a.x,2.15);
});
test('Rune barrier absorbs lethal contact once, gives immunity and consumes recovery',()=>{
  const s=lab('Rune','Stalker'),w=get(s,'Rune'),h=get(s,'Stalker');place(h,w.x,w.y);step(s,[w.id]);assert.equal(w.status,'active');approx(w.energy,69.9);assert.equal(w.barrierUntil,0);assert.equal(w.immuneUntil,s.tick+2*HZ);assert.equal(h.recoverUntil,s.tick+5*HZ);
  place(h,6,6);run(s,5*HZ);place(h,w.x,w.y);step(s);assert.equal(w.status,'eliminated');
});
test('Nova echo follows legal corridors, absorbs hunter contact but never awards a kill',()=>{
  const s=lab('Nova'),w=get(s,'Nova'),h=get(s,'Wanderer');setDirection(s,w.id,[1,0]);step(s,[w.id]);assert.equal(s.decoys.length,1);const d=s.decoys[0];assert.equal(d.character,w.id);assert.equal(s.actors.length,8);assert.ok(isOpen(s.board,Math.round(d.x),Math.round(d.y)));
  place(h,d.x,d.y);step(s);assert.equal(s.decoys.length,0);assert.equal(w.status,'active');assert.ok(h.recoverUntil>s.tick);assert.equal(s.result,null);
  const b=lab('Nova');step(b,['Nova']);run(b,3*HZ);assert.equal(b.decoys.length,0);
});
test('Hex slows only nearby hunters for 3 seconds, not Wisps or through walls',()=>{
  const s=lab('Hex');const h=get(s,'Wanderer'),w=get(s,'Hex');place(h,4,3);setDirection(s,h.id,[1,0]);step(s,[w.id]);approx(h.x,4.075);assert.equal(h.slowUntil,s.tick+3*HZ);
  place(h,4,3,[1,0]);s.tick=h.slowUntil-1;step(s);approx(h.x,4.15);
  const b=lab('Hex');b.board[3][3]=1;place(get(b,'Wanderer'),4,3);assert.equal(activateAbility(b,'Hex').ok,false);
});
test('Stalker telegraphs, lunges straight, cannot turn during lunge, stops at wall',()=>{
  const s=lab('Orb','Stalker'),h=get(s,'Stalker');place(h,2,6);setDirection(s,h.id,[1,0]);step(s,[h.id]);approx(h.x,2);const charge=h.lunge.chargeUntil;setDirection(s,h.id,[0,-1]);run(s,charge-s.tick);approx(h.x,2.375);approx(h.y,6);run(s,4);approx(h.y,6);assert.ok(h.x>3);
  s.board[6][5]=1;run(s,10);assert.equal(h.lunge,null);assert.ok(h.x<=4);
});
test('Interceptor blocks Wisps only, expires, rejects occupied tile and unsafe cuts',()=>{
  const s=lab('Orb','Interceptor'),w=get(s,'Orb'),h=get(s,'Interceptor');place(h,3,4);setDirection(s,h.id,[1,0]);place(w,4,3);setDirection(s,w.id,[0,1]);step(s,[h.id]);assert.equal(s.blocks.length,1);assert.deepEqual([s.blocks[0].x,s.blocks[0].y],[4,4]);approx(w.y,3);run(s,6);assert.ok(h.x>4);approx(w.y,3);s.tick=s.blocks[0].until-1;step(s);assert.equal(s.blocks.length,0);assert.ok(w.y>3);
  const b=lab('Orb','Interceptor');place(get(b,'Interceptor'),3,4);setDirection(b,'Interceptor',[1,0]);place(get(b,'Orb'),4,4);assert.equal(activateAbility(b,'Interceptor').ok,false);
  place(get(b,'Orb'),2,3);b.portal={x:4,y:4,closeAt:1000};assert.equal(activateAbility(b,'Interceptor').ok,false);
  b.portal=null;b.board=Array.from({length:9},(_,y)=>Array.from({length:9},(_,x)=>Number(!(y===4&&x>0&&x<8))));assert.equal(activateAbility(b,'Interceptor').ok,false);
});
test('Wanderer phase respects active portal and bypasses Wisp-only barricades',()=>{
  const s=lab();const h=get(s,'Wanderer');place(h,2,5);setDirection(s,h.id,[1,0]);s.board[5][3]=1;s.portal={x:4,y:5,closeAt:1000};assert.equal(activateAbility(s,h.id).ok,false);
  s.portal=null;s.blocks=[{x:4,y:5,until:1000}];cast(s,h.id);assert.equal(h.x,4);assert.equal(h.energy,null);
});
test('Warden devours only reachable energy; particles respawn normally',()=>{
  const s=lab('Orb','Warden');place(get(s,'Warden'),3,5);s.board[5][4]=1;s.pickups=[{id:1,x:3,y:4,active:true,value:30,readyAt:0},{id:2,x:5,y:5,active:true,value:5,readyAt:0}];cast(s,'Warden');assert.equal(s.pickups[0].active,false);assert.equal(s.pickups[1].active,true);run(s,RULES.pickupRespawn*HZ);assert.equal(s.pickups[0].active,true);
});
test('Leech drains 5 energy/s for exactly 3 seconds, never through walls',()=>{
  const s=lab('Orb','Leech'),w=get(s,'Orb'),h=get(s,'Leech');place(h,4,3);step(s,[h.id]);run(s,3*HZ-1);approx(w.energy,79);step(s);approx(w.energy,78.9);
  const b=lab('Orb','Leech');place(get(b,'Leech'),4,3);b.board[3][3]=1;step(b,['Leech']);run(b,19);approx(get(b,'Orb').energy,98);
  const c=lab('Orb','Leech');place(get(c,'Leech'),4,3);get(c,'Orb').energy=.2;step(c,['Leech']);assert.equal(get(c,'Orb').reason,'Leech drain');
});
test('Sentinel silences new activations but does not cancel an existing ability',()=>{
  const s=lab('Ember','Sentinel'),w=get(s,'Ember'),h=get(s,'Sentinel');place(h,4,3);step(s,[w.id,h.id]);assert.ok(w.surgeUntil>s.tick);assert.equal(abilityAvailability(s,w),'Silenced');const end=w.silenceUntil;s.tick=end;w.readyAt=0;assert.equal(abilityAvailability(s,w),'');
  const b=lab('Ember','Sentinel');place(get(b,'Sentinel'),4,3);b.board[3][3]=1;assert.equal(activateAbility(b,'Sentinel').ok,false);
});
test('ability intents resolve in roster order and state survives JSON roundtrip',()=>{
  const s=lab('Ember','Sentinel'),h=get(s,'Sentinel');place(h,4,3);const b=JSON.parse(JSON.stringify(s));
  step(s,['Ember','Sentinel','Ember']);step(b,['Sentinel','Ember']);assert.deepEqual(s,b);run(s,200);run(b,200);assert.deepEqual(s,b);assert.equal(s.effects.length,0);
});
test('mixed ability and movement intents keep active characters on legal edges',()=>{
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  let successes=0;
  for(let seed=0;seed<40;seed++){
    const s=createRound({seed});run(s,60);
    let r=seed+1;const random=()=>((r=(Math.imul(r,1664525)+1013904223)>>>0)/4294967296);
    for(let i=0;i<1400&&s.phase!=='finished';i++){
      const casts=[];
      for(const a of s.actors){if(random()<.1)setDirection(s,a.id,dirs[Math.floor(random()*4)]);if(random()<.02)casts.push(a.id);}
      step(s,casts);successes+=s.actors.filter(a=>a.lastAbility?.tick===s.tick&&a.lastAbility.ok).length;
      for(const a of [...s.actors.filter(a=>a.status==='active'),...s.decoys]){
        assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y));
        assert.ok(isOpen(s.board,Math.round(a.x),Math.round(a.y)));
        assert.ok(Math.abs(a.x-Math.round(a.x))<1e-8||Math.abs(a.y-Math.round(a.y))<1e-8);
        if(a.energy!==null)assert.ok(a.energy>=0&&a.energy<=100);
        if(a.faction==='hunter'&&s.portal)assert.ok(Math.hypot(a.x-s.portal.x,a.y-s.portal.y)>.99);
      }
    }
  }
  assert.ok(successes>100);
});
