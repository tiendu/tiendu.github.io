// Stable 2D Canvas renderer for the mechanical cube. In particular, iOS
// browsers should not repeatedly reconstruct filtered inline SVGs every frame.
// Uses the same 3D hinge geometry as fold.mjs, projected from directly above.
import { foldedFaces } from '../fold.mjs';

const add=(a,b)=>a.map((v,i)=>v+b[i]);
const mul=(a,n)=>a.map(v=>v*n);
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const blend=(a,b,t)=>{
  if(!b)return a;
  const ch=n=>Math.round(parseInt(a.slice(n,n+2),16)*(1-t)+parseInt(b.slice(n,n+2),16)*t).toString(16).padStart(2,'0');
  return `#${ch(1)}${ch(3)}${ch(5)}`;
};
const armor=['#5b493b','#67503c','#54463b','#5b4b40','#59493c','#67503f'];
const lining=['#56625c','#4e605c','#596660','#51615a','#52615e','#58665f'];
// The same battered iron shell is used by every player. Only the inside
// takes a player colour; metal ribs and hinge pins remain unpainted.
const PANEL_SCALE=.87; // ~13% smaller than one grid socket; leaves room for catches.
const rust=['#87492e','#a45a32','#6b3627','#b46c3c','#713f2d','#986037'];
function position(f,x,y,off=0){
  return add(add(add(f.center,mul(f.u,x*PANEL_SCALE)),mul(f.v,y*PANEL_SCALE)),mul(f.normal,off));
}
function paintPoly(ctx,points,fill,stroke=null,width=.025){
  if(points.length<3)return;
  ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
  for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);
  ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}
function quad(ctx,f,corners,fill,off=0,stroke=null,width=.025){
  paintPoly(ctx,corners.map(([x,y])=>position(f,x,y,off)),fill,stroke,width);
}
function rect(ctx,f,x1,y1,x2,y2,fill,off=0){
  quad(ctx,f,[[x1,y1],[x2,y1],[x2,y2],[x1,y2]],fill,off);
}
function stroke(ctx,points,color,width,alpha=1){
  ctx.save();ctx.globalAlpha*=alpha;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
  for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='square';ctx.stroke();ctx.restore();
}
function line(ctx,f,a,b,color,width,alpha=1,off=0){
  stroke(ctx,[position(f,a[0],a[1],off),position(f,b[0],b[1],off)],color,width,alpha);
}
function hinge(ctx,f){
  if(!f.hinge)return;
  const [a,b]=f.hinge,normal=mul(f.normal,.065),axis=b.map((v,i)=>v-a[i]);
  // A thick retaining strap bridges the deliberately inset plate rim to the
  // real shared hinge axis at the edge of the original, full-sized cube net.
  const midpoint=mul(add(a,b),.5);
  const saddle=add(midpoint,mul(add(f.center,mul(midpoint,-1)),.13));
  stroke(ctx,[saddle,midpoint],'#171f1b',.22);
  stroke(ctx,[saddle,midpoint],'#be965f',.105);
  stroke(ctx,[a,b],'#101814',.18);
  stroke(ctx,[add(a,normal),add(b,normal)],'#805c37',.14);
  stroke(ctx,[add(a,normal),add(b,normal)],'#d7aa62',.055);
  // Hinge barrel collars and exposed steel retaining pins. Three collars are
  // drawn in the same local 3D hinge frame, so they articulate with the face.
  for(const t of [.12,.50,.88]){
    const pos=add(add(a,mul(axis,t)),normal);
    const eps=mul(axis,.075);
    stroke(ctx,[add(pos,mul(eps,-1)),add(pos,eps)],'#26332b',.21);
    stroke(ctx,[add(pos,mul(eps,-1)),add(pos,eps)],'#c6a06b',.10);
    stroke(ctx,[add(pos,mul(eps,-1)),add(pos,eps)],'#e4cf98',.022);
  }
}

