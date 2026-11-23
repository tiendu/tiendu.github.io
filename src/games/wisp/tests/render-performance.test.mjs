import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root=new URL('../../../../public/games/wisp/',import.meta.url);
const source=name=>readFileSync(new URL(name,root),'utf8');

function runner(){
  let cropDraws=0,gradients=0;
  const gradient={addColorStop(){}};
  const ctx=new Proxy({}, {get(obj,key){
    if(key==='createLinearGradient' || key==='createRadialGradient')return ()=>{gradients++;return gradient;};
    if(key==='drawImage')return (...args)=>{if(args.length===9)cropDraws++;};
    return Object.hasOwn(obj,key)?obj[key]:(()=>{});
  }});
  const elements=new Map();
  const doc={getElementById(id){
    if(!elements.has(id))elements.set(id,{
      style:{},textContent:'',hidden:false,addEventListener(){},
      classList:{add(){},remove(){}},
      getAttribute(){return null;},setAttribute(){},
      getBoundingClientRect(){return {width:960,height:480}},
      getContext(){return ctx}
    });
    return elements.get(id);
  }};
  class Img{constructor(){this.complete=true;this.naturalWidth=256;}set src(x){this._src=x;}}
  const win={devicePixelRatio:1,matchMedia:()=>({matches:false}),addEventListener(){}};
  const context=vm.createContext({window:win,document:doc,location:{hostname:'localhost'},
    Image:Img,requestAnimationFrame(){},performance:{now:()=>0},console,Math,Set,Map});
  vm.runInContext(source('procedural.js'),context);
  context.WispCourse=win.WispCourse;
  vm.runInContext(source('projectile.js'),context);
  context.WispProjectiles=win.WispProjectiles;
  vm.runInContext(source('game.js'),context);
  return {engine:win.WISP_TEST, stats(){return {cropDraws,gradients};},reset(){cropDraws=0;gradients=0;}};
}

test('steady forest draws full terrain tiles and one sky gradient',()=>{
  const {engine,stats,reset}=runner();
  const g=engine.createGame('Moss',100,{chase:false,seed:12});
  // The camera initially looks into the unchanged Living Forest.
  reset();engine.paint(g);
  const steady=stats();
  assert.equal(steady.cropDraws,0,`steady terrain should use uncropped SVG tiles: ${steady.cropDraws}`);
  assert.ok(steady.gradients<25,`sky fast path lost: ${steady.gradients}`);
  // The 1200-unit blend near the first biome boundary still uses narrow slices.
  g.x=1800;
  reset();engine.paint(g);
  const transition=stats();
  assert.ok(transition.cropDraws>steady.cropDraws,`blend must retain SVG slices: ${transition.cropDraws}`);
});

test('visual-frame Cutter scheduling avoids hidden and 120Hz DOM work',()=>{
  const game=source('game.js');
  assert.doesNotMatch(game,/cutterMotion\.update\(FIXED\)/);
  assert.match(game,/cutterMotion\.update\(delta\)/);
  assert.match(game,/!game\.fire\.active/);
  assert.doesNotMatch(game,/const factor=canvas\.getBoundingClientRect\(\)\.width\/VIEW\.width/);
});
