import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, endTurn, canConstruct, connectedCells, occupied, canReclaim, powerGates } from '../public/games/unfold/engine.mjs';
import { renderBoardTiles } from '../public/games/unfold/ui/board-tiles.mjs';

function blocked(s,actor){
  const baseKeys=new Set(s.players.map(p=>p.base.join(',')));
  const goal=s.goal?.join(',');
  s.obstacles=[];s.cubes=[];
  let id=10000;
  for(let y=0;y<s.size;y++)for(let x=0;x<s.size;x++){
    const k=`${x},${y}`;
    if(k!==goal&&!baseKeys.has(k))s.obstacles.push({id:id++,type:'permanent',cells:[[x,y]]});
  }
  s.active=actor;s.acted=false;s.winner=null;s.crisis=undefined;
  s.die={face:1,action:'deploy',net:0};
  return s;
}
test('only the rolled construction offer controls defeat, not RECLAIM/REFOLD',()=>{
  const s=blocked(newGame({mode:'solo',level:'open',seed:8}),0);
  assert.equal(canConstruct(s),false);
  let lost=endTurn(s);
  assert.equal(lost.winner.kind,'stuck');
  const r=blocked(newGame({mode:'solo',level:'open',seed:8}),0);
  r.die={face:4,action:'reclaim',net:null};
  r.obstacles=[]; // No target, but ordinary construction is possible next turn.
  assert.equal(endTurn(r).winner,null);
  const fresh=newGame({mode:'solo',level:'open',seed:8});
  assert.equal(canConstruct(fresh,0,{action:'special',net:null}),true);
});
test('competitive blocked construction eliminates only that player and neutralizes cubes',()=>{
  const s=blocked(newGame({mode:'competitive',count:2,seed:5}),0);
  s.cubes=[{id:707,owner:0,cells:[[1,1]]}];
  const next=endTurn(s);
  assert.deepEqual(next.winner,{kind:'competitive',players:[1]});
  assert.equal(next.players[0].alive,false);
  assert.equal(next.cubes[0].owner,null);
});
test('Co-op construction crisis gives each teammate one turn to restore the original roll',()=>{
  let s=blocked(newGame({mode:'coop',count:2,seed:4}),0);
  s=endTurn(s);
  assert.equal(s.active,1);
  assert.equal(s.crisis.actor,0);
  assert.equal(s.crisis.remaining,1);
  s.die={face:4,action:'reclaim',net:null};
  const lost=endTurn(s);
  assert.equal(lost.winner.kind,'stuck');
  s.obstacles=[];
  const saved=endTurn(s);
  assert.equal(saved.winner,null);
  assert.equal(saved.crisis,undefined);
});
test('Co-op with three players gives exactly two recovery turns',()=>{
  let s=blocked(newGame({mode:'coop',count:3,seed:14}),0);
  s=endTurn(s);
  assert.equal(s.active,1);
  assert.equal(s.crisis.remaining,2);
  s.die={face:4,action:'reclaim',net:null};
  s=endTurn(s);
  assert.equal(s.winner,null);
  assert.equal(s.active,2);
  assert.equal(s.crisis.remaining,1);
  s.die={face:4,action:'reclaim',net:null};
  assert.equal(endTurn(s).winner.kind,'stuck');
});
test('gates open permanently on one base-connected circuit and cannot be reclaimed',()=>{
  const s=newGame({mode:'solo',level:'open',seed:9});
  s.obstacles=[{id:777,type:'gate',cells:[[3,4]],open:false,terminals:[[1,4],[5,4]]}];
  s.players[0].base=[1,4];
  s.cubes=[{id:778,owner:0,cells:[[1,3],[2,3],[3,3],[4,3],[5,3],[5,4]]}];
  assert(connectedCells(s,0).has('5,4'));
  assert.equal(occupied(s).get('3,4').type,'gate');
  assert.equal(canReclaim(s,0,777),false);
  assert.equal(powerGates(s),1);
  assert.equal(s.obstacles[0].open,true);
  assert.equal(occupied(s).has('3,4'),false);
  assert(connectedCells(s,0).has('3,4')); // Gate is public walkable floor.
  assert.equal(powerGates(s),0);
});
test('generated circuit doors do not overlap terrain, remain deterministic and have reachable terminal witnesses',()=>{
  for(const level of ['starter','standard','hard'])for(const seed of [2,17]){
    const s=newGame({mode:'solo',level,seed});
    const second=newGame({mode:'solo',level,seed});
    assert.deepEqual(s,second);
    const gates=s.obstacles.filter(o=>o.type==='gate');
    assert.equal(gates.length,level==='starter'?1:3);
    for(const gate of gates){
      assert(gate.cells.length>=1&&gate.cells.length<=3);
      assert.equal(gate.terminals.length,2);
      assert.equal(gate.open,false);
      for(const terminal of gate.terminals)assert(!occupied(s).has(terminal.join(',')));
      assert(!canReclaim(s,0,gate.id));
    }
  }
});
test('gate markup shows closed shutters, powered floors and marked terminals',()=>{
  const render=(used,marks)=>renderBoardTiles({size:3,mode:'solo',used,spots:new Set(),preview:new Map(),action:null,targets:new Set(),anchor:null,placing:false,lockingCubeId:null,foldOriginId:null,gateMarks:marks});
  assert.match(render(new Map([['1,1',{kind:'obstacle',type:'gate',id:2}]]),new Map([['1,1',{kind:'gate',open:false}]])),/gate-shutter/);
  assert.match(render(new Map(),new Map([['1,1',{kind:'gate',open:true}],['0,1',{kind:'terminal',open:true,sign:'+'}]])),/gate-floor/);
  assert.match(render(new Map(),new Map([['0,1',{kind:'terminal',open:true,sign:'+'}]])),/terminal-powered/);
});
