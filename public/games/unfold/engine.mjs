// UNFOLD v0.5: deterministic, renderer-independent rules.
import { NETS, oriented } from './nets.mjs';
import { random, pick, bases, seededMultiplayerTerrain, layoutSignature } from './terrain.mjs';
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
// An actual, legal sequence of six-panel deployments is reserved before we
// scatter terrain. This is a feasibility witness, not a suggested solution.
// It is deliberately discarded from the starting board.
const SHAPES=Object.freeze(Array.from({length:NETS.length},(_,net)=>
  [false,true].flatMap(flipped=>Array.from({length:4},(_,rotation)=>({net,rotation,flipped,cells:oriented(net,rotation,flipped)}))))
  .flat());
const distance=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);
function extendWitness(s,actor,target,maxMoves){
  for(let step=0;step<maxMoves;step++){
    const network=connectedCells(s,actor);
    if([...network].some(c=>distance(split(c),target)<=1))return true;
    const used=occupied(s),border=new Map();
    for(const cell of network){const [x,y]=split(cell);
      for(const [dx,dy] of DIRECTIONS){const c=[x+dx,y+dy];if(inside(s,c)&&!used.has(key(c)))border.set(key(c),c);}
    }
    const before=Math.min(...[...network].map(c=>distance(split(c),target)));
    const options=[],seen=new Set();
    for(const shape of SHAPES){
      for(const near of border.values())for(const offset of shape.cells){
        const x=near[0]-offset[0],y=near[1]-offset[1],sig=`${shape.net}/${shape.rotation}/${shape.flipped}/${x}/${y}`;
        if(seen.has(sig))continue;seen.add(sig);
        const cells=shape.cells.map(([dx,dy])=>[x+dx,y+dy]);
        if(cells.some(c=>!inside(s,c)||used.has(key(c))))continue;
        const closest=Math.min(...cells.map(c=>distance(c,target)));
        const progress=before-closest;
        if(progress<=0)continue;
        // The nearest panel must extend the existing route toward the target.
        options.push({shape,cells,closest,score:progress*50-closest*.6+random(s)*2});
      }
    }
    if(!options.length)return false;
    options.sort((a,b)=>b.score-a.score);
    const selected=options[pick(s,Math.min(3,options.length))];
    s.cubes.push({id:s.nextId++,owner:actor,number:null,net:selected.shape.net,
      rotation:selected.shape.rotation,flipped:selected.shape.flipped,cells:selected.cells});
  }
  return [...connectedCells(s,actor)].some(c=>distance(split(c),target)<=1);
}
function constructionWitness(s,gates=[]){
  const work={...s,cubes:[],obstacles:s.obstacles.map(o=>({...o})),nextId:s.nextId};
  const mid=Math.floor(s.size/2);
  // The ordered gates cross alternating bands of broken permanent steel.
  // This creates a genuine detour, not an arbitrary minimum turn counter.
  if(s.mode==='solo'){
    for(const gate of gates){
      if(!extendWitness(work,0,[gate.x,gate.y-1],s.size*2))return null;
    }
    if(!extendWitness(work,0,s.goal,s.size*2))return null;
  }else if(s.mode==='coop'){
    for(const p of s.players){
      if(!extendWitness(work,p.id,s.goal,s.size))return null;
    }
  }
  const reserve=new Set(work.cubes.flatMap(c=>c.cells.map(key)));
  return {reserve,route:work.cubes.map(c=>({...c,cells:c.cells.map(p=>[...p])}))};
}
function challengeTerrain(s){
  const config={
    starter:{density:.070,neutral:1},
    standard:{density:.105,neutral:2},
    hard:{density:.135,neutral:3},
  }[s.level]||{density:.105,neutral:2};
  // Co-op is a team challenge; the obstacles cannot favor one particular
  // player because a protected construction witness exists for each base.
  if(s.mode==='coop'){
    config.density=.08+s.players.length*.012;
    config.neutral=s.players.length===2?2:s.players.length===3?3:4;
  }
  const gates=[];
  if(s.mode==='solo'){
    // Vary the steel bands and openings while keeping the base and goal clear.
    const rows=s.level==='hard'?[s.size-5-pick(s,2),Math.floor(s.size/2)+pick(s,3)-1,4+pick(s,2)]:
      s.level==='standard'?[s.size-5,Math.floor(s.size/2),4+pick(s,2)]:
      [Math.floor(s.size*.52)+pick(s,3)-1];
    const leftFirst=pick(s,2)===0,span=s.level==='hard'?8:s.level==='standard'?6:5;
    const edge=s.size-span-1,spread=Math.max(1,Math.floor((edge-1)/2));
    for(const [i,y] of rows.entries()){
      const left=i%2===0?leftFirst:!leftFirst;
      const start=left?1+pick(s,spread):edge-pick(s,spread);
      for(let x=0;x<s.size;x++){
        if(x>=start&&x<start+span)continue;
        s.obstacles.push({id:s.nextId++,type:'permanent',cells:[[x,y]]});
      }
      gates.push({x:start+Math.floor((span-1)/2),y});
    }
  }
  const proof=constructionWitness(s,gates);
  if(!proof)return false;
  const used=new Set([...proof.reserve,...s.obstacles.flatMap(o=>o.cells.map(key)),...s.players.map(p=>key(p.base)),...(s.goal?[key(s.goal)]:[])]);
  const protectedBase=c=>s.players.some(p=>distance(c,p.base)<=2)||s.goal&&distance(c,s.goal)<=1;
  const free=c=>inside(s,c)&&!used.has(key(c))&&!protectedBase(c);
  const placeObstacle=(type,c)=>{s.obstacles.push({id:s.nextId++,type,cells:[c]});used.add(key(c));};
  // The bands were laid down BEFORE proving legal construction moves.
  // Extra crates, scrap and neutral modules fill unreserved sockets only.
  let neutrals=0;
  for(let i=0;i<config.neutral;i++)for(let attempt=0;attempt<220;attempt++){
    const net=pick(s,NETS.length),rotation=pick(s,4),flipped=pick(s,2)===1;
    const shape=oriented(net,rotation,flipped);
    const x=pick(s,s.size-4),y=pick(s,s.size-4);
    const cells=shape.map(([dx,dy])=>[x+dx,y+dy]);
    if(!cells.every(free))continue;
    s.cubes.push({id:s.nextId++,number:null,owner:null,net,rotation,flipped,cells});
    cells.forEach(c=>used.add(key(c)));neutrals++;break;
  }
  const count=Math.round(s.size*s.size*config.density);
  for(let i=0;i<count;i++)for(let attempt=0;attempt<130;attempt++){
    const c=[pick(s,s.size),pick(s,s.size)];if(!free(c))continue;
    placeObstacle(i%4===0?'permanent':'rubble',c);break;
  }
  // Check the witness against the finished terrain using the game's ACTUAL
  // placement validator, rather than assuming a path of empty cells suffices.
  const check={...s,cubes:s.cubes.map(c=>({...c})),acted:false};
  for(const route of proof.route){
    const coords=route.cells[0],orient=oriented(route.net,route.rotation,route.flipped);
    const [x,y]=[coords[0]-orient[0][0],coords[1]-orient[0][1]];
    if(!canPlace(check,route.owner,route.net,route.rotation,route.flipped,x,y))return false;
    check.cubes.push(route);
  }
  if(s.goal&&!s.players.every(p=>[...connectedCells(check,p.id)].some(c=>distance(split(c),s.goal)<=1)))return false;
  return true;
}
function hasOpening(s,actor){
  // Assess starting opportunities against every possible net rather than the
  // randomly rolled net. Bad rolls still require skips: no luck compensation.
  let nets=0;
  for(let n=0;n<11;n++){
    let possible=false;
    for(const flip of [false,true])for(let r=0;r<4&&!possible;r++)
      possible=legalPlacements(s,actor,n,r,flip).length>0;
    if(possible)nets++;
  }
  return nets>=9;
}
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
