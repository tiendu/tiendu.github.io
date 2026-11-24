import test from 'node:test';
import assert from 'node:assert/strict';
import {createFeedback} from '../../../../public/games/wisp/client/feedback.mjs';
import {createRound} from '../../../../public/games/wisp/core/simulation.mjs';
const make=()=>createRound({seed:11,humans:[{id:'local',character:'Orb'}]});
const kinds=events=>events.map(e=>e.kind);
test('presentation feedback is emitted once per state change, not per render',()=>{
  const s=make(),a=s.actors.find(a=>a.id==='Orb'),f=createFeedback();
  assert.deepEqual(f.observe(s,'Orb'),[]);
  s.tick++;s.phase='survive';assert.deepEqual(kinds(f.observe(s,'Orb')),['start']);
  assert.deepEqual(f.observe(s,'Orb'),[]);
  s.tick++;a.energy=30;f.observe(s,'Orb');
  s.tick++;a.energy=40;assert.deepEqual(kinds(f.observe(s,'Orb')),['pickup']);
  s.tick++;a.energy=19;a.immuneUntil=100;assert.deepEqual(kinds(f.observe(s,'Orb')),['hit','low']);
  s.tick++;a.lastAbility={ok:true,tick:s.tick};assert.deepEqual(kinds(f.observe(s,'Orb')),['cast']);
  s.tick++;a.status='eliminated';assert.deepEqual(kinds(f.observe(s,'Orb')),['shatter']);
  assert.deepEqual(f.observe(s,'Orb'),[]);
});
test('escape and portal are distinct, and a new board cannot replay old effects',()=>{
  const f=createFeedback(),s=make(),a=s.actors.find(a=>a.id==='Orb');s.phase='survive';f.observe(s,'Orb');
  s.tick++;s.phase='escape';s.portal={x:1,y:1,closeAt:20};a.status='escaped';
  assert.deepEqual(kinds(f.observe(s,'Orb')),['portal','escape']);
  const next=make();assert.deepEqual(f.observe(next,'Orb'),[]);
});
test('result feedback is deduplicated and resets for rematches',()=>{
  const f=createFeedback();assert.deepEqual(kinds(f.result('a',true)),['win']);assert.deepEqual(f.result('a',true),[]);
  assert.deepEqual(kinds(f.result('b',false)),['loss']);f.reset();assert.deepEqual(kinds(f.result('b',false)),['loss']);
});
