import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Load the actual runner, not an independent reimplementation of camera/stage math.
function load(){
  const source=new URL('../../../../public/games/wisp/',import.meta.url);
  const text=name=>readFileSync(new URL(name,source),'utf8');
  const elements=new Map();
  const doc={getElementById(id){
    if(!elements.has(id))elements.set(id,{style:{},textContent:'',hidden:false,
      addEventListener(){},classList:{add(){},remove(){}},
      getBoundingClientRect(){return {width:960,height:480}},getContext(){return {}}});
    return elements.get(id);
  }};
  const window={matchMedia:()=>({matches:false}),addEventListener(){}};
  const context=vm.createContext({window,document:doc,location:{hostname:'localhost'},
    Image:class{set src(v){this._src=v;}},requestAnimationFrame(){},performance:{now:()=>0},console,Math,Set,Map});
  vm.runInContext(text('procedural.js'),context);
  context.WispCourse=window.WispCourse;
  vm.runInContext(text('projectile.js'),context);
  context.WispProjectiles=window.WispProjectiles;
  vm.runInContext(text('game.js'),context);
  return window.WISP_TEST;
}

test('the longer VISUAL blend is continuous across all three forest boundaries',()=>{
  const {visualStageAt,stageAt}=load();
  for(const boundary of [2200,4400,6600]){
    const before=visualStageAt(boundary-0.01);
    const after=visualStageAt(boundary+0.01);
    assert.ok(Math.abs(before.a+before.t-(after.a+after.t))<.001,`visual jump at ${boundary}`);
    assert.equal(before.b,after.a,`biomes do not join at ${boundary}`);
    const start=visualStageAt(boundary-1200);
    assert.equal(start.t,0,`transition should start 1200 units before ${boundary}`);
    // The original 800-unit hazard progression remains unchanged.
    assert.equal(stageAt(boundary-900).t,0,`gameplay timing changed at ${boundary}`);
  }
});

test('parallax trees use a stable anchor independent of camera and have no hard switch',()=>{
  const {treeMixAt}=load();
  const near=treeMixAt(1820,17,2);
  const again=treeMixAt(1820,17,2);
  assert.deepEqual({...near},{...again});
  assert.ok(near.weight>=0&&near.weight<=1);
  for(const boundary of [2200,4400,6600]){
    const a=treeMixAt(boundary-0.001,111,1);
    const b=treeMixAt(boundary+0.001,111,1);
    assert.ok(Math.abs(a.a+a.weight-(b.a+b.weight))<.001);
  }
});

test('camera keeps the Wisp horizontally centered from the first frame through every forest cycle',()=>{
  const {cameraForX}=load();
  const center=480; // Half of the 960-unit logical viewport.
  for(const x of [155,160,300,480,1200,2200,4400,6600,8000,12000,24000,48000]){
    const camera=cameraForX(x);
    assert.equal(x-camera,center,`Wisp not centered at world position ${x}`);
  }
  assert.equal(cameraForX(155),-325,'negative camera is required at the starting line');
  // The multiplayer spectator should center the racer being followed too.
  const online=readFileSync(new URL('../../../../public/games/wisp/online.js',import.meta.url),'utf8');
  assert.match(online,/game\.cameraForX\(remoteMotion\?\.sample\(leader\.id\)\?\.x\?\?leader\.x\)/);
  assert.doesNotMatch(online,/Math\.max\(0,live\[0\]\.x-210\)/);
});
