import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function runner(){
  const dir=new URL('../../../../public/games/wisp/',import.meta.url);
  const source=name=>readFileSync(new URL(name,dir),'utf8');
  const elements=new Map();
  const document={getElementById(id){
    if(!elements.has(id))elements.set(id,{style:{},textContent:'',hidden:false,
      addEventListener(){},classList:{add(){},remove(){}},
      getBoundingClientRect(){return {width:960,height:480}},getContext(){return {}}});
    return elements.get(id);
  }};
  const window={matchMedia:()=>({matches:false}),addEventListener(){}};
  const context=vm.createContext({window,document,location:{hostname:'localhost'},
    Image:class{set src(v){this._src=v;}},requestAnimationFrame(){},
    performance:{now:()=>0},console,Math,Set,Map});
  vm.runInContext(source('procedural.js'),context);
  context.WispCourse=window.WispCourse;
  vm.runInContext(source('projectile.js'),context);
  context.WispProjectiles=window.WispProjectiles;
  vm.runInContext(source('game.js'),context);
  return window.WISP_TEST;
}

test('gaps cut through all turf and soil using uneven cliff profiles',()=>{
  const game=runner();
  const trace=[];
  const path={beginPath(){trace.push(['begin']);},rect(...a){trace.push(['rect',...a]);},
    moveTo(...a){trace.push(['move',...a]);},lineTo(...a){trace.push(['line',...a]);},
    closePath(){trace.push(['close']);},clip(v){trace.push(['clip',v]);}};
  game.maskGroundGaps(path,[{x:120,width:116}],0);
  assert.ok(trace.some(x=>x[0]==='clip'&&x[1]==='evenodd'),'the hole must be a real cutout');
  assert.ok(trace.some(x=>x[0]==='move'&&x[1]===120),'hole starts at collider boundary');
  assert.ok(trace.some(x=>x[0]==='line'&&x[1]===236),'hole ends at collider boundary');
  const xs=trace.filter(x=>x[0]==='line').map(x=>x[1]);
  assert.ok(Math.min(...xs)<120&&Math.max(...xs)>236,'walls erode outwards below ground');
});

test('gap rescue re-forms on the far bank without teleporting or charging twice',()=>{
  const engine=runner();
  const g=engine.createGame('Moss',100,{chase:false,seed:4});
  const gap=engine.courseNear(g,7000,0,17000).find(h=>h.type==='erosion-gap');
  assert.ok(gap,'fixture includes a gap');
  g.x=gap.x+gap.width/2;g.y=531;g.vy=0;g.grounded=false;g.surface=null;
  engine.step(g,1/120,{});
  assert.ok(g.gapRescue,'rescue animation starts after falling');
  assert.equal(g.rescues,1);
  assert.equal(engine.jump(g),false,'rescue cannot be interrupted by another jump');
  assert.ok(g.energy>71&&g.energy<73,'28 energy deducted once');
  const target=g.gapRescue.endX;
  assert.ok(g.x<target,'wisp has not teleported');
  let largest=0;
  for(let i=0;i<88;i++){
    const before=g.x;
    engine.step(g,1/120,{});
    largest=Math.max(largest,g.x-before);
  }
  assert.ok(largest<8,'rescue motion is eased');
  assert.equal(g.gapRescue,null);
  assert.equal(g.rescues,1);
  assert.ok(g.grounded&&g.x>=target,'wisp returns to playable ground');
});

test('wildfire advances during a rescue, so it is not free invulnerability',()=>{
  const engine=runner();
  const g=engine.createGame('Moss',100,{chase:false,seed:4});
  const gap=engine.courseNear(g,7000,0,17000).find(h=>h.type==='erosion-gap');
  g.x=gap.x+gap.width/2;g.y=531;g.vy=0;g.grounded=false;g.surface=null;
  engine.step(g,1/120,{});
  g.fire.active=true;g.fire.phase='advance';g.fire.x=g.x-500;
  const previousFire=g.fire.x;
  engine.step(g,1/120,{});
  assert.ok(g.fire.x>previousFire,'fire pursuit was not frozen');
});
