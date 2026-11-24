// Presentation events derived from authoritative states, never from prediction.
export function createFeedback() {
  let previous=null, resultKey=null;
  return {
    reset(){previous=null;resultKey=null;},
    observe(s,ownId){
      if(previous?.board===s.board&&previous.tick===s.tick)return [];
      const actors=new Map(s.actors.map(a=>[a.id,{status:a.status,energy:a.energy,immuneUntil:a.immuneUntil,recoverUntil:a.recoverUntil,lastCast:a.lastAbility?.ok?a.lastAbility.tick:null}]));
      const next={board:s.board,tick:s.tick,phase:s.phase,actors};
      const old=previous;previous=next;
      if(!old||old.board!==s.board||s.tick<=old.tick)return [];
      const events=[];
      if(old.phase==='prepare'&&s.phase==='survive')events.push({kind:'start'});
      if(old.phase==='survive'&&s.portal)events.push({kind:'portal'});
      for(const a of s.actors){
        const p=old.actors.get(a.id),n=actors.get(a.id);if(!p)continue;
        if(p.status==='active'&&n.status!=='active')events.push({kind:n.status==='escaped'?'escape':'shatter',id:a.id,x:a.x,y:a.y,color:a.color});
        if(a.id!==ownId||n.status!=='active'||p.status!=='active')continue;
        if(n.lastCast!==null&&n.lastCast!==p.lastCast)events.push({kind:'cast',id:a.id});
        if(n.immuneUntil>p.immuneUntil||n.recoverUntil>p.recoverUntil)events.push({kind:'hit',id:a.id});
        if(n.energy!==null&&p.energy!==null){
          if(n.energy>p.energy+1)events.push({kind:'pickup',id:a.id});
          if(p.energy>20&&n.energy<=20)events.push({kind:'low',id:a.id});
        }
      }
      return events;
    },
    result(key,won){if(!key||key===resultKey)return [];resultKey=key;return [{kind:won?'win':'loss'}];}
  };
}
