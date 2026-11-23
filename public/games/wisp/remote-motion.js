/* Interpolate remote racers from server snapshots; never change local physics. */
(() => {
  'use strict';
  // Polling provides only a few positions per second. Render one update behind
  // so the two known positions can be blended rather than displayed as jumps.
  const DELAY_MS = 220;
  const MAX_PREDICT_MS = 125;
  const MAX_GAP_MS = 1400;
  const clamp = (value,low,high) => Math.max(low,Math.min(high,value));
  const lerp = (a,b,t) => a+(b-a)*t;

  function create(){
    const tracks=new Map();
    let race=null;
    function reset(){tracks.clear();race=null;}
    function ingest(snapshot,now=performance.now()){
      if(!snapshot || snapshot.state!=='running'){reset();return;}
      const key=`${snapshot.code}:${snapshot.seed}:${snapshot.startAt}`;
      if(key!==race){tracks.clear();race=key;}
      const present=new Set();
      for(const p of snapshot.players){
        if(p.id===snapshot.me || !p.alive){tracks.delete(p.id);continue;}
        if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
        present.add(p.id);
        const track=tracks.get(p.id);
        const point={x:p.x,y:p.y,time:now};
        if(!track){tracks.set(p.id,{points:[point],connected:p.connected!==false});continue;}
        track.connected=p.connected!==false;
        const prev=track.points.at(-1);
        // Our own sync may return multiple identical positions for a peer.
        // They are not new samples: accepting them would introduce pauses.
        if(prev.x===point.x && prev.y===point.y)continue;
        if(now-prev.time>MAX_GAP_MS || Math.abs(point.x-prev.x)>650){
          track.points=[point];continue;
        }
        point.time=Math.max(now,prev.time+1);
        track.points.push(point);
        if(track.points.length>4)track.points.shift();
      }
      for(const id of tracks.keys())if(!present.has(id))tracks.delete(id);
    }
    function sample(id,now=performance.now()){
      const track=tracks.get(id);
      if(!track)return null;
      const points=track.points;
      const first=points[0];
      const at=now-DELAY_MS;
      if(points.length===1 || at<=first.time)return {x:first.x,y:first.y,vx:0,vy:0};
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i];
        if(at<=b.time){
          const elapsed=Math.max(1,b.time-a.time);
          const t=clamp((at-a.time)/elapsed,0,1);
          return {x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t),
            vx:clamp((b.x-a.x)*1000/elapsed,0,285),
            vy:clamp((b.y-a.y)*1000/elapsed,-720,720)};
        }
      }
      const b=points.at(-1),a=points.at(-2);
      if(!track.connected || now-b.time>MAX_GAP_MS)return {x:b.x,y:b.y,vx:0,vy:0};
      const elapsed=Math.max(1,b.time-a.time);
      const vx=clamp((b.x-a.x)*1000/elapsed,0,285);
      const vy=clamp((b.y-a.y)*1000/elapsed,-720,720);
      // Extrapolation is deliberately short and bounded. A lost connection
      // must not keep a remote racer moving indefinitely on our screen.
      const extra=clamp(at-b.time,0,MAX_PREDICT_MS);
      return {x:b.x+vx*extra/1000,
        y:clamp(b.y+vy*Math.min(extra,75)/1000,-500,530),vx,vy};
    }
    return {reset,ingest,sample};
  }
  window.WispRemoteMotion={create};
})();
