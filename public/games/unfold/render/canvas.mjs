// UNFOLD Neon Grid: six-face luminous energy module.
// Keep the authoritative hinge geometry and one stable Canvas throughout a fold.
import { foldedFaces } from '../fold.mjs';

const PALETTE={shell:'#111d31',rim:'#75cbe3',neutral:'#8999b1',inner:'#102a3b'};
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const scale=(a,n)=>a.map(v=>v*n);
const colorMix=(a,b,t)=>{
  const value=(i)=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0');
  return `#${value(1)}${value(3)}${value(5)}`;
};
const point=(face,x,y,offset=0)=>add(add(add(face.center,scale(face.u,x*.97)),scale(face.v,y*.97)),scale(face.normal,offset));
function polygon(ctx,pts,fill,stroke=null,width=.02,alpha=1){
  if(!pts.length)return;
  ctx.save();ctx.globalAlpha*=alpha;
  ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);
  for(const p of pts.slice(1))ctx.lineTo(p[0],p[1]);
  ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
  ctx.restore();
}
function square(ctx,face,fill,edge,width=.03,offset=0,scaleSize=.5,alpha=1){
  const a=scaleSize;
  polygon(ctx,[point(face,-a,-a,offset),point(face,a,-a,offset),point(face,a,a,offset),point(face,-a,a,offset)],fill,edge,width,alpha);
}
function segment(ctx,a,b,color,width,alpha=1){
  ctx.save();ctx.globalAlpha*=alpha;
  ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();ctx.restore();
}
function trace(ctx,face,a,b,color,width=.026,alpha=1,offset=0){
  segment(ctx,point(face,...a,offset),point(face,...b,offset),color,width,alpha);
}
function paintFace(ctx,face,owner,release){
  // No rust, rivets or metallic textures. The owner's luminous trace defines
  // an energized interior while the exterior stays a dark, glassy shell.
  const inside=face.normal[2]>=-.001;
  const edge=inside?owner:colorMix(PALETTE.rim,owner,.28);
  const core=inside?colorMix(PALETTE.inner,owner,.16):PALETTE.shell;
  const corners=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
  const front=corners.map(([x,y])=>point(face,x,y,.055));
  const back=corners.map(([x,y])=>point(face,x,y,-.055));
  for(let j=0;j<4;j++)polygon(ctx,[front[j],front[(j+1)%4],back[(j+1)%4],back[j]],'#0a1223',edge,.012,.7);
  square(ctx,face,core,edge,.055,.060);
  // Subtle bloom on the same real face geometry, never a blurry UI overlay.
  square(ctx,face,null,edge,.14,.066,.5,.10);
  square(ctx,face,null,colorMix('#a5e9fa',owner,.65),.016,.067,.42,.75);
  if(inside){
    square(ctx,face,colorMix('#152c40',owner,.13),null,0,.068,.37);
    for(const offset of [-.18,.18])trace(ctx,face,[-.29,offset],[.29,offset],edge,.020,.45,.074);
    trace(ctx,face,[-.29,-.29],[-.10,-.29],edge,.025,.65,.074);
    trace(ctx,face,[.10,.29],[.29,.29],edge,.025,.65,.074);
  }else{
    // Closed face reads as one folded module with a small power circuit.
    trace(ctx,face,[-.23,0],[.23,0],edge,.040,.85,.074);
    trace(ctx,face,[0,-.23],[0,.23],edge,.040,.85,.074);
    square(ctx,face,null,edge,.03,.075,.14,.7);
  }
  if(face.hinge){
    const [a,b]=face.hinge;
    segment(ctx,a,b,'#1a4251',.070,.8);
    segment(ctx,a,b,edge,.025,.8);
  }
  // The edges remain visible for the whole fold; there are no old catches.
  if(release<1&&inside)square(ctx,face,null,edge,.018,.076,.33,(1-release)*.35);
}
export function paintFoldCanvas(canvas,net,rotation,flipped,open,{color=null,release=1}={}){
  const ctx=canvas.getContext('2d',{alpha:true});
  if(!ctx)return false;
  if(canvas.width!==200||canvas.height!==200){canvas.width=200;canvas.height=200;}
  ctx.clearRect(0,0,200,200);
  ctx.save();ctx.translate(100,100);ctx.scale(20,20);
  ctx.imageSmoothingEnabled=true;ctx.lineJoin='round';ctx.lineCap='round';
  const owner=/^#[0-9a-fA-F]{6}$/.test(color||'')?color:PALETTE.neutral;
  const faces=foldedFaces(net,rotation,flipped,open)
    .sort((a,b)=>a.center[2]-b.center[2]||b.depth-a.depth);
  for(const face of faces){
    if(face.center[2]<.06)continue;
    const offset=Math.min(.11,face.center[2]*.10);
    polygon(ctx,face.corners.map(p=>[p[0]+offset,p[1]+offset]),'#010715',null,.02,.35);
  }
  for(const face of faces)paintFace(ctx,face,owner,release);
  ctx.restore();
  return true;
}
