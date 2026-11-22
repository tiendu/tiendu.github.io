/* WISP multiplayer beta: shared seed, room membership and live race positions.
 * The Cloudflare Durable Object tracks results. Full server-side obstacle and
 * Cutter simulation is a future hardening task, not claimed in this beta. */
(() => {
  'use strict';
  const qs = new URLSearchParams(location.search);
  const defaultApi = qs.get('api') || window.WISP_ROOM_API || (location.hostname==='tiendu.github.io'?'https://wisp-multiplayer.tiendu107.workers.dev':(['localhost','127.0.0.1'].includes(location.hostname)?'http://127.0.0.1:8787':''));
  const sessionKey = 'wisp-room-session-v1';
  const frame = document.querySelector('.game-frame');
  if (!frame || !window.WISP_TEST) return;
  const panel = document.createElement('section');
  panel.className = 'wisp-online';
  panel.setAttribute('aria-label', 'WISP online multiplayer');
  panel.innerHTML = `<style>
.wisp-online{margin:12px 0;border:1px solid #477467;border-radius:15px;background:#0d2930;padding:15px;color:#dff1e9}
.wisp-online h2{margin:0 0 9px}.wisp-online .line{display:flex;gap:8px;flex-wrap:wrap;align-items:end}
.wisp-online label{min-width:110px;flex:1}.wisp-online input,.wisp-online select{width:100%;max-width:340px;background:#193d42;color:#f0fff6;padding:9px;border:1px solid #53776b;border-radius:8px;font:inherit;font-size:14px}
.wisp-online button{min-height:41px}.wisp-online small{color:#a8c6bc;display:block;margin:8px 0}
.wisp-online .roster{display:flex;gap:8px;flex-wrap:wrap;margin:9px 0}.wisp-online .seat{padding:7px 10px;border:1px solid #416d60;border-radius:8px;font-size:12px}
.wisp-online .seat.dead{opacity:.5}.wisp-online [hidden]{display:none!important}
</style>
<h2>ONLINE RACE <small style="display:inline;font-weight:normal">2–4 wisps · last standing wins</small></h2>
<div class="line" id="wisp-online-entry">
  <label>Player name<input id="wisp-name" maxlength="18" value="Wisp" autocomplete="nickname"></label>
  <label>Wisp<select id="wisp-choice"><option>Moss</option><option>Ember</option><option>Dew</option><option>Gale</option><option>Dusk</option></select></label>
  <label>Room code<input id="wisp-code" maxlength="6" inputmode="numeric" placeholder="123456"></label>
  <button id="wisp-create">Create room</button><button id="wisp-join">Join room</button>
</div>
<div id="wisp-online-room" hidden>
  <strong id="wisp-room-code"></strong>
  <div class="roster" id="wisp-roster"></div>
  <div class="line"><button id="wisp-invite">Copy invite</button><button id="wisp-start">Start race</button><button id="wisp-leave">Leave</button></div>
</div>
<small id="wisp-online-status" role="status">Solo play works without a server. Online racing needs the WISP Cloudflare Worker.</small>
<details><summary style="cursor:pointer;font-size:12px">Server connection</summary><label>Cloudflare Worker URL<input id="wisp-api" type="url" placeholder="https://wisp-multiplayer.…workers.dev"></label></details>`;
  frame.insertAdjacentElement('beforebegin', panel);
  // The polygon menu owns presentation. Keep the original field controls as
  // an internal compatibility layer for room requests and session handling.
  panel.hidden = true;
  const $ = id => panel.querySelector('#'+id);
  $('wisp-api').value = defaultApi;
  $('wisp-code').value = (qs.get('room')||'').replace(/\D/g,'').slice(0,6);
  const localImages = Object.fromEntries(['Ember','Moss','Dew','Gale','Dusk'].map(name=>{
    const img = new Image(); const file=name.toLowerCase()+'.svg'; img.src=window.WISP_VECTOR_ASSETS?.[file]||'./assets/'+file; return [name,img];
  }));
  let session=null, snapshot=null, sequence=0, matchStarted=false;
  let polling=false, busy=false, timer=null, lastSync=0, lastRevision=-1;
  const setStatus = s => {
    $('wisp-online-status').textContent=s;
    window.dispatchEvent(new CustomEvent('wisp:online-status',{detail:s}));
  };
  const endpoint = () => $('wisp-api').value.trim().replace(/\/$/,'');
  async function request(op, data={}) {
    const base=endpoint();
    if (!/^https?:\/\/[^/]+/.test(base)) throw new Error('Configure the WISP Worker URL first.');
    const ctl=new AbortController();const timeout=setTimeout(()=>ctl.abort(),8000);
    try {
      const response=await fetch(base+'/api/wisp/'+op,{method:'POST',
        headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:ctl.signal,cache:'no-store'});
      const body=await response.json();
      if (!response.ok) throw new Error(body.error||`Room error ${response.status}`);
      return body;
    }finally{clearTimeout(timeout);}
  }
  function persist(){try{if(session)sessionStorage.setItem(sessionKey,JSON.stringify(session));else sessionStorage.removeItem(sessionKey);}catch{}}
  function showRoom(s){
    if(!s)return;
    snapshot=s;
    $('wisp-online-entry').hidden=true;$('wisp-online-room').hidden=false;
    $('wisp-room-code').textContent='ROOM '+s.code+' · '+s.state.toUpperCase();
    $('wisp-start').hidden=!(s.host&&s.state==='lobby');
    $('wisp-start').disabled=s.players.length<2;
    const roster=$('wisp-roster');roster.replaceChildren();
    const standings=[...s.players].sort((a,b)=>b.distance-a.distance);
    for(const p of standings){
      const div=document.createElement('span');div.className='seat'+(p.alive?'':' dead');
      const winner=p.id===s.winnerId?' 🏆':'';
      div.textContent=`${p.name} · ${p.wisp} · ${Math.round(p.distance)}m${p.host?' · HOST':''}${!p.connected?' · AWAY':''}${p.alive?'':' · OUT'}${winner}`;
      roster.append(div);
    }
    if(s.state==='lobby')setStatus(`${s.players.length}/4 players. Invite a friend, then the host starts.`);
    else if(s.state==='running'){
      const seconds=Math.max(0,Math.ceil((s.startAt-s.serverNow)/1000));
      if(!matchStarted&&seconds>0)setStatus('Race starts in '+seconds+'…');
      else setStatus(window.WISP_TEST.current.status==='caught'?'ELIMINATED · Spectating the remaining wisps.':'SURVIVE! One button: tap, tap again, hold to glide.');
    }else if(s.state==='finished'){
      const winner=s.players.find(p=>p.id===s.winnerId);
      setStatus(`${winner?winner.name+' wins!':'Race finished.'} · Last wisp standing`);
    }
    window.dispatchEvent(new CustomEvent('wisp:online-state',{detail:s}));
  }
  function launchRace(){
    if(!session||!snapshot||matchStarted)return;
    matchStarted=true;
    const game=window.WISP_TEST;
    const own=snapshot.players.find(p=>p.id===snapshot.me);
    const selector=document.querySelector('select#character');if(selector&&own)selector.value=own.wisp;
    const seedInput=document.querySelector('#courseSeed');if(seedInput)seedInput.value=snapshot.seed;
    game.reset(own?.wisp||'Moss',100,false,false);
    game.current.seed=snapshot.seed;
    game.setPaused(false);
    sequence=0;
    window.dispatchEvent(new Event('wisp:online-race-start'));
  }
  async function poll(){
    if(!session||busy)return;
    busy=true;
    try{
      const now=Date.now();
      let result;
      if(matchStarted&&snapshot?.state==='running'&&now-lastSync>=175){
        lastSync=now;
        const g=window.WISP_TEST.current;
        result=await request('sync',{...session,sequence:++sequence,x:g.x,y:g.y,energy:g.energy,
          eliminated:g.status==='caught',reason:g.deathCause||g.reason||'Caught'});
      }else{result=await request('state',session);}
      showRoom(result);
      if(result.state==='running'&&!matchStarted&&result.serverNow>=result.startAt)launchRace();
      if(result.state==='finished'&&matchStarted){window.WISP_TEST.setPaused(true);}
      lastRevision=result.revision;
    }catch(err){setStatus('Connection: '+(err.name==='AbortError'?'timeout':err.message));}
    finally{busy=false;}
  }
  function startPolling(){if(timer)clearInterval(timer);timer=setInterval(poll,250);poll();}
  async function entry(op){
    try{
      const name=$('wisp-name').value.trim();const wisp=$('wisp-choice').value;
      const response=await request(op,{name,wisp,...(op==='join'?{code:$('wisp-code').value.trim()}:{})});
      session={code:response.snapshot.code,token:response.token};matchStarted=false;
      persist();showRoom(response.snapshot);startPolling();
    }catch(err){setStatus(err.message);throw err;}
  }
  $('wisp-create').onclick=()=>entry('create').catch(()=>{});
  $('wisp-join').onclick=()=>entry('join').catch(()=>{});
  $('wisp-start').onclick=async()=>{try{showRoom(await request('start',session));}catch(err){setStatus(err.message);}};
  $('wisp-leave').onclick=async()=>{
    if(session)try{await request('leave',session);}catch{}
    session=null;snapshot=null;matchStarted=false;persist();if(timer)clearInterval(timer);
    $('wisp-online-entry').hidden=false;$('wisp-online-room').hidden=true;
    window.WISP_TEST.setPaused(true);setStatus('Left online room. Solo play is available.');
    window.dispatchEvent(new CustomEvent('wisp:online-state',{detail:null}));
  };
  $('wisp-invite').onclick=async()=>{
    if(!session)throw new Error('Join a room before copying an invite.');
    const u=location.protocol==='file:'?new URL(location.href):new URL('/games/wisp/',location.origin);u.searchParams.set('room',session.code);
    if(endpoint() && !endpoint().includes('wisp-multiplayer.tiendu107.workers.dev'))u.searchParams.set('api',endpoint());
    try{await navigator.clipboard.writeText(u.toString());setStatus('Invite link copied.');}
    catch{setStatus('Invite: '+u.toString());return u.toString();}
    return u.toString();
  };
  try {const data=JSON.parse(sessionStorage.getItem(sessionKey)||'null');
    if(data&&/^\d{6}$/.test(data.code)&&data.token&&(!qs.get('room')||data.code===qs.get('room'))){
      session=data;startPolling();
    }}catch{}
  window.WispOnline={
    snapshot(){return snapshot;},
    create({name,wisp}){$('wisp-name').value=name;$('wisp-choice').value=wisp;return entry('create');},
    join({name,wisp,code}){$('wisp-name').value=name;$('wisp-choice').value=wisp;$('wisp-code').value=code;return entry('join');},
    start:async()=>{if(!session)throw new Error('Join a room first.');const result=await request('start',session);showRoom(result);return result;},
    leave:()=>$('wisp-leave').onclick(),
    invite:async()=>{const url=await $('wisp-invite').onclick();return url;},
    isSpectating(){return !!(session && matchStarted && snapshot?.state==='running' && window.WISP_TEST.current.status==='caught');},
    camera(g,solo){
      if(!this.isSpectating())return solo;
      const live=snapshot.players.filter(p=>p.alive).sort((a,b)=>b.distance-a.distance);
      return live.length?Math.max(0,live[0].x-210):solo;
    },
    draw(ctx,g,camera){
      if(!matchStarted||!snapshot)return;
      for(const p of snapshot.players){
        if(p.id===snapshot.me||!p.alive)continue;
        const img=localImages[p.wisp];
        const sx=p.x-camera;if(sx<-90||sx>1050)continue;
        if(img.complete&&img.naturalWidth){ctx.save();ctx.globalAlpha=p.connected?.68:.32;ctx.drawImage(img,sx-39,p.y-70,78,78);ctx.restore();}
        ctx.save();ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.fillStyle='#e4f6dd';ctx.fillText(p.name,sx,p.y-77);ctx.restore();
      }
    }
  };
})();
