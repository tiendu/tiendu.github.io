import {ABILITIES, drainTargets} from '../core/abilities.mjs';
// Effects use canonical coordinates, and never mutate simulation state.
export function drawEffects(ctx,s,cell,tile) {
  const ring=(x,y,r,color,width=1.5)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();};
  const line=(a,b,color,width=2)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();};
  ctx.save();
  for(const b of s.blocks){
    const [x,y]=cell(b.x,b.y),r=tile*.42;
    ctx.fillStyle='#ac65ff25';ctx.fillRect(x-r,y-r,2*r,2*r);
    ctx.strokeStyle='#ac65ff';ctx.lineWidth=2;ctx.strokeRect(x-r,y-r,2*r,2*r);
    for(let i=-1;i<=1;i++)line([x-r,y+i*r*.7],[x+r,y+i*r*.7],'#ac65ff',1.2);
  }
  for(const e of s.effects){
    const [x,y]=cell(e.x,e.y),progress=Math.max(0,Math.min(1,(s.tick-e.start)/(e.until-e.start)));
    ctx.globalAlpha=(1-progress)*.75;
    if(e.kind==='repulse'||e.kind==='stasis'||e.kind==='silence'){
      if(e.kind==='stasis')ctx.setLineDash([3,4]);
      ring(x,y,8+progress*e.range*tile,e.color,2);ring(x,y,5+progress*e.range*tile*.75,e.color,1);
      if(e.kind==='silence'){line([x-10,y-10],[x+10,y+10],e.color,2);}
      ctx.setLineDash([]);
    }else if(e.kind==='phase'){
      ctx.setLineDash([4,4]);line(cell(e.from.x,e.from.y),[x,y],e.color,3);ctx.setLineDash([]);ring(x,y,13+progress*12,e.color);
    }else if(e.kind==='devour'){
      const from=cell(e.from.x,e.from.y),p=[from[0]+(x-from[0])*progress,from[1]+(y-from[1])*progress];
      line(from,p,e.color,1);ctx.fillStyle=e.color;ctx.beginPath();ctx.arc(...p,4,0,Math.PI*2);ctx.fill();
    }else if(e.kind==='lockdown'){
      const p=cell(e.target.x,e.target.y);ring(...p,10+progress*14,e.color,2);
    }else if(e.kind==='echo'){
      // Show the split at its origin, not a persistent marker on the decoy.
      ring(x,y,7+progress*23,e.color,1);
    }else if(e.kind==='surge'||e.kind==='barrier'||e.kind==='lunge'||e.kind==='drain')ring(x,y,10+progress*22,e.color,2);
  }
  ctx.globalAlpha=1;
  for(const a of s.actors){
    if(a.status!=='active')continue;
    const [x,y]=cell(a.x,a.y);
    if(s.tick<a.drainUntil&&s.tick>=a.stunUntil){
      ctx.globalAlpha=.32;ring(x,y,ABILITIES.Leech.range*tile,a.color,1);ctx.globalAlpha=.8;
      for(const w of drainTargets(s,a)){const p=cell(w.x,w.y);ctx.setLineDash([4,5]);line(p,[x,y],a.color,2);ctx.setLineDash([]);}
      ctx.globalAlpha=1;
    }
  }
  ctx.restore();
}
export function drawStatus(ctx,s,a,x,y,cell,tile) {
  const ring=(r,color,width=1.5)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();};
  ctx.save();
  if(s.tick<a.barrierUntil){ring(16,a.color,2.5);ring(20,a.color,.8);}
  if(s.tick<a.slowUntil){ctx.setLineDash([3,3]);ring(16,'#f2e477');ctx.setLineDash([]);}
  if(s.tick<a.silenceUntil){ctx.strokeStyle='#79e59a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-7,y-18);ctx.lineTo(x+7,y-18);ctx.stroke();}
  if(s.tick<a.stunUntil){ctx.fillStyle='#e9fcff';for(const dx of [-7,0,7]){ctx.beginPath();ctx.arc(x+dx,y-17,1.6,0,Math.PI*2);ctx.fill();}}
  if(s.tick<a.surgeUntil||a.lunge){
    const d=a.lunge?.dir??a.dir, p=cell(a.x+d[0],a.y+d[1]),o=cell(a.x,a.y),dx=(p[0]-o[0])/tile,dy=(p[1]-o[1])/tile;
    if(a.lunge&&s.tick<a.lunge.chargeUntil){ctx.strokeStyle=a.color;ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx*tile*.8,y+dy*tile*.8);ctx.stroke();}
    else{ctx.strokeStyle=a.color;ctx.lineWidth=2;for(let i=0;i<3;i++){ctx.globalAlpha=.65-i*.17;ctx.beginPath();ctx.moveTo(x-dx*(14+i*5)-dy*5,y-dy*(14+i*5)+dx*5);ctx.lineTo(x-dx*(22+i*5),y-dy*(22+i*5));ctx.lineTo(x-dx*(14+i*5)+dy*5,y-dy*(14+i*5)-dx*5);ctx.stroke();}}
  }
  ctx.restore();
}
