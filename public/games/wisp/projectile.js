/* WISP thrown timber. Deterministic per course seed, simulated at fixed timesteps.
 * These are world-space projectiles, not scripted high/low drop patterns. */
(function(global){
  'use strict';
  const GRAVITY=980;
  const bounds=(angle,width,height)=>({
    rx:(Math.abs(Math.cos(angle))*width+Math.abs(Math.sin(angle))*height)/2,
    ry:(Math.abs(Math.sin(angle))*width+Math.abs(Math.cos(angle))*height)/2
  });
  function newLog(seed,h,playerSpeed,ground,hash){
    const r=salt=>hash(seed,h.index,salt+(h.combo?100:0));
    const width=h.width, height=h.height;
    // Timber is flung forward by machinery offscreen; angles and rebounds vary.
    const vx=118+r(61)*142;
    const vy=-(45+r(62)*125);
    const y=ground-(154+r(63)*92);
    const targetX=h.x+(r(64)-.5)*145;
    const fallDistance=ground-height/2-y;
    const flightTime=(-vy+Math.sqrt(vy*vy+2*GRAVITY*fallDistance))/GRAVITY;
    // Estimate arrival, once at launch; the log never adjusts its trajectory to chase a wisp.
    const reaction=.95+r(65)*.50;
    const triggerX=targetX-Math.max(145,playerSpeed*(flightTime+reaction));
    return {
      phase:'waiting', x:targetX-vx*flightTime, y,
      vx,vy, angle:(r(66)-.5)*.5, spin:(r(67)<.5?-1:1)*(2.7+r(68)*6.2),
      restitution:.36+r(69)*.34, friction:.65+r(70)*.23,
      drag:.85+r(71)*.8, width,height, triggerX,targetX,
      flightTime, bounces:0, elapsed:0, impactAge:999,
    };
  }
  function advance(d,dt,ground){
    if(d.phase==='waiting'||d.phase==='settled')return;
    d.elapsed+=dt;
    d.impactAge+=dt;
    if(d.phase==='rolling'){
      d.x+=d.vx*dt;
      d.vx*=Math.exp(-d.drag*dt);
      // Once it lands, the trunk rolls along its axis rather than cartwheeling forever.
      d.angle*=Math.exp(-8*dt);
      d.y=ground-bounds(d.angle,d.width,d.height).ry;
      if(Math.abs(d.vx)<13){
        d.phase='settled';d.vx=0;d.vy=0;
        d.angle=0;d.y=ground-d.height/2;
      }
      return;
    }
    d.vy+=GRAVITY*dt;
    d.x+=d.vx*dt;
    d.y+=d.vy*dt;
    d.angle+=d.spin*dt;
    const floor=ground-bounds(d.angle,d.width,d.height).ry;
    if(d.y>=floor){
      d.y=floor;
      const incoming=d.vy;
      d.bounces++;
      d.impactAge=0;
      d.vx*=d.friction;
      d.spin*=.65;
      d.vy=-incoming*d.restitution;
      // Count emerges from restitution and impact velocity, never a scripted bounce pattern.
      if(Math.abs(d.vy)<83 || d.bounces>=7){
        d.phase='rolling';d.vy=0;
        d.angle=Math.sin(d.angle)*.22; // impact turns the trunk onto its side
        d.y=ground-bounds(d.angle,d.width,d.height).ry;
      }else d.phase='bouncing';
    }
  }
  function collider(d){
    if(!d||d.phase==='waiting')return null;
    const b=bounds(d.angle,d.width,d.height);
    // Faceted silhouettes are narrower than their rotated bounding rectangles.
    return {x1:d.x-b.rx*.89,x2:d.x+b.rx*.89,
      top:d.y-b.ry*.88,bottom:d.y+b.ry*.88,kind:'flying timber'};
  }
  global.WispProjectiles={newLog,advance,collider,bounds};
})(typeof window!=='undefined'?window:this);
