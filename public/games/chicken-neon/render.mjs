// Canvas presentation only; the engine decides every pickup, collision and disaster.
import {BIRDS,activeDisaster,disasterWarning} from './engine.mjs';
const TWO=Math.PI*2;
function line(c,points,color,width=2){c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
function poly(c,points,color){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
function round(c,x,y,w,h,r,color){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
function glow(c,color,blur=11){c.shadowColor=color;c.shadowBlur=blur;}
function text(c,s,x,y,size=12,color='#d7efff',align='left'){c.font=`700 ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;c.fillStyle=color;c.textAlign=align;c.fillText(s,x,y);c.textAlign='left';}
const palettes=[
 {sky:'#070f23',far:'#162443',near:'#122b42',grid:'#1e5369',accent:'#62dff1',name:'THE GRID'},
 {sky:'#170d26',far:'#362245',near:'#302340',grid:'#774473',accent:'#fd74b8',name:'THE FOUNDRY'},
 {sky:'#1d1020',far:'#382737',near:'#2b283d',grid:'#a75c65',accent:'#ffc16c',name:'THE WASTELAND'},
 {sky:'#090d27',far:'#201a50',near:'#182d58',grid:'#5f4a9a',accent:'#ad9aff',name:'THE FRACTURE'},
];
function background(c,w,h,s,ground,p,dt){
 c.fillStyle=p.sky;c.fillRect(0,0,w,h);
 const view=s.distance;
 const top=ground-190;
 for(let i=0;i<90;i++){
   const x=((i*193.17-view*.07)% (w+80)+w+80)%(w+80);
   const y=21+(i*97)%Math.max(150,ground-200);
   c.globalAlpha=.14+(i%5)*.07;c.fillStyle=i%4===0?p.accent:'#a1abff';c.fillRect(x,y,1.2,1.2);
 }
 c.globalAlpha=1;
 poly(c,[[0,ground],[0,top+70],...Array.from({length:19},(_,i)=>{const x=(i-1)*w/16;return[x,top+Math.sin(x*.009+view*.00022)*28+Math.sin(x*.016+2.4)*16]}),[w,ground]],p.far);
 poly(c,[[0,ground],[0,ground-87],...Array.from({length:22},(_,i)=>{const x=(i-1)*w/19;return[x,ground-85+Math.sin(x*.022+view*.00037)*21]}),[w,ground]],p.near);
 for(let k=0;k<11;k++){
   const x=(k*w/10+(-view*.18)%(w/10)+w/10)%(w+w/10);
   line(c,[[x,ground-97],[x,ground-161]],p.grid,.6);
   line(c,[[x-9,ground-127],[x,ground-142],[x+9,ground-127]],p.grid,.7);
 }
 c.fillStyle='#081426';c.fillRect(0,ground,w,h-ground);
 c.globalAlpha=.36;
 for(let i=1;i<10;i++){
   const t=i/10;
   const y=ground+(h-ground)*Math.pow(t,1.5);
   line(c,[[0,y],[w,y]],p.grid,1);
 }
 for(let i=-1;i<20;i++){
   const x=(i*w/12-view%80*1.4);
   line(c,[[x,ground],[w/2+(x-w/2)*1.45,h]],p.grid,.9);
 }
 c.globalAlpha=1;
 glow(c,p.accent,8);
 line(c,[[0,ground],[w,ground]],p.accent,2.6);
 c.shadowBlur=0;
 const e=activeDisaster(s);
 if(e?.id==='emp'){
   c.globalAlpha=.14+.05*Math.sin(s.elapsed*18);c.fillStyle='#97b8ff';c.fillRect(0,0,w,h);c.globalAlpha=1;
   for(let i=0;i<5;i++){
     let x=(i*223+s.elapsed*160)%w;
     line(c,[[x,0],[x-16,50],[x+9,79],[x-2,125]],'#b6e0ff',1.6);
   }
 }else if(e?.id==='gravity'){
   for(let i=0;i<7;i++){c.strokeStyle='#ad9aff77';c.lineWidth=1;c.beginPath();c.ellipse(w*(i+.5)/7,ground-140+Math.sin(s.elapsed*2+i)*17,35,13,0,0,TWO);c.stroke();}
 }
 text(c,p.name,w-22,27,11,p.accent,'right');
}
function hazard(c,h,x,ground,s,p){
 const y=ground;const flash=(Math.sin(s.elapsed*9+h.phase)+1)/2;
 switch(h.type){
 case 'barrier':
   glow(c,'#ff65b3',14);round(c,x,y-60,Math.max(h.width,12),60,3,'#4d254c');
   c.strokeStyle='#ff70c0';c.lineWidth=3;c.strokeRect(x+3,y-57,h.width-6,54);
   line(c,[[x+7,y-12],[x+h.width-7,y-50]],'#ff92d1',2);c.shadowBlur=0;break;
 case 'gap':
   c.fillStyle=p.sky;c.fillRect(x,ground-3,h.width,Math.max(110,ground*.3));
   glow(c,'#ff649a',10);
   line(c,[[x-1,ground],[x-1,ground+15]],'#ff6397',3);
   line(c,[[x+h.width+1,ground],[x+h.width+1,ground+15]],'#ff6397',3);c.shadowBlur=0;
   for(let i=0;i<5;i++)line(c,[[x+i*h.width/5,ground+17],[x+10+i*h.width/5,ground+28]],'#ab3d8f',.9);
   break;
 case 'corrupt':
   c.fillStyle='#6d336877';c.fillRect(x,ground-5,h.width,9);
   glow(c,'#b46aff',7);line(c,[[x,ground-4],[x+18,ground-9],[x+36,ground-4],[x+52,ground-13],[x+h.width,ground-4]],'#b77aff',2.8);c.shadowBlur=0;
   break;
 case 'beam':
   glow(c,'#79edff',7);round(c,x,y-113,h.width,43,4,'#19384a');
   line(c,[[x,y-73],[x+h.width,y-73]],'#7cf5ff',3);
   for(let i=12;i<h.width;i+=18)line(c,[[x+i,y-111],[x+i-12,y-73]],'#43aac0',1.5);c.shadowBlur=0;break;
 case 'crusher':{
   const active=Math.sin(s.elapsed*3.8+h.phase)>-.1;
   const height=active?81:34;
   glow(c,active?'#ff638d':'#6ce3fa',9);round(c,x,y-height,h.width,height,4,'#39435b');
   c.strokeStyle=active?'#ff638d':'#6ce3fa';c.lineWidth=3;c.strokeRect(x+2,y-height+2,h.width-4,height-4);
   for(let j=0;j<3;j++)line(c,[[x+5+j*12,y-height+8],[x+11+j*12,y-height+17]],'#f9b3c3',1.5);
   c.shadowBlur=0;break;
 }
 case 'coyote':
   c.save();c.translate(x,ground-15);c.globalAlpha=.8+flash*.2;
   poly(c,[[-10,-3],[5,-22],[21,-31],[39,-22],[47,-5],[28,0],[17,-7],[8,3]],'#723952');
   line(c,[[5,-22],[21,-31],[39,-22]],'#ff73ad',2.5);
   line(c,[[16,-4],[10,10],[25,1],[34,10]],'#ff73ad',2);
   c.fillStyle='#ffe5a7';c.fillRect(36,-19,3,3);c.restore();break;
 case 'eagle':
   c.save();c.translate(x+28,ground-117+Math.sin(s.elapsed*4+h.phase)*7);
   poly(c,[[-48,9],[-21,-5],[-10,2],[0,-13],[13,-1],[46,-8],[27,12],[4,9],[-3,22],[-11,9]],'#553658');
   line(c,[[-48,9],[-21,-5],[-10,2],[0,-13],[13,-1],[46,-8]],'#ed79bf',2.5);
   c.fillStyle='#ffd98f';c.fillRect(6,0,3,3);c.restore();
   c.strokeStyle='#ed79bf55';c.lineWidth=2;c.beginPath();c.ellipse(x+27,ground-2,26,5,0,0,TWO);c.stroke();break;
 case 'plasma':
   c.fillStyle='#ff6b8070';c.fillRect(x,ground-7,h.width,7);
   glow(c,'#ff8a66',11);line(c,[[x,ground-9],[x+h.width,ground-9]],'#ff8a66',3);
   if(Math.sin(s.elapsed*5+h.phase)>-.25){
     for(let i=0;i<3;i++){
       const xx=x+12+i*24;poly(c,[[xx-6,ground-190],[xx+3,ground-190],[xx+12,ground-12],[xx-3,ground-12]],'#fa8547af');
     }
   }
   c.shadowBlur=0;break;
 }
}
export function paintBird(c,x,ground,bird,s,{small=false}={}){
 const t=s.elapsed;
 const run=s.grounded?Math.sin(t*(s.speed/22))*5:1;
 const size=small?1.36:1;
 const breathe=Math.sin(t*8)*1.5;
 c.save();c.translate(x,ground+s.y-breathe);c.scale(size,size);
 // Horizontal speed streaks and tiny running feet.
 if(s.alive&&s.grounded){
   c.globalAlpha=.55;line(c,[[-51,-16],[-29,-16]],bird.color,1.8);
   line(c,[[-62,-8],[-40,-8]],bird.color,1);c.globalAlpha=1;
 }
 c.strokeStyle='#131c2b';c.lineWidth=3;c.lineCap='round';
 line(c,[[-9,-5],[-17+run,5]],'#f4ae7f',3.6);
 line(c,[[12,-6],[19-run,5]],'#f4ae7f',3.6);
 // Jetpack mounted behind the torso (left side).
 glow(c,bird.color,10);
 round(c,-39,-44,16,30,5,'#1c2940');
 round(c,-35,-40,8,23,3,bird.color);
 c.shadowBlur=0;
 const firing=s.boostPulse>0;
 if(firing){
   glow(c,'#73f3ff',13);
   poly(c,[[-35,-14],[-27,-14],[-29,15+Math.sin(t*60)*5],[-34,7]],'#7cf0ff');c.shadowBlur=0;
 }
 // Tail silhouette and unique body outlines.
 poly(c,[[-24,-31],[-42,-45],[-38,-26],[-43,-17],[-20,-17]],bird.shell);
 let rx=24,ry=24,cy=-30;
 if(bird.shape==='round'){rx=28;ry=28;cy=-31;}
 if(bird.shape==='chick'){rx=20;ry=20;cy=-25;}
 if(bird.shape==='rooster'){rx=24;ry=25;cy=-31;}
 c.fillStyle=bird.shell;c.beginPath();c.ellipse(0,cy,rx,ry,0,0,TWO);c.fill();
 c.strokeStyle='#0a1729';c.lineWidth=2;c.stroke();
 // Suit panels curve around original plumage instead of replacing it.
 c.strokeStyle=bird.color;c.lineWidth=3.4;glow(c,bird.color,7);
 c.beginPath();c.arc(-1,cy,rx-5,-2.2,.8);c.stroke();c.shadowBlur=0;
 round(c,-14,cy-4,26,13,6,'#162538');
 line(c,[[-11,cy+3],[11,cy+3]],bird.color,2);
 // Wing armor / racing insignia.
 poly(c,[[-16,cy+3],[-5,cy-7],[12,cy+2],[1,cy+16],[-10,cy+12]],'#293952');
 line(c,[[-10,cy+5],[5,cy+6]],bird.color,2.3);
 // Comb and face must remain immediately recognizable as chicken.
 if(bird.shape==='rooster')poly(c,[[4,cy-ry+5],[0,cy-ry-10],[10,cy-ry-6],[15,cy-ry-15],[20,cy-ry+4]],'#ff735f');
 else if(bird.shape==='bantam')poly(c,[[9,cy-ry+5],[7,cy-ry-10],[16,cy-ry-3],[23,cy-ry+5]],'#eab0ff');
 else if(bird.shape==='chick')poly(c,[[7,cy-ry+7],[8,cy-ry-8],[17,cy-ry+5]],'#ffd267');
 else poly(c,[[8,cy-ry+6],[7,cy-ry-7],[15,cy-ry+1],[20,cy-ry+7]],'#ff8f83');
 // Open-face curved visor, eye, and beak.
 round(c,11,cy-11,17,17,6,'#0c2231');
 line(c,[[12,cy-9],[26,cy-9]],bird.color,2.7);
 c.fillStyle='#f5fbff';c.beginPath();c.arc(21,cy-3,3,0,TWO);c.fill();
 poly(c,[[25,cy+6],[39,cy+11],[26,cy+14]],'#ffbb6a');
 if(s.fuel<25){c.globalAlpha=.5+.5*Math.sin(t*13);c.fillStyle='#ff637b';c.fillRect(-9,cy+1,7,3);c.globalAlpha=1;}
 c.restore();
}
function paintFox(c,x,ground,p){
 c.save();c.translate(x,ground-9);
 poly(c,[[-34,-8],[-47,-26],[-29,-19],[-15,-37],[4,-37],[21,-24],[27,-10],[8,-4],[-9,-10]],'#70384b');
 line(c,[[-36,-8],[-15,-37],[4,-37],[21,-24]],'#ff7095',2.3);
 line(c,[[-21,-4],[-27,6],[-3,-5],[2,7]],'#f07c9b',2);
 c.fillStyle='#fff1ae';c.fillRect(16,-27,3,3);c.restore();
}
export function draw(c,s,{width,height,dpr=1}={}){
 const w=width||c.canvas.width,h=height||c.canvas.height;
 const logicalW=w<560?590:w<900?790:Math.max(960,Math.min(1240,w));
 const scale=w/logicalW, logicalH=h/scale, ground=logicalH*(w<560?.62:.71);
 c.save();c.setTransform(dpr*scale,0,0,dpr*scale,0,0);
 const p=palettes[Math.floor(s.distance/4200)%palettes.length];
 background(c,logicalW,logicalH,s,ground,p);
 const playerX=logicalW*.24;
 const screenX=world=>playerX+(world-s.distance);
 for(const corn of s.corn){
   const x=screenX(corn.x);if(x<-10||x>logicalW+10)continue;
   const y=ground+corn.y+Math.sin(s.elapsed*4+corn.x*.08)*2;
   glow(c,'#ffe169',10);round(c,x-4,y-7,8,14,3,'#ffd16a');
   round(c,x-1,y-5,2,9,1,'#fff1c4');c.shadowBlur=0;
 }
 for(const h of s.hazards){const x=screenX(h.x);if(x>logicalW+130||x+h.width<-130)continue;
   hazard(c,h,x,ground,s,p);
 }
 const fx=playerX-114+s.fox*104;
 if(w<560){c.save();c.translate(fx,ground);c.scale(1.2,1.2);paintFox(c,0,0,p);c.restore();}
 else paintFox(c,fx,ground,p);
 paintBird(c,playerX,ground,BIRDS[s.bird],s,{small:w<560});
 // Distance-progress markers glide under the runner.
 for(let n=Math.floor(s.distance/160);n*160<s.distance+logicalW;n++){
   const x=screenX(n*160);if(x>0&&x<logicalW)text(c,String(n*160).padStart(4,'0'),x,ground+28,9,'#3c8a9a');
 }
 const warning=disasterWarning(s);
 if(warning){
   c.fillStyle=activeDisaster(s)?'#552239cc':'#372338cc';round(c,logicalW/2-160,38,320,36,8,c.fillStyle);
   text(c,warning.label,logicalW/2,61,16,'#ff96b8','center');
 }
 // HUD arrows warn when threats are within ~2.6 seconds, even on portrait screens.
 const incoming=s.hazards.find(h=>h.type!=='corrupt'&&h.x>s.distance+50&&h.x-s.distance<s.speed*2.6);
 if(incoming){
   const sec=(incoming.x-s.distance)/Math.max(1,s.speed);
   text(c,`AHEAD: ${incoming.type.toUpperCase()}  ${sec.toFixed(1)}s`,logicalW-16,logicalH-35,13,'#ffbd8f','right');
 }
 if(!s.alive){
   c.fillStyle='#090e20a6';c.fillRect(0,0,logicalW,logicalH);
   text(c,'SIGNAL LOST',logicalW/2,ground-84,42,'#ff7e9a','center');
   text(c,s.reason.toUpperCase(),logicalW/2,ground-47,15,'#ffdbb6','center');
 }
 c.restore();
}
