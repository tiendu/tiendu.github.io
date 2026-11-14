// Pure one-shot circuit guidance, only evaluated when an electrical gate opens.
// Maps energized path cells to a finite delay; it never changes game state.
const DIRECTIONS=[[1,0],[-1,0],[0,1],[0,-1]];
const key=([x,y])=>`${x},${y}`;
export function circuitPulseCells(game,gates,connectedCells){
  const result=new Map();
  if(!gates?.length)return result;
  for(const gate of gates){
    if(!gate.open||!Array.isArray(gate.terminals)||gate.terminals.length!==2)continue;
    const terminalKeys=gate.terminals.map(key);
    const source=game.players.find(p=>p.alive&&terminalKeys.every(k=>connectedCells(game,p.id).has(k)));
    if(!source)continue;
    const cells=connectedCells(game,source.id),start=key(source.base);
    if(!cells.has(start))continue;
    const seen=new Map([[start,null]]),queue=[start];
    for(let i=0;i<queue.length;i++){
      const [x,y]=queue[i].split(',').map(Number);
      for(const [dx,dy] of DIRECTIONS){
        const next=key([x+dx,y+dy]);
        if(cells.has(next)&&!seen.has(next)){seen.set(next,queue[i]);queue.push(next);}
      }
    }
    let last=0;
    for(const terminal of terminalKeys){
      if(!seen.has(terminal))continue;
      const route=[];
      for(let at=terminal;at!==null;at=seen.get(at))route.push(at);
      route.reverse();
      for(let i=0;i<route.length;i++){
        const delay=i*38;
        result.set(route[i],Math.min(delay,result.get(route[i])??Infinity));
        last=Math.max(last,delay);
      }
    }
    for(const cell of gate.cells)result.set(key(cell),last+60);
    for(const k of terminalKeys)result.set(k,last);
  }
  return result;
}
