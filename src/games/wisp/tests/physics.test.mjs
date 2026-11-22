import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const dir=new URL('../../../../public/games/wisp/',import.meta.url);
const benchmarkCode=readFileSync(new URL('./benchmark-controller.js',import.meta.url),'utf8');
const source=name=>readFileSync(new URL(name,dir),'utf8');

function loadRunner(){
  const elements=new Map();
  const doc={getElementById(id){
    if(!elements.has(id))elements.set(id,{
      style:{},textContent:'',hidden:false,addEventListener(){},
      classList:{add(){},remove(){}},getBoundingClientRect(){return {width:960,height:480}},
      getContext(){return {}}
    });
    return elements.get(id);
  }};
  const window={matchMedia:()=>({matches:false}),addEventListener(){}};
  const context=vm.createContext({window,document:doc,location:{hostname:'localhost'},
    Image:class{set src(value){this._src=value;}},requestAnimationFrame(){},performance:{now:()=>0},
    console,Math,Set,Map});
  vm.runInContext(source('procedural.js'),context,{filename:'procedural.js'});
  context.WispCourse=window.WispCourse;
  vm.runInContext(benchmarkCode,context,{filename:'benchmark-controller.js'});
  vm.runInContext(source('game.js'),context,{filename:'game.js'});
  assert.ok(window.WISP_TEST);
  return window.WISP_TEST;
}

// Regression runner uses the actual production step() and procedural.js,
// rather than a separate reimplementation of jump/energy/collision math.
test('exhausted Moss clears seeded procedural courses without cheats or pickups',()=>{
  const runner=loadRunner();
  for(let seed=1;seed<=20;seed++){
    const g=runner.createGame('Moss',0,{auto:true,chase:false,noPickups:true,seed});
    g.procEndX=12500;
    let ticks=0;
    while(g.status==='running'&&ticks++<22000)runner.step(g,1/120,{});
    assert.equal(g.status,'passed',`seed=${seed} ${g.reason}`);
    assert.equal(g.impacts,0,`seed=${seed}`);
    assert.equal(g.rescues,0,`seed=${seed}`);
    assert.equal(g.energy,0,`seed=${seed}`);
  }
});

test('one-button physics still use two jumps and exhausted running continues',()=>{
  const engine=loadRunner();
  const g=engine.createGame('Moss',0,{seed:12,chase:false,noPickups:true});
  assert.equal(engine.jump(g),true);
  assert.equal(engine.jump(g),true);
  assert.equal(engine.jump(g),false);
  const before=g.x;
  engine.step(g,1/120,{});
  assert.ok(g.x>before,'zero-energy wisp must move');
  assert.equal(g.status,'running');
});


test('all five wisps clear sampled procedural courses at three energy levels',()=>{
  const runner=loadRunner();
  for(const name of ['Moss','Ember','Dew','Gale','Dusk']){
    for(const energy of [0,20,100]){
      for(const seed of [17,23,41,57]){
        const g=runner.createGame(name,energy,{auto:true,chase:false,noPickups:true,seed});
        g.procEndX=10500;
        let ticks=0;
        while(g.status==='running'&&ticks++<22000)runner.step(g,1/120,{});
        assert.equal(g.status,'passed',`${name} at ${energy}% seed ${seed} (${g.reason})`);
        assert.equal(g.impacts,0,`${name} at ${energy}% seed ${seed}`);
        assert.equal(g.rescues,0,`${name} at ${energy}% seed ${seed}`);
      }
    }
  }
});

test('wildfire contact still shatters the wisp; zero energy alone does not',()=>{
  const engine=loadRunner();
  const g=engine.createGame('Moss',0,{chase:true,seed:4});
  engine.step(g,1/120,{});
  assert.equal(g.status,'running','zero energy is exhaustion, not elimination');
  g.fire.active=true;g.fire.phase='advance';g.fire.x=g.x-8;
  engine.step(g,1/120,{});
  assert.equal(g.status,'dying');
  assert.equal(g.deathCause,'wildfire');
  engine.step(g,1.6,{});
  assert.equal(g.status,'caught','death animation completes before elimination');
});

test('Cutter contact still starts the shared polygon death animation',()=>{
  const engine=loadRunner();
  const g=engine.createGame('Dew',100,{chase:true,seed:6});
  g.cutter.state='hunt';g.cutter.x=g.x-45;
  engine.step(g,1/120,{});
  assert.equal(g.status,'dying');
  assert.ok(g.death?.pieces?.length>0,'the wisp should split into editable-style polygon shards');
});
