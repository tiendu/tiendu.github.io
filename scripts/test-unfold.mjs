import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NETS, oriented, netKey } from '../public/games/unfold/nets.mjs';
import { foldSvg, foldedFaces } from '../public/games/unfold/fold.mjs';
import { newGame, FACES, act, endTurn, legalPlacements, canPlace, canReclaim, refoldable, connectedCells, placedCells, occupied } from '../public/games/unfold/engine.mjs';
const key=p=>p.join(',');
const place=(s,id,owner,net,x,y)=>s.cubes.push({id,owner,net,rotation:0,flipped:false,cells:placedCells(net,0,false,x,y)});

test('exactly 11 valid cube nets, one overhead square when shut, no face numbers',()=>{
  assert.equal(NETS.length,11);
  assert.equal(new Set(NETS.map(netKey)).size,11);
  for(let n=0;n<11;n++)for(let r=0;r<4;r++)for(const flipped of [false,true]){
    const net=oriented(n,r,flipped);
    assert.equal(new Set(net.map(key)).size,6);
    assert.deepEqual(foldedFaces(n,r,flipped,1).map(f=>f.number),[1,2,3,4,5,6]);
    const folded=foldedFaces(n,r,flipped,0),centers=folded.map(f=>f.center.map(x=>x.toFixed(4)).join(','));
    assert.equal(new Set(centers).size,6);
    const plate=foldSvg(n,r,flipped,.4);
    assert((plate.match(/<polygon points=/g)||[]).length>=100); // plate walls, bracing, wear, rivets
    assert(plate.includes('plate-inner') && plate.includes('plate-outer')); // readable inside/outside
    assert(plate.includes('class="pivot"')); // hinge hardware
    assert(!/<text[\s>]/.test(foldSvg(n,r,flipped,0))); // no numbering on cube panels
    assert(folded.flatMap(f=>f.corners).every(([x,y])=>Math.abs(x)<=.50001&&Math.abs(y)<=.50001)); // exact overhead square
    assert(foldedFaces(n,r,flipped,1).every(f=>Math.abs(f.center[0]-f.flat[0]+net[0][0])<1e-8 && Math.abs(f.center[1]-f.flat[1]+net[0][1])<1e-8));
    // The cube must sit above its landing face, not sink through the table.
    assert(folded.every(f=>f.center[2]>-1e-8&&f.center[2]<1.000001));
    assert(folded.some(f=>Math.abs(f.center[2]-1)<1e-8));
    assert(foldedFaces(n,r,flipped,1).every(f=>Math.abs(f.center[2])<1e-8));
  }
});
test('six faces follow the agreed 2/1/2/1 distribution',()=>assert.deepEqual(FACES,['deploy','deploy','special','reclaim','reclaim','refold']));
test('one action die per turn, with no queue or permanent cube tray',()=>{
  const a=newGame({seed:10,mode:'solo'}),b=newGame({seed:10,mode:'solo'});
  assert.deepEqual(a.die,b.die);assert.equal(a.version,5);
  assert(!('hand' in a.players[0]));assert(!('tray' in a.players[0]));
  const next=endTurn(a);assert.equal(next.turn,2);assert(next.die.face>=1&&next.die.face<=6);assert.equal(next.players.length,1);
});
test('normal Deploy accepts only its assigned shape and consumes one action',()=>{
  const s=newGame({mode:'solo',level:'open',seed:7});s.die={face:1,action:'deploy',net:3};
  const [x,y]=legalPlacements(s,0,3)[0];assert(canPlace(s,0,3,0,false,x,y));
  const next=act(s,{x,y,netIndex:0});assert.equal(next.cubes[0].net,3);assert.equal(next.cubes[0].cells.length,6);
  assert.equal(next.acted,true);assert.throws(()=>act(next,{x,y}),/finished/);
});
test('Super Deploy can select any one of 11 nets',()=>{
  const s=newGame({mode:'solo',level:'open',seed:9});s.die={face:3,action:'special',net:null};
  for(let i=0;i<11;i++){
    const pos=legalPlacements(s,0,i)[0];assert(pos);
    assert.equal(act(s,{netIndex:i,x:pos[0],y:pos[1]}).cubes[0].net,i);
  }
});
test('Reclaim adjacency is required for Solo rubble and ruins, not global clearing',()=>{
  const s=newGame({mode:'solo',level:'open',seed:8});const [x,y]=s.players[0].base;
  s.obstacles=[{id:401,type:'rubble',cells:[[x+1,y]]},{id:402,type:'ruin',cells:placedCells(0,0,false,0,0)},{id:403,type:'permanent',cells:[[x-1,y]]}];
  assert(canReclaim(s,0,401));assert(!canReclaim(s,0,402));assert(!canReclaim(s,0,403));
  s.die={face:4,action:'reclaim',net:null};
  assert.throws(()=>act(s,{targetId:402}),/adjacent/i);
  assert.equal(act(s,{targetId:401}).obstacles.length,2);
});
test('Solo/Co-op can reclaim adjacent neutral cubes but not teammate roads',()=>{
  const s=newGame({mode:'coop',count:2,seed:4});s.obstacles=[];
  const [x,y]=s.players[0].base;
  s.cubes=[{id:991,owner:null,net:0,rotation:0,flipped:false,cells:placedCells(0,0,false,x+1,y-1)}];
  assert(canReclaim(s,0,991));
  s.cubes[0].owner=1;
  assert(!canReclaim(s,0,991));
});
test('Refold requires rear cube and may choose a new shape',()=>{
  const s=newGame({mode:'competitive',count:2,seed:13});s.size=19;s.players[0].base=[9,1];s.players[1].base=[14,17];s.obstacles=[];s.cubes=[];
  place(s,101,0,4,9,2);place(s,102,0,4,10,6);place(s,103,0,4,11,10);
  assert(!refoldable(s,0,102));assert(refoldable(s,0,103));
  s.die={face:6,action:'refold',net:null};
  const newNet=1,opts=legalPlacements(s,0,newNet,0,false,103);assert(opts.length>0);
  const next=act(s,{targetId:103,netIndex:newNet,x:opts[0][0],y:opts[0][1]});
  assert.equal(next.cubes.length,3);assert.equal(next.cubes.find(c=>c.id===103).net,1);
});
test('capture a chokepoint; disconnected roads become neutral and remain unextendable',()=>{
  const s=newGame({mode:'competitive',count:2,seed:17});s.size=19;s.players[0].base=[9,1];s.players[1].base=[14,7];s.obstacles=[];s.cubes=[];
  place(s,101,0,4,9,2);place(s,102,0,4,10,6);place(s,103,0,4,11,10);place(s,201,1,4,13,7);
  assert(connectedCells(s,0).has(key(s.cubes[2].cells[0])));assert(canReclaim(s,1,102));
  s.active=1;s.die={face:4,action:'reclaim',net:null};
  const next=act(s,{targetId:102});
  assert.equal(next.cubes.find(c=>c.id===102).owner,1);
  assert.equal(next.cubes.find(c=>c.id===103).owner,null);
  assert(!connectedCells(next,0).has(key(next.cubes.find(c=>c.id===103).cells[0])));
  assert(occupied(next).get(key(next.cubes.find(c=>c.id===103).cells[0])).owner===null);
});
test('one bad roll can be passed without awarding a replacement action',()=>{
  const s=newGame({mode:'solo',level:'open',seed:33});s.die={face:4,action:'reclaim',net:null};
  assert.equal(s.obstacles.length,0);
  const next=endTurn(s);
  assert.equal(next.turn,2);assert.equal(next.cubes.length,0);
});
test('Solo difficulty scales board and terrain; Standard is the default',()=>{
  const starter=newGame({mode:'solo',level:'starter',seed:99});
  const standard=newGame({mode:'solo',seed:99});
  const hard=newGame({mode:'solo',level:'hard',seed:99});
  const open=newGame({mode:'solo',level:'open',seed:99});
  assert.deepEqual([starter.size,standard.size,hard.size,open.size],[13,15,19,11]);
  assert(standard.obstacles.length>starter.obstacles.length);
  assert(hard.obstacles.length>standard.obstacles.length);
  assert.deepEqual([starter.cubes.length,standard.cubes.length,hard.cubes.length],[1,2,3]);
  assert(standard.cubes.every(c=>c.owner===null&&c.cells.length===6));
  assert.equal(open.obstacles.length,0);
  assert.equal(newGame({mode:'solo',level:'challenge',seed:99}).level,'standard');
  assert.deepEqual(newGame({mode:'solo',seed:99}),standard);
});
test('Co-op starts at your own base; teammates share only after physically connecting',()=>{
  const s=newGame({mode:'coop',count:2,seed:345});
  s.obstacles=[];s.cubes=[];const m=Math.floor(s.size/2);
  assert(!connectedCells(s,0).has(key(s.players[1].base)));
  const [x,y]=legalPlacements(s,1,0)[0];
  assert(!canPlace(s,0,0,0,false,x,y),'player 0 cannot deploy beside player 1 alone');
  s.goal=[m+2,8];
  s.cubes=[
    {id:101,owner:0,cells:Array.from({length:6},(_,i)=>[m,2+i]),net:0},
    {id:102,owner:1,cells:[...Array.from({length:5},(_,i)=>[m,8+i]),[m+1,12]],net:0},
  ];
  assert(connectedCells(s,0).has(key(s.players[1].base)));
  assert(connectedCells(s,1).has(key(s.players[0].base)));
  assert(!refoldable(s,0,101),'a shared chokepoint cannot be refolded away');
  s.obstacles=[{id:200,type:'rubble',cells:[[m+1,1]]}];
  s.die={face:4,action:'reclaim',net:null};
  let after=act(s,{targetId:200});
  assert.equal(after.winner,null,'connected bases without reaching the goal do not win');
  s.obstacles=[{id:201,type:'rubble',cells:[[m+1,1]]}];
  s.cubes.push({id:103,owner:1,net:0,cells:[[m+1,9],[m+2,9],[m+3,9],[m+3,10],[m+4,9],[m+4,10]]});
  after=act(s,{targetId:201});
  assert.equal(after.winner?.kind,'coop','every base and goal must be connected');
});
test('Co-op should not start already won; board grows with player count',()=>{
  const a=newGame({mode:'coop',count:3,seed:3}),b=newGame({mode:'competitive',count:4,seed:3});
  assert.equal(a.players.length,3);assert.equal(b.players.length,4);assert(b.size>a.size);
  a.die={face:3,action:'special',net:null};
  const pos=legalPlacements(a,0,0)[0];assert(pos);
  assert.equal(act(a,{netIndex:0,x:pos[0],y:pos[1]}).winner,null);
});
test('browser entry imports existing game engine functions',async()=>{
  const src=await readFile(new URL('../public/games/unfold/app.mjs',import.meta.url),'utf8');
  const match=src.match(/import\s*\{([^}]*)\}\s*from\s*['"]\.\/engine\.mjs['"]/s);
  assert(match);
  const exports=await import('../public/games/unfold/engine.mjs');
  for(const name of match[1].split(',').map(s=>s.trim()).filter(Boolean))assert(name in exports,`Missing engine export: ${name}`);
});

test('cube numbers label only the contact cell, increment across deployments and survive refold',()=>{
  let s=newGame({mode:'solo',level:'open',seed:123});
  for(const index of [3,5]){
    s.die={face:3,action:'special',net:null};
    const [x,y]=legalPlacements(s,0,index)[0];
    s=act(s,{x,y,netIndex:index});
    if(index===3)s=endTurn(s);
  }
  assert.deepEqual(s.cubes.map(c=>c.number),[1,2]);
  const board=occupied(s);
  for(const cube of s.cubes){
    const values=cube.cells.map(c=>board.get(key(c)));
    assert.equal(values.filter(v=>v.contact).length,1);
    assert.equal(values[0].number,cube.number);
  }
});
