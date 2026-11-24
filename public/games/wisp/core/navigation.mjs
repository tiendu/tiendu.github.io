import {DIRS, WIDTH, HEIGHT} from './maze.mjs';

// The simulation keeps canonical coordinates. Navigation uses integer cell IDs
// and independent traversability graphs; temporary blocks never mutate the maze.
export const COUNT = WIDTH * HEIGHT;
export const cellId = (x,y) => y * WIDTH + x;
export const coords = i => [i % WIDTH, Math.floor(i / WIDTH)];
export const nearest = a => cellId(Math.round(a.x), Math.round(a.y));
export const manhattan = (a,b) => Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
export function neighbor(i,d) {
  const [x,y]=coords(i), u=x+d[0],v=y+d[1];
  return u>=0&&u<WIDTH&&v>=0&&v<HEIGHT?cellId(u,v):-1;
}
export function directionTo(i,j) {
  const [x,y]=coords(i),[u,v]=coords(j);return [u-x,v-y];
}
const cache=new WeakMap();
export function graph(board, blocked=[]) {
  const key=[...new Set(blocked)].sort((a,b)=>a-b).join(',');
  let entries=cache.get(board);
  if(!entries){entries=new Map();cache.set(board,entries);}
  if(entries.has(key))return entries.get(key);
  const mask=Uint8Array.from(board.flat(),v=>Number(v===0));
  for(const i of blocked)if(i>=0&&i<COUNT)mask[i]=0;
  const edges=Array.from({length:COUNT},(_,i)=>mask[i]?DIRS.map(d=>neighbor(i,d)).filter(j=>j>=0&&mask[j]):[]);
  const g={mask,edges,cells:Array.from({length:COUNT},(_,i)=>i).filter(i=>mask[i])};
  // Bound the cache when Lockdown and portal layouts change repeatedly.
  if(entries.size>=8)entries.delete(entries.keys().next().value);
  entries.set(key,g);return g;
}
export function bfs(g, source) {
  const dist=new Float64Array(COUNT).fill(Infinity);
  if(!g.mask[source])return dist;
  const q=new Int16Array(COUNT);let head=0,tail=1;q[0]=source;dist[source]=0;
  while(head<tail){const i=q[head++];for(const j of g.edges[i])if(dist[j]===Infinity){dist[j]=dist[i]+1;q[tail++]=j;}}
  return dist;
}
// Reverse Dijkstra: cost of entering a tile is paid once, including the goal.
// Small binary heap, no dependencies. Stale heap entries are harmless.
export function weightedDistances(g, goal, cost) {
  const dist=new Float64Array(COUNT).fill(Infinity), heap=[];
  if(!g.mask[goal])return dist;
  function push(i,d){let n=heap.length;heap.push([i,d]);while(n){const p=(n-1)>>1;if(heap[p][1]<=d)break;heap[n]=heap[p];n=p;}heap[n]=[i,d];}
  function pop(){const first=heap[0],last=heap.pop();if(heap.length){let n=0;while(2*n+1<heap.length){let k=2*n+1;if(k+1<heap.length&&heap[k+1][1]<heap[k][1])k++;if(heap[k][1]>=last[1])break;heap[n]=heap[k];n=k;}heap[n]=last;}return first;}
  dist[goal]=0;push(goal,0);
  while(heap.length){const [i,d]=pop();if(d!==dist[i])continue;for(const j of g.edges[i]){const v=d+cost[i];if(v<dist[j]){dist[j]=v;push(j,v);}}}
  return dist;
}
