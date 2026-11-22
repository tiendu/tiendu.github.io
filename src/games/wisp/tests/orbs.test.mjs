import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../../../../public/games/wisp/procedural.js',import.meta.url),'utf8');
const context={window:{}};vm.runInNewContext(code,context);
const course=context.window.WispCourse;
const stageAt=x=>({a:Math.min(3,Math.floor(x/2200)),b:Math.min(3,Math.floor(x/2200)),t:0});
test('same seed generates same obstacles and orbs',()=>{
  const a=course.make(42,3,stageAt),b=course.make(42,3,stageAt);
  assert.equal(a,b);assert.deepEqual(a.orbs,b.orbs);
});
test('greater essence appears in elevated or risky positions',()=>{
  let common=0,rare=0,chunks=0;
  for(let seed=10;seed<30;seed++)for(let index=0;index<60;index++){
    const h=course.make(seed,index,stageAt);chunks++;
    for(const orb of [...h.orbs,...(h.second?.orbs||[])]) {
      if(orb.kind==='greater'){rare++;assert.ok(orb.y<=294,'greater essence is elevated');}
      else{common++;assert.equal(orb.amount,10);}
    }
  }
  assert.ok(rare>0&&rare<chunks*.4);
  assert.ok(common<chunks*1.3,'common orbs must not saturate course');
  assert.ok(common>chunks*.55,'basic recovery is still available');
});
