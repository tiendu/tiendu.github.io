import test from 'node:test';
import assert from 'node:assert/strict';
import {createRound,step,setDirection} from '../../../../public/games/wisp/core/simulation.mjs';
import {createBotBrain,planBots,BOT_LEVELS} from '../../../../public/games/wisp/core/bots.mjs';
import {graph,bfs,weightedDistances,cellId,COUNT} from '../../../../public/games/wisp/core/navigation.mjs';
import {WIDTH,HEIGHT,openCells,isOpen} from '../../../../public/games/wisp/core/maze.mjs';
import {cardinal} from '../../../../public/games/wisp/core/movement.mjs';
const point=(a,x,y,dir=[0,0])=>Object.assign(a,{x,y,dir:[...dir],wanted:null});
const get=(s,id)=>s.actors.find(a=>a.id===id);
const openBoard=()=>Array.from({length:HEIGHT},(_,y)=>Array.from({length:WIDTH},(_,x)=>Number(!x||!y||x===WIDTH-1||y===HEIGHT-1)));
function lab(w='Orb',h='Wanderer'){
  const s=createRound({seed:17,humans:[{id:'w',character:w},{id:'h',character:h}]});
  s.phase='survive';s.tick=100;s.board=openBoard();s.cells=openCells(s.board).map(([x,y])=>({x,y}));s.pickups=[];
  for(const a of s.actors){if(a.id!==w&&a.id!==h)a.status='eliminated';else a.player=null;}
  point(get(s,w),3,3);point(get(s,h),9,14);return s;
}
function botTick(s,b){
  const intents=planBots(s,b),casts=[];
  for(const i of intents){assert.ok(!i.direction||cardinal(i.direction));assert.equal(get(s,i.id).player,null);if(i.direction)setDirection(s,i.id,i.direction);if(i.ability)casts.push(i.id);}
  step(s,casts);return intents;
}
const plan=(s,id)=>planBots(s,createBotBrain('hard')).find(i=>i.id===id);
test('navigation respects blocked cells and chooses the lower-risk detour',()=>{
  const board=openBoard(),start=cellId(3,3),goal=cellId(5,3),middle=cellId(4,3);
  const g=graph(board),blocked=graph(board,[middle]);
  assert.equal(bfs(g,start)[goal],2);assert.equal(bfs(blocked,start)[goal],4);assert.equal(bfs(blocked,start)[middle],Infinity);
  const cost=new Float64Array(COUNT).fill(1);cost[middle]=10;
  assert.equal(weightedDistances(g,goal,cost)[start],4);
  assert.equal(board[3][4],0);
});
test('planning is read-only for round state and never controls human seats',()=>{
  const s=createRound({seed:4,humans:[{id:'human',character:'Orb'},{id:'opponent',character:'Stalker'}]}),b=createBotBrain();
  assert.deepEqual(planBots(s,b),[]);s.phase='survive';s.tick=60;
  const before=JSON.stringify(s),intents=planBots(s,b);
  assert.equal(JSON.stringify(s),before);assert.ok(intents.length>0);assert.ok(intents.every(i=>!get(s,i.id).player));
  s.phase='finished';assert.deepEqual(planBots(s,b),[]);
});
test('low-energy Wisp collects an available resource instead of roaming',()=>{
  const s=lab(),w=get(s,'Orb');w.energy=18;get(s,'Wanderer').player='human';
  s.pickups=[{id:0,x:4,y:3,active:true,value:30,readyAt:0}];
  assert.deepEqual(plan(s,w.id).direction,[1,0]);const b=createBotBrain();
  for(let i=0;i<12;i++)botTick(s,b);
  assert.ok(w.energy>40);
});
test('Wisps head toward the revealed portal and route around Lockdown',()=>{
  const s=lab(),w=get(s,'Orb');w.energy=90;get(s,'Wanderer').player='human';
  s.phase='escape';s.portal={x:6,y:3,closeAt:s.tick+80};s.blocks=[{x:4,y:3,until:s.tick+100}];
  assert.notDeepEqual(plan(s,w.id).direction,[1,0]);
  const b=createBotBrain('hard');for(let i=0;i<60&&s.phase!=='finished';i++)botTick(s,b);
  assert.equal(w.status,'escaped');
});
test('Wisp abilities preserve reserve, respect silence and react to corridor danger',()=>{
  const s=lab('Rune','Stalker'),w=get(s,'Rune'),h=get(s,'Stalker');point(h,4,3);
  assert.equal(plan(s,w.id).ability,true);w.energy=31;assert.equal(plan(s,w.id).ability,false);
  w.energy=100;w.silenceUntil=s.tick+20;assert.equal(plan(s,w.id).ability,false);
  const b=lab();point(get(b,'Wanderer'),4,3);assert.equal(plan(b,'Orb').ability,true);
  const c=lab();point(get(c,'Wanderer'),5,3);c.board[3][4]=1;assert.equal(plan(c,'Orb').ability,false);
});
test('protective Wisp moves toward a threatened teammate when a rescue is viable',()=>{
  const s=lab('Orb','Wanderer'),w=get(s,'Orb'),h=get(s,'Wanderer');
  const ally=s.actors.find(a=>a.faction==='wisp'&&a.id!==w.id);ally.status='active';ally.player='human';
  point(w,3,3);point(ally,6,3);point(h,7,3);h.player='human';
  const b=createBotBrain('hard'),i=planBots(s,b).find(i=>i.id===w.id);
  assert.deepEqual(i.direction,[1,0]);assert.ok(b.memory[w.id].goal>=0);
  // The rescue is not attempted when the caster cannot afford the reserve.
  w.energy=30;const low=createBotBrain('hard');planBots(s,low);assert.notEqual(low.memory[w.id].goal,b.memory[w.id].goal);
});
test('hunters take valid shortcuts and pursue a closer Echo without using its owner',()=>{
  const s=lab('Orb','Wanderer'),h=get(s,'Wanderer');get(s,'Orb').player='human';
  point(h,3,3);point(get(s,'Orb'),6,3);s.board[3][4]=1;s.board[2][4]=1;s.board[1][4]=1;s.board[4][4]=1;s.board[5][4]=1;
  const i=plan(s,h.id);assert.equal(i.ability,true);assert.deepEqual(i.direction,[1,0]);
  const b=lab('Nova','Wanderer'),a=get(b,'Wanderer');get(b,'Nova').player='human';point(a,5,5);point(get(b,'Nova'),9,5);b.decoys=[{id:'echo:Nova',owner:'Nova',character:'Nova',x:3,y:5,dir:[0,0],energy:60,until:1000}];
  assert.deepEqual(plan(b,a.id).direction,[-1,0]);
});
test('Stalker only lunges on a visible straight pursuit line',()=>{
  const s=lab('Orb','Stalker'),h=get(s,'Stalker'),w=get(s,'Orb');w.player='human';point(h,3,3);point(w,6,3);
  const i=plan(s,h.id);assert.equal(i.ability,true);assert.deepEqual(i.direction,[1,0]);
  point(w,6,4);assert.equal(plan(s,h.id).ability,false);
});
test('coordination distributes hunters when several targets are reachable',()=>{
  const s=createRound({seed:42});s.phase='survive';s.tick=100;s.board=openBoard();s.pickups=[];
  const wisps=s.actors.filter(a=>a.faction==='wisp'),hunters=s.actors.filter(a=>a.faction==='hunter');
  wisps.forEach((a,i)=>{point(a,3+i*2,4);a.player='human';});hunters.forEach((a,i)=>point(a,3+i*2,9));
  const b=createBotBrain('hard');planBots(s,b);
  const goals=hunters.map(h=>b.memory[h.id].goal);
  assert.ok(new Set(goals).size>=3);
});
test('difficulty affects perception cadence, not gameplay attributes',()=>{
  assert.ok(BOT_LEVELS.easy.reaction>BOT_LEVELS.hard.reaction);
  const s=lab('Ember','Wanderer'),b=createBotBrain('easy');planBots(s,b);const tick=b.observation.tick;
  s.tick++;point(get(s,'Ember'),4,3);planBots(s,b);assert.equal(b.observation.tick,tick);
  assert.throws(()=>createBotBrain('impossible'));
});
test('bot decisions and round outcomes replay after serializing state and brain',()=>{
  const a=createRound({seed:80}),b=createBotBrain('normal');for(let i=0;i<400;i++)botTick(a,b);
  const c=JSON.parse(JSON.stringify(a)),d=JSON.parse(JSON.stringify(b));
  for(let i=0;i<500;i++){assert.deepEqual(botTick(a,b),botTick(c,d));}
  assert.deepEqual(a,c);assert.deepEqual(b,d);
});
test('seeded complete bot matches stay legal and exercise all twelve abilities',()=>{
  const successes=new Set();let escapes=0,eliminations=0;
  for(let seed=0;seed<12;seed++){
    const s=createRound({seed}),b=createBotBrain(seed%2?'hard':'normal');
    for(let i=0;i<1800&&s.phase!=='finished';i++){
      botTick(s,b);
      for(const a of s.actors){
        if(a.lastAbility?.ok&&a.lastAbility.tick===s.tick)successes.add(a.id);
        if(a.status!=='active')continue;
        assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y));
        assert.ok(isOpen(s.board,Math.round(a.x),Math.round(a.y)));
        assert.ok(Math.abs(a.x-Math.round(a.x))<1e-7||Math.abs(a.y-Math.round(a.y))<1e-7);
        if(a.energy!==null)assert.ok(a.energy>0&&a.energy<=100);
        if(a.faction==='hunter'&&s.portal)assert.ok(Math.hypot(a.x-s.portal.x,a.y-s.portal.y)>.99);
      }
    }
    assert.equal(s.phase,'finished');assert.equal(s.result.escaped+s.result.eliminated,4);escapes+=s.result.escaped;eliminations+=s.result.eliminated;
  }
  assert.ok(escapes>0&&eliminations>0);assert.equal(successes.size,12,[...successes].join(', '));
});
