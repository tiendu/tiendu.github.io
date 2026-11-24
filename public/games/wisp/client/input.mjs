const keys={ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1],ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0]};
export function installInput(canvas,move,ping) {
  addEventListener('keydown',e=>{
    if(e.ctrlKey||e.metaKey||e.altKey||['INPUT','SELECT','TEXTAREA'].includes(e.target?.tagName))return;
    const d=keys[e.key]??keys[e.key.toLowerCase()];
    if(d){e.preventDefault();move(...d);}
  });
  document.querySelectorAll('[data-d]').forEach(b=>b.addEventListener('click',()=>move(...b.dataset.d.split(',').map(Number))));
  let start=null;
  canvas.addEventListener('pointerdown',e=>{
    if(!e.isPrimary||e.button!==0)return;
    start={x:e.clientX,y:e.clientY,id:e.pointerId};canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointercancel',()=>{start=null;});
  canvas.addEventListener('pointerup',e=>{
    if(!start||start.id!==e.pointerId)return;
    const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;
    if(Math.max(Math.abs(dx),Math.abs(dy))>=18)move(...(Math.abs(dx)>Math.abs(dy)?[Math.sign(dx),0]:[0,Math.sign(dy)]));
    else ping(e.clientX,e.clientY);
  });
}
