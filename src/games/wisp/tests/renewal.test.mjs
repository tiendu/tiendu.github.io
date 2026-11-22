import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function runner(){
  const root=new URL('../../../../public/games/wisp/',import.meta.url);
  const source=name=>readFileSync(new URL(name,root),'utf8');
  const els=new Map();
  const document={getElementById(id){
    if(!els.has(id))els.set(id,{style:{},hidden:false,textContent:'',
      addEventListener(){},classList:{add(){},remove(){}},
      getBoundingClientRect(){return {width:960,height:480}},getContext(){return {}}});
    return els.get(id);
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
  return {api:window.WISP_TEST,course:window.WispCourse};
}

test('fire is finite, rain extinguishes it, and the same biome does not reactivate it',()=>{
  const {api}=runner();
  const g=api.createGame('Moss',100,{seed:9001,chase:true});
  g.x=6620;
  api.updateFire(g,1/120);
  assert.equal(g.fire.phase,'warning');
  assert.equal(g.fire.lastEpoch,0);
  const initial=g.fire.x;
  for(let t=0;t<2.0;t+=.1){g.x+=21;g.time+=.1;api.updateFire(g,.1);api.updateForest(g,.1);}
  assert.equal(g.fire.x,initial,'fire should not advance during the warning');
  for(let t=0;t<.5;t+=.1){g.x+=21;g.time+=.1;api.updateFire(g,.1);api.updateForest(g,.1);}
  for(let t=0;t<52.3;t+=.1){g.x+=22;g.time+=.1;api.updateFire(g,.1);api.updateForest(g,.1);}
  assert.equal(g.status,'running','healthy Moss should survive average pursuit');
  assert.equal(g.fire.phase,'storm');
  assert.ok(api.rainIntensity(g)>=0);
  for(let t=0;t<5.2;t+=.1){g.x+=22;g.time+=.1;api.updateFire(g,.1);api.updateForest(g,.1);}
  assert.equal(g.fire.active,false);
  assert.equal(g.fire.phase,'quenched');
  assert.equal(g.forest.completed,1);
  assert.equal(g.forest.milestones.length,1);
  const anchored=Math.ceil((6600+(api.FIRE_SURVIVAL+5)*235+2400)/1040)*1040;
  assert.equal(g.forest.milestones[0].regrowthStart,anchored,
    'the biome boundary must be anchored, not based on individual runner speed');
  const stop=g.fire.lastEpoch;
  api.updateFire(g,.1);
  assert.equal(g.fire.lastEpoch,stop,'must not immediately respawn in burnt forest');
  assert.equal(g.status,'running');
});

test('regrowth is smooth and a subsequent cycle restores living, cutter and wildfire',()=>{
  const {api,course}=runner();
  const g=api.createGame('Gale',100,{seed:21,chase:true});
  g.x=20000;
  const start=Math.ceil((g.x+2600)/course.CHUNK)*course.CHUNK;
  const next=start+2600;
  g.forest.milestones.push({regrowthStart:start,nextCycleStart:next});
  const before=api.stageAtFor(g,start-1200,1200);
  const middle=api.stageAtFor(g,start-600,1200);
  const regen=api.stageAtFor(g,start,1200);
  assert.equal(before.a,3);
  assert.equal(before.b,4);
  assert.ok(middle.t>0&&middle.t<1);
  assert.equal(regen.a,4);
  assert.equal(api.stageAtFor(g,next-600,1200).b,0);
  assert.equal(api.stageAtFor(g,next,1200).a,0);
  assert.equal(api.stageAtFor(g,next+2200,1200).a,1);
  assert.equal(api.epochAt(g,next),1);
  const hazards=course.nearby(g.seed,start+200,x=>api.stageAtFor(g,x),0,1300);
  assert.ok(hazards.length);
  assert.ok(hazards.every(h=>h.stage>=0&&h.stage<=4));
  g.x=next+2;
  api.updateForest(g,.1);
  assert.equal(g.forest.cycle,1);
  assert.equal(g.cutter.wait,7);
  g.x=next+6600;
  api.updateFire(g,1/120);
  assert.equal(g.fire.lastEpoch,1);
  assert.equal(g.fire.phase,'warning');
});

test('energy and firefront remain meaningful during a pursuit',()=>{
  const {api}=runner();
  const healthy=api.createGame('Moss',100,{chase:true});
  healthy.x=6600;api.updateFire(healthy,.01);
  healthy.fire.phase='advance';healthy.fire.elapsed=0;
  const before=healthy.fire.x;
  api.updateFire(healthy,1);
  const step=healthy.fire.x-before;
  assert.ok(step>175&&step<210,'normal flames should be slower than a healthy Moss');
  healthy.x=healthy.fire.x+7;
  api.updateFire(healthy,.05);
  assert.equal(healthy.status,'dying','wildfire still kills on contact');
});

test('all five wisps can survive the timed fire at a sustainable cruising pace',()=>{
  const {api}=runner();
  for(const name of ['Moss','Ember','Dew','Gale','Dusk']){
    const g=api.createGame(name,100,{chase:true,seed:512});
    g.x=6600;
    api.updateFire(g,1/120);
    for(let i=0;i<650 && g.status==='running';i++){
      const dt=.1;
      g.x+=235*g.stats.speed*.95*dt;
      g.time+=dt;
      api.updateFire(g,dt);
      api.updateForest(g,dt);
    }
    assert.equal(g.status,'running',name+' could not survive with adequate speed');
    assert.equal(g.forest.completed,1,name+' did not reach the rain');
  }
});

test('an exhausted wisp cannot ignore the flames indefinitely',()=>{
  const {api}=runner();
  const g=api.createGame('Moss',0,{chase:true,seed:9});
  g.x=6600;
  api.updateFire(g,1/120);
  for(let i=0;i<300 && g.status==='running';i++){
    g.x+=235*g.stats.speed*.55*.1;
    g.time+=.1;
    api.updateFire(g,.1);api.updateForest(g,.1);
  }
  assert.equal(g.status,'dying');
  assert.equal(g.deathCause,'wildfire');
});

test('the storm clears, preserves world position and keeps deterministic obstacles',()=>{
  const {api}=runner();
  const g=api.createGame('Dew',100,{chase:false,seed:103});
  g.x=20000;g.forest.milestones.push({regrowthStart:24000,nextCycleStart:26600});
  g.forest.weather='storm';g.forest.weatherElapsed=2;
  assert.ok(api.rainIntensity(g)>0);
  g.forest.weather='rain';g.forest.weatherElapsed=0;
  for(let i=0;i<170;i++)api.updateForest(g,.1);
  assert.equal(g.forest.weather,'clear');
  assert.equal(api.rainIntensity(g),0);
  assert.equal(g.x,20000);
  const p=api.courseNear(g,26800,0,3000).map(h=>({id:h.id,type:h.type,stage:h.stage}));
  const q=api.courseNear(g,26800,0,3000).map(h=>({id:h.id,type:h.type,stage:h.stage}));
  assert.deepEqual(p,q);
});
