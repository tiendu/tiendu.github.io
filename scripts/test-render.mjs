// Neon Grid rendering regressions: exact six-face geometry and stable Canvas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { foldedFaces } from '../public/games/unfold/fold.mjs';
import { paintFoldCanvas } from '../public/games/unfold/canvas.mjs';
function mockCanvas(){
  const calls={fillRect:0,stroke:0,fill:0,clearRect:0};
  const ctx={
    save(){},restore(){},translate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},
    clearRect(){calls.clearRect++;},fillRect(){calls.fillRect++;},stroke(){calls.stroke++;},fill(){calls.fill++;},
  };
  return {canvas:{width:0,height:0,dataset:{},getContext:()=>ctx},calls};
}
test('every cube net closes as one unit and unfolds to a flat six-cell panel',()=>{
  for(let net=0;net<11;net++)for(let rotation=0;rotation<4;rotation++)for(const flipped of [false,true]){
    const folded=foldedFaces(net,rotation,flipped,0),open=foldedFaces(net,rotation,flipped,1);
    assert.equal(folded.length,6);assert.equal(open.length,6);
    assert.ok(folded.some(f=>Math.abs(f.center[2]-1)<1e-8),'closed box has a top lid');
    for(const face of folded){
      assert.ok(face.center[2]>-1e-8&&face.center[2]<1+1e-8);
      for(const p of face.corners)assert.ok(p[2]>-1e-8&&p[2]<1+1e-8);
    }
    for(const face of open){
      assert.ok(Math.abs(face.center[2])<1e-8);
      assert.ok(Math.abs(face.normal[2]-1)<1e-8);
    }
  }
});
test('energy cube renders all states without mechanical fasteners or reallocated canvas',()=>{
  const {canvas,calls}=mockCanvas();
  assert.equal(paintFoldCanvas(canvas,0,0,false,0,{color:'#49ddf5'}),true);
  assert.equal(canvas.width,200);assert.equal(canvas.height,200);
  const first=calls.fill;
  assert.ok(first>8,'faces are solid geometric surfaces');
  for(const progress of [.25,.5,.75,1])assert.equal(paintFoldCanvas(canvas,0,0,false,progress,{color:'#49ddf5'}),true);
  assert.equal(calls.clearRect,5);
  assert.ok(calls.stroke>0,'luminous outlines are visible without bloom');
});
test('neon cube has stable dark shell but player-specific illuminated panels',()=>{
  const colors=(color,progress)=>{
    const fills=[];
    const ctx={save(){},restore(){},translate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},clearRect(){},
      stroke(){fills.push(this.strokeStyle)},fill(){fills.push(this.fillStyle)}};
    paintFoldCanvas({width:0,height:0,getContext:()=>ctx},0,0,false,progress,{color});
    return fills;
  };
  const a=colors('#49ddf5',1),b=colors('#ff68bd',1);
  assert.notDeepEqual(a,b);
  assert(a.includes('#102a3b')||a.some(c=>c?.startsWith?.('#')));
  assert(colors('#49ddf5',0).includes('#111d31'));
});

test('animation controller extraction preserves timing, hooks and action flow',async()=>{
  const {createFoldAnimator,ANIMATION_MS}=await import('../public/games/unfold/render/animation.mjs');
  const app=await readFile(new URL('../public/games/unfold/app.mjs',import.meta.url),'utf8');
  assert.deepEqual(ANIMATION_MS,{normal:1600,quick:700,instant:0});
  assert.match(app,/from ['"]\.\/render\/animation\.mjs['"]/);
  assert.doesNotMatch(app,/function (createGrit|prepareFoldStage|animateFold|moveClosedBox)\(/);
  assert.match(app,/if\(busy\)fastForwardAnimation\(\)/);
  const stage={hidden:false,children:[1],replaceChildren(...children){this.children=children;}};
  const lifted={classList:{removed:[],remove(name){this.removed.push(name);}}};
  const game={classList:{removed:[],remove(name){this.removed.push(name);}}};
  const originalDocument=globalThis.document;
  globalThis.document={querySelectorAll:()=>[lifted]};
  try{
    const animator=createFoldAnimator({$:id=>({ 'fold-stage':stage,game })[id],
      getGame:()=>({size:13,active:0}),animationSpeed:()=> 'instant'});
    assert.deepEqual(Object.keys(animator).sort(),
      ['animateFold','createGrit','fastForwardAnimation','finishFoldVisual','moveClosedBox'].sort());
    animator.fastForwardAnimation();
    animator.finishFoldVisual();
    assert.equal(stage.hidden,true);
    assert.deepEqual(stage.children,[]);
    assert.deepEqual(lifted.classList.removed,['fold-lifting']);
    assert.deepEqual(game.classList.removed,['is-unfolding']);
    await animator.moveClosedBox([1,1],[2,2],0,0,false,'#fff');
  }finally{globalThis.document=originalDocument;}
});
