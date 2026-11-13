import test from 'node:test';
import assert from 'node:assert/strict';
import { legalFits } from '../public/games/unfold/guided.mjs';
import { NETS, oriented } from '../public/games/unfold/nets.mjs';
import { newGame, legalPlacements, canPlace, act } from '../public/games/unfold/engine.mjs';

const key=([x,y])=>`${x},${y}`;
const footprint=cells=>cells.map(key).sort().join('|');

test('every legal orientation has a visible landing and all displayed fits are valid',()=>{
  const state=newGame({mode:'solo',level:'starter',seed:9});
  for (let n=0;n<NETS.length;n++) {
    const guided=legalFits(state,0,n);
    const expected=new Set();
    for (const flipped of [false,true]) for (let rotation=0;rotation<4;rotation++) {
      const [dx,dy]=oriented(n,rotation,flipped)[0];
      for (const [x,y] of legalPlacements(state,0,n,rotation,flipped)) {
        expected.add(key([x+dx,y+dy]));
      }
    }
    assert.deepEqual(new Set(guided.keys()),expected,`net ${n}: every legal anchor must appear`);
    for (const [anchor,{contact,fits}] of guided) {
      assert.equal(key(contact),anchor);
      assert(fits.length>=1);
      assert.equal(new Set(fits.map(f=>footprint(f.cells))).size,fits.length,`net ${n}: duplicate fits`);
      for (const pose of fits) {
        const [dx,dy]=oriented(n,pose.rotation,pose.flipped)[0];
        assert(canPlace(state,0,n,pose.rotation,pose.flipped,contact[0]-dx,contact[1]-dy));
        assert.equal(pose.cells.length,6);
        assert.deepEqual(pose.cells[0],contact);
      }
    }
  }
});

test('a guided fit can be committed without any additional rotation or flip step',()=>{
  const game=newGame({mode:'solo',level:'open',seed:15});
  game.die={face:1,action:'deploy',net:7};
  const {contact,fits}=[...legalFits(game,0,7).values()][0];
  const p=fits[0], [dx,dy]=oriented(7,p.rotation,p.flipped)[0];
  const next=act(game,{netIndex:7,x:contact[0]-dx,y:contact[1]-dy,rotation:p.rotation,flipped:p.flipped});
  assert.equal(next.cubes.length,1);
  assert.equal(footprint(next.cubes[0].cells),footprint(p.cells));
});

test('guided solver respects obstacles and excludes the selected cube during refold',()=>{
  const s=newGame({mode:'solo',level:'starter',seed:111});
  const spots=legalFits(s,0,0);
  assert(spots.size>0);
  s.cubes=[{id:801,number:1,owner:0,net:0,rotation:0,flipped:false,cells:[...spots.values()][0].fits[0].cells}];
  const other=legalFits(s,0,0,801);
  for (const {fits} of other.values()) for (const fit of fits)
    assert.notEqual(footprint(fit.cells),footprint(s.cubes[0].cells));
});
