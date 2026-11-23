// Shared WISP room world. Only the room advances threats and moving obstacles.
// The procedural course and thrown-log physics are the same modules as solo play.
import '../../../../public/games/wisp/procedural.js';
import '../../../../public/games/wisp/projectile.js';

const Course=globalThis.WispCourse;
const Projectile=globalThis.WispProjectiles;
const GROUND=380, LENGTH=2200, BLEND=800, FIRE_SECONDS=52, QUENCH=5;
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

function stageAt(world,x){
  for(let i=world.milestones.length-1;i>=0;i--){
    const m=world.milestones[i];
    if(x>=m.nextCycleStart)return initialStage(x-m.nextCycleStart);
    if(x>=m.regrowthStart)return {a:4,b:0,t:smooth((x-(m.nextCycleStart-BLEND))/BLEND)};
    if(x>=m.regrowthStart-BLEND)return {a:3,b:4,t:smooth((x-(m.regrowthStart-BLEND))/BLEND)};
  }
  return initialStage(x);
}
function initialStage(x){
  const section=Math.max(0,Math.floor(Math.max(0,x)/LENGTH));
  const a=Math.min(3,section), b=Math.min(3,a+1);
  const t=a===3?0:smooth(((Math.max(0,x)-section*LENGTH)-(LENGTH-BLEND))/BLEND);
  return {a,b,t};
}
function epochAt(world,x){
  let n=0;
  for(const m of world.milestones){if(x<m.nextCycleStart)break;n++;}
  return n;
}

