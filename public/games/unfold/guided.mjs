// Pure guided-placement solver. Every marker represents a contact cell that
// accepts at least one legal rotation/mirror of the *current* six-faced net.
// Distinct orientations with the same footprint are shown only once.
import { legalPlacements, placedCells } from './engine.mjs';
import { oriented } from './nets.mjs';

const contactKey = ([x,y]) => `${x},${y}`;
const footprintKey = cells => cells.map(contactKey).sort().join('|');

export function legalFits(state, actor, net, excluded=null) {
  const positions = new Map();
  for (const flipped of [false,true]) for (let rotation=0;rotation<4;rotation++) {
    const [dx,dy] = oriented(net,rotation,flipped)[0];
    for (const [x,y] of legalPlacements(state,actor,net,rotation,flipped,excluded)) {
      const contact=[x+dx,y+dy],key=contactKey(contact);
      const cells=placedCells(net,rotation,flipped,x,y);
      const shape=footprintKey(cells);
      if (!positions.has(key)) positions.set(key,{contact,fits:[],seen:new Set()});
      const entry=positions.get(key);
      if (entry.seen.has(shape)) continue;
      entry.seen.add(shape);
      entry.fits.push({rotation,flipped,cells});
    }
  }
  const result=new Map();
  for (const [key,{contact,fits}] of positions) result.set(key,{contact,fits});
  return result;
}
