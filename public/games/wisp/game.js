/* WISP — forest runner physics, procedural survival and the Cutter / wildfire. */
(() => {
  'use strict';

  const VIEW = { width: 960, height: 480, ground: 380 };
  const FIXED = 1 / 120;
  const G = 980;
  const CHARACTERS = {
    Moss:  { speed: .96, jump: .94, drain: 8,  impact: 11, color: '#96ce71' },
    Ember: { speed: 1.06, jump: 1, drain: 12, impact: 18, color: '#ffa14d' },
    Dew:   { speed: 1, jump: 1, drain: 10, impact: 16, color: '#75d9de' },
    Gale:  { speed: 1.04, jump: 1.10, drain: 12, impact: 22, color: '#75aff9' },
    Dusk:  { speed: .98, jump: 1.05, drain: 9,  impact: 15, color: '#c1a7ff' },
  };
  const SPRITE_FILES = {
    Moss: 'moss.svg', Ember: 'ember.svg', Dew: 'dew.svg', Gale: 'gale.svg', Dusk: 'dusk.svg',
    trunk: 'forked-trunk.svg', log: 'small-log.svg',
    broadleaf: 'living-broadleaf.svg', conifer: 'living-conifer.svg',
    damaged: 'disturbed-broadleaf.svg', thinning: 'disturbed-conifer.svg',
    orb: 'forest-essence.svg', greater: 'greater-essence.svg', timber: 'falling-timber.svg',
    groundBurntAshFlakes:'burnt-ash-flakes.svg',
    groundBurntCharcoalFragments:'burnt-charcoal-fragments.svg',
    groundBurntEmberFissure:'burnt-ember-fissure.svg',
    groundBurntFaceA:'burnt-face-a.svg',
    groundBurntFaceB:'burnt-face-b.svg',
    groundBurntGapLeft:'burnt-gap-left.svg',
    groundBurntGapRight:'burnt-gap-right.svg',
    groundBurntPlatformLeft:'burnt-platform-left.svg',
    groundBurntPlatformRight:'burnt-platform-right.svg',
    groundBurntSmokeWisp:'burnt-smoke-wisp.svg',
    groundBurntTopA:'burnt-top-a.svg',
    groundBurntTopB:'burnt-top-b.svg',
    groundDisturbedBrokenTwigs:'disturbed-broken-twigs.svg',
    groundDisturbedDirtScar:'disturbed-dirt-scar.svg',
    groundDisturbedFaceA:'disturbed-face-a.svg',
    groundDisturbedFaceB:'disturbed-face-b.svg',
    groundDisturbedGapLeft:'disturbed-gap-left.svg',
    groundDisturbedGapRight:'disturbed-gap-right.svg',
    groundDisturbedGrassSparse:'disturbed-grass-sparse.svg',
    groundDisturbedPlatformLeft:'disturbed-platform-left.svg',
    groundDisturbedPlatformRight:'disturbed-platform-right.svg',
    groundDisturbedTopA:'disturbed-top-a.svg',
    groundDisturbedTopB:'disturbed-top-b.svg',
    groundDisturbedWeedClump:'disturbed-weed-clump.svg',
    groundLivingFaceA:'living-face-a.svg',
    groundLivingFaceB:'living-face-b.svg',
    groundLivingGapLeft:'living-gap-left.svg',
    groundLivingGapRight:'living-gap-right.svg',
    groundLivingGrassTuftA:'living-grass-tuft-a.svg',
    groundLivingGrassTuftB:'living-grass-tuft-b.svg',
    groundLivingLeafLitter:'living-leaf-litter.svg',
    groundLivingMossPatch:'living-moss-patch.svg',
    groundLivingPlatformLeft:'living-platform-left.svg',
    groundLivingPlatformRight:'living-platform-right.svg',
    groundLivingTopA:'living-top-a.svg',
    groundLivingTopB:'living-top-b.svg',
    groundLoggedBarkChips:'logged-bark-chips.svg',
    groundLoggedDryWeeds:'logged-dry-weeds.svg',
    groundLoggedFaceA:'logged-face-a.svg',
    groundLoggedFaceB:'logged-face-b.svg',
    groundLoggedGapLeft:'logged-gap-left.svg',
    groundLoggedGapRight:'logged-gap-right.svg',
    groundLoggedPlatformLeft:'logged-platform-left.svg',
    groundLoggedPlatformRight:'logged-platform-right.svg',
    groundLoggedSawdust:'logged-sawdust.svg',
    groundLoggedSmallStones:'logged-small-stones.svg',
    groundLoggedTopA:'logged-top-a.svg',
    groundLoggedTopB:'logged-top-b.svg',
    stageBurntAncient:'burnt-forest-ancient-dead.svg',
    stageBurntBroadleaf:'burnt-forest-broadleaf-charred.svg',
    stageBurntConifer:'burnt-forest-conifer-burnt.svg',
    stageBurntLog:'burnt-forest-log-smoldering.svg',
    stageBurntTimber:'burnt-forest-falling-timber-burning.svg',
    stageBurntTrunk:'burnt-collision-matched-trunk.svg',
    stageDisturbedAncient:'disturbed-forest-ancient-broken.svg',
    stageDisturbedBroadleaf:'disturbed-forest-broadleaf-damaged.svg',
    stageDisturbedConifer:'disturbed-forest-conifer-thinning.svg',
    stageDisturbedLog:'disturbed-forest-log-cut-small.svg',
    stageDisturbedTimber:'disturbed-forest-falling-timber-branches.svg',
    stageDisturbedTrunk:'disturbed-collision-matched-trunk.svg',
    stageLivingAncient:'living-forest-ancient-background.svg',
    stageLivingBroadleaf:'living-forest-broadleaf-background.svg',
    stageLivingConifer:'living-forest-conifer-background.svg',
    stageLivingLog:'living-forest-log-mossy.svg',
    stageLivingTimber:'living-forest-log-fresh.svg',
    stageLivingTrunk:'living-collision-matched-trunk.svg',
    stageLoggedAncient:'logged-forest-broadleaf-bare.svg',
    stageLoggedBroadleaf:'logged-forest-broadleaf-bare.svg',
    stageLoggedConifer:'logged-forest-conifer-stripped.svg',
    stageLoggedLog:'logged-forest-log-rolling.svg',
    stageLoggedTimber:'logged-forest-falling-timber-heavy.svg',
    stageLoggedTrunk:'logged-collision-matched-trunk.svg',
    hazardRoot:'hazard-root.svg',hazardStump:'hazard-stump.svg',hazardStack:'hazard-stack.svg',
    hazardAsh:'hazard-ash.svg',hazardTree:'hazard-falling-tree.svg',hazardChar:'hazard-falling-char.svg',
    wildfireLog:'wildfire-burning-log.svg',
    stageLivingUnderstory:'living-understory.svg',
    stageDisturbedUnderstory:'disturbed-understory.svg',
    stageLoggedUnderstory:'logged-understory.svg',
    stageBurntUnderstory:'burnt-understory.svg',
  };
  const STAGE_NAMES=['Living Forest','Disturbed Forest','Logged Forest','Burnt Forest','Regrowth'];
  const STAGE_KEYS=['living','disturbed','logged','burnt','regrowth'];
  const STAGE_LENGTH=2200;
  const STAGE_BLEND=800; // Hazard selection and pursuit pacing: unchanged.
  const VISUAL_STAGE_BLEND=1200; // Longer visual-only overlap between forests.
  const STAGE_COLORS={
    living:{sky:'#153f44',haze:'#345a4d',soil:'#46372e',mountain:'#31574d'},
    disturbed:{sky:'#333f3b',haze:'#645b4c',soil:'#665142',mountain:'#48554b'},
    logged:{sky:'#464043',haze:'#67564a',soil:'#6b5543',mountain:'#4c4541'},
    burnt:{sky:'#25242e',haze:'#493a3a',soil:'#2d2b30',mountain:'#373039'},
    regrowth:{sky:'#355858',haze:'#6b8970',soil:'#4b4940',mountain:'#4c7463'}
  };
  const STAGE_DECOR={
    living:['GrassTuftA','GrassTuftB','MossPatch','LeafLitter'],
    disturbed:['GrassSparse','WeedClump','DirtScar','BrokenTwigs'],
    logged:['DryWeeds','Sawdust','BarkChips','SmallStones'],
    burnt:['AshFlakes','EmberFissure','CharcoalFragments','SmokeWisp'],
    regrowth:['GrassTuftA','GrassTuftB','MossPatch','LeafLitter']
  };
  const stageKey=(i)=>STAGE_KEYS[Math.max(0,Math.min(4,i))];
  const hash01=(n,salt=0)=>{let v=Math.imul((n|0)^Math.imul(salt+1,0x9e3779b1),0x85ebca6b);v^=v>>>13;v=Math.imul(v,0xc2b2ae35);v^=v>>>16;return (v>>>0)/4294967296;};
  const smoothstep=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  function stageAt(x, blend=STAGE_BLEND){
    const section=Math.max(0,Math.floor(Math.max(0,x)/STAGE_LENGTH));
    const a=Math.min(3,section),b=Math.min(3,a+1);
    const local=Math.max(0,x)-section*STAGE_LENGTH;
    const t=a>=3?0:smoothstep((local-(STAGE_LENGTH-blend))/blend);
    return {a,b,t,stage:a, name:STAGE_NAMES[a], next:STAGE_NAMES[b]};
  }
  // Milestones are scheduled well ahead of the current collision window.
  // Both the renderer and procedural generator sample the same world biome.
  function epochAt(g,x){
    if(!g?.forest)return 0;
    let count=0;
    for(const m of g.forest.milestones){
      if(x<m.nextCycleStart)break;
      count++;
    }
    return count;
  }
  function stageAtFor(g,x,blend=STAGE_BLEND){
    if(!g?.forest?.milestones?.length)return stageAt(x,blend);
    for(let i=g.forest.milestones.length-1;i>=0;i--){
      const m=g.forest.milestones[i];
      if(x>=m.nextCycleStart)return stageAt(x-m.nextCycleStart,blend);
      if(x>=m.regrowthStart){
        const t=smoothstep((x-(m.nextCycleStart-blend))/blend);
        return {a:4,b:0,t,stage:4,name:'Regrowth',next:'Living Forest'};
      }
      if(x>=m.regrowthStart-blend){
        const t=smoothstep((x-(m.regrowthStart-blend))/blend);
        return {a:3,b:4,t,stage:3,name:'Burnt Forest',next:'Regrowth'};
      }
    }
    return stageAt(x,blend);
  }
  let sceneryGame=null;
  const visualStageAt=x=>stageAtFor(sceneryGame,x,VISUAL_STAGE_BLEND);
  // Visual selection is anchored to a scenery object's world coordinate, never
  // its current screen position, so a parallax tree cannot change form mid-run.
  function treeMixAt(anchor,index,layer){
    const mix=visualStageAt(anchor);
    const switchAt=.23+hash01(index,31+layer)*.54;
    const t=smoothstep((mix.t-switchAt)/.25+.5);
    return {...mix, weight:t};
  }
  // Stage difficulty changes smoothly with the world, rather than at abrupt mile markers.
  // Surviving a frenzy earns additional quiet time. This is Cutter-free recovery,
  // not protection from logs, falling timber, or gaps.
  function quietWindow(g){
    const s=stageAtFor(g,g.x),times=[15,13,11,9,12];
    const mean=times[s.a]*(1-s.t)+times[s.b]*s.t;
    const variation=(hash01(g.cutter.wave,117)-.5)*2;
    return mean+variation+(g.cutter.frenzyUsed?3.5:0);
  }
  function blendHex(a,b,t){
    const v1=parseInt(a.slice(1),16),v2=parseInt(b.slice(1),16);
    const r=Math.round(((v1>>16)&255)*(1-t)+((v2>>16)&255)*t);
    const g=Math.round(((v1>>8)&255)*(1-t)+((v2>>8)&255)*t);
    const bb=Math.round((v1&255)*(1-t)+(v2&255)*t);
    return `rgb(${r},${g},${bb})`;
  }
  // Young growth reuses the healthy biome's SVG shapes, mixed against the
  // charred forest through the visual-stage blend. No absent asset keys.
  function biomeSprite(stage,label){const key=stageKey(stage===4?0:stage);return 'stage'+key.charAt(0).toUpperCase()+key.slice(1)+label;}
  function groundSprite(stage,label){const key=stageKey(stage===4?0:stage);return 'ground'+key.charAt(0).toUpperCase()+key.slice(1)+label;}

  const imageAssets = {};
  let game;
  let cutterMotion = null;
  let lastCutterAnimation = null;
  let gliding = false;
  // One-action input: every new press jumps; holding the press requests glide.
  // Glide only affects the falling half of the jump (see physics below).
  const HOLD_TO_GLIDE_MS = 150;
  const activeKeys = new Set();
  let actionHeld = false;
  let actionDownAt = 0;
  let activePointerId = null;
  let last = 0;
  let accumulator = 0;
  let reducedMotion = false;
  let paused = false;
  let onlineRoom = false;
  let onlineRace = false;
  let soloChoice = 'Moss';
  let resultAnnounced = false;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const el = (id) => document.getElementById(id);

  function createGame(name='Moss', energy=100, opts={}) {
    return {
      name, stats: CHARACTERS[name],
      x: 155, y: VIEW.ground, vy: 0, grounded: true, surface: 'ground', jumps: 0,
      energy: energy, distance: 0, time: 0, impacts: 0, pickups: 0,
      chaseEnabled: opts.chase !== false && !opts.auto, cutter: makeCutter(), rescues: 0,
      status: 'running', reason: '', impactCooldown: 0, staggerRemaining:0, staggerTotal:0,
      collected: new Set(), noPickups: opts.noPickups === true,
      auto: !!opts.auto, lastJumpX: null, events: [],
      glide: false, death: null, fire: makeFire(), deathCause:null, seed:Number.isFinite(+opts.seed)?(Number(opts.seed)|0):2026,
      hazardStates:new Map(), gapRescue:null,
      forest:{cycle:0,milestones:[],weather:'clear',weatherElapsed:0,completed:0},
      procPlan:null, procPlanStep:0, procPlanX:0, procCleared:new Set(),
    };
  }



  // Wildfire is a finite endurance challenge, not a permanent chase.
  // Timed rain begins after 52 seconds of *active pursuit* (warning excluded).
  const FIRE_SURVIVAL=52;
  const STORM_QUENCH=5;
  function makeFire(){
    return {phase:'dormant',x:-9999,elapsed:0,chaseElapsed:0,surgeCount:0,
      warningDuration:2.3,active:false,lastEpoch:-1};
  }
  function activateFire(g,preview=false){
    if(g.fire.active || !g.chaseEnabled || g.auto)return false;
    const f=g.fire;
    f.active=true;f.preview=!!preview;
    f.phase=preview?'advance':'warning';
    f.elapsed=0;f.chaseElapsed=0;f.surgeCount=0;
    f.x=g.x-(preview?210:410);
    f.lastEpoch=epochAt(g,g.x);
    const c=g.cutter;c.state='rest';c.wait=999999;c.elapsed=0;c.x=g.x-900;c.y=0;c.onTrunk=false;
    notify(g,'warning',preview?'Wildfire preview: stay ahead of the front!':'The air turns orange. The forest is catching fire!');
    return true;
  }
  function rainIntensity(g){
    const w=g.forest;
    if(w.weather==='storm')return smoothstep(w.weatherElapsed/3);
    if(w.weather==='rain')return 1;
    if(w.weather==='clearing')return 1-smoothstep(w.weatherElapsed/10);
    return 0;
  }
  function updateForest(g,dt){
    const w=g.forest;
    if(w.weather!=='clear'){
      w.weatherElapsed+=dt;
      if(w.weather==='rain'&&w.weatherElapsed>=6){w.weather='clearing';w.weatherElapsed=0;}
      else if(w.weather==='clearing'&&w.weatherElapsed>=10){w.weather='clear';w.weatherElapsed=0;}
    }
    const epoch=epochAt(g,g.x);
    if(epoch>w.cycle){
      w.cycle=epoch;
      const c=g.cutter;c.state='rest';c.wait=7;c.elapsed=0;c.x=g.x-650;c.y=0;c.onTrunk=false;
      notify(g,'quiet','A new forest takes root. The journey continues.');
    }
  }
  function updateFire(g,dt){
    const f=g.fire;
    const epoch=epochAt(g,g.x);
    // Activation is gated by epoch, not only distance: quenching cannot
    // immediately restart the same wildfire in the still-blackened region.
    const burnStart=epoch===0?3*STAGE_LENGTH:
      g.forest.milestones[epoch-1].nextCycleStart+3*STAGE_LENGTH;
    if(!f.active && g.x>=burnStart && epoch>f.lastEpoch && g.chaseEnabled && !g.auto)activateFire(g);
    if(!f.active || g.status!=='running')return;
    f.elapsed+=dt;
    if(f.phase==='warning'){
      if(f.elapsed>=f.warningDuration){f.phase='advance';f.elapsed=0;notify(g,'warning','WILDFIRE ADVANCING! Keep moving!');}
      return;
    }
    if(f.phase==='storm'){
      // The incoming rain steadily pushes back the flames. No instant pop.
      f.x-=155*dt;
      if(f.elapsed>=STORM_QUENCH){
        f.active=false;f.phase='quenched';
        g.forest.completed++;
        g.forest.weather='rain';g.forest.weatherElapsed=0;
        // Every racer shares the same seeded geometry. Rain is triggered by
        // survival time, but the next biome boundary is anchored to this
        // cycle's burn start, never to an individual wisp's current distance.
        // Even the fastest wisp should not reach the new biome before quench.
        const future=burnStart+(FIRE_SURVIVAL+STORM_QUENCH)*235+2400;
        const regrowthStart=Math.ceil(future/WispCourse.CHUNK)*WispCourse.CHUNK;
        g.forest.milestones.push({regrowthStart,nextCycleStart:regrowthStart+2600});
        notify(g,'quiet','The rain extinguishes the wildfire. New growth will follow.');
      }
      return;
    }
    f.chaseElapsed+=dt;
    if(f.chaseElapsed>=FIRE_SURVIVAL){
      f.phase='storm';f.elapsed=0;
      g.forest.weather='storm';g.forest.weatherElapsed=0;
      notify(g,'quiet','Thunder rolls overhead. Rain is coming!');
      return;
    }
    if(f.phase==='advance' && f.elapsed>=10.4){
      f.phase='surge-warning';f.elapsed=0;
      notify(g,'warning','Hot wind! Flames are about to surge!');
      return;
    }
    if(f.phase==='surge-warning'&&f.elapsed>=1.75){
      f.phase='surge';f.elapsed=0;f.surgeCount++;
      notify(g,'warning','FIRE SURGE! Keep moving!');
      return;
    }
    if(f.phase==='surge'&&f.elapsed>=2.0){
      f.phase='advance';f.elapsed=0;
      notify(g,'quiet','The flames slow. Keep collecting Essence.');
      return;
    }
    // Scale pursuit with each character's natural cruising speed so Moss isn't
    // inherently doomed. Energy still matters because exhaustion slows the wisp.
    const base=235*g.stats.speed;
    const ramp=Math.min(10,f.chaseElapsed*.19);
    const speed=base*(f.phase==='surge'?1.10:.83)+ramp;
    f.x+=speed*dt;
    if(f.x>=g.x-10){
      g.deathCause='wildfire';
      startDeath(g,`${g.name} was engulfed by the wildfire.`);
    }
  }

  function makeCutter() {
    return {state:'rest',elapsed:0,wait:7.0,x:-600,y:0,wave:0,gapOutcome:null,
      frenzyUsed:false, totalHunt:0, gapJumpTime:0, gapStartX:0, eventSent:false, postState:'hunt', cutTarget:null, cleared:new Set(), onTrunk:false, trunkLap:-1, actionStartX:0, climbDuration:.72, descendDuration:.54};
  }

  function enterCut(g,target,returnState) {
    const c=g.cutter;
    c.cutTarget=target;
    c.postState=returnState || (c.state==='frenzy'?'frenzy':'hunt');
    c.state='cut';
    c.elapsed=0;
    notify(g,'warning',`The Cutter hacks through the ${target.name}.`);
  }
  function enterCutter(g,state,detail,preserveHuntClock=false) {
    const c=g.cutter;
    c.state=state;c.elapsed=0;
    if(state!=='cut') c.cutTarget=null;
    if(state==='hunt' && !preserveHuntClock) c.totalHunt=0;
    if(state==='rest' || state==='warning'){c.onTrunk=false;c.trunkLap=-1;c.y=0;}
    if(detail) notify(g,state==='frenzy'?'warning':'quiet',detail);
  }
  function checkCutterContact(g) {
    const c=g.cutter;
    // A hit is based on the visible character and saw; a jumping wisp can still
    // clear him if there is no actual overlap in both axes.
    const bodyLeft=c.x-42, bladeRight=c.x+112;
    const verticalTop=VIEW.ground+c.y-135, verticalBottom=VIEW.ground+c.y+3;
    if(!['rest','warning','retreat','fall'].includes(c.state) &&
       bladeRight>=g.x-13 && bodyLeft<=g.x+13 &&
       g.y>=verticalTop && g.y-32<=verticalBottom) {
      startDeath(g, `The Cutter caught ${g.name}. One touch is enough.`);
    }
  }
  function speedFor(g) {
    const e = g.energy;
    // At >=50%, full running speed. At 0%, 55%. Movement never stops outright.
    const multiplier = e >= 50 ? 1 : (e >= 25 ? .80 + .20 * (e - 25) / 25 : .55 + .25 * e / 25);
    // Damage creates a short additional speed penalty; resilience determines recovery time.
    const stagger = g.staggerRemaining > 0 ? 1 - .30 * (g.staggerRemaining / Math.max(.01,g.staggerTotal)) : 1;
    return 235 * g.stats.speed * multiplier * stagger;
  }

  function jump(g) {
    if (g.status !== 'running' || g.gapRescue || g.jumps >= 2) return false;
    if (g.grounded) {
      g.vy = -Math.sqrt(2 * G * 70 * g.stats.jump);
      g.jumps = 1;
    } else {
      g.vy = -Math.sqrt(2 * G * 77 * g.stats.jump);
      g.jumps = 2;
    }
    g.grounded = false;
    g.surface = null;
    g.lastJumpX = g.x;
    g.events.push({x: g.x, kind: g.jumps === 2 ? 'double' : 'jump'});
    return true;
  }

  function notify(g, kind, message) {
    const event={x:g.x,kind,detail:message,time:g.time};
    g.events.push(event);
  }

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function shade(hex, amount){
    const h=hex.replace('#','');
    const n=parseInt(h.length===3 ? h.split('').map(c=>c+c).join('') : h,16);
    const r=clamp(((n>>16)&255)+amount,0,255)|0;
    const g=clamp(((n>>8)&255)+amount,0,255)|0;
    const b=clamp((n&255)+amount,0,255)|0;
    return `rgb(${r},${g},${b})`;
  }
  function makeDeath(g){
    const base=g.stats.color || '#ffffff';
    const palette=[shade(base,46), base, shade(base,-28), shade(base,-56), 'rgba(255,255,255,.72)'];
    const pieces=[];
    for(let i=0;i<22;i++){
      const angle=(-0.95 + (i/21)*1.9 + (Math.random()-.5)*.22);
      const speed=50 + Math.random()*135;
      const startR=5 + Math.random()*20;
      const px=Math.cos(angle)*startR;
      const py=-18 + Math.sin(angle)*13;
      const size=6 + Math.random()*12;
      const verts=3 + (i%3);
      const pts=[];
      for(let k=0;k<verts;k++){
        const a=(Math.PI*2*k/verts)+(Math.random()-.5)*.45;
        const rr=size*(.58+Math.random()*.52);
        pts.push([Math.cos(a)*rr, Math.sin(a)*rr]);
      }
      pieces.push({x:px, y:py, vx:Math.cos(angle)*speed, vy:-70-Math.random()*135, rot:(Math.random()-.5)*1.5, spin:(Math.random()-.5)*6.2, alpha:.42 + Math.random()*.34, size, pts, color:palette[i%palette.length], landed:false, settle:0, groundY:18 + Math.random()*9});
    }
    return {time:0, duration:1.5, pieces};
  }
  function startDeath(g, reason){
    if(g.status==='dying' || g.status==='caught') return;
    g.status='dying';
    g.reason=reason;
    g.death=makeDeath(g);
    g.vy=0;
    g.grounded=false;
    g.surface=null;
    notify(g,'impact',reason);
  }
  function updateDeath(g,dt){
    if(!g.death) return;
    const d=g.death;
    d.time+=dt;
    for(const p of d.pieces){
      if(!p.landed){
        p.vy += 760*dt;
        p.x += p.vx*dt;
        p.y += p.vy*dt;
        p.rot += p.spin*dt;
        if(p.y >= p.groundY){
          p.y = p.groundY;
          p.vx *= .28;
          p.vy *= -.14;
          p.spin *= .36;
          p.landed = true;
        }
      }else{
        p.settle = clamp(p.settle + dt*2.1,0,1);
        p.x *= (1 - 0.028 - 0.06*p.settle);
        p.rot *= .94;
        p.alpha = Math.max(.14, p.alpha - dt*.09);
      }
    }
    if(d.time >= d.duration) g.status='caught';
  }

  function collectEnergy(g, amount, kind='essence') {
    if (g.status !== 'running') return 0;
    const before = g.energy;
    g.energy=Math.min(100,Math.max(0,g.energy+amount));
    const gain = g.energy-before;
    g.pickups++;
    notify(g,'pickup',`${kind === 'greater' ? 'Greater Essence' : 'Forest Essence'} +${Math.round(gain)} energy`);
    return gain;
  }

  function impact(g, kind) {
    if (g.impactCooldown > 0 || g.status !== 'running') return false;
    g.impacts++;
    const loss=Math.min(g.energy,g.stats.impact);
    g.energy = Math.max(0, g.energy - g.stats.impact);
    g.impactCooldown = 1.1; // temporary protection against repeat hits
    // More resilient wisps regain full running speed sooner.
    g.staggerTotal = .45 + g.stats.impact * .025;
    g.staggerRemaining = g.staggerTotal;
    g.x = Math.max(145, g.x - 24);
    g.vy = Math.min(g.vy, -130);
    g.grounded = false;
    g.surface = null;
    notify(g,'impact',`${kind}: −${Math.round(loss)} energy · ${g.staggerTotal.toFixed(1)}s recovery`);
    if (g.auto) {
      g.status = 'failed';
      g.reason = `Hit ${kind} in the auto-test`;
    }
    return true;
  }

  // One source of truth for procedural hazards and their collision geometry.
  function courseNear(g,x,behind=50,ahead=1200) {
    return WispCourse.nearby(g.seed,x,world=>stageAtFor(g,world),behind,ahead);
  }
  function procGapAt(g,x) {
    return courseNear(g,x,180,180).find(h=>h.type==='erosion-gap'&&x>h.x&&x<h.x+h.width)||null;
  }
  function procPlatformAt(g,x) {
    return courseNear(g,x,850,30).find(h=>{
      if(h.type==='forked-trunk'||h.type==='mossy-trunk')return x+8>h.x&&x-8<h.x+h.width;
      if(h.type==='falling-tree'||h.type==='charred-tree'){
        const d=g.hazardStates.get(h.id);
        return d && d.phase==='landed' && x+8>h.x+18 && x-8<h.x+h.width;
      }
      return false;
    })||null;
  }
  function dynamicFor(g,h) {
    if(!g.hazardStates.has(h.id))g.hazardStates.set(h.id,{timer:0,phase:'waiting',x:h.x,y:90,hit:false,travel:0});
    return g.hazardStates.get(h.id);
  }
  function dynamicUpdate(g,dt) {
    const nearby=courseNear(g,g.x,850,900);
    for(const h of nearby) {
      if(!['falling-tree','charred-tree','falling-timber','rolling-log'].includes(h.type))continue;
      if(h.type==='falling-timber'){
        let d=g.hazardStates.get(h.id);
        if(!d){
          d=WispProjectiles.newLog(g.seed,h,speedFor(g),VIEW.ground,WispCourse.hash);
          g.hazardStates.set(h.id,d);
        }
        if(d.phase==='waiting' && g.x>=d.triggerX){
          d.phase='flight';
          g.events.push({x:g.x,kind:'timber-launch',id:h.id});
        }
        WispProjectiles.advance(d,dt,VIEW.ground);
        continue;
      }
      const d=dynamicFor(g,h);
      if(d.phase==='waiting' && g.x>=h.x-(h.type==='rolling-log'?245:760)){
        d.phase='warning';d.timer=0;
        if(h.type==='falling-tree'||h.type==='charred-tree')notify(g,'warning','A tree creaks and begins to fall!');
      }
      if(d.phase==='waiting')continue;
      d.timer+=dt;
      if(h.type==='rolling-log'){
        d.phase='rolling';d.travel=Math.min(55,d.travel+dt*34);d.x=h.x-d.travel;
        continue;
      }
      const warning=2.05,fallDur=.58;
      if(d.timer<warning){d.phase='warning';}
      else if(d.timer<warning+fallDur){
        d.phase='falling';const q=(d.timer-warning)/fallDur;
        d.y=90+(VIEW.ground-23-90)*q*q;
      }else {d.phase='landed';d.y=VIEW.ground-23;}
    }
    // Keep the live state near the player; generation is deterministic but movement state is not regenerated.
    for(const [id] of g.hazardStates) {
      const idx=Number(id.split(':')[1]);
      if(Number.isFinite(idx) && idx < Math.floor((g.x-2100)/WispCourse.CHUNK))g.hazardStates.delete(id);
    }
  }
  function procObstacleRects(g,h) {
    if(h.type==='erosion-gap')return [];
    if(h.type==='forked-trunk'||h.type==='mossy-trunk')return h.branches.map(b=>({x1:b.x1,x2:b.x2,top:b.top,bottom:b.bottom,kind:b.kind}));
    let x=h.x,w=h.width,top=VIEW.ground-h.height;
    if(h.type==='rolling-log'){const d=g.hazardStates.get(h.id);if(d&&d.phase==='rolling')x=d.x;}
    if(h.type==='falling-timber'){
      const hit=WispProjectiles.collider(g.hazardStates.get(h.id));
      return hit?[hit]:[];
    }
    if(h.type==='falling-tree'||h.type==='charred-tree'){
      const d=g.hazardStates.get(h.id);
      if(!d || d.phase==='waiting' || d.phase==='warning')return [];
      if(d.phase==='falling'){
        return [{x1:x+10,x2:x+Math.min(w,145),top:d.y-24,bottom:d.y+19,kind:h.type}];
      }
      return []; // solid, landable trunk platform; side collision handled separately
    }
    return [{x1:x,x2:x+w,top,bottom:VIEW.ground+3,kind:h.type}];
  }
  // A missed jump disperses the wisp into essence and carries it to the bank.
  // The world position advances smoothly; pursuits keep running throughout.
  function beginGapRescue(g,gap){
    g.gapRescue={elapsed:0,duration:.72,startX:g.x,
      endX:Math.max(g.x,gap.x+gap.width+36),gapId:gap.id};
    g.rescues++;
    g.energy=Math.max(0,g.energy-28);
    g.staggerTotal=1.1;g.staggerRemaining=1.1;
    g.vy=0;g.grounded=false;g.surface=null;g.jumps=2;
    notify(g,'impact','Gap rescue: -28 energy and slowdown.');
  }
  function advanceGapRescue(g,dt){
    const r=g.gapRescue;
    r.elapsed=Math.min(r.duration,r.elapsed+dt);
    const t=smoothstep(r.elapsed/r.duration);
    g.x=r.startX+(r.endX-r.startX)*t;
    g.distance=Math.max(g.distance,g.x-155);
    if(r.elapsed>=r.duration){
      g.x=r.endX;g.y=VIEW.ground;g.vy=0;
      g.grounded=true;g.surface='ground';g.jumps=0;
      g.gapRescue=null;
    }
  }
  function stepProcedural(g,dt,input={}) {
    if(g.gapRescue){
      g.time+=dt;
      g.impactCooldown=Math.max(0,g.impactCooldown-dt);
      g.staggerRemaining=Math.max(0,g.staggerRemaining-dt);
      advanceGapRescue(g,dt);
      updateFire(g,dt);
      updateForest(g,dt);
      if(g.chaseEnabled && !g.fire.active && g.status==='running')proceduralCutter(g,dt);
      return;
    }
    if(g.auto){
      if(!window.WispBenchmark)throw new Error('Test-only benchmark controller was not loaded');
      window.WispBenchmark.control(g,{speedFor,courseNear,jump,G,ground:VIEW.ground});
    }
    if(input.jump)jump(g);
    // Do not glide after the small branch: at high energy the extra airtime
    // makes a fast wisp land inside the NEXT fork. Reserve glide for long
    // gaps, tall stack maneuvers and the completed fork double-jump.
    const kind=g.procPlanType;
    const needGlide=kind && (
      (kind==='forked-trunk' && g.procPlanStep===4) ||
      (['erosion-gap','timber-stack','ash-patch'].includes(kind) && g.procPlanStep===2)
    );
    const plannedGlide=g.auto && g._projectilePlan?.hold && g._projectilePlan.index>0;
    g.glide=!!input.glide || (g.auto && (needGlide || plannedGlide) && !g.grounded);
    g.time+=dt;
    g.impactCooldown=Math.max(0,g.impactCooldown-dt);
    g.staggerRemaining=Math.max(0,g.staggerRemaining-dt);
    const v=speedFor(g),oldX=g.x,oldY=g.y;
    g.x+=v*dt;g.distance=Math.max(0,g.x-155);
    g.energy=Math.max(0,g.energy-v*dt*g.stats.drain/1000);
    if(g.grounded&&g.surface==='ground'&&procGapAt(g,g.x)){
      g.grounded=false;g.surface=null;g.vy=0;notify(g,'warning','Missed the gap — falling!');
    }
    if(g.grounded&&g.surface==='trunk'&&!procPlatformAt(g,g.x)){
      g.grounded=false;g.surface=null;g.jumps=0;
    }
    if(!g.grounded){
      const grav=g.glide&&g.vy>0?G*.29:G;
      g.vy=Math.min(g.vy+grav*dt,g.glide&&g.vy>0?165:720);
      g.y+=g.vy*dt;
    }
    if(!g.grounded&&g.vy>=0){
      const plat=procPlatformAt(g,g.x);
      const top=plat && (plat.type==='falling-tree'||plat.type==='charred-tree')?356:339;
      if(plat && oldY<=top+1 && g.y>=top){
        g.y=top;g.vy=0;g.grounded=true;g.surface='trunk';g.jumps=0;
        g.events.push({x:g.x,kind:'land-trunk'});
      }
      if(!g.grounded && oldY<=VIEW.ground+1 && g.y>=VIEW.ground && !procGapAt(g,g.x)){
        g.y=VIEW.ground;g.vy=0;g.grounded=true;g.surface='ground';g.jumps=0;
      }
    }
    dynamicUpdate(g,dt);
    // Projectile spawn points can be behind us while the airborne log is still nearby.
    const obstacles=courseNear(g,g.x,850,350);
    for(const h of obstacles){
      if((h.type==='forked-trunk'||h.type==='mossy-trunk') && g.x+13>h.x && oldX+13<=h.x && g.y>339+4)impact(g,'trunk side');
      if((h.type==='falling-tree'||h.type==='charred-tree') && g.hazardStates.get(h.id)?.phase==='landed' &&
         g.x+13>h.x+18 && oldX+13<=h.x+18 && g.y>356+4) impact(g,'fallen trunk side');
      for(const r of procObstacleRects(g,h)){
        if(g.x+13>r.x1 && g.x-13<r.x2 && g.y>r.top+.1 && g.y-32<r.bottom){impact(g,r.kind);}
      }
    }
    if(!g.noPickups){
      for(const h of courseNear(g,g.x,120,75)){
        for(const orb of h.orbs){
          if(g.collected.has(orb.id))continue;
          if(Math.hypot(g.x-orb.x,g.y-23-orb.y)<32){g.collected.add(orb.id);collectEnergy(g,orb.amount,orb.kind);}
        }
      }
    }
    if(g.y>VIEW.ground+150){
      const gap=procGapAt(g,g.x)||courseNear(g,g.x,200,120).find(h=>h.type==='erosion-gap'&&Math.abs(h.x-g.x)<200);
      if(gap)beginGapRescue(g,gap);
    }
    updateFire(g,dt);
    updateForest(g,dt);
    if(g.chaseEnabled && !g.fire.active && g.status==='running') proceduralCutter(g,dt);
    if(g.auto)window.WispBenchmark.finish(g);
  }

  function proceduralCutter(g,dt){
    const c=g.cutter;
    c.elapsed+=dt;
    if(c.state==='rest'){if(c.elapsed>=c.wait)enterCutter(g,'warning','Chainsaw warning!');return;}
    if(c.state==='warning'){
      if(c.elapsed>=1.65){
        // Retain earned lead, with a guaranteed minimum warning distance.
        c.x=Math.min(g.x-240,Math.max(c.x,g.x-380));
        c.wave++;c.frenzyUsed=false;enterCutter(g,'approach','The Cutter emerges from behind!');
      }return;
    }
    if(c.state==='retreat'){
      c.x-=155*dt;
      if(c.elapsed>=2.1){enterCutter(g,'rest','The forest is quiet again.');c.wait=quietWindow(g);}
      return;
    }
    if(c.state==='fall'){
      c.x+=35*dt;c.y+=120*dt+150*c.elapsed*dt;
      if(c.elapsed>=1.6){c.y=0;enterCutter(g,'rest','The Cutter fell. Quiet returns.');c.wait=quietWindow(g);}
      return;
    }
    if(c.state==='climb'){
      const u=Math.min(1,c.elapsed/c.climbDuration),t=u*u*(3-2*u);
      c.x=c.actionStartX+(c.trunkStart+28-c.actionStartX)*t;
      c.y=-(c.trunkHeight||41)*t;checkCutterContact(g);
      if(u>=1){c.onTrunk=true;enterCutter(g,c.postState,null,true);}return;
    }
    if(c.state==='descend'){
      const u=Math.min(1,c.elapsed/c.descendDuration),t=u*u*(3-2*u);
      c.x=c.actionStartX+(c.trunkEnd+25-c.actionStartX)*t;
      c.y=-(c.trunkHeight||41)*(1-t);checkCutterContact(g);
      if(u>=1){c.onTrunk=false;c.trunkLap=-1;c.y=0;enterCutter(g,c.postState,null,true);}return;
    }
    if(c.state==='cut'){
      if(c.elapsed>=((c.cutTarget&&c.cutTarget.duration)||1)){
        if(c.cutTarget)c.cleared.add(c.cutTarget.key);
        notify(g,'quiet','The Cutter sawed through the obstruction.');
        enterCutter(g,c.postState||'hunt',null,true);
      }checkCutterContact(g);return;
    }
    if(['approach','hunt','frenzy'].includes(c.state)){
      const nearby=courseNear(g,c.x,90,125);
      const platform=nearby.find(h=>{
        const solid=(h.type==='mossy-trunk'||h.type==='forked-trunk')||
          (['falling-tree','charred-tree'].includes(h.type)&&g.hazardStates.get(h.id)?.phase==='landed');
        const left=['falling-tree','charred-tree'].includes(h.type)?h.x+18:h.x;
        return solid&&left-c.x>=-6&&left-c.x<=38;
      });
      if(!c.onTrunk && platform){
        c.postState=c.state;c.actionStartX=c.x;
        c.trunkStart=platform.x+(['falling-tree','charred-tree'].includes(platform.type)?18:0);
        c.trunkEnd=platform.x+platform.width;c.trunkHeight=platform.height===24?24:41;
        c.climbDuration=c.state==='frenzy'?.51:.72;c.state='climb';c.elapsed=0;
        notify(g,'quiet','The Cutter climbs onto the fallen trunk.');return;
      }
      if(c.onTrunk && c.x>=c.trunkEnd-31){
        c.postState=c.state;c.actionStartX=c.x;c.descendDuration=c.state==='frenzy'?.38:.54;
        c.state='descend';c.elapsed=0;return;
      }
      let cutting=null;
      for(const h of nearby){
        const parts=procObstacleRects(g,h);
        if((h.type==='forked-trunk'||h.type==='mossy-trunk')&&!c.onTrunk)continue;
        if(h.type==='root'||h.type==='short-log'||h.type==='stump'||h.type==='rolling-log'||h.type==='ash-patch'||h.type==='burning-log')continue;
        for(const b of parts){
          const key=`${h.id}:${b.kind}:${Math.round(b.x1)}`;
          if(c.cleared.has(key))continue;
          if(b.x1-c.x>=-7 && b.x1-c.x<=35){cutting={key,name:b.kind,duration:c.state==='frenzy'?.4:.88};break;}
        }
        if(cutting)break;
      }
      if(cutting){enterCut(g,cutting,c.state);return;}
    }
    c.x+=({approach:198,hunt:248,frenzy:312,jump:228}[c.state]||214)*dt;
    if(c.state==='jump'){
      if(c.elapsed>=.9){c.y=0;enterCutter(g,c.gapOutcome==='frenzy'?'frenzy':'hunt',null,true);}
      else c.y=-42*Math.sin(Math.PI*c.elapsed/.9);
    }else{
      const gap=courseNear(g,c.x,20,42).find(h=>h.type==='erosion-gap'&&h.x-c.x>-15&&h.x-c.x<22);
      if(gap){
        if(gap.width>90){enterCutter(g,c.state==='frenzy'?'fall':'retreat','The wide gap stops The Cutter.');return;}
        c.gapOutcome=c.state;enterCutter(g,'jump','The Cutter jumps the small gap.');
      }
    }
    if(c.state==='approach'&&c.elapsed>=2.15)enterCutter(g,'hunt','The Cutter is hunting!');
    else if(c.state==='hunt'){
      c.totalHunt+=dt;
      if(!c.frenzyUsed && c.totalHunt>=3.25){c.frenzyUsed=true;enterCutter(g,'frenzy','FRENZY!');}
      else if(c.totalHunt>=9&&!c.onTrunk)enterCutter(g,'retreat','The Cutter retreats.');
    }else if(c.state==='frenzy'&&c.elapsed>=2.5){enterCutter(g,'hunt','Frenzy ends.');c.totalHunt=6.5;}
    checkCutterContact(g);
  }

  function step(g,dt,input={}) {
    if(g.status==='dying'){updateDeath(g,dt);return;}
    if(g.status==='running')stepProcedural(g,dt,input);
  }

  // Images are hydrated from HTML so the same test can run as a standalone file on iOS.
  function loadImages() {
    const blobs = window.WISP_VECTOR_ASSETS || {};
    for (const [key,filename] of Object.entries(SPRITE_FILES)) {
      const src = blobs[filename] || `assets/${filename}`;
      const img = new Image(); img.decoding='async'; img.src=src; imageAssets[key]=img;
    }
  }

  function drawImage(name,x,y,w,h,alpha=1) {
    const img = imageAssets[name];
    if (img && img.complete && img.naturalWidth) {
      ctx.globalAlpha = alpha;
      ctx.drawImage(img,x,y,w,h);
      ctx.globalAlpha=1;
    }
  }

  // Crop native-size SVG ground tiles into narrow world-space slices; this
  // avoids visible stage jumps at every 256px tile boundary.
  function drawGroundSlice(name,srcX,screenX,y,width,height,alpha=1){
    const img=imageAssets[name];
    if(alpha<=.001 || !img || !img.complete || !img.naturalWidth)return;
    ctx.globalAlpha=alpha;
    ctx.drawImage(img,srcX,0,width,height,screenX,y,width,height);
    ctx.globalAlpha=1;
  }

  // Exact wall contours from the existing gap SVGs; gameplay collision remains
  // the flat interval [h.x,h.x + h.width] at the terrain surface.
  const GAP_LEFT_EDGE=[[0,0],[-5,10],[-8,28],[-17,42],[-11,58],[-26,77],
    [-13,96],[-19,112],[-31,138],[-27,164]];
  const GAP_RIGHT_EDGE=[[0,0],[5,17],[11,31],[17,52],[11,74],[23,94],
    [18,121],[28,147],[26,164]];
  function traceGapOpening(path,left,width){
    path.moveTo(left,VIEW.ground-24);
    path.lineTo(left+width,VIEW.ground-24);
    for(const [dx,dy] of GAP_RIGHT_EDGE)path.lineTo(left+width+dx,VIEW.ground+dy);
    path.lineTo(left+26,VIEW.height+16);
    path.lineTo(left-27,VIEW.height+16);
    for(let i=GAP_LEFT_EDGE.length-1;i>=0;i--){
      const [dx,dy]=GAP_LEFT_EDGE[i];
      path.lineTo(left+dx,VIEW.ground+dy);
    }
    path.closePath();
  }
  function maskGroundGaps(path,gaps,camera){
    path.beginPath();
    path.rect(-2,VIEW.ground-24,VIEW.width+4,VIEW.height-VIEW.ground+40);
    for(const h of gaps)traceGapOpening(path,h.x-camera,h.width);
    path.clip('evenodd');
  }
  function drawGapDepth(h,camera){
    const left=h.x-camera,w=h.width;
    ctx.save();
    ctx.beginPath();traceGapOpening(ctx,left,w);ctx.clip();
    const depth=ctx.createLinearGradient(0,VIEW.ground,0,VIEW.height);
    depth.addColorStop(0,'#17292a');
    depth.addColorStop(.40,'#0d2025');
    depth.addColorStop(1,'#071218');
    ctx.fillStyle=depth;
    ctx.fillRect(left-40,VIEW.ground-4,w+80,VIEW.height-VIEW.ground+24);
    // Directional crevice shadows along the uneven walls, not a black box.
    const shadeLeft=ctx.createLinearGradient(left-32,0,left+26,0);
    shadeLeft.addColorStop(0,'rgba(0,0,0,.62)');
    shadeLeft.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=shadeLeft;ctx.fillRect(left-33,VIEW.ground,60,VIEW.height-VIEW.ground+16);
    const shadeRight=ctx.createLinearGradient(left+w-24,0,left+w+33,0);
    shadeRight.addColorStop(0,'rgba(0,0,0,0)');
    shadeRight.addColorStop(1,'rgba(0,0,0,.62)');
    ctx.fillStyle=shadeRight;ctx.fillRect(left+w-25,VIEW.ground,60,VIEW.height-VIEW.ground+16);
    for(let i=0;i<4;i++){
      const y=VIEW.ground+23+i*25+hash01(h.index,i+81)*6;
      const reach=6+hash01(h.index,i+97)*17;
      ctx.fillStyle=i%2?'rgba(88,84,72,.22)':'rgba(102,95,80,.18)';
      ctx.beginPath();
      if(i%2){
        ctx.moveTo(left+w+24,y-6);
        ctx.lineTo(left+w-reach,y+5);
        ctx.lineTo(left+w+18,y+11);
      }else{
        ctx.moveTo(left-25,y-5);
        ctx.lineTo(left+reach,y+4);
        ctx.lineTo(left-22,y+12);
      }
      ctx.closePath();ctx.fill();
    }
    ctx.restore();
  }

  // Stable ridges sampled in parallax-world coordinates, not repeated triangles.
  // Smooth multi-octave noise produces broad hills and smaller natural shoulders.
  function smoothNoise(world,period,salt){
    const position=world/period,cell=Math.floor(position);
    const t=smoothstep(position-cell);
    return hash01(cell,salt)*(1-t)+hash01(cell+1,salt)*t;
  }
  function ridgeHeight(world,layer){
    const far=layer===0;
    const wide=smoothNoise(world,far?470:350,far?181:199);
    const small=smoothNoise(world,far?147:103,far?211:229);
    return (far?211:263)-(wide-.5)*(far?63:79)-(small-.5)*(far?22:35);
  }
  function sceneryTreeAt(i,l,layer){
    const jitter=(hash01(i,301+l*11)-.5)*layer.step*.62;
    const world=i*layer.step+l*33+jitter;
    const scale=.79+hash01(i,331+l*7)*.41;
    const kind=hash01(i,349+l*13);
    return {world,width:layer.w*scale,height:layer.h*scale,
      type:kind<.50?'Broadleaf':kind<.88?'Conifer':'Ancient',
      roll:hash01(i,371+l*17),
      patch:.69+.48*smoothNoise(world,layer.step*3.8,391+l*7),
      alpha:layer.alpha*(.78+.23*hash01(i,403+l*13))};
  }
  function drawRidges(camera){
    const step=24;
    for(let layer=0;layer<2;layer++){
      const speed=layer===0?.14:.29;
      const offset=camera*speed;
      ctx.globalAlpha=layer===0?.35:.29;
      for(let sx=-step;sx<VIEW.width+step;sx+=step){
        const wx=offset+sx;
        const mix=visualStageAt((wx+step*.5)/speed);
        const a=STAGE_COLORS[stageKey(mix.a)],b=STAGE_COLORS[stageKey(mix.b)];
        ctx.fillStyle=blendHex(a.mountain,b.mountain,mix.t);
        ctx.beginPath();
        ctx.moveTo(sx,VIEW.ground);
        ctx.lineTo(sx,ridgeHeight(wx,layer));
        ctx.lineTo(sx+step+1,ridgeHeight(wx+step+1,layer));
        ctx.lineTo(sx+step+1,VIEW.ground);
        ctx.closePath();ctx.fill();
      }
      ctx.globalAlpha=1;
    }
  }
  function drawLightShafts(camera){
    const speed=.19,period=540;
    const first=Math.floor(camera*speed/period)-2;
    const last=Math.ceil((camera*speed+VIEW.width)/period)+2;
    for(let i=first;i<=last;i++){
      const world=i*period+hash01(i,421)*170;
      const mix=visualStageAt(world/speed);
      const living=([0,4].includes(mix.a)?1-mix.t:0)+([0,4].includes(mix.b)?mix.t:0);
      if(living<=.01)continue;
      const x=world-camera*speed;
      ctx.globalAlpha=living*(.065+.03*hash01(i,423));
      ctx.fillStyle='#cfdfb4';ctx.beginPath();
      ctx.moveTo(x-19,0);ctx.lineTo(x+22,0);
      ctx.lineTo(x+132,VIEW.ground);ctx.lineTo(x+65,VIEW.ground);
      ctx.closePath();ctx.fill();
    }
    ctx.globalAlpha=1;
  }
  function drawMist(camera){
    const speed=.22,period=345;
    const first=Math.floor(camera*speed/period)-2;
    const last=Math.ceil((camera*speed+VIEW.width)/period)+2;
    for(let i=first;i<=last;i++){
      const world=i*period+hash01(i,449)*73;
      const mix=visualStageAt(world/speed);
      // Rain/smoke belong to later phases. Here, living fog gives way to dusty air.
      const tone=['rgba(159,194,171,','rgba(174,163,135,',
        'rgba(173,148,132,','rgba(149,140,149,','rgba(166,201,174,'];
      const stage=hash01(i,451)<mix.t?mix.b:mix.a;
      const sx=world-camera*speed;
      const opacity=.06+.035*hash01(i,457);
      const fog=ctx.createLinearGradient(sx-210,0,sx+300,0);
      fog.addColorStop(0,tone[stage]+'0)');
      fog.addColorStop(.45,tone[stage]+opacity.toFixed(3)+')');
      fog.addColorStop(1,tone[stage]+'0)');
      ctx.fillStyle=fog;
      ctx.fillRect(sx-210,254+hash01(i,463)*44,510,35);
    }
  }
  function drawUnderstory(camera,_g,gaps){
    const spacing=125;
    const first=Math.floor(camera/spacing)-2;
    const last=Math.ceil((camera+VIEW.width)/spacing)+2;
    const density=[.81,.58,.34,.48,.92];
    for(let i=first;i<=last;i++){
      const world=i*spacing+hash01(i,481)*67;
      const mix=treeMixAt(world,i,4);
      const chance=(density[mix.a]*(1-mix.t)+density[mix.b]*mix.t);
      if(hash01(i,487)>chance)continue;
      const size=51+hash01(i,491)*18;
      const width=size*1.37;
      // Do not draw foliage over a pit, even in chase-disabled practice runs.
      if(gaps.some(h=>world+width>h.x&&world-7<h.x+h.width))continue;
      const sx=world-camera;
      const alpha=.70+.18*hash01(i,499);
      if(mix.weight<.999)drawImage(biomeSprite(mix.a,'Understory'),sx,VIEW.ground-size+5,width,size,alpha*(1-mix.weight));
      if(mix.weight>.001)drawImage(biomeSprite(mix.b,'Understory'),sx,VIEW.ground-size+5,width,size,alpha*mix.weight);
    }
  }
  function drawAirDetails(camera,g){
    // World-space particles: camera motion cannot create new random patterns.
    const spacing=88;
    const first=Math.floor(camera/spacing)-2;
    const last=Math.ceil((camera+VIEW.width)/spacing)+2;
    const colors=['#c6d89a','#beb49a','#c8ad9b','#d6a28c','#c7dfad'];
    const densities=[.68,.38,.44,.82,.72];
    for(let i=first;i<=last;i++){
      const world=i*spacing+hash01(i,521)*spacing*.75;
      const mix=visualStageAt(world);
      const stage=hash01(i,523)<mix.t?mix.b:mix.a;
      if(hash01(i,527)>densities[stage])continue;
      const drift=reducedMotion?0:Math.sin(g.time*(.35+.27*hash01(i,533))+i*2.3)*5;
      const x=world-camera+drift;
      const y=98+hash01(i,541)*242+(reducedMotion?0:Math.cos(g.time*.40+i)*3);
      const r=.9+hash01(i,547)*1.25;
      ctx.globalAlpha=(stage===3?.38:.22)*(.65+.35*hash01(i,551));
      ctx.fillStyle=colors[stage];
      ctx.fillRect(x,y,r,r*(stage===3?1.4:.75));
    }
    ctx.globalAlpha=1;
  }

  // Rain sits above the game world but below UI. Droplets are screen-spaced,
  // time-animated and reproducible without Math.random or per-frame sprites.
  function drawWeather(g,camera){
    const rain=rainIntensity(g);
    if(rain<=.001)return;
    ctx.save();
    const cloud=ctx.createLinearGradient(0,0,0,235);
    cloud.addColorStop(0,`rgba(12,20,30,${(.43*rain).toFixed(3)})`);
    cloud.addColorStop(1,'rgba(12,20,30,0)');
    ctx.fillStyle=cloud;ctx.fillRect(0,0,VIEW.width,VIEW.ground);
    // Broad cloud banks scroll slowly above the ridges, without harsh edges.
    ctx.globalAlpha=rain*.13;ctx.fillStyle='#071b28';
    const bankShift=reducedMotion?0:g.time*2;
    for(let i=-1;i<=3;i++){
      const x=i*330+(hash01(i,731)-.5)*80-bankShift%330;
      ctx.beginPath();ctx.moveTo(x-90,0);
      ctx.lineTo(x+290,0);
      ctx.bezierCurveTo(x+260,55,x+220,37,x+166,45);
      ctx.bezierCurveTo(x+118,69,x+45,33,x-90,70);
      ctx.closePath();ctx.fill();
    }
    if(g.forest.weather==='storm' && !reducedMotion){
      const t=g.forest.weatherElapsed;
      if((t>2.2&&t<2.30)||(t>4.04&&t<4.12)){
        ctx.globalAlpha=.16*rain;ctx.fillStyle='#d9e9ec';
        ctx.fillRect(0,0,VIEW.width,VIEW.ground);
      }
    }
    const count=reducedMotion?55:Math.round(125*rain);
    ctx.globalAlpha=Math.min(.5,rain*.46);
    ctx.strokeStyle='#a8d2de';ctx.lineWidth=1.15;ctx.beginPath();
    for(let i=0;i<count;i++){
      const x=(hash01(i,711)*VIEW.width+(reducedMotion?0:g.time*195))%VIEW.width;
      const y=(hash01(i,719)*VIEW.ground+(reducedMotion?0:g.time*510))%VIEW.ground;
      ctx.moveTo(x,y);ctx.lineTo(x-8,y+18);
    }
    ctx.stroke();
    // A few shallow ripples make the rain meet the terrain. Never paint a
    // puddle across the geometric openings carved in Phase 1.
    const gaps=courseNear(g,camera,100,VIEW.width+120).filter(h=>h.type==='erosion-gap');
    for(let i=Math.floor(camera/155)-1;i<Math.ceil((camera+VIEW.width)/155)+1;i++){
      const world=i*155+hash01(i,751)*90;
      if(gaps.some(h=>world+25>h.x&&world-25<h.x+h.width))continue;
      const age=(reducedMotion?.5:(g.time*1.7+hash01(i,757))%1);
      ctx.strokeStyle=`rgba(183,216,205,${(rain*(1-age)*.26).toFixed(3)})`;
      ctx.lineWidth=1;
      ctx.beginPath();ctx.ellipse(world-camera,VIEW.ground+1,4+15*age,1.6+2*age,0,0,Math.PI*2);ctx.stroke();
    }
    ctx.restore();
  }

  function drawBg(camera,g) {
    // Sky and soil are sampled in WORLD space across the whole viewport; the
    // whole screen no longer changes palette when the player crosses a border.
    const SKY_STEP=24;
    const soilBands=[];
    for(let sx=0;sx<VIEW.width;sx+=SKY_STEP){
      const width=Math.min(SKY_STEP,VIEW.width-sx);
      const mix=visualStageAt(camera+sx+width/2);
      const a=STAGE_COLORS[stageKey(mix.a)],b=STAGE_COLORS[stageKey(mix.b)];
      const grad=ctx.createLinearGradient(0,0,0,VIEW.ground);
      grad.addColorStop(0,blendHex(a.sky,b.sky,mix.t));
      grad.addColorStop(1,blendHex(a.haze,b.haze,mix.t));
      ctx.fillStyle=grad;ctx.fillRect(sx,0,width+.5,VIEW.ground);
      soilBands.push({x:sx,width:width+.5,color:blendHex(a.soil,b.soil,mix.t)});
    }

    drawLightShafts(camera);
    drawRidges(camera);
    drawMist(camera);

    // An individual tree never changes its biome as the camera moves. Each
    // tree has a fixed world anchor and a deterministic, slightly offset
    // crossfade so forest damage spreads unevenly instead of popping en masse.
    const layerSpecs=[{speed:.12,step:198,w:153,h:278,alpha:.17},
      {speed:.30,step:208,w:168,h:310,alpha:.26},
      {speed:.52,step:236,w:185,h:340,alpha:.39}];
    const densities=[.99,.77,.41,.56,.96];
    layerSpecs.forEach((layer,l)=>{
      // Add margins for the deterministic offsets and the widest ancient trees.
      const first=Math.floor(camera*layer.speed/layer.step)-3;
      const last=Math.floor((camera*layer.speed+VIEW.width)/layer.step)+3;
      for(let i=first;i<=last;i++){
        const tree=sceneryTreeAt(i,l,layer);
        const mix=treeMixAt(tree.world/layer.speed,i,l);
        const density=(densities[mix.a]*(1-mix.t)+densities[mix.b]*mix.t)*tree.patch;
        if(tree.roll>Math.min(1,density))continue;
        const x=tree.world-camera*layer.speed;
        const y=VIEW.ground-tree.height+12;
        if(mix.weight<.999)drawImage(biomeSprite(mix.a,tree.type),x,y,tree.width,tree.height,tree.alpha*(1-mix.weight));
        if(mix.weight>.001)drawImage(biomeSprite(mix.b,tree.type),x,y,tree.width,tree.height,tree.alpha*mix.weight);
      }
    });

    // Clip the full ground layer, including its turf and decorations. A pit
    // is an actual opening rather than an overlay covering intact ground.
    const visibleGaps=courseNear(g,camera,180,VIEW.width+180).filter(h=>h.type==='erosion-gap');
    ctx.save();maskGroundGaps(ctx,visibleGaps,camera);
    // The earth face sits IN FRONT of distant tree roots, as in the original
    // painter order; don't reveal submerged roots beneath translucent tiles.
    for(const band of soilBands){
      ctx.fillStyle=band.color;
      ctx.fillRect(band.x,VIEW.ground,band.width,VIEW.height-VIEW.ground);
    }

    // The ground tiles are genuine SVG facets. Mix neighboring biome sprites
    // every 32 world pixels, not once per tile; preserve the unchanged geometry.
    const tile=256, slice=32;
    const first=Math.floor(camera/tile)-1,last=Math.floor((camera+VIEW.width)/tile)+1;
    for(let i=first;i<=last;i++){
      const worldX=i*tile, suffix=i%2===0?'A':'B';
      for(let dx=0;dx<tile;dx+=slice){
        const width=Math.min(slice,tile-dx),mix=visualStageAt(worldX+dx+width/2);
        const screenX=worldX+dx-camera;
        drawGroundSlice(groundSprite(mix.a,'Face'+suffix),dx,screenX,VIEW.ground+26,width,160,1-mix.t);
        drawGroundSlice(groundSprite(mix.a,'Top'+suffix),dx,screenX,VIEW.ground-22,width,60,1-mix.t);
        if(mix.t>.001){
          drawGroundSlice(groundSprite(mix.b,'Face'+suffix),dx,screenX,VIEW.ground+26,width,160,mix.t);
          drawGroundSlice(groundSprite(mix.b,'Top'+suffix),dx,screenX,VIEW.ground-22,width,60,mix.t);
        }
      }
    }

    ctx.restore(); // Ground finished. Decorations must not be clipped to dirt y>=356.
    // Ground decoration is discrete by nature; choose deterministic clusters
    // from the same longer visual progression. No disappearing on camera scroll.
    const firstD=Math.floor(camera/89)-2,lastD=Math.floor((camera+VIEW.width)/89)+2;
    for(let i=firstD;i<=lastD;i++){
      const world=i*89+19+hash01(i,39)*43;
      if(visibleGaps.some(h=>world+44>h.x&&world-4<h.x+h.width))continue;
      const mix=visualStageAt(world);
      const switchAt=.18+hash01(i,42)*.64;
      const stage=mix.t>=switchAt?mix.b:mix.a;
      const variants=STAGE_DECOR[stageKey(stage)];
      const slot=Math.floor(hash01(i,43)*variants.length);
      const label=variants[slot];
      const w=label.startsWith('Grass')||label.startsWith('Weed')||label.startsWith('Dry')?30:43;
      drawImage(groundSprite(stage,label),world-camera,VIEW.ground-(label==='SmokeWisp'?43:21),w,label==='SmokeWisp'?43:22,.82);
    }

    drawUnderstory(camera,g,visibleGaps);
    drawAirDetails(camera,g);
  }

  function drawProceduralCourse(g,camera){
    const x=world=>world-camera;
    const visible=courseNear(g,camera,500,VIEW.width+590);
    for(const h of visible){
      const sx=x(h.x),stage=h.stage;
      if(h.type==='erosion-gap'){
        drawGapDepth(h,camera);
        const left=visualStageAt(h.x),right=visualStageAt(h.x+h.width);
        const cap=(side,s,px)=>{
          drawImage(groundSprite(s.a,side),px,VIEW.ground-22,96,186,1-s.t);
          if(s.t>.001)drawImage(groundSprite(s.b,side),px,VIEW.ground-22,96,186,s.t);
        };
        cap('GapLeft',left,sx-96);cap('GapRight',right,sx+h.width);
      }else if(h.type==='mossy-trunk'||h.type==='forked-trunk'){
        drawImage(biomeSprite(stage,'Trunk'),sx-36,202,730,203);
      }else if(h.type==='root'){
        drawImage('hazardRoot',sx-7,VIEW.ground-29,h.width+14,29);
      }else if(h.type==='stump'){
        drawImage('hazardStump',sx-15,VIEW.ground-61,h.width+30,61);
      }else if(h.type==='timber-stack'){
        drawImage('hazardStack',sx-26,VIEW.ground-90,h.width+50,94);
      }else if(h.type==='ash-patch'){
        drawImage('hazardAsh',sx-5,VIEW.ground-27,h.width+10,31);
      }else if(h.type==='rolling-log'){
        const d=g.hazardStates.get(h.id),xx=x(d&&d.phase==='rolling'?d.x:h.x);
        drawImage(biomeSprite(stage,'Log'),xx-9,VIEW.ground-41,h.width+18,42);
        if(d&&d.phase==='rolling'){
          ctx.fillStyle='rgba(220,175,110,.33)';
          ctx.fillRect(xx+h.width+5,VIEW.ground-4,Math.min(28,d.travel),2);
        }
      }else if(h.type==='falling-tree'||h.type==='charred-tree'){
        const d=g.hazardStates.get(h.id),timer=d?.timer||0;
        const warn=2.05,fallDur=.58;
        const q=timer<warn?0:Math.min(1,(timer-warn)/fallDur);
        const angle=q*q*(3-2*q)*Math.PI*.46;
        if(d&&d.phase==='warning'){
          ctx.fillStyle='rgba(244,176,97,.28)';ctx.beginPath();ctx.ellipse(sx+20,VIEW.ground-2,60,9,0,0,Math.PI*2);ctx.fill();
        }
        ctx.save();ctx.translate(sx+10,VIEW.ground);
        ctx.rotate(angle);
        drawImage(h.type==='charred-tree'?'hazardChar':'hazardTree',-73,-205,146,209,.92);
        ctx.restore();
      }else if(h.type==='falling-timber'){
        const d=g.hazardStates.get(h.id);
        if(d && d.phase!=='waiting'){
          const px=x(d.x),py=d.y;
          ctx.save();ctx.translate(px,py);ctx.rotate(d.angle);
          drawImage(biomeSprite(stage,'Timber'),-d.width/2-7,-d.height/2-8,d.width+14,d.height+16);
          ctx.restore();
          // Contact sparks/dirt only AFTER a bounce, never a landing predictor.
          if(d.impactAge<.16){
            ctx.globalAlpha=Math.max(0,1-d.impactAge/.16)*.54;
            ctx.fillStyle=stage>=3?'#db723e':'#b39c77';
            for(let j=0;j<4;j++)ctx.fillRect(px-13+j*9,VIEW.ground-2-(j%2)*5,3,3);
            ctx.globalAlpha=1;
          }
        }
      }else{
        // Natural log, freshly cut timber, or smoldering log: same collider, biome-specific SVG.
        drawImage(biomeSprite(stage,'Log'),sx-12,VIEW.ground-(h.height+18),h.width+24,h.height+20);
      }
      for(const o of h.orbs){
        if(g.collected.has(o.id))continue;
        const size=o.kind==='greater'?43:30;
        drawImage(o.kind==='greater'?'greater':'orb',x(o.x)-size/2,o.y-size/2+Math.sin(g.time*2.6+h.index)*3,size,size);
      }
    }

  }

  function drawCutterShadow(g,camera){
    const c=g.cutter;
    if(!g.chaseEnabled || ['rest','warning'].includes(c.state))return;
    const sx=c.x-camera;
    if(sx < -170 || sx>VIEW.width+150)return;
    ctx.fillStyle='rgba(5,13,17,.45)';ctx.beginPath();ctx.ellipse(sx,VIEW.ground+c.y+4,33,7,0,0,Math.PI*2);ctx.fill();
  }
  function updateCutterOverlay(g,camera){
    const svg=el('cutter-svg');if(!svg)return;
    const c=g.cutter,visible=g.chaseEnabled&&!g.fire.active&&!['rest','warning'].includes(c.state);
    svg.style.display=visible?'block':'none';
    if(!visible)return;
    const factor=canvas.getBoundingClientRect().width/VIEW.width;
    const size=.35;
    svg.style.width=`${760*size*factor}px`;
    svg.style.height=`${520*size*factor}px`;
    const sx=c.x-camera;
    svg.style.left=`${(sx-326*size)*factor}px`;
    svg.style.top=`${(VIEW.ground+c.y-476*size)*factor}px`;
    const mode=c.state==='rest'?'run':c.state==='retreat'?'brake':c.state==='hunt'?'run':c.state==='cut'?'cut':c.state==='climb'?'climb':c.state==='descend'?'descend':c.state;
    if(cutterMotion&&mode!==lastCutterAnimation){cutterMotion.play(mode);lastCutterAnimation=mode;}
  }

  // Native inline SVG overlay (not Canvas drawImage): SMIL runs in the DOM,
  // including the anchored flame-tip polygons. The collision plane is still f.x.
  function drawWildfire(g,camera){
    const svg=el('wildfire-svg');
    const f=g.fire;
    if(!svg || !f || !f.active){if(svg)svg.style.display='none';return;}
    const front=f.x-camera;
    const size=.76;
    const ratio=canvas.getBoundingClientRect().width/VIEW.width;
    // SVG's actual ground bed is y=463..480. Align flame roots at y=463 with
    // gameplay's soil surface, WITHOUT any vertical bobbing or sway.
    const groundAnchorY=463;
    const leadingEdgeX=1034;
    svg.style.width=`${(1120*size*ratio).toFixed(2)}px`;
    svg.style.height=`${(530*size*ratio).toFixed(2)}px`;
    svg.style.left=`${((front-leadingEdgeX*size)*ratio).toFixed(2)}px`;
    svg.style.top=`${((VIEW.ground-groundAnchorY*size)*ratio).toFixed(2)}px`;
    svg.style.opacity=f.phase==='warning'?.68:f.phase==='storm'?Math.max(0,1-f.elapsed/STORM_QUENCH):1;
    svg.style.display='block';
    svg.setAttribute('data-fire-phase',f.phase);
    // Treat the wall as artwork, NOT as hundreds of separate collisions.
    // This marked contact line follows the world-space gameplay front f.x.
    // Warm front lighting belongs behind sprites and does not affect physics.
    const glow=ctx.createLinearGradient(front-190,0,front+85,0);
    glow.addColorStop(0,'rgba(255,97,37,0)');
    glow.addColorStop(.64,`rgba(255,120,33,${f.phase==='surge'?.17:.10})`);
    glow.addColorStop(1,'rgba(255,128,40,0)');
    ctx.fillStyle=glow;
    ctx.fillRect(Math.max(0,front-190),28,275,VIEW.ground-28);
  }

  function drawDeath(g,camera){
    if(!g.death) return;
    const screenX=g.x-camera;
    ctx.fillStyle='rgba(7,23,27,.18)';
    ctx.beginPath();ctx.ellipse(screenX,VIEW.ground+3,24,5,0,0,Math.PI*2);ctx.fill();
    for(const p of g.death.pieces){
      ctx.save();
      ctx.translate(screenX+p.x, g.y-29+p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(p.pts[0][0], p.pts[0][1]);
      for(let i=1;i<p.pts.length;i++) ctx.lineTo(p.pts[i][0], p.pts[i][1]);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha=1;
  }

  // Horizontal camera is a world-space translation, not a chase indicator.
  // Let it go negative at the beginning of a run, otherwise the first 325
  // world units would pin the Wisp to the left edge instead of the center.
  const cameraForX = worldX => worldX - VIEW.width / 2;

  function drawGapRescue(g,camera){
    const r=g.gapRescue;
    const progress=r.elapsed/r.duration;
    const travel=smoothstep(progress);
    const startX=r.startX-camera,endX=r.endX-camera;
    ctx.save();
    for(let i=0;i<13;i++){
      const u=travel-i*.045;
      if(u<=0||u>1)continue;
      const px=startX+(endX-startX)*u;
      const py=VIEW.ground-43-34*Math.sin(Math.PI*u);
      ctx.globalAlpha=(1-i/13)*.70;
      ctx.fillStyle=g.stats.color;
      ctx.beginPath();ctx.arc(px,py,2.3+(1-u)*2,0,Math.PI*2);ctx.fill();
    }
    if(progress>.64){
      ctx.globalAlpha=clamp((progress-.64)/.36,0,1);
      ctx.translate(g.x-camera,VIEW.ground-30-15*(1-travel));
      drawImage(g.name,-39,-40,78,78);
    }
    ctx.restore();
  }

  function drawWisp(g,camera) {
    const screenX=g.x-camera;
    ctx.fillStyle='rgba(7,23,27,.31)';ctx.beginPath();ctx.ellipse(screenX,VIEW.ground+2,26,5,0,0,Math.PI*2);ctx.fill();
    const bob=g.grounded ? Math.sin(g.time*11)*2.5 : 0;
    const tilt=g.grounded ? Math.sin(g.time*11)*.025 : -Math.min(.15,Math.abs(g.vy)/1400);
    ctx.save();ctx.translate(screenX,g.y-30+bob);ctx.rotate(tilt);
    drawImage(g.name,-39,-40,78,78);
    ctx.restore();
    if(g.impactCooldown>0) {
      ctx.strokeStyle=`rgba(255,189,128,${.2+.3*Math.sin(g.time*18)**2})`;
      ctx.lineWidth=2;ctx.beginPath();ctx.arc(screenX,g.y-25,27,0,Math.PI*2);ctx.stroke();
    }
  }

  function paint(g) {
    const pixelRatio=Math.min(window.devicePixelRatio||1,2);
    const bounds=canvas.getBoundingClientRect();
    const fit=Math.min(bounds.width/VIEW.width,bounds.height/VIEW.height);
    const dw=Math.max(1,Math.round(bounds.width*pixelRatio));
    const dh=Math.max(1,Math.round(bounds.height*pixelRatio));
    if(canvas.width!==dw || canvas.height!==dh){canvas.width=dw;canvas.height=dh;}
    ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#091e24';ctx.fillRect(0,0,dw,dh);
    const s=fit*pixelRatio;
    ctx.setTransform(s,0,0,s,(dw-VIEW.width*s)/2,(dh-VIEW.height*s)/2);
    sceneryGame=g;
    const soloCamera = cameraForX(g.x);
    const camera = window.WispOnline?.camera?.(g,soloCamera) ?? soloCamera;
    drawBg(camera,g);
    drawProceduralCourse(g,camera);
    drawCutterShadow(g,camera);
    drawWildfire(g,camera);
    if(g.status==='dying' || (g.status==='caught' && g.death)) drawDeath(g,camera);
    else if(g.gapRescue) drawGapRescue(g,camera);
    else drawWisp(g,camera);
    window.WispOnline?.draw?.(ctx,g,camera);
    drawWeather(g);
    sceneryGame=null;
    updateCutterOverlay(g,camera);

  }

  // Only resource and distance are exposed. Pursuer distance is deliberately
  // absent: fire and Cutter artwork convey danger without a numeric hint.
  function updateHud(g) {
    el('distance').textContent=String(Math.round(g.distance));
    el('energyText').textContent=`${g.energy.toFixed(0)}%`;
    el('energyFill').style.width=`${g.energy}%`;
    el('energyFill').parentElement.setAttribute('aria-valuenow',String(Math.round(g.energy)));
    el('energyFill').style.background=g.energy>45?'#9bd477':g.energy>22?'#efbd6f':'#f17b67';
  }

  function beginAction() {
    if (paused || game.status!=='running' || document.getElementById('wisp-menu')?.hidden===false || actionHeld) return;
    actionHeld = true;
    actionDownAt = performance.now();
    gliding = false;
    el('jump').classList.add('down');
    if (!game.auto) jump(game);
  }

  function releaseAction() {
    actionHeld = false;
    gliding = false;
    el('jump')?.classList.remove('down');
  }

  function reset(name,energy,auto=false,noPickups=false,seed=2026) {
    // Internal reset, never directly wired to a public control during an online match.
    releaseAction();
    activeKeys.clear();
    activePointerId=null;
    game=createGame(name,energy,{auto,noPickups,chase:!auto,seed});
    game.isOnlineRun=false;resultAnnounced=false;
    lastCutterAnimation=null;
    updateHud(game);
  }

  function startSolo(name='Moss') {
    if(onlineRoom || !Object.prototype.hasOwnProperty.call(CHARACTERS,name))return false;
    soloChoice=name;
    reset(name,100,false,false,Math.floor(Math.random()*0x7fffffff));
    paused=false;
    return true;
  }

  function startOnline(name,seed) {
    if(!onlineRoom || onlineRace || !Object.prototype.hasOwnProperty.call(CHARACTERS,name) ||
        !Number.isSafeInteger(seed) || seed<0)return false;
    reset(name,100,false,false,seed);
    game.isOnlineRun=true;
    onlineRace=true;
    paused=false;
    return true;
  }

  function setOnlineRoom(active) {
    onlineRoom=Boolean(active);
    if(onlineRoom){paused=true;releaseAction();}
    else onlineRace=false;
  }

  function finishOnline() {
    onlineRace=false;
    paused=true;
    releaseAction();
  }

  function frame(ts) {
    if(!last) last=ts;
    const delta=Math.min((ts-last)/1000,.06);last=ts;
    accumulator=Math.min(accumulator+delta,.18);
    // Holding the same jump button activates glide only while airborne.
    // The physics engine applies glide only when velocity points downward.
    gliding = actionHeld && ts - actionDownAt >= HOLD_TO_GLIDE_MS && !game.grounded && !game.auto;
    if(!paused) {while(accumulator>=FIXED) {step(game,FIXED,{glide:gliding});if(cutterMotion)cutterMotion.update(FIXED);accumulator-=FIXED;}}
    else accumulator=0;
    const fireSvg=el('wildfire-svg');
    if(fireSvg && typeof fireSvg.pauseAnimations==='function' && typeof fireSvg.unpauseAnimations==='function'){
      if(paused && !fireSvg.animationsPaused())fireSvg.pauseAnimations();
      if(!paused && fireSvg.animationsPaused())fireSvg.unpauseAnimations();
    }
    paint(game);updateHud(game);
    if(game.status==='running')resultAnnounced=false;
    else if(!resultAnnounced && !onlineRoom && !game.isOnlineRun &&
      ['caught','failed','passed'].includes(game.status)){
      resultAnnounced=true;
      window.dispatchEvent(new CustomEvent('wisp:solo-finished',{detail:{
        name:game.name,status:game.status,reason:game.reason,deathCause:game.deathCause,
        distance:Math.round(game.distance),seconds:game.time,
        cycles:game.forest?.completed||0
      }}));
    }
    requestAnimationFrame(frame);
  }

  function setup() {
    loadImages();
    game=createGame();
    if(window.WispCutter){cutterMotion=window.WispCutter.setup(el('cutter-svg'));}
    const jumpButton = el('jump');
    jumpButton.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      if (activePointerId !== null) return;
      activePointerId = e.pointerId;
      try { jumpButton.setPointerCapture(e.pointerId); } catch (_) { /* harmless on older WebKit */ }
      beginAction();
    });
    function endPointer(e) {
      if (activePointerId !== e.pointerId) return;
      activePointerId = null;
      if (activeKeys.size === 0) releaseAction();
    }
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => jumpButton.addEventListener(type, endPointer));
    // On mobile the finger may leave the button; a captured pointer remains held
    // until release. Window listeners are a fallback for imperfect iOS capture.
    ['pointerup', 'pointercancel'].forEach(type => window.addEventListener(type, endPointer));

    const jumpKeys = new Set(['Space', 'ArrowUp', 'KeyW']);
    window.addEventListener('keydown', e => {
      // Player names and menu controls take priority over gameplay hotkeys.
      // In particular, W and R must remain typeable in the online lobby.
      if (paused || document.getElementById('wisp-menu')?.hidden === false ||
          e.target?.closest?.('input,textarea,select,[contenteditable]')) return;
      if (jumpKeys.has(e.code)) {
        e.preventDefault();
        if (!e.repeat && !activeKeys.has(e.code)) {
          activeKeys.add(e.code);
          beginAction();
        }
      }
      if (e.code === 'KeyR' && !e.repeat && !onlineRoom && game.status==='caught')startSolo(soloChoice);
    });
    window.addEventListener('keyup', e => {
      if (!jumpKeys.has(e.code)) return;
      e.preventDefault();
      activeKeys.delete(e.code);
      if (activeKeys.size === 0 && activePointerId === null) releaseAction();
    });
    window.addEventListener('blur', () => {
      activeKeys.clear();
      activePointerId = null;
      releaseAction();
    });
    reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
    requestAnimationFrame(frame);
  }

  // The public interface is intentionally small: menus and room transport do not
  // get direct access to developer-only simulation, physics or hazard triggers.
  window.WispGame={
    get current(){return game;},
    get onlineRoom(){return onlineRoom;},
    startSolo,startOnline,setOnlineRoom,finishOnline,cameraForX,
    setPaused(value){paused=Boolean(value);if(paused)releaseAction();}
  };
  // Maintain the original physics harness for local development and automated
  // regression runs, but do not publish its mutating shortcuts on the live site.
  if(['localhost','127.0.0.1',''].includes(location.hostname)){
    // Physics inspection is local-only; browser UI and Cloudflare never use this.
    window.WISP_TEST={createGame,step,jump,courseNear,
      procGapAt,procObstacleRects,stageAt,visualStageAt,treeMixAt,cameraForX,speedFor,CHARACTERS,
      traceGapOpening,maskGroundGaps,ridgeHeight,smoothNoise,sceneryTreeAt,
      updateFire,updateForest,epochAt,stageAtFor,rainIntensity,FIRE_SURVIVAL,
      get current(){return game;}};
  }
  setup();
})();
