// Public, transport-only room API. The room server remains authoritative.
export function makeRoomRequest(base,requestFetch=fetch){
  return async function request(op,details={}){
    if(!base)throw new Error('Online rooms need a room server. Configure window.UNFOLD_ROOM_API.');
    const body=JSON.stringify(details);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
    try{
      const res=await requestFetch(`${base}/api/unfold/${op}`,{method:'POST',headers:{'Content-Type':'application/json'},body,signal:controller.signal});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||`Room error (${res.status})`);
      return data;
    }finally{clearTimeout(timer);}
  };
}
