// UNFOLD fold/unfold, relocation and grit effects. No game rules or networking.
import { foldedFaces } from '../fold.mjs';
import { paintFoldCanvas } from './canvas.mjs';
export const ANIMATION_MS={normal:1600,quick:700,instant:0};
export function createFoldAnimator({$,getGame,animationSpeed}){
  let animationFastForward=false;
  function createGrit(cells){
    const layer=$('grit-layer'),surface=$('board-surface'),sr=surface.getBoundingClientRect();
    layer.replaceChildren();
    const positions=[[.13,.12], [.87,.08], [.08,.85], [.91,.88]];
    cells.forEach(([x,y],index)=>{
      if(index>5)return;
      const tile=$('board').querySelector(`[data-x="${x}"][data-y="${y}"]`);
      if(!tile)return;
      const r=tile.getBoundingClientRect();
      const [rx,ry]=positions[index%4];
      for(let j=0;j<2;j++){
        const bit=document.createElement('i');bit.className='grit-bit';
        bit.style.left=`${r.left-sr.left+r.width*rx}px`;
        bit.style.top=`${r.top-sr.top+r.height*ry}px`;
        bit.style.setProperty('--dx',`${((index*7+j*13)%27)-13}px`);
        bit.style.setProperty('--dy',`${-6-(index+j)%10}px`);
        bit.style.animationDelay=`${(j*45+index*21)}ms`;
        layer.append(bit);
      }
    });
    setTimeout(()=>layer.replaceChildren(),680);
  }

  // Stable renderer: one canvas for the entire operation, no filtered SVG DOM
  // reconstruction. For Refold, individual sockets uncover the black void only
  // once that particular rigid plate has lifted off the table. The frame canvas
  // stays mounted and is never repainted while an animation is running.
  function finishFoldVisual(){
    const stage=$('fold-stage');
    stage.hidden=true;stage.replaceChildren();
    document.querySelectorAll('.tile.fold-lifting').forEach(tile=>tile.classList.remove('fold-lifting'));
    $('game').classList.remove('is-unfolding');
    animationFastForward=false;
  }
  function prepareFoldStage(contact){
    const stage=$('fold-stage'),board=$('board'),surface=$('board-surface');
    const tile=board.querySelector(`[data-x="${contact[0]}"][data-y="${contact[1]}"]`);
    if(!tile)return null;
    const surfaceRect=surface.getBoundingClientRect(),rect=tile.getBoundingClientRect();
    const first=board.querySelector('[data-x="0"][data-y="0"]')?.getBoundingClientRect();
    const second=board.querySelector('[data-x="1"][data-y="0"]')?.getBoundingClientRect();
    const pitch=first&&second?second.left-first.left:board.getBoundingClientRect().width/getGame().size;
    stage.style.setProperty('--fx',`${rect.left+rect.width/2-surfaceRect.left}px`);
    stage.style.setProperty('--fy',`${rect.top+rect.height/2-surfaceRect.top}px`);
    stage.style.setProperty('--cube-canvas',`${pitch*10}px`);
    const canvas=document.createElement('canvas');canvas.width=200;canvas.height=200;
    const mechanism=document.createElement('div');mechanism.className='mechanism';mechanism.append(canvas);
    stage.replaceChildren(mechanism);stage.hidden=false;
    $('game').classList.add('is-unfolding');
    return canvas;
  }
  function liftedSockets(net,rot,flip,contact,open){
    const faces=foldedFaces(net,rot,flip,open),root=faces[0].flat;
    for(const face of faces){
      if(face.number===1)continue; // Contact face holds the closed cube in place.
      const x=contact[0]+face.flat[0]-root[0],y=contact[1]+face.flat[1]-root[1];
      const tile=$('board').querySelector(`[data-x="${x}"][data-y="${y}"]`);
      if(!tile)continue;
      tile.classList.toggle('fold-lifting',face.center[2]>.035);
    }
  }
  // Remain at the same fixed camera position. Closed box relocation is a brief
  // motion of the box, NOT a camera pan or six disconnected tiles teleporting.
  async function moveClosedBox(from,to,net,rot,flip,color){
    if(animationSpeed()==='instant')return;
    const canvas=prepareFoldStage(from);if(!canvas)return;
    paintFoldCanvas(canvas,net,rot,flip,0,{color,release:0});
    const stage=$('fold-stage'),originX=parseFloat(stage.style.getPropertyValue('--fx')),originY=parseFloat(stage.style.getPropertyValue('--fy'));
    const rect=$('board').querySelector(`[data-x="${to[0]}"][data-y="${to[1]}"]`)?.getBoundingClientRect();
    const sr=$('board-surface').getBoundingClientRect();if(!rect)return;
    const targetX=rect.left+rect.width/2-sr.left,targetY=rect.top+rect.height/2-sr.top;
    const duration=animationSpeed()==='quick'?130:230,start=performance.now();
    await new Promise(resolve=>{
      const step=now=>{
        const t=animationFastForward?1:Math.min(1,(now-start)/duration),ease=t*t*(3-2*t);
        stage.style.setProperty('--fx',`${originX+(targetX-originX)*ease}px`);
        stage.style.setProperty('--fy',`${originY+(targetY-originY)*ease}px`);
        if(t<1)requestAnimationFrame(step);else resolve();
      };requestAnimationFrame(step);
    });
  }
  async function animateFold(net,rot,flip,contact,reverse=false){
    if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||animationSpeed()==='instant')return;
    const canvas=prepareFoldStage(contact);if(!canvas)return;
    animationFastForward=false;
    const ownerColor=['#49ddf5','#ff68bd','#ffcd65','#b3f36d'][getGame().active]||'#49ddf5';
    const duration=ANIMATION_MS[animationSpeed()]*(reverse?.83:1);
    await new Promise(resolve=>{
      const start=performance.now();
      const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
      const step=now=>{
        const t=animationFastForward?1:Math.min(1,(now-start)/duration);
        const progress=ease(Math.max(0,Math.min(1,(t-.12)/.75)));
        const openness=reverse?1-progress:progress;
        const release=reverse?1-progress:ease(Math.min(1,t/.15));
        paintFoldCanvas(canvas,net,rot,flip,openness,{color:ownerColor,release});
        if(reverse)liftedSockets(net,rot,flip,contact,openness);
        if(t<1)requestAnimationFrame(step);else resolve();
      };requestAnimationFrame(step);
    });
    // Do NOT remove the canvas here. It stays in place until the new game state
    // has rendered, so there cannot be one blank frame at the phase boundary.
  }
  function fastForwardAnimation(){animationFastForward=true;}
  return {createGrit,finishFoldVisual,moveClosedBox,animateFold,fastForwardAnimation};
}
