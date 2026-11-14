// Neon Grid previews: the exact six-panel nets, without painted iron.
import { NETS } from '../nets.mjs';
export function netThumbnail(n){
  const cells=NETS[n],maxX=Math.max(...cells.map(c=>c[0])),maxY=Math.max(...cells.map(c=>c[1]));
  const scale=16,offsetX=(96-(maxX+1)*scale)/2,offsetY=(80-(maxY+1)*scale)/2;
  return `<svg viewBox="0 0 96 80" aria-hidden="true">${cells.map(([x,y],i)=>`<rect x="${offsetX+x*scale}" y="${offsetY+y*scale}" width="${scale-1}" height="${scale-1}" rx="2" fill="${i?'#17495A':'#80F0C1'}" stroke="${i?'#49DDF5':'#D5FFEA'}" stroke-width="1.5"/>`).join('')}</svg>`;
}
