/* Room transport and remote-racer rendering. The polygon menu owns all UI. */
(() => {
  'use strict';
  const game=window.WispGame;
  if(!game)return;

  const qs=new URLSearchParams(location.search);
  const DEFAULT_WORKER='https://wisp-multiplayer.tiendu107.workers.dev';
  const fallback=['localhost','127.0.0.1'].includes(location.hostname)
    ?'http://127.0.0.1:8787':location.hostname==='tiendu.github.io'?DEFAULT_WORKER:'';
  const api=(qs.get('api')||window.WISP_ROOM_API||fallback).replace(/\/$/,'');
  const sessionKey='wisp-room-session-v1';
  const localImages=Object.fromEntries(['Ember','Moss','Dew','Gale','Dusk'].map(name=>{
    const img=new Image(),file=name.toLowerCase()+'.svg';
    img.src='./assets/'+file;
    return [name,img];
  }));

  let session=null,snapshot=null,sequence=0,matchStarted=false;
  const remoteMotion=window.WispRemoteMotion?.create?.()||null;
  let socket=null,socketReady=false,reconnectAt=0,lastFallback=0;
  let snapshotPerf=0;
  let timer=null,busy=false,entering=false,lastSync=0,generation=0;
  const emit=(name,detail)=>window.dispatchEvent(new CustomEvent(name,{detail}));
  const status=message=>emit('wisp:online-status',message);

  function endpoint(){
    let url;
    try{url=new URL(api);}catch{throw new Error('WISP multiplayer Worker URL is not configured.');}
    if(!['http:','https:'].includes(url.protocol))throw new Error('Invalid Worker URL.');
    return url.origin+url.pathname.replace(/\/$/,'');
  }
  async function request(op,payload={}){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),8000);
    try{
      const response=await fetch(endpoint()+'/api/wisp/'+op,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload),signal:controller.signal,cache:'no-store'
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||`Room error ${response.status}`);
      return data;
    }finally{clearTimeout(timeout);}
  }
  function persist(){
    try{if(session)sessionStorage.setItem(sessionKey,JSON.stringify(session));
      else sessionStorage.removeItem(sessionKey);}catch{}
  }
  function update(s){
    snapshot=s;snapshotPerf=performance.now();
    remoteMotion?.ingest(s);
    game.applyOnlineSnapshot?.(s);
    emit('wisp:online-state',s);
    if(s.state==='lobby')status(`${s.players.length}/5 wisps. Invite a friend, then the host starts.`);
    else if(s.state==='running'){
      const countdown=Math.max(0,Math.ceil((s.startAt-s.serverNow)/1000));
      if(!matchStarted&&countdown)status(`Race starts in ${countdown}…`);
      else status(game.current.status==='caught'?'ELIMINATED · Spectating the remaining wisps.':
        'SURVIVE! Tap to jump, tap again, hold to glide.');
    }else if(s.state==='finished'){
      const winner=s.players.find(p=>p.id===s.winnerId);
      status(`${winner?winner.name+' wins!':'Race finished.'} · Last wisp standing`);
      if(matchStarted){matchStarted=false;game.finishOnline();}
    }
  }
  function launch(){
    if(!session||!snapshot||matchStarted||snapshot.state!=='running')return;
    const own=snapshot.players.find(p=>p.id===snapshot.me);
    if(!game.startOnline(own?.wisp||'Moss',snapshot.seed,!!snapshot.world,own))return;
    sequence=0;matchStarted=true;
    game.applyOnlineSnapshot?.(snapshot);
    emit('wisp:online-race-start',null);
  }
  async function poll(){
    if(!session||busy)return;
    busy=true;
    const expected=session,epoch=generation;
    try{
      const now=Date.now();let result;
      if(matchStarted&&snapshot?.state==='running'&&now-lastSync>=175){
        lastSync=now;
        const g=game.current;
        result=await request('sync',{...expected,sequence:++sequence,x:g.x,y:g.y,energy:g.energy,
          eliminated:g.status==='caught',reason:g.deathCause||g.reason||'Caught'});
      }else result=await request('state',expected);
      if(session!==expected||generation!==epoch)return; // A stale request must not resurrect a left room.
      update(result);
      if(result.state==='running'&&!matchStarted&&result.serverNow>=result.startAt)launch();
    }catch(error){if(session===expected&&generation===epoch)
      status('Connection: '+(error.name==='AbortError'?'timeout':error.message));}
    finally{busy=false;}
  }
  function connectSocket(){
    if(!session||socket||typeof WebSocket!=='function')return;
    if(Date.now()<reconnectAt)return;
    try{
      const url=endpoint().replace(/^http/,'ws')+'/api/wisp/stream';
      const ws=new WebSocket(url);
      socket=ws;socketReady=false;
      ws.onopen=()=>{if(socket===ws&&session)
        ws.send(JSON.stringify({type:'hello',code:session.code,token:session.token}));};
      ws.onmessage=e=>{
        if(socket!==ws||!session)return;
        try{
          const msg=JSON.parse(e.data);
          if(msg.type==='snapshot'&&msg.snapshot.code===session.code){
            socketReady=true;update(msg.snapshot);
            if(snapshot.state==='running'&&!matchStarted&&snapshot.serverNow>=snapshot.startAt)launch();
          }else if(msg.type==='error')status('Connection: '+msg.error);
        }catch{ /* Corrupt frames are ignored; HTTP remains available. */ }
      };
      ws.onclose=()=>{if(socket===ws){socket=null;socketReady=false;reconnectAt=Date.now()+3000;}};
      ws.onerror=()=>{if(socket===ws){socketReady=false;try{ws.close();}catch{}}};
    }catch{socket=null;socketReady=false;reconnectAt=Date.now()+3000;}
  }
  function sendSocket(){
    if(!session||!socketReady||socket?.readyState!==1)return;
    if(snapshot?.state==='running'&&!matchStarted&&
      snapshot.serverNow+(performance.now()-snapshotPerf)>=snapshot.startAt)launch();
    if(matchStarted&&snapshot?.state==='running'){
      const g=game.current;
      socket.send(JSON.stringify({type:'sync',sequence:++sequence,x:g.x,y:g.y,
        energy:g.energy,eliminated:g.status==='caught',reason:g.deathCause||g.reason||'Caught'}));
    }else socket.send(JSON.stringify({type:'state'}));
  }
  function startPolling(){
    if(timer)clearInterval(timer);
    timer=setInterval(()=>{
      if(!session)return;
      if(socketReady){sendSocket();return;}
      if(Date.now()-lastFallback>=250){lastFallback=Date.now();void poll();}
      if(!socket)connectSocket();
    },100);
    void poll();connectSocket();
  }
  async function enter(op,{name,wisp,code}={}){
    if(session||entering)throw new Error('A room is already active or being joined.');
    entering=true;
    const epoch=generation;
    try{
      const result=await request(op,{name,wisp,...(op==='join'?{code}:{})});
      if(generation!==epoch)return null; // Ignore a creation that completed after local exit.
      session={code:result.snapshot.code,token:result.token};
      generation++;sequence=0;matchStarted=false;lastSync=0;
      game.setOnlineRoom(true);persist();update(result.snapshot);startPolling();
      return result;
    }finally{entering=false;}
  }
  async function leave(){
    const old=session;
    generation++;session=null;snapshot=null;matchStarted=false;
    remoteMotion?.reset();
    const oldSocket=socket;socket=null;socketReady=false;
    if(oldSocket)try{oldSocket.close(1000,'Leaving room');}catch{}
    clearInterval(timer);timer=null;persist();
    game.setOnlineRoom(false);game.setPaused(true);
    emit('wisp:online-state',null);
    status('Left the online room. Solo play is available.');
    if(old)try{await request('leave',old);}catch{/* Local exit must work even if the Worker is offline. */}
  }
  async function start(){
    if(!session)throw new Error('Join a room first.');
    const expected=session,epoch=generation;
    const result=await request('start',expected);
    if(session!==expected||generation!==epoch)return null;
    update(result);return result;
  }
  async function rematch(){
    if(!session)throw new Error('Join a room first.');
    const expected=session,epoch=generation;
    const result=await request('rematch',expected);
    if(session!==expected||generation!==epoch)return null;
    update(result);return result;
  }
  async function invite(){
    if(!session)throw new Error('Join a room first.');
    const url=location.protocol==='file:'?new URL(location.href):new URL('/games/wisp/',location.origin);
    url.searchParams.set('room',session.code);
    if(api&&api!==DEFAULT_WORKER)url.searchParams.set('api',api);
    try{await navigator.clipboard.writeText(url.toString());status('Invite link copied.');}
    catch{status('Invite: '+url.toString());}
    return url.toString();
  }

  // The session is restored after reload, but there is only one room UI: menu.js.
  try{
    const saved=JSON.parse(sessionStorage.getItem(sessionKey)||'null');
    if(saved&&/^\d{6}$/.test(saved.code)&&typeof saved.token==='string'&&
       (!qs.get('room')||saved.code===qs.get('room'))){
      session=saved;game.setOnlineRoom(true);startPolling();
    }
  }catch{}

  window.WispOnline={
    snapshot:()=>snapshot,create:options=>enter('create',options),
    join:options=>enter('join',options),start,rematch,leave,invite,
    isSpectating(){return Boolean(session&&snapshot?.state==='running'&&game.current.status==='caught');},
    camera(_g,solo){
      if(!this.isSpectating())return solo;
      const live=snapshot.players.filter(p=>p.alive).sort((a,b)=>b.distance-a.distance);
      const leader=live[0];
      return leader?game.cameraForX(remoteMotion?.sample(leader.id)?.x??leader.x):solo;
    },
    draw(ctx,_g,camera){
      if(!matchStarted||!snapshot)return;
      for(const p of snapshot.players){
        if(p.id===snapshot.me||!p.alive)continue;
        const motion=remoteMotion?.sample(p.id)||p;
        const image=localImages[p.wisp],x=motion.x-camera,y=motion.y;
        if(x<-90||x>1050)continue;
        if(image?.complete&&image.naturalWidth){
          ctx.save();ctx.globalAlpha=p.connected?.88:.32;
          ctx.translate(x,y-31);
          ctx.rotate(Math.max(-.12,Math.min(.12,(motion.vy||0)/3800)));
          ctx.drawImage(image,-39,-39,78,78);ctx.restore();
        }
        ctx.save();ctx.font='bold 13px system-ui';ctx.textAlign='center';
        ctx.fillStyle='#e4f6dd';ctx.fillText(p.name,x,y-77);ctx.restore();
      }
    }
  };
})();
