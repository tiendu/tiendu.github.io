// UNFOLD mechanical cube renderer.
// Real 3D kinematics, fixed overhead camera, raster-era drawing language.
// Each face is a thick, two-sided iron plate. The +normal face is the ribbed
// INSIDE that becomes the road; the -normal face is the rusted OUTSIDE shell.
import { oriented } from './nets.mjs';

const add=(a,b)=>a.map((v,i)=>v+b[i]);
const mul=(a,n)=>a.map(v=>v*n);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const clamp=v=>Math.max(0,Math.min(1,v));
const ease=v=>{v=clamp((v-.055)/.945);return v*v*v*(v*(6*v-15)+10);};
const spin=(v,axis,rad)=>add(add(mul(v,Math.cos(rad)),mul(cross(axis,v),Math.sin(rad))),mul(axis,dot(axis,v)*(1-Math.cos(rad))));
const positionKey=([x,y])=>`${x},${y}`;
const val=n=>Number(n).toFixed(3);
const point=p=>`${val(p[0])},${val(p[1])}`;
const pts=p=>p.map(point).join(' ');
const blend=(a,b,t)=>{
  if(!b)return a;
  const ch=n=>Math.round(parseInt(a.slice(n,n+2),16)*(1-t)+parseInt(b.slice(n,n+2),16)*t).toString(16).padStart(2,'0');
  return `#${ch(1)}${ch(3)}${ch(5)}`;
};

export function foldedFaces(net,rotation=0,flipped=false,open=1){
  const cells=oriented(net,rotation,flipped),idx=new Map(cells.map((p,i)=>[positionKey(p),i]));
  const hierarchy=Array(6),queue=[0];hierarchy[0]={parent:null,depth:0};
  for(let qi=0;qi<queue.length;qi++){
    const i=queue[qi],p=cells[i];
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const j=idx.get(`${p[0]+dx},${p[1]+dy}`);
      if(j===undefined||hierarchy[j])continue;
      hierarchy[j]={parent:i,depth:hierarchy[i].depth+1,dx,dy};queue.push(j);
    }
  }
  if(queue.length!==6)throw Error('Disconnected cube net');
  const frames=Array(6);
  frames[0]={center:[0,0,0],u:[1,0,0],v:[0,1,0],hinge:null};
  for(let qi=1;qi<queue.length;qi++){
    const j=queue[qi],{parent,depth,dx,dy}=hierarchy[j],f=frames[parent];
    // Independent hinge delays make the panels unwrap in successive, heavy
    // movements. No teleportation and no scaling of a flat tile silhouette.
    const delay=(depth-1)*.115;
    const angle=(1-ease((open-delay)/(1-delay)))*Math.PI/2;
    const axis=dx?f.v:f.u,rad=(dx?-dx:dy)*angle;
    const u=spin(f.u,axis,rad),v=spin(f.v,axis,rad);
    const hinge=add(f.center,add(mul(f.u,dx/2),mul(f.v,dy/2)));
    const center=add(hinge,add(mul(u,dx/2),mul(v,dy/2)));
    frames[j]={center,u,v,hinge:[add(hinge,mul(axis,-.5)),add(hinge,mul(axis,.5))]};
  }
  return frames.map((f,i)=>({
    number:i+1,flat:cells[i],center:f.center,u:f.u,v:f.v,
    corners:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>add(f.center,add(mul(f.u,x/2),mul(f.v,y/2)))),
    normal:cross(f.u,f.v),hinge:f.hinge,depth:hierarchy[i].depth
  }));
}

// Local panel geometry is tied to the rotating plate. As the plate turns,
// scratches, reinforcement ribs, latch plates and rivets turn with it.
function surface(f,x,y,offset=0){
  return add(add(add(f.center,mul(f.u,x)),mul(f.v,y)),mul(f.normal,offset));
}
const polygon=(f,pairs,off=0)=>pts(pairs.map(([x,y])=>surface(f,x,y,off)));
const line=(f,a,b,color,width,opacity=1,off=0)=>
  `<path d="M ${point(surface(f,...a,off)).replace(',',' ')} L ${point(surface(f,...b,off)).replace(',',' ')}" stroke="${color}" stroke-width="${width}" stroke-opacity="${opacity}" stroke-linecap="square"/>`;
