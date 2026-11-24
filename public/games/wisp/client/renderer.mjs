import {WIDTH,HEIGHT} from '../core/maze.mjs';
import {view,unview} from './orientation.mjs';
import {drawEffects,drawStatus} from './effects.mjs';
import {drawCharacter} from '../characters.mjs';
const TILE=40;
export function renderer(canvas) {
  const ctx=canvas.getContext('2d');
  const walls=document.createElement('canvas'), wctx=walls.getContext('2d');
  let lastBoard, lastOrientation, lastRatio, bursts=[];
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  function prepare(board,landscape) {
    const ratio=Math.min(2,window.devicePixelRatio||1);
    if(lastBoard===board&&lastOrientation===landscape&&lastRatio===ratio) return;
    if(lastBoard!==board)bursts=[];
    lastBoard=board; lastOrientation=landscape; lastRatio=ratio;
    const width=(landscape?HEIGHT:WIDTH)*TILE, height=(landscape?WIDTH:HEIGHT)*TILE;
    canvas.width=walls.width=Math.round(width*ratio); canvas.height=walls.height=Math.round(height*ratio);
    canvas.style.aspectRatio=`${width}/${height}`;
    canvas.style.setProperty('--board-ratio',String(width/height));
    wctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);
    wctx.fillStyle='#090d19'; wctx.fillRect(0,0,width,height);
    wctx.fillStyle='#20384d';
    board.forEach((row,y)=>row.forEach((v,x)=>{
      if(!v)return; const [u,w]=view(x,y,landscape);
      wctx.fillRect(u*TILE+1,w*TILE+1,TILE-2,TILE-2);
    }));
    ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);
  }
  function cell(x,y,landscape) {return view(x,y,landscape).map(v=>(v+.5)*TILE);}
  function ring(x,y,r,color,width=1.5) {
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
  }
  function draw(s,landscape,previous,alpha,pings,time,localPosition=null,events=[]) {
    prepare(s.board,landscape);
    for(const e of events)if(e.kind==='escape'||e.kind==='shatter')bursts.push({...e,start:time});
    bursts=bursts.filter(e=>time-e.start<650);
    ctx.drawImage(walls,0,0,(landscape?HEIGHT:WIDTH)*TILE,(landscape?WIDTH:HEIGHT)*TILE);
    for(const p of s.pickups) if(p.active) {
      const [x,y]=cell(p.x,p.y,landscape),r=p.value===30?6:p.value===15?4:2;
      ctx.fillStyle='#b5efff';ctx.globalAlpha=.10;ctx.beginPath();ctx.arc(x,y,r+4,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=p.value===5?.65:1;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    }
    if(s.portal) {
      const [x,y]=cell(s.portal.x,s.portal.y,landscape);
      ring(x,y,15+(reduce.matches?0:Math.sin(time/250)*2),'#9fffe0',2);ring(x,y,9,'#e7fff7',2);ring(x,y,19,'#286f66');
    }
    for(const ping of (Array.isArray(pings)?pings:[pings])) if(ping&&time<ping.until) {
      const [x,y]=cell(ping.x,ping.y,landscape);
      ring(x,y,reduce.matches?13:8+((time/300)%1)*12,'#e8f6ff');ring(x,y,5,'#e8f6ff');
    }
    const screen=(x,y)=>cell(x,y,landscape);
    drawEffects(ctx,s,screen,TILE);
    if(!reduce.matches)for(const b of bursts){
      const [x,y]=screen(b.x,b.y),t=(time-b.start)/650;ctx.save();ctx.globalAlpha=1-t;
      if(b.kind==='escape'){ring(x,y,8+t*23,b.color,2);ring(x,y,14+t*26,b.color,1);}
      else {ctx.strokeStyle=b.color;ctx.lineWidth=2;for(let i=0;i<8;i++){const a=i*Math.PI/4;const r=8+t*23;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r);ctx.lineTo(x+Math.cos(a)*(r+5),y+Math.sin(a)*(r+5));ctx.stroke();}}
      ctx.restore();
    }
    for(const d of s.decoys){
      const c=s.actors.find(a=>a.id===d.character),p=previous?.get(d.id)??d;
      const [x,y]=screen(p.x+(d.x-p.x)*alpha,p.y+(d.y-p.y)*alpha);
      drawCharacter(ctx,c,x-24,y-24,48,{energy:d.energy});
    }
    // Draw the local player last, so the marker is always readable.
    const actors=[...s.actors].sort((a,b)=>Number(a.player==='local')-Number(b.player==='local'));
    for(const a of actors) {
      if(a.status!=='active')continue;
      const old=previous?.get(a.id),p=old&&old.warp===a.warp?old:a;
      const predicted=a.player==='local'&&localPosition?.warp===a.warp?localPosition:null;
      const [x,y]=cell(predicted?.x??(p.x+(a.x-p.x)*alpha),predicted?.y??(p.y+(a.y-p.y)*alpha),landscape);
      if(a.player==='local') ring(x,y,18,'#dce9f5',1.3);
      if(s.tick<a.immuneUntil) ring(x,y,15,'#78a6c7',1.3);
      drawStatus(ctx,s,a,x,y,screen,TILE);
      const size=a.faction==='wisp'?48:38;
      drawCharacter(ctx,a,x-size/2,y-size/2,size,{energy:a.energy??100,dim:s.tick<a.recoverUntil,pulse:reduce.matches?1:1+Math.sin(time/400+a.x)*.12});
    }
  }
  function hit(clientX,clientY,landscape) {
    const r=canvas.getBoundingClientRect();
    const x=Math.floor((clientX-r.left)/r.width*(landscape?HEIGHT:WIDTH));
    const y=Math.floor((clientY-r.top)/r.height*(landscape?WIDTH:HEIGHT));
    return unview(x,y,landscape);
  }
  return {draw,hit};
}
