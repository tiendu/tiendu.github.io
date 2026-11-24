import test from 'node:test';
import assert from 'node:assert/strict';
import {createSolo,tickSolo,nextLevel,soloRecord,betterRecord,levelDifficulty,levelSeed,tickRound} from '../../../../public/games/wisp/core/session.mjs';
import {createRound} from '../../../../public/games/wisp/core/simulation.mjs';
import {createBotBrain} from '../../../../public/games/wisp/core/bots.mjs';
const own=r=>r.round.actors.find(a=>a.player==='local');
const finish=(r,escaped=true)=>{for(const a of r.round.actors.filter(a=>a.faction==='wisp')){a.status=escaped?'escaped':'eliminated';a.reason='test';}r.round.phase='survive';tickSolo(r);};
test('tutorial is only level 1; skip does not award a clear; fresh maze and energy on advance',()=>{
  const r=createSolo({seed:78});assert.equal(r.level,1);assert.equal(r.round.tutorial,true);assert.ok(!r.round.actors.some(a=>a.id==='Stalker'));
  const board=r.round.board;finish(r);assert.equal(r.status,'cleared');assert.equal(r.cleared,1);
  assert.ok(nextLevel(r));assert.equal(r.level,2);assert.notDeepEqual(r.round.board,board);assert.equal(r.round.tutorial,false);assert.equal(own(r).energy,100);assert.equal(own(r).readyAt,0);
  const ids=r.round.actors.map(a=>a.id);finish(r);nextLevel(r);assert.deepEqual(r.round.actors.map(a=>a.id),ids);
  const skipped=createSolo({seed:78,skipTutorial:true});assert.equal(skipped.level,2);assert.equal(skipped.cleared,0);assert.equal(createSolo({character:'Stalker'}).level,2);
  assert.equal(levelDifficulty(1),'easy');assert.equal(levelDifficulty(2),'normal');assert.equal(levelDifficulty(6),'hard');assert.equal(levelDifficulty(9999),'hard');assert.notEqual(levelSeed(1,2),levelSeed(1,3));
});
test('human Wisp death ends run, escaped Wisp waits for final team result, no double scoring',()=>{
  const dead=createSolo();dead.round.phase='survive';own(dead).energy=.01;tickSolo(dead);assert.equal(dead.status,'lost');assert.equal(dead.outcome.active,3);assert.equal(nextLevel(dead),false);const score=soloRecord(dead);tickSolo(dead);assert.deepEqual(soloRecord(dead),score);
  const escaped=createSolo();escaped.round.phase='survive';own(escaped).status='escaped';tickSolo(escaped);assert.equal(escaped.status,'playing');finish(escaped);assert.equal(escaped.status,'cleared');assert.equal(escaped.cleared,1);tickSolo(escaped);assert.equal(escaped.cleared,1);assert.ok(betterRecord(soloRecord(escaped),score));
});
test('solo hunter advances only if all four Wisps are eliminated',()=>{
  const won=createSolo({character:'Warden'});finish(won,false);assert.equal(won.status,'cleared');assert.equal(won.eliminated,4);assert.ok(nextLevel(won));
  const lost=createSolo({character:'Warden'});finish(lost,true);assert.equal(lost.status,'lost');assert.equal(nextLevel(lost),false);
});
test('shared tick path is deterministic after JSON round/brain serialization',()=>{
  const r=createRound({seed:55,humans:[{id:'local',character:'Orb'}]}),brain=createBotBrain('normal');
  for(let i=0;i<200;i++)tickRound(r,brain,[{id:'Orb',direction:[0,1],ability:i%100===0}]);
  const a=JSON.parse(JSON.stringify(r)),b=JSON.parse(JSON.stringify(brain));
  for(let i=0;i<200;i++){tickRound(r,brain);tickRound(a,b);}assert.deepEqual(a,r);assert.deepEqual(b,brain);
});
