// Six equal reel stops. Pure UI representation; engine owns random outcomes.
export const REEL_FACES=['DEPLOY','DEPLOY','SUPER','RECLAIM','RECLAIM','REFOLD'];

export function reelFace(face){
  const label=REEL_FACES[face-1]||'DEPLOY';
  const reel=document.getElementById('reel-track'),housing=document.querySelector('.reel-scene');
  housing?.classList.remove('spinning','clunk');
  reel.classList.remove('spinning');reel.style.transition='none';reel.style.transform='none';
  void reel.offsetHeight;reel.innerHTML=`<span>${label}</span>`;
  reel.setAttribute('data-face',String(face));
  // A brief detent as the drum locks. No change to randomization or timing.
  if(housing&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
    void housing.offsetHeight;housing.classList.add('clunk');
  }
}
