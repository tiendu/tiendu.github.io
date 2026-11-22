import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const asset=name=>readFileSync(new URL(`../../../../public/games/wisp/${name}`,import.meta.url),'utf8');
function lib(){
  const window={};const context=vm.createContext({window});
  vm.runInContext(asset('procedural.js'),context);
  vm.runInContext(asset('projectile.js'),context);
  return {course:window.WispCourse,projectile:window.WispProjectiles};
}
function log(seed,index=2){
  const {course,projectile}=lib();
  const hazard={index,type:'falling-timber',width:88,height:27,x:index*1040+390,combo:false};
  return {p:projectile.newLog(seed,hazard,124.08,380,course.hash),projectile};
}
test('catapult trajectory is seed-stable, genuinely airborne and horizontally mobile',()=>{
  const a=log(201),b=log(201),c=log(202);
  assert.deepEqual(JSON.parse(JSON.stringify(a.p)),JSON.parse(JSON.stringify(b.p)));
  assert.notEqual(a.p.vx,c.p.vx);
  assert.ok(a.p.vx>0 && a.p.vy<0);
  assert.ok(a.p.triggerX<a.p.targetX && a.p.y<280);
  a.p.phase='flight';b.p.phase='flight';
  for(let tick=0;tick<300;tick++){
    a.projectile.advance(a.p,1/120,380);
    b.projectile.advance(b.p,1/120,380);
  }
  assert.equal(a.p.x,b.p.x);
  assert.equal(a.p.y,b.p.y);
  assert.notEqual(a.p.x,a.p.targetX,'the log travels after reaching its original target');
  assert.ok(a.p.bounces>0,'the log actually hits and rebounds');
});
test('bounces, rotation and rollout vary across seeds without random calls during simulation',()=>{
  const samples=[];
  for(let seed=1;seed<=72;seed++){
    const {p,projectile}=log(seed);
    p.phase='flight';
    for(let tick=0;tick<1200 && p.phase!=='settled';tick++){
      projectile.advance(p,1/120,380);
      if(p.phase==='rolling'){
        const half=projectile.bounds(p.angle,p.width,p.height).ry;
        assert.ok(Math.abs((p.y+half)-380)<.0001,'the rolling log must touch soil');
      }
    }
    assert.equal(p.phase,'settled','every projectile must come to rest');
    assert.equal(p.y,366.5,'resting log lies on the ground');
    samples.push(p.bounces);
  }
  assert.ok(new Set(samples).size>=3,'different seeds should yield different bounce counts');
  assert.ok(Math.max(...samples)>=3,'some logs should bounce several times');
});
test('moving hitbox uses projectile coordinates, not the old static drop location',()=>{
  const {p,projectile}=log(99);p.phase='flight';
  const first=projectile.collider(p);assert.ok(first);
  for(let i=0;i<90;i++)projectile.advance(p,1/120,380);
  const second=projectile.collider(p);
  assert.ok(Math.abs(first.x1-second.x1)>50);
  assert.equal(second.kind,'flying timber');
});
test('no dashed landing marker or pre-impact shadow remains',()=>{
  const source=asset('game.js');
  assert.doesNotMatch(source,/setLineDash\s*\(/);
  assert.doesNotMatch(source,/Falling timber overhead — watch the shadow/);
  const html=asset('play.html');
  assert.ok(html.indexOf('src="projectile.js"')<html.indexOf('src="game.js"'));
  const procedural=asset('procedural.js');
  assert.match(procedural, /\{type:'falling-timber',weight:2\}/);
});