export function createWorld(seed,startAt){
  return {seed,startAt,updatedAt:startAt,time:0,cycle:0,completed:0,
    weather:'clear',weatherElapsed:0,milestones:[],hazards:{},
    cutter:{state:'rest',x:-600,y:0,elapsed:0,wait:7,targetId:null,velocity:0,frenzyUsed:false,totalHunt:0,
      onTrunk:false,trunkStart:0,trunkEnd:0,trunkHeight:0,actionStartX:0,postState:'hunt',cutTarget:null},
    fire:{active:false,phase:'dormant',x:-9999,elapsed:0,chaseElapsed:0,
      warningDuration:2.3,lastEpoch:-1,surgeCount:0,velocity:0}};
}
function activePlayers(players){return players.filter(p=>p.alive&&p.reason!=='Left race');}
function cut(state,c){c.state=state;c.elapsed=0;if(state==='hunt')c.totalHunt=0;}
function advanceCutter(world,alive,dt){
  const c=world.cutter;
  if(!alive.length||world.fire.active){c.velocity=0;return;}
  const nearest=[...alive].sort((a,b)=>a.x-b.x)[0];
  c.targetId=nearest.id;
  c.elapsed+=dt;
  if(c.state==='rest'){
    if(c.elapsed>=c.wait)cut('warning',c);
    return;
  }
  if(c.state==='warning'){
    if(c.elapsed>=1.65){c.x=Math.min(nearest.x-240,Math.max(c.x,nearest.x-380));cut('approach',c);}
    return;
  }
  if(c.state==='retreat'){
    c.velocity=-155;c.x-=155*dt;
    if(c.elapsed>=2.1){cut('rest',c);c.wait=12;c.frenzyUsed=false;c.onTrunk=false;c.y=0;}
    return;
  }
  if(c.state==='climb'||c.state==='descend'){
    const duration=c.state==='climb'?(c.climbDuration||.72):(c.descendDuration||.54);
    const q=clamp(c.elapsed/duration,0,1),t=smooth(q);
    c.x=c.actionStartX+((c.state==='climb'?c.trunkStart+28:c.trunkEnd+25)-c.actionStartX)*t;
    c.y=-(c.trunkHeight||41)*(c.state==='climb'?t:1-t);
    if(q>=1){c.onTrunk=c.state==='climb';if(!c.onTrunk)c.y=0;cut(c.postState||'hunt',c);}
    return;
  }
  const around=Course.nearby(world.seed,c.x,at=>stageAt(world,at),90,125);
  const platform=around.find(h=>{
    const solid=['mossy-trunk','forked-trunk'].includes(h.type)||
      (['falling-tree','charred-tree'].includes(h.type)&&world.hazards[h.id]?.phase==='landed');
    const left=['falling-tree','charred-tree'].includes(h.type)?h.x+18:h.x;
    return solid&&left-c.x>=-6&&left-c.x<=38;
  });
  if(!c.onTrunk&&platform){
    c.postState=c.state;c.actionStartX=c.x;
    c.trunkStart=platform.x+(['falling-tree','charred-tree'].includes(platform.type)?18:0);
    c.trunkEnd=platform.x+platform.width;c.trunkHeight=platform.height===24?24:41;
    c.climbDuration=c.state==='frenzy'?.51:.72;cut('climb',c);return;
  }
  if(c.onTrunk&&c.x>=c.trunkEnd-31){
    c.postState=c.state;c.actionStartX=c.x;
    c.descendDuration=c.state==='frenzy'?.38:.54;cut('descend',c);return;
  }
  if(around.some(h=>h.type==='erosion-gap'&&h.x-c.x>-12&&h.x-c.x<20)){
    cut('retreat',c);return;
  }
  c.velocity=c.state==='frenzy'?298:c.state==='approach'?198:239;
  c.x+=c.velocity*dt;
  if(c.state==='approach'&&c.elapsed>=2.15)cut('hunt',c);
  else if(c.state==='hunt'){
    c.totalHunt+=dt;
    if(!c.frenzyUsed&&c.totalHunt>=3.25){c.frenzyUsed=true;cut('frenzy',c);}
    else if(c.totalHunt>=9)cut('retreat',c);
  }else if(c.state==='frenzy'&&c.elapsed>=2.5){cut('hunt',c);c.totalHunt=6.5;}
}
function activateFire(world,alive,epoch){
  const f=world.fire;
  f.active=true;f.phase='warning';f.elapsed=0;f.chaseElapsed=0;f.surgeCount=0;
  f.lastEpoch=epoch;f.x=Math.min(...alive.map(p=>p.x))-410;f.velocity=0;
  const c=world.cutter;c.state='rest';c.wait=1e9;c.elapsed=0;c.velocity=0;
}
function advanceFire(world,alive,dt){
  const f=world.fire;
  if(!alive.length)return;
  const leader=Math.max(...alive.map(p=>p.x));
  const epoch=epochAt(world,leader);
  const burnStart=epoch===0?3*LENGTH:world.milestones[epoch-1].nextCycleStart+3*LENGTH;
  if(!f.active && epoch>f.lastEpoch && leader>=burnStart)activateFire(world,alive,epoch);
  if(!f.active)return;
  f.elapsed+=dt;
  if(f.phase==='warning'){
    if(f.elapsed>=f.warningDuration){f.phase='advance';f.elapsed=0;}
    return;
  }
  if(f.phase==='storm'){
    f.velocity=-155;f.x-=155*dt;
    if(f.elapsed>=QUENCH){
      f.active=false;f.phase='quenched';f.velocity=0;
      world.completed++;world.weather='rain';world.weatherElapsed=0;
      const future=burnStart+(FIRE_SECONDS+QUENCH)*235+2400;
      const regrowthStart=Math.ceil(future/Course.CHUNK)*Course.CHUNK;
      world.milestones.push({regrowthStart,nextCycleStart:regrowthStart+2600});
    }
    return;
  }
  f.chaseElapsed+=dt;
  if(f.chaseElapsed>=FIRE_SECONDS){
    f.phase='storm';f.elapsed=0;f.velocity=-155;
    world.weather='storm';world.weatherElapsed=0;return;
  }
  if(f.phase==='advance'&&f.elapsed>=10.4){f.phase='surge-warning';f.elapsed=0;}
  else if(f.phase==='surge-warning'&&f.elapsed>=1.75){f.phase='surge';f.elapsed=0;f.surgeCount++;}
  else if(f.phase==='surge'&&f.elapsed>=2){f.phase='advance';f.elapsed=0;}
  // This pace is shared, rather than re-scaled independently for each character.
  f.velocity=(f.phase==='surge'?252:195)+Math.min(10,f.chaseElapsed*.19);
  f.x+=f.velocity*dt;
}
function advanceWeather(world,dt){
  if(world.weather==='clear')return;
  world.weatherElapsed+=dt;
  if(world.weather==='rain'&&world.weatherElapsed>=6){world.weather='clearing';world.weatherElapsed=0;}
  else if(world.weather==='clearing'&&world.weatherElapsed>=10){world.weather='clear';world.weatherElapsed=0;}
}
function advanceHazards(world,alive,dt){
  if(!alive.length)return;
  const leader=Math.max(...alive.map(p=>p.x));
  const trailing=Math.min(...alive.map(p=>p.x));
  // Dynamic obstacles wake from the leading racer's progress, not from a local viewport.
  for(const h of Course.nearby(world.seed,leader,at=>stageAt(world,at),1250,1550)){
    if(!['rolling-log','falling-timber','falling-tree','charred-tree'].includes(h.type))continue;
    let d=world.hazards[h.id];
    if(!d){
      if(h.type==='falling-timber')d=Projectile.newLog(world.seed,h,235,GROUND,Course.hash);
      else d={phase:'waiting',timer:0,x:h.x,y:90,travel:0,angle:0};
      d.type=h.type;d.width=h.width;d.height=h.height;world.hazards[h.id]=d;
    }
    if(h.type==='falling-timber'){
      if(d.phase==='waiting'&&leader>=d.triggerX)d.phase='flight';
      Projectile.advance(d,dt,GROUND);
    }else{
      if(d.phase==='waiting'&&leader>=h.x-(h.type==='rolling-log'?245:760))d.phase='warning';
      if(d.phase==='waiting')continue;
      d.timer+=dt;
      if(h.type==='rolling-log'){
        d.phase='rolling';d.travel=Math.min(55,d.travel+34*dt);d.x=h.x-d.travel;
      }else if(d.timer<2.05)d.phase='warning';
      else if(d.timer<2.63){d.phase='falling';const q=(d.timer-2.05)/.58;d.y=90+(GROUND-23-90)*q*q;}
      else {d.phase='landed';d.y=GROUND-23;}
    }
  }
  for(const id of Object.keys(world.hazards)){
    const index=Number(id.split(':')[1]);
    if(Number.isFinite(index)&&index*Course.CHUNK<trailing-2300)delete world.hazards[id];
  }
}
export function advanceWorld(world,players,now){
  if(now<=world.startAt || now<=world.updatedAt)return world;
  // Bound clock catch-up after long background suspension, without advancing
  // thousands of physics frames on the next mobile packet.
  let remaining=clamp((now-world.updatedAt)/1000,0,8);
  world.updatedAt=now;
  const alive=activePlayers(players);
  while(remaining>0.000001){
    const dt=Math.min(remaining,.05);remaining-=dt;world.time+=dt;
    advanceWeather(world,dt);
    advanceFire(world,alive,dt);
    advanceCutter(world,alive,dt);
    advanceHazards(world,alive,dt);
  }
  if(alive.length){
    const leader=Math.max(...alive.map(p=>p.x));
    const epoch=epochAt(world,leader);
    if(epoch>world.cycle){world.cycle=epoch;world.cutter.state='rest';world.cutter.wait=7;
      world.cutter.elapsed=0;world.cutter.x=leader-650;}
  }
  return world;
}
export function worldSnapshot(world,players){
  const alive=activePlayers(players);
  const min=alive.length?Math.min(...alive.map(p=>p.x)):0;
  const max=alive.length?Math.max(...alive.map(p=>p.x)):0;
  const hazards=Object.entries(world.hazards).filter(([id])=>{
    const i=Number(id.split(':')[1]);
    const x=i*Course.CHUNK;
    return x>=min-1600&&x<=max+2600;
  }).map(([id,d])=>({id,...d}));
  return {time:world.time,updatedAt:world.updatedAt,cycle:world.cycle,completed:world.completed,
    weather:world.weather,weatherElapsed:world.weatherElapsed,
    milestones:world.milestones,cutter:{...world.cutter},fire:{...world.fire},hazards};
}
export function authoritativeContacts(world,players){
  let eliminated=0;
  for(const p of activePlayers(players)){
    if(world.fire.active&&world.fire.phase!=='warning'&&world.fire.phase!=='storm'&&p.x<=world.fire.x+10){
      p.alive=false;p.reason='Wildfire';eliminated++;continue;
    }
    const c=world.cutter;
    if(['approach','hunt','frenzy','climb','descend'].includes(c.state)&&c.x>=p.x-14&&c.x<p.x+22&&p.y>325+c.y){
      p.alive=false;p.reason='Cutter';eliminated++;continue;
    }
    for(const d of Object.values(world.hazards)){
      let bounds=null;
      if(d.type==='falling-timber'&&d.phase!=='waiting')bounds=Projectile.collider(d);
      else if(d.type==='rolling-log'&&d.phase==='rolling')
        bounds={x1:d.x,x2:d.x+(d.width||35),top:GROUND-(d.height||21),bottom:GROUND+3};
      else if(['falling-tree','charred-tree'].includes(d.type)&&d.phase==='falling')
        bounds={x1:d.x+10,x2:d.x+Math.min(d.width||175,145),top:d.y-24,bottom:d.y+19};
      if(bounds&&p.x+13>bounds.x1&&p.x-13<bounds.x2&&p.y>bounds.top&&p.y-32<bounds.bottom){
        p.alive=false;p.reason='Moving obstacle';eliminated++;break;
      }
    }
  }
  return eliminated;
}
