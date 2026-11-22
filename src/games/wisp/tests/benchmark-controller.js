/* Test-only scripted obstacle driver. Not loaded by WISP's published HTML. */
(function(global){
  'use strict';
  function control(g,{speedFor,courseNear,jump,G,ground}){
    const v=speedFor(g);
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
    if(h.type==='falling-timber'||h.type==='falling-tree'||h.type==='charred-tree'){
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
