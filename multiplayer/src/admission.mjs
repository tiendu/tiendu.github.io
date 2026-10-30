import {TTL} from './rules.mjs';
export function pruneLeases(leases,now=Date.now()) {
  for(const [code,lease] of Object.entries(leases)) if(lease.expires<=now) delete leases[code];
}
// Caller must serialize and persist admission before exposing the new room.
export function reserveRoom(leases,limit=50,now=Date.now()) {
  pruneLeases(leases,now);
  const cap=Number(limit);
  if(!Number.isInteger(cap)||cap<1||cap>1000||Object.keys(leases).length>=cap) return null;
  let room;
  do {const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);room=String(bytes[0]%1_000_000).padStart(6,'0');} while(leases[room]);
  const id=crypto.randomUUID(),token=crypto.randomUUID();
  leases[room]={id,expires:now+TTL};
  return {room,id,token,created:now};
}
