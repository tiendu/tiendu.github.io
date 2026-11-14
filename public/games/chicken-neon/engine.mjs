// CHICKEN RUN: NEON WILDS — deterministic, browser-independent solo simulation.
// Original Chicken Run and its multiplayer protocol remain untouched (Classic route).
export const BIRDS = Object.freeze([
  {name:'Sunrise',role:'SPEED DEMON',description:'Fastest runner, weakest jump.',color:'#ff9067',shell:'#8a312f',speed:1.22,jump:.81,jet:.90,efficiency:.85,shape:'rooster'},
  {name:'Pepper',role:'ALL-ROUNDER',description:'Balanced speed, jumps and fuel.',color:'#ff68bd',shell:'#303246',speed:1,jump:1,jet:1,efficiency:1,shape:'hen'},
  {name:'Pearl',role:'HIGH JUMPER',description:'Highest jump, slowest runner.',color:'#63e2f3',shell:'#e6edf4',speed:.83,jump:1.32,jet:1.04,efficiency:.94,shape:'round'},
  {name:'Mango',role:'SURVIVOR',description:'Best corn economy, limited speed.',color:'#b4f46d',shell:'#e9ba44',speed:.91,jump:1.05,jet:.92,efficiency:1.45,shape:'chick'},
  {name:'Indigo',role:'JET ACE',description:'Longest jetpack boost, costly fuel.',color:'#bb9cff',shell:'#4b4b83',speed:1.09,jump:.90,jet:1.37,efficiency:.80,shape:'bantam'},
]);
export const DISASTERS=Object.freeze([
  {id:'emp',label:'EMP STORM',hint:'Jetpacks offline — use regular jumps'},
  {id:'collapse',label:'GRID COLLAPSE',hint:'Watch for extra void gaps'},
  {id:'plasma',label:'PLASMA RAIN',hint:'Avoid the marked impact zones'},
  {id:'gravity',label:'GRAVITY SURGE',hint:'Air movement has changed'},
]);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function random(s){let x=s.rng||1;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296;}
const between=(s,a,b)=>a+(b-a)*random(s);
const pick=(s,list)=>list[Math.floor(random(s)*list.length)];
export function disasterWindow(seconds){
  if(seconds<180)return null;
  if(seconds<300)return [60,90];
  if(seconds<480)return [35,60];
  if(seconds<720)return [22,40];
  return [15,28];
}
export function newRun(bird=2,seed=Date.now()>>>0){
  if(!Number.isInteger(bird)||bird<0||bird>=BIRDS.length)throw Error('Invalid chicken');
  const s={version:1,bird,seed:seed>>>0,rng:(seed>>>0)||1,elapsed:0,distance:0,
    y:0,vy:0,grounded:true,boostReady:true,boostPulse:0,jumpPulse:0,fuel:82,
    speed:0,fox:.10,alive:true,reason:'',hazards:[],corn:[],nextHazard:560,nextCorn:180,
    disaster:null,nextDisaster:180,lastDisaster:null,warning:'',collected:0,nearMisses:0};
  return s;
}
export function activeDisaster(s){return s.disaster&&s.elapsed<s.disaster.end?s.disaster:null;}
export function disasterWarning(s){
  const d=activeDisaster(s);
  if(d)return DISASTERS.find(x=>x.id===d.id);
  if(s.nextDisaster-s.elapsed<=3&&s.nextDisaster-s.elapsed>0)return {id:'warning',label:'GRID INSTABILITY',hint:'Environmental failure imminent'};
  return null;
}
export function jump(s){
  if(!s.alive)return false;
  const b=BIRDS[s.bird];
  if(s.grounded){
    s.vy=-(s.fuel<8?355:520)*b.jump;
    s.grounded=false;s.boostReady=true;s.jumpPulse=.22;
    return true;
  }
  if(!s.boostReady||s.fuel<12||activeDisaster(s)?.id==='emp')return false;
  s.fuel=clamp(s.fuel-12/(b.efficiency*(b.shape==='bantam'?.85:1)),0,100);
  s.vy=Math.min(s.vy,-340*b.jet);
  s.boostReady=false;s.boostPulse=.38;
  return true;
}
function inGap(s,x){return s.hazards.some(h=>h.type==='gap'&&x>=h.x&&x<=h.x+h.width);}
function spawn(s){
  const ahead=s.distance+1600;
  // Corn never depends on a jump: every cluster includes reachable ground corn.
  while(s.nextCorn<ahead){
    const x=s.nextCorn;
    s.corn.push({x,y:-31,got:false},{x:x+29,y:-31,got:false},
      {x:x+58,y:random(s)<.55?-90:-31,got:false});
    s.nextCorn+=between(s,300,410);
  }
  while(s.nextHazard<ahead){
    const d=activeDisaster(s),phase=s.elapsed;
    const choices=phase<20?['barrier','corrupt']:phase<55?['barrier','corrupt','gap']:
      phase<100?['barrier','corrupt','gap','beam','coyote']:
      ['barrier','corrupt','gap','beam','coyote','eagle','crusher'];
    if(d?.id==='collapse')choices.push('gap','gap');
    if(d?.id==='plasma')choices.push('plasma','plasma');
    if(d?.id==='gravity'){
      const index=choices.indexOf('beam');if(index>=0)choices.splice(index,1);
    }
    const type=pick(s,choices);
    const width=type==='gap'?between(s,58,91):type==='corrupt'?between(s,115,165):
      type==='beam'?82:type==='crusher'?45:type==='plasma'?72:type==='eagle'?92:type==='coyote'?53:30;
    s.hazards.push({type,x:s.nextHazard,width,phase:between(s,0,6.28),warn:2.4});
    const spacing=between(s,400,525);
    s.nextHazard+=spacing;
  }
}
function hit(s,reason){s.alive=false;s.reason=reason;s.vy=0;return s;}
function collide(s,h){
  const front=s.distance+15,back=s.distance-13;
  if(front<h.x||back>h.x+h.width)return;
  const feet=s.y,head=s.y-43;
  switch(h.type){
    case 'barrier':if(feet>-56)return hit(s,'Energy barrier collision');break;
    case 'coyote':if(feet>-52)return hit(s,'Caught by the coyote');break;
    case 'beam':if(feet>-113&&head<-69)return hit(s,'Struck the overhead beam');break;
    case 'crusher':if(Math.sin(s.elapsed*3.8+h.phase)>-.10&&feet>-72)return hit(s,'Crushed by a pulse gate');break;
    case 'eagle':if(feet<-27)return hit(s,'Snatched by the eagle');break;
    case 'plasma':if(feet>-63&&Math.sin(s.elapsed*5+h.phase)>-.25)return hit(s,'Hit by plasma rain');break;
  }
}
function scheduleDisaster(s){
  const upcoming=disasterWindow(s.elapsed);
  if(!upcoming)return;
  let ids=DISASTERS.map(x=>x.id).filter(id=>id!==s.lastDisaster);
  const id=pick(s,ids);
  s.disaster={id,start:s.elapsed,end:s.elapsed+between(s,9,13)};
  s.lastDisaster=id;
  const gap=disasterWindow(s.disaster.end);
  s.nextDisaster=s.disaster.end+between(s,...gap);
}
export function step(s,rawDt=1/60){
  if(!s.alive)return s;
  const dt=clamp(rawDt,0,1/30);
  const b=BIRDS[s.bird];
  s.elapsed+=dt;
  if(s.disaster&&s.elapsed>=s.disaster.end)s.disaster=null;
  if(s.elapsed>=s.nextDisaster)scheduleDisaster(s);
  spawn(s);
  const corrupt=s.hazards.some(h=>h.type==='corrupt'&&s.distance>=h.x&&s.distance<=h.x+h.width&&s.grounded);
  const energyFactor=s.fuel<=0?.56:s.fuel<15?.74:s.fuel<35?.88:1;
  s.speed=245*b.speed*energyFactor*(corrupt?.75:1);
  const oldX=s.distance;
  s.distance+=s.speed*dt;
  s.fuel=clamp(s.fuel-(2.65/b.efficiency)*dt,0,100);
  const gravity=activeDisaster(s)?.id==='gravity'?1080:1460;
  s.vy+=gravity*dt;
  s.y+=s.vy*dt;
  if(!inGap(s,s.distance)&&s.y>=0){
    // Falling too far below the lip of a platform cannot magically recover.
    if(s.y>21&&oldX<s.distance&&inGap(s,oldX))return hit(s,'Fell into the void');
    s.y=0;s.vy=0;s.grounded=true;s.boostReady=true;
  }else s.grounded=false;
  if(s.y>85)return hit(s,'Fell into the void');
  s.boostPulse=Math.max(0,s.boostPulse-dt);
  s.jumpPulse=Math.max(0,s.jumpPulse-dt);
  for(const c of s.corn){
    if(!c.got&&Math.abs(c.x-s.distance)<21&&Math.abs(c.y-(s.y-25))<35){
      c.got=true;s.collected++;
      s.fuel=clamp(s.fuel+7.5,0,100);
      s.fox=Math.max(.045,s.fox-.025);
    }
  }
  for(const hazard of s.hazards){
    if(!s.alive)break;
    if(hazard.type!=='gap'&&hazard.type!=='corrupt')collide(s,hazard);
  }
  const starvation=Math.pow(1-s.fuel/100,2);
  s.fox=clamp(s.fox+dt*(.0025+.135*starvation+(corrupt?.045:0)),0,1);
  if(s.fox>=1)return hit(s,'Caught by the fox');
  s.hazards=s.hazards.filter(h=>h.x+h.width>s.distance-220);
  s.corn=s.corn.filter(c=>!c.got&&c.x>s.distance-120);
  return s;
}
export function bestKey(){return 'chicken-neon-v1-records';}
