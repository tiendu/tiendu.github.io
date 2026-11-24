import {HZ, STEP, RULES} from './config.mjs';
import {DIRS} from './maze.mjs';
import {cardinal, centered} from './movement.mjs';
import {ABILITIES, abilityAvailability, corridorDistance, abilityTarget} from './abilities.mjs';
import {COUNT, graph, bfs, weightedDistances, cellId, coords, nearest, neighbor, directionTo, manhattan} from './navigation.mjs';

// Difficulty changes decisions only, never movement speed, damage or cooldowns.
export const BOT_LEVELS=Object.freeze({
  easy: Object.freeze({reaction:6, castEvery:12, prediction:0, coordination:2, caution:.65, noise:.65}),
  normal: Object.freeze({reaction:3, castEvery:6, prediction:2, coordination:7, caution:1, noise:.15}),
  hard: Object.freeze({reaction:1, castEvery:3, prediction:3, coordination:10, caution:1.2, noise:0}),
});
const active=a=>a.status==='active';
const same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
const reverse=d=>[-d[0],-d[1]];
const point=i=>{const [x,y]=coords(i);return {x,y};};
const eps=1e-7;
// Brain is serializable beside the round. No Math.random, DOM, or wall clock.
export function createBotBrain(difficulty='normal') {
  if(!Object.hasOwn(BOT_LEVELS,difficulty))throw new Error('Unknown bot difficulty');
  return {difficulty,memory:{},observation:null};
}
function memoryFor(brain,a) {
  return brain.memory[a.id]??={center:-1,thinkAt:0,castAt:0,goal:-1,recent:[],reverseAt:0,warp:a.warp};
}
function noise(s,a,i) {
  let v=(s.seed^Math.imul(s.tick+1,2654435761)^Math.imul(i+1,2246822519)^Math.imul(a.id.charCodeAt(0),3266489917))>>>0;
  v=Math.imul(v^(v>>>16),2246822519)>>>0;return (v^(v>>>13))>>>0;
}
function upcoming(a) {
  if(centered(a))return nearest(a);
  const [dx,dy]=a.dir;
  return cellId(dx>0?Math.ceil(a.x):dx<0?Math.floor(a.x):Math.round(a.x),dy>0?Math.ceil(a.y):dy<0?Math.floor(a.y):Math.round(a.y));
}
function options(g,a,at) {
  const edges=g.edges[at]??[];
  // An opposite buffered direction reverses immediately in the movement engine.
  // Do not accidentally reverse mid-edge while intending a turn at the next center.
  return centered(a)?edges:edges.filter(j=>!same(directionTo(at,j),reverse(a.dir)));
}
function positionMap(g,a,maps) {
  const i=nearest(a);return maps(g,i);
}
function predict(g,a,steps) {
  let i=nearest(a),d=a.dir;
  if(!cardinal(d))return i;
  for(let n=0;n<steps;n++){const j=neighbor(i,d);if(!g.mask[j])break;i=j;}
  return i;
}
function visibleWisps(s) {
  // Identical candidate shape for a real Wisp or an Echo. No owner, real/decoy
  // flag, exact energy or private cooldown is used by hunter decisions.
  return [...s.actors.filter(a=>active(a)&&a.faction==='wisp'),...s.decoys]
    .map(({id,x,y,dir})=>({id,x,y,dir:[...dir]}));
}
function makeContext(s,brain,profile) {
  const blocked=s.blocks.filter(b=>s.tick<b.until).map(b=>cellId(b.x,b.y));
  const portal=s.portal?cellId(s.portal.x,s.portal.y):-1;
  const base=graph(s.board),wisp=graph(s.board,blocked),hunter=graph(s.board,portal<0?[]:[portal]);
  const memo=new Map();
  function maps(g,i){let m=memo.get(g);if(!m){m=new Map();memo.set(g,m);}if(!m.has(i))m.set(i,bfs(g,i));return m.get(i);}
  const hunters=s.actors.filter(a=>active(a)&&a.faction==='hunter');
  // Easy bots react to a slightly older visible position. Hard bots observe
  // each decision tick. Current public terrain and own positions remain exact.
  if(!brain.observation||s.tick-brain.observation.tick>=profile.reaction){
    brain.observation={tick:s.tick,wisps:visibleWisps(s),hunters:hunters.map(({id,x,y,dir,recoverUntil,stunUntil,slowUntil})=>({id,x,y,dir:[...dir],recoverUntil,stunUntil,slowUntil}))};
  }
  const wisps=brain.observation.wisps;
  const threats=brain.observation.hunters.map(h=>({h,dist:positionMap(base,h,maps)}));
  // Recovery, stun and slowing are visible in the renderer. Their current
  // states reduce threat, but bots don't inspect opponents' private readiness.
  const danger=new Float64Array(COUNT).fill(Infinity);
  for(const {h,dist} of threats){const delay=(s.tick<h.recoverUntil?2:0)+(s.tick<h.stunUntil?2:0)+(s.tick<h.slowUntil?1:0);for(let i=0;i<COUNT;i++)danger[i]=Math.min(danger[i],dist[i]+delay-(h.id==='Stalker'?.8:0));}
  return {s,base,wisp,hunter,portal,maps,hunters,wisps,threats,danger};
}
function safeCosts(ctx,a,profile,urgent=false) {
  const risk=(ctx.s.tick<a.immuneUntil||ctx.s.tick<a.barrierUntil)?.45:1;
  const c=new Float64Array(COUNT);
  for(let i=0;i<COUNT;i++){const d=Math.max(0,ctx.danger[i]);c[i]=1+Math.max(0,5-d)**2*.17*profile.caution*risk*(urgent?.12:1);}
  return c;
}
function pickWispGoal(ctx,a,at,m,profile) {
  const {s,wisp:g,maps,danger,portal}=ctx, from=maps(g,at);
  const remaining=s.portal?(s.portal.closeAt-s.tick)/HZ:Infinity;
  const escape=portal>=0&&Number.isFinite(from[portal]);
  const urgent=escape&&(remaining<=from[portal]/RULES.speed+3||a.energy<=from[portal]/RULES.speed*RULES.drain+4);
  const need=100-a.energy;
  // A low-energy Wisp may take a short refill detour, but not miss the portal.
  const refill=escape&&a.energy<from[portal]/RULES.speed*RULES.drain+7;
  if(escape&&!refill)return {goal:portal,urgent};
  let goal=-1,best=-Infinity;
  // Protective characters may position for a rescue if a teammate is under
  // pressure, provided they can reach casting range without diving into contact.
  if(!escape&&profile.coordination>=7&&['Orb','Hex'].includes(a.id)&&a.energy>=a.cost+35&&!abilityAvailability(s,a)&&danger[at]>ABILITIES[a.id].range){
    const range=ABILITIES[a.id].range;
    for(const ally of s.actors)if(ally!==a&&ally.faction==='wisp'&&active(ally)){
      const i=nearest(ally);if(danger[i]>2||from[i]>6)continue;
      const nearAlly=maps(g,i);
      for(const j of g.cells){
        if(from[j]<1||from[j]>3||nearAlly[j]>2||danger[j]<1.25||danger[j]>range)continue;
        const score=danger[j]-from[j]*.4-nearAlly[j]*.3;
        if(score>best){best=score;goal=j;}
      }
    }
    if(goal>=0)return {goal,urgent:false};
  }
  if(need>=5)for(const p of s.pickups)if(p.active){
    const i=cellId(p.x,p.y),d=from[i];if(!Number.isFinite(d))continue;
    if(escape&&(d+maps(g,i)[portal])/RULES.speed+1>remaining)continue;
    if(a.energy<=d/RULES.speed*RULES.drain)continue;
    const competition=s.actors.filter(w=>w!==a&&w.faction==='wisp'&&active(w)&&w.energy<95&&maps(g,nearest(w))[i]+1<d).length;
    const score=Math.min(need,p.value)*(a.energy<35?1.5:1)/(2+d)-Math.max(0,4-danger[i])*.9-competition*.6+(m.goal===i?.18:0);
    if(score>best){best=score;goal=i;}
  }
  if(goal>=0&&(best>0||a.energy<30||refill))return {goal,urgent:false};
  if(escape)return {goal:portal,urgent:true};
  // No useful pickup: travel toward a safe area, avoiding recently visited
  // centers. A bounded horizon keeps the bot from standing on a local maximum.
  best=-Infinity;
  for(const i of g.cells){const d=from[i];if(d<3||d>9)continue;
    const score=Math.min(12,danger[i])*1.1+g.edges[i].length*.55-d*.25-(m.recent.includes(i)?3:0)+(m.goal===i?.25:0);
    if(score>best){best=score;goal=i;}
  }
  return {goal,urgent:false};
}
function hunterAssignments(ctx,profile) {
  const {s,hunter:g,wisp,maps,wisps}=ctx, taken=new Map(), assignments=new Map(), usedGoals=new Map();
  // Assign closest hunters first so a distant bot doesn't claim a nearby prey.
  const list=ctx.hunters.filter(h=>!h.player).map(h=>({h,d:Math.min(...wisps.map(w=>maps(g,nearest(h))[nearest(w)]))})).sort((a,b)=>a.d-b.d);
  for(const {h} of list){
    const from=maps(g,nearest(h));let target=null,best=Infinity;
    for(const w of wisps){
      const i=nearest(w),d=from[i];if(!Number.isFinite(d))continue;
      const score=d+(taken.get(w.id)??0)*profile.coordination+(noise(s,h,i)%100)/100*profile.noise;
      if(score<best){best=score;target=w;}
    }
    if(!target){assignments.set(h.id,{goal:-1,target:null});continue;}
    const n=taken.get(target.id)??0;taken.set(target.id,n+1);
    const direct=nearest(target),lead=h.id==='Stalker'?0:h.id==='Interceptor'?profile.prediction+1:h.id==='Wanderer'?profile.prediction:Math.max(0,profile.prediction-1);
    const predicted=predict(wisp,target,lead);
    let goal=g.mask[predicted]?predicted:direct;
    if(!g.mask[goal]||!Number.isFinite(from[goal]))goal=direct;
    // An extra hunter tries an adjacent junction instead of forming a train.
    if(h.id==='Interceptor'&&ctx.portal>=0&&profile.prediction>0&&from[direct]>2){
      const prey=maps(wisp,direct),exit=maps(wisp,ctx.portal);let score=Infinity;
      for(const j of g.cells){
        // Intercept a plausible escape route before the Wisp arrives. Do not
        // camp the portal mouth: aim at a junction at least two tiles away.
        if(prey[j]<2||prey[j]>8||exit[j]<2||g.edges[j].length<2||
           prey[j]+exit[j]>exit[direct]+1||from[j]>prey[j]+1)continue;
        const value=from[j]+prey[j]*.25+(usedGoals.get(j)??0)*6;
        if(value<score){score=value;goal=j;}
      }
    }
    if(n>0&&profile.coordination>=7){
      const options=g.edges[goal]??[];
      let score=Infinity;
      for(const j of options){const d=from[j]+(usedGoals.get(j)??0)*6+(j===direct?2:0);if(d<score){score=d;goal=j;}}
    }
    // Warden can deny a pickup near its prey rather than duplicate a chase.
    if(h.id==='Warden'&&from[direct]>3){let score=Infinity;for(const p of s.pickups)if(p.active){const j=cellId(p.x,p.y),d=from[j],prey=maps(g,direct)[j];if(prey<=3&&d<=from[direct]+2&&d<score){goal=j;score=d;}}}
    usedGoals.set(goal,(usedGoals.get(goal)??0)+1);assignments.set(h.id,{goal,target});
  }
  return assignments;
}
function route(ctx,a,at,goal,g,cost,m,profile) {
  let choices=options(g,a,at);if(!choices.length)return null;
  const dist=goal>=0?(cost?weightedDistances(g,goal,cost):ctx.maps(g,goal)):null;
  if(dist&&choices.some(j=>Number.isFinite(dist[j])))choices=choices.filter(j=>Number.isFinite(dist[j]));
  let best=-Infinity,choice=null;
  for(const j of choices){
    const d=directionTo(at,j),score=(dist&&Number.isFinite(dist[j])?-(dist[j]+(cost?cost[j]:1)):0)
      -(same(d,reverse(a.dir))?.25:0)-(m.recent.includes(j)?.13:0)+(noise(ctx.s,a,j)%100)/100*profile.noise;
    if(score>best){best=score;choice=d;}
  }
  return choice;
}
function within(ctx,a,b,r) {return manhattan(a,b)<=r+eps&&corridorDistance(ctx.s.board,a,b)<=r+eps;}
function phaseAim(ctx,a,goal,cost) {
  const {s}=ctx,g=a.faction==='wisp'?ctx.wisp:ctx.hunter,at=nearest(a);
  if(goal<0||manhattan(a,point(at))>.22)return null;
  const dist=cost?weightedDistances(g,goal,cost):ctx.maps(g,goal);
  let best=2,aim=null;
  for(const d of DIRS){const target=abilityTarget(s,a,d);if(!target)continue;const j=cellId(target.x,target.y);const gain=dist[at]-dist[j];
    if(Number.isFinite(dist[j])&&gain>best&&(a.faction==='hunter'||ctx.danger[j]>=ctx.danger[at]-.5)){best=gain;aim=d;}}
  return aim;
}
function decideCast(ctx,a,plan,m,profile) {
  const {s,hunters,danger}=ctx, spec=ABILITIES[a.id], at=nearest(a);
  if(abilityAvailability(s,a))return null;
  const w=a.faction==='wisp';
  const enemies=w?hunters:visibleWisps(s);
  const close=r=>enemies.filter(b=>within(ctx,a,b,r));
  const d=danger[at];
  // Preserve a small survival reserve; only defensive emergency casts can
  // spend near the reserve. Ability engine still validates all actual casts.
  if(w&&a.energy-a.cost<(d<1.5?4:14))return null;
  switch(a.id){
    case 'Orb': return close(spec.range).some(h=>s.tick>=h.stunUntil&&(s.tick>=h.recoverUntil||h.lunge))?{}:null;
    case 'Prism': case 'Wanderer': {const aim=phaseAim(ctx,a,plan.goal,w?plan.cost:null);return aim?{direction:aim}:null;}
    case 'Ember': return (d<3.5||ctx.portal>=0&&ctx.maps(ctx.wisp,at)[ctx.portal]>5)?{}:null;
    case 'Rune': return d<3&&s.tick>=a.barrierUntil&&s.tick>=a.immuneUntil?{}:null;
    case 'Nova': return d<3&&cardinal(a.dir)&&ctx.wisp.edges[at].length>=2?{}:null;
    case 'Hex': return close(spec.range).some(h=>s.tick>=h.slowUntil&&s.tick>=h.stunUntil)?{}:null;
    case 'Stalker': {
      if(s.tick<a.recoverUntil||!plan.target)return null;
      const dir=centered(a)?plan.direction??a.wanted??a.dir:a.dir;
      if(!cardinal(dir))return null;
      const [dx,dy]=dir, x=plan.target.x-a.x,y=plan.target.y-a.y, ahead=x*dx+y*dy;
      if(ahead<1||ahead>5||Math.abs(x*dy-y*dx)>.15)return null;
      let i=at;for(let n=0;n<Math.ceil(ahead);n++){i=neighbor(i,dir);if(!ctx.hunter.mask[i])return null;}
      return {direction:dir};
    }
    case 'Interceptor': {
      if(!plan.target||manhattan(a,point(at))>.2)return null;
      const target=nearest(plan.target), dist=ctx.maps(ctx.wisp,target);
      for(const dir of DIRS){const j=neighbor(at,dir);if(!ctx.wisp.mask[j]||dist[j]>3||!abilityTarget(s,a,dir))continue;
        // Block a tile along prey's route, not the hunter's own chosen exit.
        if(plan.direction&&same(dir,plan.direction))continue;
        if(ctx.portal>=0&&ctx.maps(ctx.wisp,ctx.portal)[j]>ctx.maps(ctx.wisp,ctx.portal)[target]+1)continue;
        return {direction:dir};}
      return null;
    }
    case 'Warden': return close(4).length&&s.pickups.some(p=>p.active&&within(ctx,a,p,spec.range))?{}:null;
    case 'Leech': return close(spec.range-.25).length?{}:null;
    case 'Sentinel': return close(spec.range).length?{}:null;
    default:return null;
  }
}
// Return only legal input intents. The simulation remains the sole authority
// for movement, collisions, energy, ability validation and scoring.
export function planBots(s,brain) {
  if(!['survive','escape'].includes(s.phase))return [];
  const profile=BOT_LEVELS[brain.difficulty];
  const eligible=[];
  for(const a of s.actors){
    if(a.player||!active(a)||s.tick<a.stunUntil||a.lunge)continue;
    const m=memoryFor(brain,a),at=upcoming(a),gap=manhattan(a,point(at));
    if(m.warp!==a.warp){m.center=-1;m.goal=-1;m.warp=a.warp;}
    const moving=cardinal(a.dir),blocked=!moving;
    const maxStep=RULES.speed*STEP*(s.tick<a.surgeUntil?2:1);
    // Plan a turn one tick before crossing the center. Reaction delay applies
    // to reconsideration, not to physics; no missed turns on fast corners.
    const turn=gap<=maxStep+eps&&(m.center!==at||blocked&&s.tick>=m.thinkAt||centered(a)&&s.tick>=m.thinkAt&&!cardinal(a.wanted));
    const cast=s.tick>=m.castAt&&!abilityAvailability(s,a);
    if(turn||cast)eligible.push({a,m,at,turn,cast});
  }
  if(!eligible.length)return [];
  const ctx=makeContext(s,brain,profile), assignments=eligible.some(e=>e.a.faction==='hunter')?hunterAssignments(ctx,profile):new Map();
  const intents=[];
  for(const {a,m,at,turn,cast} of eligible){
    const w=a.faction==='wisp',g=w?ctx.wisp:ctx.hunter;
    // A hunter caught on the newly revealed portal can leave using the base
    // graph; it must never use the forbidden portal as a destination.
    const nav=g.mask[at]?g:ctx.base;
    let plan=w?pickWispGoal(ctx,a,at,m,profile):(assignments.get(a.id)??{goal:-1,target:null});
    if(w){
      plan.cost=safeCosts(ctx,a,profile,plan.urgent);
      // With little time left, take the shortest legal route, not a leisurely
      // detour around a distant hunter.
      if(plan.goal===ctx.portal&&plan.urgent)plan.cost.fill(1);
    }
    plan.direction=route(ctx,a,at,plan.goal,nav,plan.cost,m,profile);
    let d=turn?plan.direction:null;
    if(turn){m.center=at;m.thinkAt=s.tick+profile.reaction;m.goal=plan.goal;if(m.recent.at(-1)!==at){m.recent.push(at);if(m.recent.length>8)m.recent.shift();}}
    // Emergency reversals are exceptional and rate-limited to avoid jitter.
    if(w&&!centered(a)&&cardinal(a.dir)&&s.tick>=m.reverseAt&&profile.prediction>0){
      const back=neighbor(at,reverse(a.dir));
      if(ctx.danger[at]<1.3&&ctx.danger[back]>ctx.danger[at]+.75&&g.mask[back]){d=reverse(a.dir);m.reverseAt=s.tick+HZ/2;m.center=-1;}
    }
    let ability=false;
    if(cast){m.castAt=s.tick+profile.castEvery;const act=decideCast(ctx,a,plan,m,profile);if(act){ability=true;d=act.direction??d;}}
    if(d||ability)intents.push({id:a.id,direction:d,ability});
  }
  return intents;
}