function plate(ctx,f,{color,release}){
  const inside=f.normal[2]>=0,plane=inside?.090:-.090;
  const metal=inside?'#bca77a':'#aa7848';
  const perimeter=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
  const front=perimeter.map(([x,y])=>position(f,x,y,.090));
  const back=perimeter.map(([x,y])=>position(f,x,y,-.090));
  for(let i=0;i<4;i++){
    const j=(i+1)%4;
    paintPoly(ctx,[front[i],front[j],back[j],back[i]],i%2?'#523d2f':'#2b3230','#1b2524',.027);
  }
  // Interior deck colour is unmistakably the owner's paint (or weathered
  // neutral steel). Exterior armour is never tinted by ownership.
  const deck=inside?blend(lining[f.number-1],color||'#707870',color ? .79 : .48):armor[f.number-1];
  quad(ctx,f,perimeter,deck,plane,'#1a2222',.045);
  quad(ctx,f,[[-.42,-.42],[.42,-.42],[.42,.42],[-.42,.42]],null,plane+.003,inside?'#ada988':'#9e7646',.052);
  if(inside){
    rect(ctx,f,-.34,-.33,.34,.33,blend('#39463e',color||'#737b72',color ? .88 : .53),plane+.006);
    // Player paint appears on the broad road surface. Bracing is bare iron.
    rect(ctx,f,-.245,-.19,.245,.19,blend('#3b463e',color||'#778078',color ? .80 : .52),plane+.009);
    rect(ctx,f,-.37,-.37,-.29,.37,'#879389',plane+.008);
    rect(ctx,f,.29,-.37,.37,.37,'#879389',plane+.008);
    for(const y of [-.25,0,.25]){
      line(ctx,f,[-.23,y],[.23,y],'#aa9f79',.042,.65,plane+.012);
      line(ctx,f,[-.21,y+.045],[.21,y+.045],'#263530',.038,.85,plane+.012);
    }
    rect(ctx,f,-.09,-.40,.09,-.35,metal,plane+.012);
    rect(ctx,f,-.09,.35,.09,.40,metal,plane+.012);
  }else{
    rect(ctx,f,-.36,-.36,.36,.36,'#554338',plane-.006);
    line(ctx,f,[-.32,-.32],[.32,.32],'#8b6846',.125,1,plane-.011);
    line(ctx,f,[.32,-.32],[-.32,.32],'#8b6846',.125,1,plane-.011);
    line(ctx,f,[-.29,-.29],[.29,.29],'#2b3030',.038,.75,plane-.013);
    rect(ctx,f,-.14,-.14,.14,.14,'#303b3a',plane-.018);
    rect(ctx,f,-.10,-.09,.10,.09,'#b18852',plane-.022);
    rect(ctx,f,-.06,-.04,.06,.04,'#30332c',plane-.024);
    for(let i=0;i<3;i++)rect(ctx,f,-.3+i*.11,.28,-.24+i*.11,.30,'#e0a75f',plane-.010);
  }
  const flecks=[[-.39,-.18,.105],[-.27,-.41,.08],[.33,-.35,.10],[-.41,.30,.10],[.34,.23,.10],[.15,.37,.08],[-.08,-.42,.095],[.23,-.38,.085]];
  flecks.filter((_,i)=>!inside||i%3===0).forEach(([x,y,w],i)=>rect(ctx,f,x,y,x+w,y+w,rust[(f.number+i)%rust.length],plane+(inside?.018:-.018)));
  const chips=[[.27,-.23,.07],[-.31,.10,.095],[.11,.29,.08],[-.04,-.32,.06]];
  chips.forEach(([x,y,w])=>{
    rect(ctx,f,x,y,x+w,y+w,inside?'#384d45':'#302f29',plane+(inside?.019:-.019));
    rect(ctx,f,x,y,x+w*.55,y+w*.35,inside?'#ad8853':'#b56d37',plane+(inside?.021:-.021));
  });
  for(const [x,y] of [[-.37,-.37],[.37,-.37],[-.37,.37],[.37,.37]]){
    rect(ctx,f,x-.035,y-.035,x+.035,y+.035,'#c4ad7d',plane+(inside?.022:-.022));
    rect(ctx,f,x-.01,y-.02,x+.01,y+.02,'#303630',plane+(inside?.024:-.024));
  }
  // Big external fasteners: pixel hex nuts with recessed bolt heads. Small
  // phone cells receive only four strongly readable structural points.
  if(!inside){
    for(const [x,y] of [[-.34,-.34],[.34,-.34],[-.34,.34],[.34,.34]]){
      quad(ctx,f,[[x-.075,y-.035],[x-.035,y-.075],[x+.035,y-.075],[x+.075,y-.035],[x+.075,y+.035],[x+.035,y+.075],[x-.035,y+.075],[x-.075,y+.035]],'#c1a26e',plane-.027,'#3f3025',.025);
      rect(ctx,f,x-.022,y-.012,x+.022,y+.012,'#2b302a',plane-.031);
    }
  }
  const lock=inside?1:clamp(1-release);
  if(lock>.02){
    ctx.save();ctx.globalAlpha*=lock;
    // Two retaining tongues reach into the tube's catching slots, beyond
    // the 87%-width panel. They extend from ±.37 to the full frame edge.
    rect(ctx,f,-.12,-.54,.12,-.37,'#c3a371',plane-.028);
    rect(ctx,f,-.12,.37,.12,.54,'#c3a371',plane-.028);
    rect(ctx,f,-.05,-.53,.05,-.48,'#30372e',plane-.032);
    rect(ctx,f,-.05,.48,.05,.53,'#30372e',plane-.032);
    ctx.restore();
  }
}
// Canvas backing resolution is deliberately fixed at 20 pixels per socket.
// CSS scales that stable raster with nearest-neighbor pixels on either screen.
export function paintFoldCanvas(canvas,net,rotation,flipped,open,{color=null,release=1}={}){
  const ctx=canvas.getContext('2d',{alpha:true});
  if(!ctx)return false;
  const size=200;
  if(canvas.width!==size||canvas.height!==size){canvas.width=size;canvas.height=size;}
  ctx.clearRect(0,0,size,size);
  ctx.save();ctx.translate(size/2,size/2);ctx.scale(size/10,size/10);
  ctx.imageSmoothingEnabled=false;ctx.lineJoin='bevel';ctx.lineCap='square';
  const faces=foldedFaces(net,rotation,flipped,open).sort((a,b)=>a.center[2]-b.center[2]||b.depth-a.depth);
  // Contact shadows belong to the moving metal, not the permanent board.
  // They are redrawable in this canvas without clearing any installed cells.
  for(const face of faces){
    if(face.center[2]<.05)continue;
    const offset=.12*Math.min(1,face.center[2]);
    ctx.save();ctx.globalAlpha=.22;
    paintPoly(ctx,face.corners.map(p=>[p[0]+offset,p[1]+offset]),'#020705');
    ctx.restore();
  }
  for(const face of faces){plate(ctx,face,{color,release});hinge(ctx,face);}
  ctx.restore();
  return true;
}
