// v1.5 rendering regression checks: actual six-plate geometry, stable tube
// underlay, and a canvas renderer usable without repeatedly replacing SVG.
import test from 'node:test';
import assert from 'node:assert/strict';
import { foldedFaces } from '../public/games/unfold/fold.mjs';
import { paintFoldCanvas } from '../public/games/unfold/canvas.mjs';
import { paintTubeFrame } from '../public/games/unfold/tubes.mjs';
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
test('the permanent tube frame paints only on board-size changes',()=>{
  const {canvas,calls}=mockCanvas();
  assert.equal(paintTubeFrame(canvas,15),true);
  assert.equal(canvas.width,240);assert.equal(canvas.height,240);
  const before=calls.fillRect;
  assert.ok(before>500);
  assert.equal(paintTubeFrame(canvas,15),false);
  assert.equal(calls.fillRect,before,'frame did not repaint');
  assert.equal(paintTubeFrame(canvas,19),true);
  assert.equal(canvas.width,304);assert.ok(calls.fillRect>before);
});
test('the cube uses a stable canvas to draw both wrapped and unwrapped surfaces',()=>{
  const {canvas,calls}=mockCanvas();
  assert.equal(paintFoldCanvas(canvas,0,0,false,0),true);
  assert.equal(canvas.width,200);assert.equal(canvas.height,200);
  const first=calls.fill;
  assert.ok(first>30,'thick plates and rivets were drawn');
  assert.equal(paintFoldCanvas(canvas,0,0,false,.5),true);
  assert.equal(paintFoldCanvas(canvas,0,0,false,1),true);
  assert.equal(paintFoldCanvas(canvas,0,0,false,.2),true,'reverse pose uses same renderer');
  assert.equal(canvas.width,200);
  assert.ok(calls.clearRect===4,'one stable surface, cleared once per frame');
  assert.ok(calls.fill>first);
});
