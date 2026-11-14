// Desktop-only relocation of the existing placement toolbar. No new actions.
// The original DOM controls and event listeners are preserved on resize.
export function installDesktopPlacement(get, reposition){
  const tools=get('placement-tools'),viewport=get('board-viewport'),slot=get('desktop-placement-slot');
  if(!tools||!viewport||!slot)return;
  const media=window.matchMedia?.('(min-width: 1100px)');
  if(!media)return;
  const update=()=>{
    const target=media.matches?slot:viewport;
    const focus=document.activeElement;
    const restore=tools.contains(focus)?focus:null;
    if(tools.parentElement!==target)target.append(tools);
    tools.style.removeProperty('top');tools.style.removeProperty('left');
    reposition();
    restore?.focus?.({preventScroll:true});
  };
  if(media.addEventListener)media.addEventListener('change',update);
  else media.addListener?.(update);
  update();
}
