/* Test-only scripted obstacle driver. Not loaded by WISP's published HTML. */
(function(global){
  'use strict';
  // A physics-only oracle for regression tests: search for *possible* one-button
  // timings using the real projectile trajectory. No game client ships this code.
  function safeTimings(g, d, v, G, ground, actions, hold=false, horizon=6.5){
    const projectile=global.WispProjectiles;
    const flight={...d};
    let y=g.y, vy=g.vy, grounded=g.grounded, jumps=g.jumps;
    let index=0, t=0;
    const dt=1/120;
    let x=g.x,energy=g.energy;
    for(let i=0;i<Math.ceil(horizon/dt);i++){
      while(index<actions.length && actions[index]<=t+.00001){
        if(jumps<2){
          if(grounded){vy=-Math.sqrt(2*G*70*g.stats.jump);jumps=1;}
          else{vy=-Math.sqrt(2*G*77*g.stats.jump);jumps=2;}
          grounded=false;
        }
        index++;
      }
      t+=dt;
      projectile.advance(flight,dt,ground);
      if(!grounded){
        vy=Math.min(vy+(hold&&vy>0?G*.29:G)*dt,hold&&vy>0?165:720);y+=vy*dt;
        if(y>=ground){y=ground;vy=0;grounded=true;jumps=0;}
      }
      const factor=energy>=50?1:energy>=25?.80+.20*(energy-25)/25:.55+.25*energy/25;
      const currentSpeed=235*g.stats.speed*factor;
      x+=currentSpeed*dt;energy=Math.max(0,energy-currentSpeed*dt*g.stats.drain/1000);
      const box=projectile.collider(flight);
      if(box && x+19>box.x1 && x-19<box.x2 && y+6>box.top && y-38<box.bottom)return false;
      if(x>flight.x+flight.width/2+34 && flight.vx <v)return true;
    }
    return true;
  }
  function findTimings(g,d,v,G,ground){
    const possible=[];
    for(let a=0;a<5.8;a+=.075)possible.push(Math.round(a*1000)/1000);
    // Try ordinary jumps first; hold-to-glide is a legal fallback for long rolling hazards.
    for(const hold of [false,true]){
      if(safeTimings(g,d,v,G,ground,[],hold))return {times:[],hold};
      for(const a of possible){
        if(safeTimings(g,d,v,G,ground,[a],hold))return {times:[a],hold};
      }
      for(const a of possible){
        for(let b=a+.15;b<=a+.72;b+=.095){
          const second=Math.round(b*1000)/1000;
          if(safeTimings(g,d,v,G,ground,[a,second],hold))return {times:[a,second],hold};
        }
      }
    }
    return {times:null,hold:false};
  }
  function control(g,{speedFor,courseNear,jump,G,ground}){
    const v=speedFor(g);
    // Choose one legal one-button path when this seeded projectile launches.
    // Its arc/bounces are immutable; the path only controls when to jump.
    const catapults=[...g.hazardStates.entries()]
      .filter(([,d])=>d.width && d.phase!=='waiting' && d.x>g.x-110 && d.x<g.x+650)
      .sort((a,b)=>a[1].triggerX-b[1].triggerX);
    if(catapults.length){
      const [id,log]=catapults[0];
      if(g._projectilePlan?.id!==id){
        g._projectilePlan={id,at:g.time,...findTimings(g,log,v,G,ground),index:0};
      }
      const plan=g._projectilePlan;
      if(plan.times){
        while(plan.index<plan.times.length && g.time-plan.at>=plan.times[plan.index]){
          jump(g);plan.index++;
        }
      }
      if(log.x>g.x-90)return; // leave the tested projectile's safe action schedule alone
      g._projectilePlan=null;
    }else g._projectilePlan=null;
    const candidates=courseNear(g,g.x,50,900);
    const h=candidates.find(h=>h.x+h.width>=g.x-14 && h.x>g.x-780);
    if(!h)return;
    if(g.procPlan!==h.id){g.procPlan=h.id;g.procPlanType=h.type;g.procPlanStep=0;g.procPlanX=0;}
    const takeoff=(when)=>{if(g.grounded && g.x>=when && g.x<=when+32){if(jump(g)){g.procPlanStep++;g.procPlanX=g.x;return true;}}return false;};
    if(h.type==='forked-trunk'||h.type==='mossy-trunk'){
      if(g.procPlanStep===0){takeoff(h.x-14-v*.38);return;}
      if(g.procPlanStep===1){takeoff(h.x+199-14-v*.19);return;}
      if(g.procPlanStep===2){takeoff(h.x+439-14-v*(h.type==='mossy-trunk'?.19:.45));return;}
      if(h.type==='forked-trunk' && g.procPlanStep===3 && !g.grounded && g.jumps===1 && g.x-g.procPlanX>=v*.22){if(jump(g))g.procPlanStep=4;}
      return;
    }
    if(h.type==='erosion-gap'){
      const threshold=h.x-18-v*.095;
      if(g.procPlanStep===0){takeoff(threshold);return;}
      if(g.procPlanStep===1 && !g.grounded && g.jumps===1 && g.x-g.procPlanX>=v*.18){if(jump(g))g.procPlanStep=2;}
      return;
    }
    if(h.type==='falling-timber')return;
    if(h.type==='falling-tree'||h.type==='charred-tree'){
      const d=g.hazardStates.get(h.id);
      if(!d || d.phase==='waiting' || d.phase==='warning')return; // do not jump INTO airborne timber
      if(d.phase==='falling'&&d.y<ground-60)return;
      // A fallen tree persists as a long, landable trunk, not an oversized short-log hitbox.
      if((h.type==='falling-tree'||h.type==='charred-tree') && d.phase==='landed'){
        if(g.procPlanStep===0)takeoff(h.x+18-14-v*.38);
        return;
      }
    }
    const actualX=h.type==='rolling-log'?(g.hazardStates.get(h.id)?.x??h.x):h.x;
    const width=h.width;
    // Analytically center the first jump's clearance window around the hazard.
    // This uses Moss's actual jump impulse and current energy-dependent speed.
    const relV=h.type==='rolling-log'?v+34:v;
    const hgt=Math.min(65,h.height+3);
    const impulse=Math.sqrt(2*G*70*g.stats.jump);
    const disc=Math.sqrt(Math.max(0,impulse*impulse-2*G*hgt));
    const enter=(impulse-disc)/G + .018;
    const exit=(impulse+disc)/G - .018;
    const earliest=actualX+width+13-relV*exit;
    const latest=actualX-13-relV*enter;
    const takeoffX=(earliest+latest)/2;
    const before=h.type==='timber-stack'?Math.max(78,v*.57) : h.type==='falling-timber'?64 : h.type==='ash-patch'?56 : actualX-takeoffX;
    if(g.procPlanStep===0){takeoff(actualX-before);return;}
    if((h.type==='timber-stack'||h.type==='falling-timber'||h.type==='ash-patch')&&g.procPlanStep===1 && !g.grounded && g.jumps===1 && g.x-g.procPlanX>=v*.23){if(jump(g))g.procPlanStep=2;}
  }
  function finish(g){
    if(!g.procEndX || g.x<g.procEndX)return;
    g.status=g.impacts===0&&g.rescues===0?'passed':'failed';
    g.reason=g.status==='passed'?'Cleared procedural course without impacts or rescues.':'Benchmark detected collision or gap rescue.';
  }
  global.WispBenchmark={control,finish};
})(typeof window!=='undefined'?window:this);