const rect=(f,x1,y1,x2,y2,fill,off=0)=>
  `<polygon points="${polygon(f,[[x1,y1],[x2,y1],[x2,y2],[x1,y2]],off)}" fill="${fill}"/>`;

const armor=['#5b493b','#67503c','#54463b','#5b4b40','#59493c','#67503f'];
const lining=['#56625c','#4e605c','#596660','#51615a','#52615e','#58665f'];
const rust=['#87492e','#a45a32','#6b3627','#b46c3c','#713f2d','#986037'];
function plate(f,{color,release=1}={}){
  const interior=f.normal[2]>=0;
  const plane=interior?.090:-.090; // face closest to the camera
  const inner=interior?lining[f.number-1]:armor[f.number-1];
  const metal=interior?'#bca77a':'#aa7848';
  const all=f.corners;
  const front=all.map(p=>add(p,mul(f.normal,.090)));
  const back=all.map(p=>add(p,mul(f.normal,-.090)));
  // Chunky 18%-thick iron rims: the plates must read as heavy box walls.
  const edge=[0,1,2,3].map(i=>{
    const j=(i+1)%4;
    return `<polygon points="${pts([front[i],front[j],back[j],back[i]])}" fill="${i%2?'#523d2f':'#2b3230'}" stroke="#1b2524" stroke-width=".027"/>`;
  }).join('');
  const face=polygon(f,[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]],plane);
  const rim=polygon(f,[[-.42,-.42],[.42,-.42],[.42,.42],[-.42,.42]],plane+.003);
  let details='';
  if(interior){
    // Interior: strong parallel support ribs, the usable walking surface,
    // and copper service channels. It is structurally different from armor.
    details+=rect(f,-.34,-.33,.34,.33,blend('#344440',color,.28),plane+.006);
    details+=rect(f,-.37,-.37,-.29,.37,'#879389',plane+.008);
    details+=rect(f,.29,-.37,.37,.37,'#879389',plane+.008);
    for(const y of [-.25,0,.25]){
      details+=line(f,[-.23,y],[.23,y],'#aa9f79','.042',.65,plane+.012);
      details+=line(f,[-.21,y+.045],[.21,y+.045],'#263530','.038',.85,plane+.012);
    }
    details+=rect(f,-.09,-.40,.09,-.35,metal,plane+.012);
    details+=rect(f,-.09,.35,.09,.40,metal,plane+.012);
  } else {
    // Exterior: battered cross-braced armor with a central locking hatch.
    details+=rect(f,-.36,-.36,.36,.36,'#554338',plane-.006);
    details+=line(f,[-.32,-.32],[.32,.32],'#8b6846','.125',1,plane-.011);
    details+=line(f,[.32,-.32],[-.32,.32],'#8b6846','.125',1,plane-.011);
    details+=line(f,[-.29,-.29],[.29,.29],'#2b3030','.038',.75,plane-.013);
    details+=rect(f,-.14,-.14,.14,.14,'#303b3a',plane-.018);
    details+=rect(f,-.10,-.09,.10,.09,'#b18852',plane-.022);
    details+=rect(f,-.06,-.04,.06,.04,'#30332c',plane-.024);
    // Three square vent/stencil marks, no face numbering.
    for(let i=0;i<3;i++)details+=rect(f,-.3+i*.11,.28,-.24+i*.11,.30,'#e0a75f',plane-.010);
  }
  // Stationary pitted rust patches. Discrete rects intentionally form a
  // chunky 16-bit pixel-art texture instead of procedural smooth noise.
  const flecks=[[-.39,-.18,.105],[-.27,-.41,.08],[.33,-.35,.10],[-.41,.30,.10],[.34,.23,.10],[.15,.37,.08],[-.08,-.42,.095],[.23,-.38,.085]];
  for(let i=0;i<flecks.length;i++){
    const [x,y,w]=flecks[i];
    details+=rect(f,x,y,x+w,y+w,rust[(f.number+i)%rust.length],plane+(interior?.018:-.018));
  }
  // Chipped 8-bit paint blocks. Their deliberately coarse silhouettes
  // remain visible at a 20-pixel phone socket without noisy procedural grain.
  const chips=[[.27,-.23,.07],[-.31,.10,.095],[.11,.29,.08],[-.04,-.32,.06]];
  for(let i=0;i<chips.length;i++){
    const [x,y,w]=chips[i],ink=interior?'#384d45':'#302f29';
    details+=rect(f,x,y,x+w,y+w,ink,plane+(interior?.019:-.019));
    details+=rect(f,x,y,x+w*.55,y+w*.35,interior?'#ad8853':'#b56d37',plane+(interior?.021:-.021));
  }
  for(const [x,y] of [[-.37,-.37],[.37,-.37],[-.37,.37],[.37,.37]]){
    details+=rect(f,x-.035,y-.035,x+.035,y+.035,'#c4ad7d',plane+(interior?.022:-.022));
    details+=rect(f,x-.01,y-.02,x+.01,y+.02,'#303630',plane+(interior?.024:-.024));
  }
  // Retaining clips on top/bottom edges of the exterior, disappear only
  // when its seams are unlocked; interior has permanent hinge anchor plates.
  const lock=interior?1:Math.max(0,1-release);
  if(lock>.02){
    details+=`<g opacity="${val(lock)}">${rect(f,-.12,-.5,.12,-.37,'#c3a371',plane-.028)}${rect(f,-.12,.37,.12,.5,'#c3a371',plane-.028)}</g>`;
  }
  return `<g class="plate ${interior?'plate-inner':'plate-outer'}">
    ${edge}
    <polygon points="${face}" fill="${inner}" stroke="#1a2222" stroke-width=".045"/>
    <polygon points="${rim}" fill="none" stroke="${interior?'#ada988':'#9e7646'}" stroke-width=".052" stroke-linejoin="bevel"/>
    ${details}
  </g>`;
}
function hinge(f){
  if(!f.hinge)return '';
  const [a,b]=f.hinge,vec=mul(f.normal,.06),p=point;
  const v1=add(a,vec),v2=add(b,vec);
  // A barrel pin with collars, attached to the actual computed hinge edge.
  return `<g class="pivot">
    <path d="M ${p(a).replace(',',' ')} L ${p(b).replace(',',' ')}" stroke="#1e2724" stroke-width=".165" stroke-linecap="square"/>
    <path d="M ${p(v1).replace(',',' ')} L ${p(v2).replace(',',' ')}" stroke="#b58c53" stroke-width=".105" stroke-linecap="square"/>
    <path d="M ${p(v1).replace(',',' ')} L ${p(v2).replace(',',' ')}" stroke="#ecd19a" stroke-width=".022" stroke-opacity=".8" stroke-linecap="square"/>
  </g>`;
}

