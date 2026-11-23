/* WISP polygon main menu. Keep presentation separate from the one-button runner. */
(() => {
  'use strict';
  const engine = window.WispGame;
  const online = window.WispOnline;
  if (!engine) return;
  const names = ['Moss','Ember','Dew','Gale','Dusk'];
  const traits = ['ENDURANCE','SPRINTER','BALANCED','ACROBAT','SURVIVOR'];
  let selected = 'Moss';
  let mode = 'solo';
  let room = null;
  let raceRunning = false;
  let resultKey = null;

  const menu = document.createElement('section');
  menu.id = 'wisp-menu';
  menu.setAttribute('aria-label', 'WISP main menu');
  menu.innerHTML = `
    <div class="wm-scene" aria-hidden="true"><div class="wm-ridge far"></div><div class="wm-ridge near"></div><div class="wm-topline"></div></div>
    <div class="wm-shell">
      <header class="wm-header"><div><h1 class="wm-brand">WISP</h1><p class="wm-subtitle">Run while the forest disappears</p></div><span class="wm-badge">LOW-POLY FOREST SURVIVAL</span></header>
      <div class="wm-board">
        <div class="wm-headrow"><span class="wm-label">01 / Choose your spirit</span><span class="wm-hint">Five spirits. One button. No weapons.</span></div>
        <div class="wm-list" id="wm-wisps" aria-label="Choose your wisp"></div>
        <div class="wm-line"></div>
        <div class="wm-headrow"><span class="wm-label">02 / Choose your run</span><span class="wm-hint">The Cutter and the wildfire are hunting.</span></div>
        <div class="wm-modes" role="tablist" aria-label="Game mode">
          <button type="button" class="wm-mode" id="wm-solo-tab" role="tab" aria-selected="true"><strong>SOLO RUN</strong><small>Outrun the forest's destruction</small></button>
          <button type="button" class="wm-mode" id="wm-online-tab" role="tab" aria-selected="false"><strong>ONLINE RACE</strong><small>2–5 wisps · one of each spirit</small></button>
        </div>
        <div id="wm-solo-panel" role="tabpanel" aria-labelledby="wm-solo-tab">
          <div class="wm-actions"><p class="wm-hint">Tap = jump · Tap twice = double-jump · Hold = glide<br>Collect essence. At 0% energy you slow down—you don't die.</p>
            <button id="wm-start-solo" class="wm-cta" type="button">RUN THE FOREST ›</button></div>
        </div>
        <div id="wm-online-panel" role="tabpanel" aria-labelledby="wm-online-tab" hidden>
          <div id="wm-online-entry">
            <div class="wm-online-form"><label class="wm-field" for="wm-player">PLAYER NAME<input id="wm-player" maxlength="18" autocomplete="nickname" placeholder="Optional · your Wisp name is the default" /></label>
              <label class="wm-field" for="wm-code">ROOM CODE (TO JOIN)<input id="wm-code" maxlength="6" inputmode="numeric" pattern="[0-9]{6}" autocomplete="off" placeholder="123456" /></label></div>
            <div class="wm-online-controls"><button type="button" class="wm-cta" id="wm-create">CREATE ROOM</button><button type="button" class="wm-secondary" id="wm-join">JOIN ROOM</button></div>
          </div>
          <div id="wm-lobby" class="wm-room" hidden>
            <span class="wm-room-meta">PRIVATE ROOM · SHARE WITH FRIENDS</span><div class="wm-code" id="wm-room-code">------</div>
            <div class="wm-roster" id="wm-roster"></div>
            <div class="wm-online-controls"><button type="button" id="wm-begin" class="wm-cta">START RACE</button><button type="button" id="wm-invite" class="wm-secondary">COPY INVITE</button><button type="button" id="wm-leave" class="wm-secondary">LEAVE ROOM</button></div>
          </div>
          <p class="wm-notice" id="wm-online-note" role="status">Create a private room, then share the six-digit code.</p>
        </div>
        <p class="wm-help">One input: <span>JUMP</span> · double-tap to jump again · hold while falling to glide.</p>
      </div>
      <div class="wm-footer"><span>01 LIVING  /  02 DISTURBED  /  03 LOGGED  /  04 BURNT</span><span>EVERY FOREST FALLS DIFFERENTLY</span></div>
    </div>`;
  document.body.append(menu);
  // The result dialog stays in the playable frame, above the canvas, Cutter
  // and wildfire overlays. Never place interactive replay controls on canvas.
  const result=document.createElement('section');
  result.id='wisp-result';result.hidden=true;
  result.setAttribute('role','dialog');result.setAttribute('aria-modal','true');
  result.setAttribute('aria-labelledby','wm-result-title');
  result.innerHTML=`<div class="wm-result-card">
    <p class="wm-result-eyebrow" id="wm-result-eyebrow">RUN COMPLETE</p>
    <h2 id="wm-result-title">THE FOREST ENDURES</h2>
    <p class="wm-result-reason" id="wm-result-reason"></p>
    <div class="wm-result-stats" id="wm-result-stats"></div>
    <div class="wm-result-actions">
      <button type="button" class="wm-cta" id="wm-result-replay">REPLAY</button>
      <button type="button" class="wm-secondary" id="wm-result-menu">MENU</button>
    </div>
  </div>`;
  document.querySelector('.game-frame').append(result);
  const $ = id => menu.querySelector('#'+id);
  const $result = id => result.querySelector('#'+id);
  const menuBtn=document.createElement('button');menuBtn.id='wisp-menu-trigger';menuBtn.type='button';menuBtn.hidden=true;menuBtn.textContent='MENU';
  const exitBtn=document.createElement('button');exitBtn.id='wisp-exit-room';exitBtn.type='button';exitBtn.hidden=true;exitBtn.textContent='LEAVE RACE';
  document.querySelector('.game-header').append(menuBtn,exitBtn);

  const cards=$('wm-wisps');
  names.forEach((name,i)=>{
    const button=document.createElement('button');button.type='button';button.className='wm-wisp';button.dataset.wisp=name;
    button.setAttribute('aria-pressed',String(name===selected));
    const img=document.createElement('img');img.src='./assets/'+name.toLowerCase()+'.svg';img.alt='';img.decoding='async';
    const title=document.createElement('span');title.className='wm-name';title.textContent=name.toUpperCase();
    const trait=document.createElement('span');trait.className='wm-trait';trait.textContent=traits[i];
    button.append(img,title,trait);button.addEventListener('click',()=>pick(name));cards.append(button);
  });
  function pick(name){
    if(room || !names.includes(name))return;
    selected=name;
    for(const btn of cards.children)btn.setAttribute('aria-pressed',String(btn.dataset.wisp===selected));
  }
  function tab(which){
    mode=which;
    $('wm-solo-tab').setAttribute('aria-selected',String(which==='solo'));
    $('wm-online-tab').setAttribute('aria-selected',String(which==='online'));
    $('wm-solo-panel').hidden=which!=='solo';
    $('wm-online-panel').hidden=which!=='online';
  }
  $('wm-solo-tab').addEventListener('click',()=>{if(!room)tab('solo');});
  $('wm-online-tab').addEventListener('click',()=>tab('online'));
  function show(){
    if(raceRunning)return; // No pause/escape advantage during a live multiplayer race.
    closeResult();
    engine.setPaused(true);menu.hidden=false;menuBtn.hidden=true;
    (mode==='online'?$('wm-online-tab'):$('wm-solo-tab')).focus({preventScroll:true});
  }
  function hide(){menu.hidden=true;menuBtn.hidden=raceRunning;}
  const elapsedText=seconds=>{
    const s=Math.max(0,Math.floor(seconds||0));
    return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  };
  function closeResult(){result.hidden=true;resultKey=null;}
  function showResult(key,{eyebrow,title,reason,stats,replayLabel,replayEnabled}){
    if(resultKey===key && !result.hidden)return;
    resultKey=key;
    $result('wm-result-eyebrow').textContent=eyebrow;
    $result('wm-result-title').textContent=title;
    $result('wm-result-reason').textContent=reason;
    const items=$result('wm-result-stats');items.replaceChildren();
    for(const [label,value] of stats){
      const card=document.createElement('div');card.className='wm-result-stat';
      const number=document.createElement('strong');number.textContent=String(value);
      const caption=document.createElement('span');caption.textContent=label;
      card.append(number,caption);items.append(card);
    }
    const replay=$result('wm-result-replay');
    replay.textContent=replayLabel;replay.disabled=!replayEnabled;
    menu.hidden=true;menuBtn.hidden=true;exitBtn.hidden=true;
    result.hidden=false;
    if(replayEnabled)replay.focus({preventScroll:true});
    else $result('wm-result-menu').focus({preventScroll:true});
  }
  $result('wm-result-replay').addEventListener('click',async()=>{
    if(room){
      if(!room.host||room.state!=='finished')return;
      const button=$result('wm-result-replay');button.disabled=true;
      try{await online.rematch();}
      catch(error){button.disabled=false;$result('wm-result-reason').textContent=error.message||'Could not start rematch.';}
    }else{
      closeResult();startSolo();
    }
  });
  $result('wm-result-menu').addEventListener('click',async()=>{
    if(room){
      const button=$result('wm-result-menu');button.disabled=true;
      try{await online.leave();}
      finally{button.disabled=false;room=null;raceRunning=false;tab('online');show();}
    }else show();
  });
  window.addEventListener('wisp:solo-finished',e=>{
    if(room||engine.onlineRoom)return;
    const g=e.detail;
    const title=g.status==='passed'?'FOREST CLEARED':g.deathCause==='wildfire'
      ?'ENGULFED BY WILDFIRE':/Cutter/i.test(g.reason||'')?'CAUGHT BY THE CUTTER':'THE RUN ENDS';
    showResult(`solo:${g.distance}:${g.seconds}`,{
      eyebrow:'SOLO · RUN COMPLETE',title,
      reason:g.reason||'The forest claimed another Wisp.',
      stats:[['DISTANCE',Math.round(g.distance).toLocaleString('en-US')],
        ['TIME',elapsedText(g.seconds)],['CYCLES',g.cycles]],
      replayLabel:'REPLAY',replayEnabled:true
    });
  });
  function startSolo(){
    if(room || engine.onlineRoom) return;
    if(!engine.startSolo(selected))return;
    raceRunning=false;hide();
  }
  $('wm-start-solo').addEventListener('click',startSolo);
  menuBtn.addEventListener('click',show);
  exitBtn.addEventListener('click',async()=>{
    if(!raceRunning)return;
    exitBtn.disabled=true;
    try{await online?.leave?.();}finally{raceRunning=false;room=null;exitBtn.hidden=true;exitBtn.disabled=false;tab('online');show();}
  });
  $('wm-player').addEventListener('input',e=>{e.target.value=e.target.value.slice(0,18);});
  $('wm-code').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,6);});
  const note = message => { $('wm-online-note').textContent=message||''; };
  async function submit(kind){
    const name=$('wm-player').value.trim();const code=$('wm-code').value.trim();
    if(kind==='join'&&!/^\d{6}$/.test(code)){note('Enter a six-digit room code.');return;}
    if(!online){note('The multiplayer controller is unavailable.');return;}
    const button=kind==='create'?$('wm-create'):$('wm-join');button.disabled=true;
    try {await online[kind]({name,wisp:selected,code});}
    catch(error){note(error.message||'Could not contact WISP rooms.');}
    finally{button.disabled=false;}
  }
  $('wm-create').addEventListener('click',()=>submit('create'));
  $('wm-join').addEventListener('click',()=>submit('join'));
  $('wm-begin').addEventListener('click',async()=>{try{await online.start();}catch(error){note(error.message);}});
  $('wm-invite').addEventListener('click',async()=>{try{await online.invite();}catch(error){note(error.message);}});
  $('wm-leave').addEventListener('click',async()=>{try{await online.leave();}catch(error){note(error.message);}});
  function renderRoom(s){
    room=s;
    $('wm-online-entry').hidden=!!s;
    $('wm-lobby').hidden=!s;
    if(!s){$('wm-online-entry').hidden=false;closeResult();return;}
    tab('online');$('wm-room-code').textContent=s.code;
    const roster=$('wm-roster');roster.replaceChildren();
    // Five fixed slots make claims visible, whether a room has two or five players.
    for(const spirit of names){
      const p=s.players.find(player=>player.wisp===spirit);
      const item=document.createElement('div');
      item.className='wm-seat'+(p?' occupied':' open')+(p&&!p.alive&&s.state==='running'?' out':'');
      if(p?.id===s.me)item.classList.add('mine');
      const icon=document.createElement('img');
      icon.src='./assets/'+spirit.toLowerCase()+'.svg';
      icon.alt='';icon.decoding='async';
      const name=document.createElement('strong');name.textContent=spirit.toUpperCase();
      const detail=document.createElement('span');
      detail.textContent=p?`${p.name}${p.host?' · HOST':''}${s.state==='running'&&!p.alive?' · OUT':''}`:'AVAILABLE';
      item.append(icon,name,detail);roster.append(item);
    }
    $('wm-begin').hidden=!s.host||s.state!=='lobby';
    $('wm-begin').disabled=s.players.length<2;
    $('wm-invite').hidden=s.state!=='lobby';
    $('wm-leave').textContent=s.state==='running'?'LEAVE RACE':'LEAVE ROOM';
    if(s.state==='lobby'){
      closeResult();raceRunning=false;exitBtn.hidden=true;
      menu.hidden=false;menuBtn.hidden=true;engine.setPaused(true);
      note(`${s.players.length}/5 wisps. ${s.host?'Start once a friend joins.':'Waiting for the host to start.'}`);
    }
    if(s.state==='running')note(`Shared forest seed ${s.seed}. Race starting…`);
    if(s.state==='finished'){
      const winner=s.players.find(p=>p.id===s.winnerId);
      note(winner?`${winner.name} won the race.`:'Race finished.');
      raceRunning=false;exitBtn.hidden=true;engine.setPaused(true);
      const standings=[...s.players].sort((a,b)=>b.distance-a.distance);
      showResult(`online:${s.code}:${s.seed}`,{
        eyebrow:'ONLINE · RACE COMPLETE',title:winner?`${winner.name} WINS!`:'RACE COMPLETE',
        reason:s.host?'Choose REMATCH to return this room to the lobby.':'Waiting for the host to request a rematch.',
        stats:standings.map((p,i)=>[`${i+1}. ${p.name} · ${p.wisp}`,Math.round(p.distance).toLocaleString('en-US')]),
        replayLabel:s.host?'REMATCH':'HOST CONTROLS REMATCH',replayEnabled:s.host
      });
    }
  }
  window.addEventListener('wisp:online-state',e=>renderRoom(e.detail));
  window.addEventListener('wisp:online-status',e=>{
    if(mode==='online'&&typeof e.detail==='string'&&!/SURVIVE!/.test(e.detail))note(e.detail);
  });
  window.addEventListener('wisp:online-race-start',()=>{
    closeResult();raceRunning=true;hide();exitBtn.hidden=false;engine.setPaused(false);
  });
  const queryRoom=new URLSearchParams(location.search).get('room');
  if(queryRoom&&/^\d{6}$/.test(queryRoom)){tab('online');$('wm-code').value=queryRoom;note('Invite detected. Choose an available spirit to join.');}
  if(online?.snapshot){const saved=online.snapshot();if(saved)renderRoom(saved);}
  engine.setPaused(true);
  window.WispMenu={open:show,get selected(){return selected;},get mode(){return mode;}};
})();
