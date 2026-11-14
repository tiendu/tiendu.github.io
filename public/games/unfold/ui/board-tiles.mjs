// Pure board tile HTML. No DOM, game actions, storage, or timers.
import { gameIcon } from './icons.mjs';
const COLORS=['red','blue','green','gold'];
const key=([x,y])=>`${x},${y}`;
export function renderBoardTiles({size,mode,used,spots,preview,action,targets,anchor,placing,lockingCubeId,foldOriginId,gateMarks=new Map(),pulseCells=new Map(),focusCell=[0,0]}){
  const tiles=[];for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const k=`${x},${y}`,cell=used.get(k),p=preview.get(k),mark=gateMarks.get(k),classes=['tile'],hasMark=spots.has(k);
    if(mark?.kind==='gate'&&mark.open){classes.push('gate-open');if(mark.opening)classes.push('gate-just-opened');}
    if(mark?.kind==='terminal')classes.push(mark.open?'terminal-powered':'terminal-idle');
    if(pulseCells.has(k))classes.push('circuit-pulse');
    if(cell?.kind==='base')classes.push('base-'+(COLORS[cell.owner]||'neutral'));
    if(cell?.kind==='cube')classes.push('road-'+(COLORS[cell.owner]||'neutral'));
    if(cell?.kind==='goal')classes.push('goal');
    if(cell?.kind==='cube'&&cell.id===lockingCubeId)classes.push('latch-lock');
    if(cell?.kind==='cube'&&cell.id===foldOriginId)classes.push('fold-origin');
    if(cell?.kind==='obstacle')classes.push(cell.type);
    if(p)classes.push(p.valid?'preview-good':'preview-bad');
    if(hasMark)classes.push('legal-anchor');
    if(anchor&&key(anchor)===k&&placing)classes.push('selected-anchor');
    const available=cell&&['obstacle','cube'].includes(cell.kind)&&targets.has(cell.id);
    if(available)classes.push(action==='reclaim'?'reclaim-target':'refold-target');
    const cubeNumber=cell?.kind==='cube'&&cell.contact?cell.number:null;
    let content=cubeNumber?`<span class="contact-label" aria-label="Cube ${cubeNumber}">${cubeNumber}</span>`:'';
    if(cell?.kind==='base')content=`${gameIcon('hub','game-symbol tile-symbol')}<strong class="tile-glyph-text">${mode==='solo'?'S':cell.id+1}</strong>`;
    if(cell?.kind==='goal')content=`${gameIcon('goal','game-symbol tile-symbol')}<strong class="tile-glyph-text">★</strong>`;
    if(cell?.kind==='obstacle')content=cell.type==='gate'?`<span class="gate-shutter">${gameIcon('gate')}</span>`:['ruin','permanent'].includes(cell.type)?`<span class="obstacle-mark scrap-mark">${gameIcon('wall')}</span>`:`<span class="obstacle-mark crate-mark">${gameIcon('crate')}</span>`;
    if(mark?.kind==='terminal')content+=`<span class="gate-terminal" aria-label="Electrical terminal ${mark.sign}">${mark.sign}</span>`;
    if(mark?.kind==='gate'&&mark.open&&!cell)content+=`<span class="gate-floor">${gameIcon('gate-open')}</span>`;
    if(hasMark)content+='<span class="anchor-dot"></span>';
    tiles.push(`<button type="button" role="gridcell" class="${classes.join(' ')}" ${pulseCells.has(k)?`style="--pulse-delay:${pulseCells.get(k)}ms"`:''} ${cell?.kind==='cube'?`data-cube-id="${cell.id}"`:''} tabindex="${focusCell[0]===x&&focusCell[1]===y?0:-1}" data-x="${x}" data-y="${y}" aria-label="${mark?.kind==='terminal'?`${mark.sign} electrical terminal ${mark.open?'powered':'unpowered'}`:mark?.kind==='gate'?`${mark.open?'Open':'Closed'} electric gate`:cell?.kind||'Empty'} square ${x+1},${y+1}${cubeNumber?`, cube ${cubeNumber} contact square`:''}${available?`, ${action.toUpperCase()} available`:''}" title="${cell?.kind||'Empty'} · ${x+1},${y+1}${available?` · ${action.toUpperCase()} available`:''}">${content}</button>`);
  }
  return tiles.join('');
}