// Orthographic top-down view: closed cube projects to a single board cell.
// Parts have genuine thickness, different interior/exterior surfaces, and
// hinge barrels that remain in the correct place during unfolding/refolding.
export function foldSvg(net,rotation=0,flipped=false,open=1,{preview=false,color=null,release=1}={}){
  const faces=foldedFaces(net,rotation,flipped,open);
  const layers=faces.slice().sort((a,b)=>a.center[2]-b.center[2]||b.depth-a.depth);
  const panels=layers.map(f=>plate(f,{color,release})+hinge(f)).join('');
  let size='-5 -5 10 10';
  if(preview){
    const final=foldedFaces(net,rotation,flipped,1).flatMap(f=>f.corners);
    const lowX=Math.min(...final.map(p=>p[0])),highX=Math.max(...final.map(p=>p[0]));
    const lowY=Math.min(...final.map(p=>p[1])),highY=Math.max(...final.map(p=>p[1]));
    const extent=Math.max(highX-lowX,highY-lowY)+.8;
    size=`${val((lowX+highX-extent)/2)} ${val((lowY+highY-extent)/2)} ${val(extent)} ${val(extent)}`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" class="hinged-cube pixel-mechanism" viewBox="${size}" role="img" aria-label="A rusty box opening to show six reinforced steel panels" overflow="visible" shape-rendering="crispEdges">${panels}</svg>`;
}
