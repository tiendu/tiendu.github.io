// UNFOLD v0.5: deterministic, renderer-independent rules.
import { NETS, oriented } from './nets.mjs';
import { random, pick, bases, seededMultiplayerTerrain, layoutSignature, makeTerrainGeneration } from './terrain.mjs';
export const FACES = Object.freeze(['deploy','deploy','special','reclaim','reclaim','refold']);
export const LABELS = Object.freeze({deploy:'Deploy',special:'Super Deploy',reclaim:'Reclaim',refold:'Refold'});
const DIRECTIONS=[[1,0],[-1,0],[0,1],[0,-1]];
const key=([x,y])=>`${x},${y}`;
const split=k=>k.split(',').map(Number);
const adjacent=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])===1;
const inside=(s,[x,y])=>x>=0&&y>=0&&x<s.size&&y<s.size;
export const clone=s=>structuredClone(s);
function roll(s){const index=pick(s,6);const action=FACES[index];return {face:index+1,action,net:action==='deploy'?pick(s,NETS.length):null};}
export const player=(s,id=s.active)=>s.players[id];
export const occupied=s=>{
  const result=new Map();
  for(const p of s.players)result.set(key(p.base),{kind:'base',id:p.id,owner:p.baseOwner});
  if(s.goal)result.set(key(s.goal),{kind:'goal'});
  for(const o of s.obstacles)for(const c of o.cells)result.set(key(c),{kind:'obstacle',id:o.id,type:o.type});
  for(const [ordinal,cube] of s.cubes.entries())cube.cells.forEach((c,face)=>result.set(key(c),{kind:'cube',id:cube.id,owner:cube.owner,contact:face===0,number:cube.number??null}));
  return result;
};
const {challengeTerrain,hasOpening}=makeTerrainGeneration({
  occupied,connectedCells,canPlace,legalPlacements
});
// A new seed alone does not guarantee a visibly different board. Retry when
// the generated terrain matches the completed game's *original* layout.
export function newDistinctGame(config,previous=null){
  let next=newGame(config);
  if(!previous)return next;
  const oldBoard=previous.layoutId??layoutSignature(previous);
  for(let retry=1;retry<=16&&next.layoutId===oldBoard;retry++){
    const seed=(((Number(config.seed)>>>0)+Math.imul(retry,0x9e3779b9))>>>0)||1;
    next=newGame({...config,seed});
  }
  if(next.layoutId===oldBoard)throw Error('Unable to generate a different board');
  return next;
}
export function newGame({mode='solo',count=1,level='standard',seed=12345}={}){
  if(!['solo','coop','competitive'].includes(mode))throw Error('Invalid mode');
  if(level==='challenge')level='standard'; // migrate saved v1.3 puzzles
  if(mode==='solo'&&!['open','starter','standard','hard'].includes(level))throw Error('Invalid Solo map difficulty');
  const n=mode==='solo'?1:Math.max(2,Math.min(4,Math.floor(count)));
  const size=mode==='solo'?({open:11,starter:13,standard:15,hard:19}[level]):
    mode==='coop'?(n===2?15:n===3?17:19):(n===2?13:n===3?17:19);
  const s={version:5,mode,level,size,seed:(Number(seed)>>>0)||1,
    players:bases(size,n,mode).map((base,id)=>({id,name:mode==='solo'?'You':['Red','Blue','Green','Gold'][id],base,baseOwner:id,alive:true})),
    active:0,turn:1,acted:false,die:null,cubes:[],obstacles:[],
    goal:mode==='solo'||mode==='coop'?[Math.floor(size/2),mode==='solo'?1:Math.floor(size/2)]:null,
    nextId:1,nextCubeNumber:1,winner:null,announcement:''};
  if(mode==='solo'&&level==='open'){
    // Keep the field empty but vary both ends of the route every round.
    const mid=Math.floor(size/2);
    s.players[0].base=[mid-2+pick(s,5),size-2];
    s.goal=[mid-2+pick(s,5),1];
  }
  if(mode==='competitive'){
    let accepted=false;
    for(let attempt=0;attempt<16;attempt++){
      s.obstacles=[];s.cubes=[];s.nextId=1;
      seededMultiplayerTerrain(s);
      if(s.players.every(p=>hasOpening(s,p.id))){accepted=true;break;}
    }
    if(!accepted){s.obstacles=[];s.cubes=[];s.nextId=1;}
  }else if(level!=='open'||mode==='coop'){
    let accepted=false;
    for(let attempt=0;attempt<12;attempt++){
      s.obstacles=[];s.cubes=[];s.nextId=1;delete s.terrainProof;
      if(challengeTerrain(s)&&s.players.every(p=>hasOpening(s,p.id))){accepted=true;break;}
    }
    if(!accepted)throw Error('Unable to generate a playable construction map');
  }
  s.layoutId=layoutSignature(s);
  s.die=roll(s);return s;
}
function walk(available,roots){const seen=new Set(),queue=[];for(const r of roots)if(available.has(r)){seen.add(r);queue.push(r);}for(let i=0;i<queue.length;i++){const [x,y]=split(queue[i]);for(const [dx,dy]of DIRECTIONS){const k=key([x+dx,y+dy]);if(available.has(k)&&!seen.has(k)){seen.add(k);queue.push(k);}}}return seen;}
export function connectedCells(s,actor,excluded=null){
  const friendly=s.mode==='coop'?s.players.filter(p=>p.alive).map(p=>p.id):[actor],available=new Set(),roots=[];
  for(const p of s.players){if(friendly.includes(p.baseOwner))available.add(key(p.base));if(p.id===actor)roots.push(key(p.base));}
  for(const c of s.cubes)if(c.id!==excluded&&friendly.includes(c.owner))for(const cell of c.cells)available.add(key(cell));
  return walk(available,roots);
}
const touchesNetwork=(cells,network)=>cells.some(([x,y])=>DIRECTIONS.some(([dx,dy])=>network.has(key([x+dx,y+dy]))));
export const placedCells=(net,rotation=0,flipped=false,x=0,y=0)=>oriented(net,rotation,flipped).map(([dx,dy])=>[x+dx,y+dy]);
export function canPlace(s,actor,net,rotation,flipped,x,y,excluded=null){
  if(!Number.isInteger(net)||net<0||net>=NETS.length||!Number.isInteger(x)||!Number.isInteger(y))return false;
  const cells=placedCells(net,rotation,flipped,x,y),used=occupied(s);
  if(excluded!=null){const old=s.cubes.find(c=>c.id===excluded);if(!old)return false;
    // No-op relocation is not meaningful; allow a changed footprint even if some cells overlap.
    if(cells.every(c=>old.cells.some(v=>key(v)===key(c))))return false;
  }
  if(cells.some(c=>!inside(s,c)||(used.has(key(c))&&!(used.get(key(c)).kind==='cube'&&used.get(key(c)).id===excluded))))return false;
  return touchesNetwork(cells,connectedCells(s,actor,excluded));
}
export function legalPlacements(s,actor,net,rotation=0,flipped=false,excluded=null){const a=[];for(let y=0;y<s.size;y++)for(let x=0;x<s.size;x++)if(canPlace(s,actor,net,rotation,flipped,x,y,excluded))a.push([x,y]);return a;}
export function canReclaim(s,actor,id){
  const cube=s.cubes.find(c=>c.id===id),obstacle=s.obstacles.find(o=>o.id===id),target=cube||obstacle;
  if(!target)return false;
  if(cube&&(cube.owner===actor||(s.mode!=='competitive'&&cube.owner!==null)))return false;
  if(obstacle&&obstacle.type==='permanent')return false;
  return touchesNetwork(target.cells,connectedCells(s,actor));
}
export function refoldable(s,actor,id){
  const target=s.cubes.find(c=>c.id===id);
  if(!target||target.owner!==actor)return false;
  const teammates=s.mode==='coop'?s.players.filter(p=>p.alive).map(p=>p.id):[actor];
  const neighbors=s.cubes.filter(c=>c.id!==id&&teammates.includes(c.owner)&&c.cells.some(a=>target.cells.some(b=>adjacent(a,b))));
  if(neighbors.length>1)return false; // rear cube only; protect teammate links too
  const before=connectedCells(s,actor),after=connectedCells(s,actor,id);
  // Only roads connected before refolding must remain connected afterwards.
  // In Co-op, that includes teammate roads that joined our network.
  return s.cubes.filter(c=>c.id!==id&&teammates.includes(c.owner))
    .every(c=>c.cells.filter(v=>before.has(key(v))).every(v=>after.has(key(v))));
}
function neutralize(s){if(s.mode!=='competitive')return;
  for(const p of s.players.filter(p=>p.alive)){
    const connected=connectedCells(s,p.id);
    for(const c of s.cubes)if(c.owner===p.id&&!c.cells.some(v=>connected.has(key(v)))){c.owner=null;c.neutralFrom=p.id;}
  }
}
function victory(s,actor){
  if(s.mode==='solo'){const connected=connectedCells(s,actor);if(DIRECTIONS.some(([dx,dy])=>connected.has(key([s.goal[0]+dx,s.goal[1]+dy])))){s.winner={kind:'solo',players:[actor]};s.announcement='Destination reached. Puzzle complete!';}return;}
  if(s.mode==='coop'){
    const available=new Set(s.players.filter(p=>p.alive).map(p=>key(p.base)));
    for(const c of s.cubes)if(c.owner!==null)for(const cell of c.cells)available.add(key(cell));
    const active=walk(available,[key(s.players[0].base)]);
    const goalReached=!s.goal||DIRECTIONS.some(([dx,dy])=>active.has(key([s.goal[0]+dx,s.goal[1]+dy])));
    if(goalReached&&s.players.every(p=>active.has(key(p.base)))){s.winner={kind:'coop',players:s.players.map(p=>p.id)};s.announcement='All bases connected to the goal!';}return;
  }
  let active=connectedCells(s,actor);
  for(const opponent of s.players.filter(p=>p.alive&&p.id!==actor)){
    if(!DIRECTIONS.some(([dx,dy])=>active.has(key([opponent.base[0]+dx,opponent.base[1]+dy]))))continue;
    opponent.alive=false;opponent.baseOwner=actor;
    for(const c of s.cubes)if(c.owner===opponent.id)c.owner=actor;
    s.announcement=`${player(s,actor).name} conquered ${opponent.name}.`;active=connectedCells(s,actor);
  }
  neutralize(s);
  if(s.players.filter(p=>p.alive).length===1){s.winner={kind:'competitive',players:[actor]};s.announcement=`${player(s,actor).name} wins!`;}
}
export function hasPhysicalMove(s,actor){
  if([...s.cubes,...s.obstacles].some(o=>canReclaim(s,actor,o.id)))return true;
  for(let net=0;net<NETS.length;net++)for(const flip of [false,true])for(let r=0;r<4;r++)if(legalPlacements(s,actor,net,r,flip).length)return true;
  for(const c of s.cubes){if(c.owner!==actor||!refoldable(s,actor,c.id))continue;
    for(let net=0;net<NETS.length;net++)for(const flip of [false,true])for(let rot=0;rot<4;rot++){
      if(legalPlacements(s,actor,net,rot,flip,c.id).length)return true;
    }
  }
  return false;
}
// All actions use the same rule entry point and may occur only once per turn.
export function act(s,payload={}){
  if(s.winner||s.acted)throw Error('This turn is finished');
  const next=clone(s),actor=next.active,action=next.die.action;
  next.announcement='';
  if(action==='reclaim'){
    const id=Number(payload.targetId);if(!canReclaim(next,actor,id))throw Error('Only adjacent enemy/neutral cubes or obstacles can be reclaimed');
    const cube=next.cubes.find(c=>c.id===id);
    if(cube){cube.owner=actor;delete cube.neutralFrom;neutralize(next);}else next.obstacles=next.obstacles.filter(o=>o.id!==id);
  }else if(['deploy','special','refold'].includes(action)){
    const {x,y,rotation=0,flipped=false,targetId=null}=payload;
    const net=action==='deploy'?next.die.net:Number(payload.netIndex);
    const old=action==='refold'?next.cubes.find(c=>c.id===targetId):null;
    if(action==='refold'&&!refoldable(next,actor,targetId))throw Error('Choose a removable rear cube');
    if(!canPlace(next,actor,net,rotation,flipped,x,y,old?.id??null))throw Error('Blocked placement. Rotate or pick a green anchor.');
    const cells=placedCells(net,rotation,flipped,x,y);
    if(old)Object.assign(old,{cells,net,rotation,flipped});
    else next.cubes.push({id:next.nextId++,number:next.nextCubeNumber??(next.cubes.length+1),owner:actor,cells,net,rotation,flipped});
    if(!old)next.nextCubeNumber=(next.nextCubeNumber??next.cubes.length)+1;
  }else throw Error('Unsupported action');
  next.acted=true;victory(next,actor);next.announcement ||= `${player(next).name} used ${LABELS[action]}.`;
  return next;
}
export function endTurn(s){
  if(s.winner)return s;
  const next=clone(s);next.announcement='';
  // Passing is always legal: a poor roll is luck, not a defeat.
  if(next.mode==='competitive'&&!hasPhysicalMove(next,next.active)){
    const p=player(next);p.alive=false;p.baseOwner=null;
    for(const c of next.cubes)if(c.owner===p.id){c.owner=null;c.neutralFrom=p.id;}
    next.announcement=`${p.name} has no physical moves and is eliminated.`;
  }
  const alive=next.players.filter(p=>p.alive);
  if(next.mode==='competitive'&&alive.length===1){next.winner={kind:'competitive',players:[alive[0].id]};return next;}
  if(next.mode==='coop'&&!next.players.some(p=>p.alive&&hasPhysicalMove(next,p.id))){
    next.winner={kind:'stuck',players:[]};next.announcement='Team has no legal moves remaining.';return next;
  }
  if(next.mode==='solo'&&!hasPhysicalMove(next,0)){
    next.winner={kind:'stuck',players:[]};next.announcement='No legal moves remain.';return next;
  }
  if(next.mode==='competitive'){
    do{next.active=(next.active+1)%next.players.length;}while(!player(next).alive);
  }else if(next.mode==='coop')next.active=(next.active+1)%next.players.length;
  next.turn++;next.acted=false;next.die=roll(next);return next;
}
