// Pure seeded terrain helpers. The engine is still the rules authority.
import { oriented } from './nets.mjs';
const key=([x,y])=>`${x},${y}`;
const inside=(s,[x,y])=>x>=0&&y>=0&&x<s.size&&y<s.size;
export function random(s){let x=s.seed>>>0||0x6d2b79f5;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x>>>0;return s.seed/4294967296;}
export const pick=(s,n)=>Math.floor(random(s)*n);
export function bases(size,count,mode){const m=Math.floor(size/2);if(mode==='solo')return [[m,size-2]];if(count===2)return [[m,1],[m,size-2]];if(count===3)return [[m,1],[size-2,m],[1,size-2]];return [[m,1],[size-2,m],[m,size-2],[1,m]];}

// Multiplayer terrain is seeded and generated ONCE by the room authority.
// A neutral module is always an actual complete 6-panel cube, never a group of
// unrelated squares. Competing bases get a clear buffer and comparable openings.
export function seededMultiplayerTerrain(s){
  const count=s.players.length,freeOfBases=c=>s.players.every(p=>
    Math.abs(p.base[0]-c[0])+Math.abs(p.base[1]-c[1])>3);
  const used=new Set(s.players.map(p=>key(p.base)));
  const cellsFree=cells=>cells.every(c=>inside(s,c)&&!used.has(key(c))&&freeOfBases(c));
  const addObstacle=(type,cells)=>{s.obstacles.push({id:s.nextId++,type,cells});cells.forEach(c=>used.add(key(c)));};
  const addNeutral=(net,rotation,flipped,cells)=>{
    s.cubes.push({id:s.nextId++,number:null,owner:null,net,rotation,flipped,cells});
    cells.forEach(c=>used.add(key(c)));
  };
  // Keep the two regions either side of each player open, avoiding unfair
  // starting traps. Neutral cubes deliberately sit in the contested interior.
  const neutralCount=count===2?2:count===3?3:4;
  for(let i=0;i<neutralCount;i++)for(let attempt=0;attempt<180;attempt++){
    const net=pick(s,11),rotation=pick(s,4),flipped=pick(s,2)===1;
    const shape=oriented(net,rotation,flipped),x=pick(s,s.size-4),y=pick(s,s.size-4);
    const cells=shape.map(([dx,dy])=>[x+dx,y+dy]);
    if(!cellsFree(cells))continue;
    // Prevent a disproportionate neutral advantage for one base.
    const distances=s.players.map(p=>Math.min(...cells.map(c=>
      Math.abs(p.base[0]-c[0])+Math.abs(p.base[1]-c[1]))));
    if(Math.max(...distances)-Math.min(...distances)>Math.ceil(s.size*.6))continue;
    addNeutral(net,rotation,flipped,cells);break;
  }
  const obstacleCount=Math.round(s.size*s.size*.028);
  for(let i=0;i<obstacleCount;i++)for(let attempt=0;attempt<120;attempt++){
    const cell=[pick(s,s.size),pick(s,s.size)];
    if(!cellsFree([cell]))continue;
    addObstacle(i%4===0?'permanent':'rubble',[cell]);break;
  }
}

// Record the initial layout before any actions can remove or add terrain.
export function layoutSignature(s){
  const tiles=Array(s.size*s.size).fill('.');
  const mark=(cells,value)=>{for(const [x,y] of cells)tiles[y*s.size+x]=value;};
  for(const p of s.players)mark([p.base],'B');
  if(s.goal)mark([s.goal],'G');
  for(const o of s.obstacles)mark(o.cells,o.type==='permanent'?'P':'R');
  for(const c of s.cubes)if(c.owner===null)mark(c.cells,'N');
  return tiles.join('');
}
