// Pure seeded terrain helpers. The engine is still the rules authority.
import { NETS, oriented } from './nets.mjs';
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
  for(const o of s.obstacles)mark(o.cells,o.type==='permanent'?'P':o.type==='gate'?'E':'R');
  for(const c of s.cubes)if(c.owner===null)mark(c.cells,'N');
  return tiles.join('');
}

// Solo/Co-op terrain is built using the same authoritative engine validators.
// Dependency injection avoids a circular terrain -> engine import.
export function makeTerrainGeneration({occupied,connectedCells,canPlace,legalPlacements}){
  const DIRECTIONS=[[1,0],[-1,0],[0,1],[0,-1]];
  const split=k=>k.split(',').map(Number);
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
    // Replace pre-existing steel (never the protected witness route) with
    // short latching doors. The proven detour remains playable while closed.
    const route=proof.route.flatMap(c=>c.cells.map(cell=>({cell,owner:c.owner})));
    const routeNear=(site,side,owner=null)=>route.filter(r=>
      (owner===null||r.owner===owner)&&
      (side==='above'?r.cell[1]<site.y:side==='below'?r.cell[1]>site.y:true))
      .sort((a,b)=>distance(a.cell,[site.x,site.y])-distance(b.cell,[site.x,site.y]));
    if(s.mode==='solo'){
      for(const site of gates){
        const length=s.level==='starter'?1:s.level==='hard'?3:2;
        const nearSteel=s.obstacles.filter(o=>o.type==='permanent'&&o.cells[0][1]===site.y);
        let selected=null;
        // The side of the gap provides a straight 1-3-cell steel segment.
        for(const dir of [-1,1]){
          const x0=site.x+(dir===-1?-Math.ceil((s.level==='hard'?8:s.level==='standard'?6:5)/2):Math.ceil((s.level==='hard'?8:s.level==='standard'?6:5)/2));
          const line=Array.from({length},(_,i)=>[x0+dir*i,site.y]);
          const pieces=line.map(c=>nearSteel.find(o=>o.cells.some(t=>key(t)===key(c))));
          if(pieces.every(Boolean)){selected=pieces;break;}
        }
        if(!selected){
          // Try any consecutive steel at this row closest to the passage.
          const byX=new Map(nearSteel.map(o=>[o.cells[0][0],o]));
          for(const x of [...byX.keys()].sort((a,b)=>Math.abs(a-site.x)-Math.abs(b-site.x))){
            const p=Array.from({length},(_,i)=>byX.get(x+i));
            if(p.every(Boolean)){selected=p;break;}
          }
        }
        if(!selected)return false;
        const plus=routeNear(site,'below')[0]?.cell;
        const minus=routeNear(site,'above')[0]?.cell;
        if(!plus||!minus||key(plus)===key(minus))return false;
        const door={id:selected[0].id,type:'gate',open:false,
          cells:selected.map(o=>o.cells[0]),terminals:[plus,minus]};
        const ids=new Set(selected.map(o=>o.id));
        s.obstacles=s.obstacles.filter(o=>!ids.has(o.id));s.obstacles.push(door);
      }
    }else if(s.mode==='coop'){
      // One optional circuit door near a verified route, not over any module.
      const first=route.filter(r=>r.owner===0),used=new Set([
        ...proof.reserve,...s.obstacles.flatMap(o=>o.cells.map(key)),
        ...s.players.map(p=>key(p.base)),...(s.goal?[key(s.goal)]:[])]);
      const candidates=[];
      for(const r of first)for(const [dx,dy] of DIRECTIONS){
        const c=[r.cell[0]+dx,r.cell[1]+dy];
        if(inside(s,c)&&!used.has(key(c))&&s.players.every(p=>distance(c,p.base)>2)&&distance(c,s.goal)>1)
          candidates.push(c);
      }
      if(candidates.length&&first.length>=2){
        const cell=candidates[pick(s,candidates.length)];
        const firstRoute=first.slice().sort((a,b)=>distance(a.cell,cell)-distance(b.cell,cell));
        const terminals=[firstRoute[0].cell,firstRoute.find(r=>key(r.cell)!==key(firstRoute[0].cell))?.cell];
        if(terminals[1])s.obstacles.push({id:s.nextId++,type:'gate',open:false,cells:[cell],terminals});
      }
    }
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
  return {challengeTerrain,hasOpening};
}
