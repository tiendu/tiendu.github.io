import {WISPS,HUNTERS} from '../core/characters.mjs';
import {moveActor} from '../core/abilities.mjs';
import {RULES,STEP} from '../core/config.mjs';
const definitions=new Map([...WISPS,...HUNTERS].map(c=>[c.id,c]));
const PROTOCOL=3;
export function backendURL(value){
  if(!value)return null;
  try{const u=new URL(value);if(u.username||u.password||u.search||u.hash||!(u.protocol==='https:'||u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))return null;return u.origin;}catch{return null;}
}
export function hydrateSnapshot(msg,previous){
  return {...msg,board:previous?.seed===msg.seed?previous.board:msg.board,actors:msg.actors.map(a=>({...definitions.get(a.id),...a}))};
}
// Local movement prediction is visual only. Never predict energy, abilities,
// collision outcomes or scores. Each snapshot replaces the authoritative state.
export function predictLocal(state,direction,elapsed){
  const a=state?.actors.find(a=>a.player==='local'&&a.status==='active');
  if(!a)return null;
  const p={...a,dir:[...a.dir],wanted:direction??a.wanted,lunge:a.lunge?{...a.lunge}:null};
  if(['survive','escape'].includes(state.phase)){
    let left=Math.min(.1,Math.max(0,elapsed));
    while(left>1e-8){const dt=Math.min(STEP,left);moveActor(state,p,RULES.speed*dt);left-=dt;}
  }
  return {x:p.x,y:p.y,warp:p.warp};
}
export function socketClient(api,{onState,onLobby,onStatus,onWelcome,onNotice=onStatus,onResult=()=>{}}){
  let playerId=null,ws=null,session=null,retry=null,attempt=0,seq=0,stopped=true,epoch=0,pending=[],latest=null,arrived=0,lastDirection=null,heartbeat=null;
  const clear=()=>{clearTimeout(retry);clearInterval(heartbeat);retry=heartbeat=null;};
  const send=value=>{if(ws?.readyState!==WebSocket.OPEN||ws.bufferedAmount>64*1024)return false;try{ws.send(JSON.stringify(value));return true;}catch{return false;}};
  function connect(){
    clear();const current=++epoch;const endpoint=new URL(`${api}/v3/rooms/${session.code}/socket`);endpoint.protocol=endpoint.protocol==='https:'?'wss:':'ws:';
    onStatus(attempt?'Reconnecting…':'Connecting…');
    ws=new WebSocket(endpoint);
    ws.onopen=()=>{if(current!==epoch)return;send({type:'hello',protocol:PROTOCOL,token:session.token,character:session.character});};
    ws.onmessage=e=>{
      if(current!==epoch)return;let msg;try{msg=JSON.parse(e.data);}catch{return;}
      if(msg.type==='welcome'){
        if(msg.protocol!==PROTOCOL){stop();onStatus('Protocol mismatch');return;}
        playerId=msg.id;session.token=msg.token;session.character=msg.character;seq=msg.seq;pending=[];lastDirection=null;attempt=0;
        onWelcome(msg,session.code);onStatus('Connected');heartbeat=setInterval(()=>send({type:'heartbeat'}),15000);
      }else if(msg.type==='snapshot'){
        const previous=latest;if(previous&&(previous.seed!==msg.seed||msg.tick<previous.tick)){pending=[];lastDirection=null;}latest=hydrateSnapshot(msg,previous);arrived=performance.now();pending=pending.filter(p=>p.seq>msg.ack);
        onState(latest,previous,arrived);
      }else if(msg.type==='lobby'){
        const mine=msg.players.find(p=>p.id===playerId);if(mine)session.character=mine.character;
        if(msg.state!=='running'){pending=[];lastDirection=null;}
        if(msg.state==='lobby')latest=null;
        onLobby(msg);
      }
      else if(msg.type==='result')onResult(msg.result);
      else if(msg.type==='notice')onNotice(msg.message);
      else if(msg.type==='error'){const error=msg.error;stop();onStatus(error);}
    };
    ws.onclose=e=>{
      if(current!==epoch||stopped)return;clear();
      if(e.code===1000||e.code===1008||e.code===1009||e.code===1007){stopped=true;onStatus(e.reason||'Disconnected');return;}
      if(++attempt>6){stopped=true;onStatus('Reconnect failed. Leave room and try again.');return;}
      onStatus('Connection lost · reconnecting');retry=setTimeout(connect,Math.min(5000,400*2**(attempt-1)));
    };
  }
  function stop(){stopped=true;epoch++;clear();if(ws)ws.close();ws=null;session=null;latest=null;pending=[];lastDirection=null;}
  function join(code,character,token){stop();session={code,character,token};stopped=false;attempt=0;connect();}
  async function create(character,mode){
    const generation=epoch;const res=await fetch(`${api}/v3/rooms`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode})}),data=await res.json();
    if(generation!==epoch)return;
    if(!res.ok)throw new Error(data.error||'Could not create room');if(data.protocol!==PROTOCOL)throw new Error('Protocol mismatch');join(data.code,character,data.token);
  }
  function input(direction,ability=false){
    const msg={type:'input',seq:seq+1,...(direction?{direction}:{}),...(ability?{ability:true}:{})};
    if(!send(msg))return;seq++;if(direction){lastDirection=direction;pending.push({seq,direction});if(pending.length>64)pending.shift();}
  }
  return {create,join,input,start:()=>send({type:'start'}),next:()=>send({type:'next'}),rematch:()=>send({type:'rematch'}),mode:mode=>send({type:'mode',mode}),select:character=>send({type:'select',character}),ready:ready=>send({type:'ready',ready}),kick:id=>send({type:'kick',id}),ping:(x,y)=>send({type:'ping',x,y}),leave:()=>{send({type:'leave'});stop();},stop,
    prediction:now=>!stopped&&ws?.readyState===WebSocket.OPEN?predictLocal(latest,pending.at(-1)?.direction??lastDirection,(now-arrived)/1000):null};
}
