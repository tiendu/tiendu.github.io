// Shared tactile button feedback for pointer and keyboard input.
export function installMechanicalPress(){
  const selector='button';
  let active=null;
  const mark=(el,on)=>{ if(el&&el.matches?.(selector)&&!el.disabled)el.classList.toggle('is-pressed',on); };
  const clear=()=>{ mark(active,false); active=null; };
  document.addEventListener('pointerdown',event=>{
    const el=event.target.closest(selector);
    if(!el||el.disabled)return;
    clear(); active=el; mark(active,true);
  },true);
  for(const type of ['pointerup','pointercancel'])document.addEventListener(type,clear,true);
  window.addEventListener('blur',clear);
  document.addEventListener('keydown',event=>{
    if((event.key===' '||event.key==='Enter')&&document.activeElement?.matches?.(selector))mark(document.activeElement,true);
  },true);
  document.addEventListener('keyup',event=>{
    if((event.key===' '||event.key==='Enter')&&document.activeElement?.matches?.(selector))mark(document.activeElement,false);
  },true);
}
