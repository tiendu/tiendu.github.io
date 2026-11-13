// v1.6: sheet-metal catches mounted on the permanent iron tubes.
// They are deliberately on a distinct canvas: the frame never has to be
// erased or repainted as moving plates lock and release.
const UNIT=16;
const BRASS='#b99b66',DARK='#18211d',IRON='#60584a';
function pixel(ctx,x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h);}
function catchPair(ctx,x,y){
  const l=x*UNIT,t=y*UNIT,c=l+UNIT/2;
  // Two opposed clamp feet sit on the horizontal pipes bordering a panel.
  // Forked jaws bridge the inset deck edges into the tubes themselves.
  for(const top of [true,false]){
    const p=t+(top?0:UNIT);
    pixel(ctx,c-3,p-2,6,4,DARK);
    pixel(ctx,c-3,p-2,5,1,IRON);
    pixel(ctx,c-2,p-1,4,2,BRASS);
    pixel(ctx,c-1,p+(top?1:-2),2,3,'#d5b17a');
    pixel(ctx,c,p,1,1,'#252c28');
  }
}
export function paintLatchFrame(canvas,size,cells=[],{hidden=new Set(),settling=[]}={}){
  if(!canvas||!Number.isInteger(size)||size<1)return false;
  const pixels=size*UNIT;
  if(canvas.width!==pixels||canvas.height!==pixels){canvas.width=pixels;canvas.height=pixels;}
  const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)return false;
  ctx.clearRect(0,0,pixels,pixels);ctx.imageSmoothingEnabled=false;
  const visited=new Set();
  for(const cell of [...cells,...settling]){
    const x=Array.isArray(cell)?cell[0]:cell.x,y=Array.isArray(cell)?cell[1]:cell.y;
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=size||y>=size)continue;
    const k=`${x},${y}`;
    if(visited.has(k)||hidden.has(k))continue;
    visited.add(k);catchPair(ctx,x,y);
  }
  return true;
}
