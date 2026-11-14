import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,newDistinctGame,legalPlacements,connectedCells,occupied} from '../public/games/unfold/engine.mjs';
import {NETS} from '../public/games/unfold/nets.mjs';
const key=p=>p.join(',');
const distance=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);

test('NEXT always regenerates terrain across Solo and multiplayer modes',()=>{
  const configs=[
    ...['open','starter','standard','hard'].map(level=>({mode:'solo',level})),
    {mode:'coop',count:2},{mode:'competitive',count:2},
  ];
  for(const config of configs){
    const previous=newGame({...config,seed:1234}),original=previous.layoutId;
    // Simulate progress after the original board was created.
    previous.obstacles.shift();
    previous.cubes.push({id:99999,owner:0,cells:[[0,0]]});
    // Even a seed source returning the same value cannot replay the old map.
    const next=newDistinctGame({...config,seed:1234},previous);
    assert.notEqual(next.layoutId,original,JSON.stringify(config));
    assert.deepEqual(newDistinctGame({...config,seed:1234},previous),next);
    assert.equal(next.turn,1);
    assert.equal(next.mode,previous.mode);
    assert.equal(next.level,previous.level);
    assert.equal(next.players.length,previous.players.length);
    if(config.level==='open')assert.equal(next.obstacles.length,0);
  }
});

test('generated Solo map families remain deterministic with legal starting nets',()=>{
  for(const level of ['starter','standard','hard'])for(const seed of [1,3,17,89,20261113]){
    const s=newGame({mode:'solo',level,seed});
    assert.deepEqual(newGame({mode:'solo',level,seed}),s);
    assert(s.goal&&s.cubes.every(c=>c.owner===null&&c.cells.length===6));
    assert(s.obstacles.some(o=>o.type==='rubble'));
    assert(s.obstacles.some(o=>o.type==='permanent'));
    const occupiedCells=occupied(s);assert.equal(occupiedCells.size,s.players.length+1+s.cubes.length*6+s.obstacles.reduce((total,o)=>total+o.cells.length,0));
    let open=0;
    for(let n=0;n<NETS.length;n++){
      if([false,true].some(flip=>[0,1,2,3].some(rot=>legalPlacements(s,0,n,rot,flip).length)))open++;
    }
    assert(open>=9,`${level} seed ${seed} should have real legal opening moves`);
    assert(!connectedCells(s,0).has(key(s.goal)));
    for(const obstacle of s.obstacles)for(const cell of obstacle.cells)
      assert(distance(cell,s.players[0].base)>2,`${level} base buffer must be clear`);
  }
});
test('Co-op uses a shared goal with protected individual starting areas',()=>{
  for(const count of [2,3,4])for(const seed of [2,19,991]){
    const s=newGame({mode:'coop',count,seed});
    assert.equal(s.size,count===2?15:count===3?17:19);
    assert(s.goal);
    assert(s.cubes.length>=2);
    for(const p of s.players){
      const initial=connectedCells(s,p.id);
      assert(initial.has(key(p.base)));
      for(const other of s.players.filter(v=>v.id!==p.id))
        assert(!initial.has(key(other.base)),`player ${p.id} cannot deploy from distant base ${other.id}`);
      assert(s.obstacles.every(o=>o.cells.every(c=>distance(c,p.base)>2)));
    }
  }
});
