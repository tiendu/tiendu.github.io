/* WISP — deterministic procedural obstacle library.
 * Stage art remains SVG; collision geometry stays in game physics.
 * No random choices depend on render order or frame rate.
 */
(function (global) {
  'use strict';
  const CHUNK = 1040;
  const POOLS = [
    [{type:'root',weight:4},{type:'short-log',weight:4},{type:'mossy-trunk',weight:3}],
    [{type:'stump',weight:2},{type:'forked-trunk',weight:4},{type:'falling-tree',weight:3},{type:'falling-timber',weight:3}],
    [{type:'timber-stack',weight:3},{type:'rolling-log',weight:3},{type:'erosion-gap',weight:3},{type:'falling-timber',weight:2}],
    [{type:'burning-log',weight:3},{type:'ash-patch',weight:3},{type:'charred-tree',weight:3},{type:'erosion-gap',weight:3}]
  ];
  const NAMES = ['Living','Disturbed','Logged','Burnt'];
  const hash = (seed,index,salt) => {
    let h = (seed|0) ^ Math.imul(index+719,0x9e3779b1) ^ Math.imul(salt+61,0x85ebca6b);
    h = Math.imul(h ^ (h>>>16),0x7feb352d);h = Math.imul(h ^ (h>>>15),0x846ca68b);
    return ((h^(h>>>16))>>>0)/4294967296;
  };
  function choose(list,t){
    let total=0;for(const v of list)total+=v.weight;
    let target=t*total;
    for(const v of list){target-=v.weight;if(target<0)return v.type;}
    return list[list.length-1].type;
  }
  const CACHE=new Map();
  // A rest chunk appears periodically even late in the race. Two-hazard recipes
  // are intentionally restricted to tested combinations, never arbitrary pairs.
  const SECONDARY={
    0: {'root':['short-log'], 'short-log':['root']},
    1: {'stump':['short-log','falling-timber'], 'falling-timber':['stump','short-log']},
    2: {'timber-stack':['rolling-log','short-log'], 'rolling-log':['timber-stack','short-log'],
        'falling-timber':['rolling-log','timber-stack'], 'erosion-gap':['short-log']},
    3: {'burning-log':['ash-patch','short-log'], 'ash-patch':['burning-log','short-log'],
        'erosion-gap':['burning-log'], 'charred-tree':['ash-patch']}
  };
  function intensity(index,stage){
    // Four-stage ramp with a gentle late-game increase, bounded for fairness.
    const biome=[.10,.34,.53,.65][stage];
    const progress=Math.min(.15,Math.max(0,index-3)*.009);
    return Math.min(.78,biome+progress);
  }
  const SPACING=[380,375,420,390];
  function combined(seed,index,primary){
    if(index===0 || index%7===6 || !SECONDARY[primary.stage][primary.type])return null;
    if(hash(seed,index,13)>=intensity(index,primary.stage))return null;
    const options=SECONDARY[primary.stage][primary.type];
    const type=options[Math.floor(hash(seed,index,14)*options.length)];
    const width={root:30,'short-log':40,stump:34,'falling-timber':88,
      'rolling-log':35,'timber-stack':52,'burning-log':43,'ash-patch':96}[type];
    const height={root:17,'short-log':21,stump:22,'falling-timber':27,
      'rolling-log':21,'timber-stack':75,'burning-log':22,'ash-patch':6}[type];
    const offset=(primary.type==='timber-stack'?445:SPACING[primary.stage])+(hash(seed,index,15)-.5)*20;
    const x=primary.x+offset;
    if(x+width>=primary.base+CHUNK-105)return null;
    const firstClear=primary.x+primary.width;
    // Enforce room to LAND and reset jumps between hazards, including gaps.
    if(x-firstClear<165)return null;
    const id=`${seed}:${index}:b`;
    return {id,index,base:primary.base,type,stage:primary.stage,stageName:NAMES[primary.stage],
      x,width,height,branches:[],combo:true,
      orbs:hash(seed,index,42)<.24?[{id:`${index}:combo`,x:x+width+65,y:345,kind:'common',amount:10}]:[]};
  }

  function make(seed,index,stageAt){
    const cacheKey=`${seed|0}:${index}`;
    if(CACHE.has(cacheKey))return CACHE.get(cacheKey);
    const base=index*CHUNK;
    const s=stageAt(base+420);
    const stage=hash(seed,index,1)<s.t?s.b:s.a;
    const type=choose(POOLS[stage],hash(seed,index,2));
    const drift=(hash(seed,index,3)-.5)*42;
    let x=base+390+drift, width=46, height=25;
    if(type==='mossy-trunk'||type==='forked-trunk'){x=base+(index===0?365:218)+drift;width=640;height=41;}
    if(type==='stump'){width=34;height=22;}
    if(type==='root'){width=30;height=17;}
    if(type==='short-log'){width=40;height=21;}
    if(type==='timber-stack'){width=52;height=75;}
    if(type==='rolling-log'){width=35;height=21;}
    if(type==='burning-log'){width=43;height=22;}
    if(type==='ash-patch'){width=96;height=6;}
    if(type==='erosion-gap'){x=base+452+drift;width=110+Math.round(hash(seed,index,9)*14);height=0;}
    if(type==='falling-tree'||type==='charred-tree'){width=175;height=24;}
    if(type==='falling-timber'){width=88;height=27;}
    const branches= type==='forked-trunk' ? [
      {id:`${index}:short`,x1:x+199,x2:x+218,top:298,bottom:339,kind:'short branch'},
      {id:`${index}:fork`,x1:x+439,x2:x+472,top:267,bottom:339,kind:'tall fork'}
    ] : type==='mossy-trunk' ? [
      {id:`${index}:sprout-a`,x1:x+199,x2:x+214,top:320,bottom:339,kind:'sprout'},
      {id:`${index}:sprout-b`,x1:x+439,x2:x+452,top:324,bottom:339,kind:'sprout'}
    ] : [];
    // The essence economy is deliberately slightly negative even for Moss.
    // A perfect player needs the occasional high, risky Greater Essence to
    // compensate for skipped common pickups and environmental mistakes.
    const orbs=[];
    const commonChance=[.82,.76,.70,.65][stage];
    if(hash(seed,index,6)<commonChance){
      // Place the baseline +10 pickup on a reliably reachable safe section.
      orbs.push({id:`${index}:common`,x:base+147+hash(seed,index,31)*36,
        y:345,kind:'common',amount:10});
    }
    // Rare +25 rewards live above the obstacle, never freely on flat ground.
    if(hash(seed,index,7)<.29){
      const trunk=type==='mossy-trunk'||type==='forked-trunk';
      const height=type==='erosion-gap'?294:type==='timber-stack'?261:trunk?225:259;
      const ox=trunk?x+416:type==='erosion-gap'?x+width*.50:x+width*.58;
      orbs.push({id:`${index}:greater`,x:ox,y:height,kind:'greater',amount:25});
    }
    // Platform pickups are occasional and elevated rather than automatic.
    if((type==='mossy-trunk'||type==='forked-trunk')&&hash(seed,index,8)<.30){
      orbs.push({id:`${index}:platform`,x:x+125,y:296,kind:'common',amount:10});
    }
    const made={id:`${seed}:${index}`,index,base,type,stage,stageName:NAMES[stage],x,width,height,branches,orbs,combo:false};
    made.second=combined(seed,index,made);
    if(CACHE.size>500)CACHE.delete(CACHE.keys().next().value);
    CACHE.set(cacheKey,made);
    return made;
  }
  function nearby(seed,x,stageAt,behind=0,ahead=0){
    const first=Math.max(0,Math.floor((x-behind)/CHUNK));
    const last=Math.max(first,Math.floor((x+ahead)/CHUNK));
    const found=[];
    for(let index=first;index<=last;index++){
      const main=make(seed,index,stageAt);
      found.push(main);
      if(main.second)found.push(main.second);
    }
    return found;
  }
  global.WispCourse={CHUNK,POOLS,NAMES,hash,make,nearby,intensity};
})(typeof window!=='undefined'?window:this);
