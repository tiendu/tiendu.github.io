// Player-local camera: zoom, wheel, and two-finger pinch. Never sent to server.
export function installCamera(get,onViewportChange){
  let zoom=1,pinchStart=null;
  function setZoom(level,clientX=null,clientY=null){
    const v=get('board-viewport'),before=zoom,box=v.getBoundingClientRect();
    const x=clientX===null?box.width/2:clientX-box.left,y=clientY===null?box.height/2:clientY-box.top;
    const contentX=(v.scrollLeft+x)/before,contentY=(v.scrollTop+y)/before;
    zoom=Math.max(1,Math.min(3,Math.round(level*100)/100));
    get('board-surface').style.setProperty('--board-magnification',String(zoom));
    get('zoom-level').textContent=`${Math.round(zoom*100)}%`;
    v.scrollLeft=Math.max(0,contentX*zoom-x);v.scrollTop=Math.max(0,contentY*zoom-y);
    onViewportChange();
  }
  get('zoom-in').addEventListener('click',()=>setZoom(zoom+.25));
  get('zoom-out').addEventListener('click',()=>setZoom(zoom-.25));
  get('zoom-fit').addEventListener('click',()=>setZoom(1));
  // Non-pointer alternative to the wheel and pinch gestures.
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.isComposing)return;
    const target=event.target;
    if(target?.closest?.('input,textarea,select,[contenteditable]'))return;
    if(!document.body.classList.contains('playing'))return;
    if(event.key==='+'||event.key==='='){event.preventDefault();setZoom(zoom+.25);}
    else if(event.key==='-'){event.preventDefault();setZoom(zoom-.25);}
    else if(event.key==='0'){event.preventDefault();setZoom(1);}
  });
  get('board-viewport').addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*(e.deltaY<0?1.12:.89),e.clientX,e.clientY);},{passive:false});
  get('board-viewport').addEventListener('touchstart',e=>{
    if(e.touches.length===2){const a=e.touches[0],b=e.touches[1];pinchStart={distance:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),zoom};}
  },{passive:true});
  get('board-viewport').addEventListener('touchmove',e=>{
    if(e.touches.length===2&&pinchStart){e.preventDefault();const a=e.touches[0],b=e.touches[1];const d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
      setZoom(pinchStart.zoom*d/Math.max(1,pinchStart.distance),(a.clientX+b.clientX)/2,(a.clientY+b.clientY)/2);
    }
  },{passive:false});
  get('board-viewport').addEventListener('touchend',e=>{if(e.touches.length<2)pinchStart=null;});
}
