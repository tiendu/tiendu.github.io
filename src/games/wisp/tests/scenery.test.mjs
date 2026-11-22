import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function load(){
  const folder=new URL('../../../../public/games/wisp/',import.meta.url);
  const source=name=>readFileSync(new URL(name,folder),'utf8');
  const elements=new Map();
  const doc={getElementById(id){
    if(!elements.has(id))elements.set(id,{style:{},textContent:'',hidden:false,
      addEventListener(){},classList:{add(){},remove(){}},
      getBoundingClientRect(){return {width:960,height:480}},getContext(){return {}}});
    return elements.get(id);
  }};
  const window={matchMedia:()=>({matches:false}),addEventListener(){}};
  const ctx=vm.createContext({window,document:doc,location:{hostname:'localhost'},
    Image:class{set src(s){this._src=s;}},requestAnimationFrame(){},
    performance:{now:()=>0},console,Math,Set,Map});
  vm.runInContext(source('procedural.js'),ctx);
  ctx.WispCourse=window.WispCourse;
  vm.runInContext(source('projectile.js'),ctx);
  ctx.WispProjectiles=window.WispProjectiles;
  vm.runInContext(source('game.js'),ctx);
  return window.WISP_TEST;
}

test('ridge profiles are smooth, deterministic and bounded across world positions',()=>{
  const {ridgeHeight}=load();
  for(const layer of [0,1]){
    for(const x of [0,100,1278,2199.9,2200.1,4400,6599.9,11000,25000]){
      const y=ridgeHeight(x,layer);
      assert.ok(y>130&&y<340,`ridge y=${y} at ${x}`);
      assert.equal(y,ridgeHeight(x,layer),'ridge depends only on world position');
      assert.ok(Math.abs(ridgeHeight(x+.1,layer)-y)<.4,'no ridge seam');
    }
  }
});

test('tree layout varies, stays anchored, and does not depend on camera',()=>{
  const {sceneryTreeAt}=load();
  const layer={speed:.30,step:208,w:168,h:310,alpha:.26};
  const trees=Array.from({length:60},(_,i)=>sceneryTreeAt(i,1,layer));
  for(let i=0;i<60;i++){
    assert.deepEqual({...sceneryTreeAt(i,1,layer)},{...trees[i]});
    assert.ok(trees[i].world>i*layer.step-100&&trees[i].world<i*layer.step+140);
    assert.ok(trees[i].height>240&&trees[i].height<400);
    assert.ok(trees[i].patch>.6&&trees[i].patch<1.2);
  }
  assert.ok(new Set(trees.map(t=>Math.round(t.height))).size>15,'trees need size variety');
  assert.ok(new Set(trees.map(t=>t.type)).size===3,'three existing tree families remain used');
});

test('understory assets appear only in the scenery system, not hazard pools',()=>{
  const js=readFileSync(new URL('../../../../public/games/wisp/game.js',import.meta.url),'utf8');
  const proc=readFileSync(new URL('../../../../public/games/wisp/procedural.js',import.meta.url),'utf8');
  assert.match(js,/drawUnderstory\(camera,g,visibleGaps\)/);
  // drawUnderstory receives visibleGaps as 'gaps'; verify both overlap guards.
  assert.match(js,/gaps\.some\(h=>world\+width>h\.x/);
  assert.match(js,/visibleGaps\.some\(h=>world\+44>h\.x/);
  assert.doesNotMatch(proc,/understory|Undergrowth|Understory/);
  assert.doesNotMatch(js,/const spacing=layer===0\?330:265/,'old triangular mountains removed');
});
