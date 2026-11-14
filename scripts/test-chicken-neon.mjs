import test from 'node:test';
import assert from 'node:assert/strict';
import {BIRDS,newRun,jump,step,disasterWindow,activeDisaster,disasterWarning} from '../public/games/chicken-neon/engine.mjs';

test('five visibly distinct chickens with genuine statistical tradeoffs',()=>{
 assert.equal(BIRDS.length,5);
 assert.deepEqual(BIRDS.map(x=>x.name),['Sunrise','Pepper','Pearl','Mango','Indigo']);
 assert.equal(BIRDS[0].speed,Math.max(...BIRDS.map(x=>x.speed)));
 assert.equal(BIRDS[2].speed,Math.min(...BIRDS.map(x=>x.speed)));
 assert.equal(BIRDS[2].jump,Math.max(...BIRDS.map(x=>x.jump)));
 assert.equal(BIRDS[4].jet,Math.max(...BIRDS.map(x=>x.jet)));
 assert.equal(BIRDS[3].efficiency,Math.max(...BIRDS.map(x=>x.efficiency)));
});

test('only jump input: ground jump, single fuel-powered boost, no sprint',()=>{
 const s=newRun(1,42);const fuel=s.fuel;
 assert.equal(jump(s),true);assert.equal(s.grounded,false);
 assert.equal(jump(s),true);assert(s.fuel<fuel);
 assert.equal(jump(s),false);
 assert.equal('sprint' in s,false);
});

test('empty fuel disables jetpack but preserves an emergency jump',()=>{
 const s=newRun(0,4);s.fuel=0;
 assert(jump(s));assert.equal(jump(s),false);
});

test('EMP disables jetpack without disabling grounded jump',()=>{
 const s=newRun(2,9);s.elapsed=181;s.disaster={id:'emp',start:180,end:193};
 assert(jump(s));assert.equal(jump(s),false);
});

test('disasters begin at three minutes, then become more frequent',()=>{
 assert.equal(disasterWindow(179),null);
 assert.deepEqual(disasterWindow(180),[60,90]);
 assert.deepEqual(disasterWindow(400),[35,60]);
 assert.deepEqual(disasterWindow(600),[22,40]);
 assert.deepEqual(disasterWindow(800),[15,28]);
 const s=newRun(1,813);s.nextHazard=1e8;s.nextCorn=1e8;s.elapsed=179.99;
 step(s,1/60);
 assert(activeDisaster(s));
 assert(['emp','collapse','plasma','gravity'].includes(s.disaster.id));
 assert(s.nextDisaster>s.disaster.end);
 assert(disasterWarning(s));
});

test('generated courses repeat for the same seed and chicken',()=>{
 const a=newRun(3,777),b=newRun(3,777);
 for(let i=0;i<65;i++){step(a,1/60);step(b,1/60);}
 assert.deepEqual(a,b);
 assert(a.hazards.length>=1);assert(a.corn.length>=2);
});

test('corn replenishes energy and pushes back fox pressure',()=>{
 const s=newRun(3,3);s.nextCorn=1e8;s.nextHazard=1e8;s.fuel=40;s.fox=.65;
 s.corn=[{x:4,y:-31,got:false}];step(s,1/60);
 assert(s.fuel>40);assert(s.fox<.65);assert.equal(s.collected,1);
});

test('barriers and void gaps are fatal without a timely jump',()=>{
 const barrier=newRun(1,41);
 barrier.nextHazard=1e8;barrier.nextCorn=1e8;
 barrier.hazards=[{type:'barrier',x:20,width:26,phase:0}];
 for(let i=0;i<30&&barrier.alive;i++)step(barrier,1/60);
 assert.equal(barrier.alive,false);assert.match(barrier.reason,/Energy barrier/);
 const gap=newRun(1,41);gap.nextHazard=1e8;gap.nextCorn=1e8;
 gap.hazards=[{type:'gap',x:18,width:105,phase:0}];
 for(let i=0;i<120&&gap.alive;i++)step(gap,1/60);
 assert.equal(gap.alive,false);assert.match(gap.reason,/void/);
});

test('starvation eventually lets the fox catch a runner',()=>{
 const s=newRun(1,2);s.fuel=0;s.fox=.96;s.nextHazard=1e8;s.nextCorn=1e8;
 for(let i=0;i<120&&s.alive;i++)step(s,1/60);
 assert.equal(s.alive,false);assert.match(s.reason,/fox/);
});
