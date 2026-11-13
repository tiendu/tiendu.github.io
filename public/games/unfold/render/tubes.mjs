// UNFOLD 1.5: fixed, low-resolution iron tube framework.
// Render only when the board size changes. The board, sockets and installed
// modules live on separate persistent DOM layers; unfolding never clears this.
const UNIT=16;
const iron={shadow:'#060807',dark:'#252c28',side:'#3d4540',lit:'#838578',edge:'#c0ae82',rust:'#875033',oil:'#161c1a',collar:'#574a38',bolt:'#c5ac76'};
function pixel(ctx,x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h);}
function coupling(ctx,x,y,strong){
  // Most intersections are narrow dark welds rather than brass squares.
  // The chunky collars and hex nuts occur only at load-bearing joints.
  if(!strong){
    pixel(ctx,x-1,y-1,3,3,'#444b42');
    pixel(ctx,x-1,y-1,2,1,'#8c8b75');
    pixel(ctx,x+1,y,1,2,'#232b26');
    return;
  }
  pixel(ctx,x-3,y-3,7,7,iron.oil);
  pixel(ctx,x-2,y-3,5,6,iron.collar);
  pixel(ctx,x-2,y-3,4,1,'#ad8756');
  pixel(ctx,x-3,y-2,1,4,'#826846');
  pixel(ctx,x+2,y-1,1,4,'#242c27');
  // Recessed 5x5 hexagonal nut, with a dark central bolt hole.
  pixel(ctx,x-1,y-2,3,1,iron.bolt);
  pixel(ctx,x-2,y-1,5,3,'#a88a59');
  pixel(ctx,x-1,y+2,3,1,'#5a523c');
  pixel(ctx,x-1,y,2,1,'#242925');
  pixel(ctx,x,y+1,1,1,'#30352e');
}
export function paintTubeFrame(canvas,boardSize){
  if(!canvas||!Number.isInteger(boardSize)||boardSize<1)return false;
  const pixels=boardSize*UNIT;
  if(canvas.width===pixels&&canvas.height===pixels&&canvas.dataset?.tubeSize===String(boardSize))return false;
  canvas.width=pixels;canvas.height=pixels;
  if(canvas.dataset)canvas.dataset.tubeSize=String(boardSize);
  const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)return false;
  ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,pixels,pixels);
  // Pipe roundness is formed by fixed chunky bands, not CSS gradients.
  // The shadow side falls over the exposed dark sockets; no solid floor.
  for(let i=0;i<=boardSize;i++){
    const x=i*UNIT;
    pixel(ctx,x-2,0,6,pixels,iron.shadow);
    pixel(ctx,x-2,0,1,pixels,iron.side);
    pixel(ctx,x-1,0,1,pixels,iron.edge);
    pixel(ctx,x,0,1,pixels,iron.lit);
    pixel(ctx,x+1,0,1,pixels,iron.dark);
    pixel(ctx,x+2,0,1,pixels,iron.oil);
  }
  for(let i=0;i<=boardSize;i++){
    const y=i*UNIT;
    pixel(ctx,0,y-2,pixels,6,iron.shadow);
    pixel(ctx,0,y-2,pixels,1,iron.side);
    pixel(ctx,0,y-1,pixels,1,iron.edge);
    pixel(ctx,0,y,pixels,1,iron.lit);
    pixel(ctx,0,y+1,pixels,1,iron.dark);
    pixel(ctx,0,y+2,pixels,1,iron.oil);
  }
  for(let y=0;y<=boardSize;y++)for(let x=0;x<=boardSize;x++){
    const px=x*UNIT,py=y*UNIT;
    coupling(ctx,px,py,x%3===0&&y%3===0);
    // Corrosion collects at a repeatable minority of structural joints.
    const hash=(x*19+y*37+x*y*11)%23;
    if(hash===3||hash===17){pixel(ctx,px+3,py+2,2,1,iron.rust);pixel(ctx,px+3,py+3,1,1,'#52362b');}
  }
  return true;
}
