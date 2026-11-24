import {WIDTH,HEIGHT} from '../core/maze.mjs';
import {view,unview} from './orientation.mjs';
import {drawCharacter} from '../characters.mjs';
const TILE=40;
export function renderer(canvas) {
  const ctx=canvas.getContext('2d');
  const walls=document.createElement('canvas'), wctx=walls.getContext('2d');
  let lastBoard, lastOrientation, lastRatio;
  function prepare(board,landscape) {
    const ratio=Math.min(2,window.devicePixelRatio||1);
    if(lastBoard===board&&lastOrientation===landscape&&lastRatio===ratio) return;
    lastBoard=board; lastOrientation=landscape; lastRatio=ratio;
    const width=(landscape?HEIGHT:WIDTH)*TILE, height=(landscape?WIDTH:HEIGHT)*TILE;
    canvas.width=walls.width=Math.round(width*ratio); canvas.height=walls.height=Math.round(height*ratio);
    canvas.style.aspectRatio=`${width}/${height}`;
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
  function draw(s,landscape,previous,alpha,ping,time) {
    prepare(s.board,landscape);
    ctx.drawImage(walls,0,0,(landscape?HEIGHT:WIDTH)*TILE,(landscape?WIDTH:HEIGHT)*TILE);
    for(const p of s.pickups) if(p.active) {
      const [x,y]=cell(p.x,p.y,landscape),r=p.value===30?6:p.value===15?4:2;
      ctx.fillStyle='#b5efff';ctx.globalAlpha=.10;ctx.beginPath();ctx.arc(x,y,r+4,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=p.value===5?.65:1;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    }
    if(s.portal) {
      const [x,y]=cell(s.portal.x,s.portal.y,landscape);
      ring(x,y,15+Math.sin(time/250)*2,'#9fffe0',2);ring(x,y,9,'#e7fff7',2);ring(x,y,19,'#286f66');
    }
    if(ping&&time<ping.until) {
      const [x,y]=cell(ping.x,ping.y,landscape);
      ring(x,y,8+((time/300)%1)*12,'#e8f6ff');ring(x,y,5,'#e8f6ff');
    }
    // Draw the local player last, so the marker is always readable.
    const actors=[...s.actors].sort((a,b)=>Number(a.player==='local')-Number(b.player==='local'));
    for(const a of actors) {
      if(a.status!=='active')continue;
      const p=previous?.get(a.id)??a;
      const [x,y]=cell(p.x+(a.x-p.x)*alpha,p.y+(a.y-p.y)*alpha,landscape);
      if(a.player==='local') ring(x,y,18,'#dce9f5',1.3);
      if(s.tick<a.immuneUntil) ring(x,y,15,'#78a6c7',1.3);
      const size=a.faction==='wisp'?48:38;
      drawCharacter(ctx,a,x-size/2,y-size/2,size,{energy:a.energy??100,dim:s.tick<a.recoverUntil});
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
