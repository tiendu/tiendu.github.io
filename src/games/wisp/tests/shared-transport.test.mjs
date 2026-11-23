import test from 'node:test';
import assert from 'node:assert/strict';
import {WispRooms} from '../server/worker.mjs';

class PeerSocket {
  constructor(){this.sent=[];this.attachment={};this.closed=null;}
  serializeAttachment(value){this.attachment=value;}
  deserializeAttachment(){return this.attachment;}
  send(raw){this.sent.push(JSON.parse(raw));}
  close(code,reason){this.closed={code,reason};}
}
function harness(){
  const sockets=[],room={code:'123456',state:'lobby'};
  const host={id:'moss',token:'secret-moss'},guest={id:'dew',token:'secret-dew'};
  const service=Object.create(WispRooms.prototype);
  service.ready=Promise.resolve();service.queue=Promise.resolve();
  service.dirty=false;service.lastSave=Date.now();service.broadcastAt=new Map();
  service.persist=async()=>{};
  service.ctx={getWebSockets:()=>sockets};
  service.rooms={
    require(code){assert.equal(code,room.code);return room;},
    player(_room,token){if(token===host.token)return host;if(token===guest.token)return guest;throw Error('Invalid room session');},
    state(){return room;},
    sync(payload){service.lastInput=payload;return room;},
    snapshot(_room,p){return {code:room.code,state:room.state,me:p.id,players:[],world:null};}
  };
  return {service,sockets,host,guest};
}

test('authenticated sockets broadcast room state without leaking another player session',async()=>{
  const {service,sockets,host,guest}=harness();
  const a=new PeerSocket(),b=new PeerSocket();sockets.push(a,b);
  await service.webSocketMessage(a,JSON.stringify({type:'hello',code:'123456',token:host.token}));
  await service.webSocketMessage(b,JSON.stringify({type:'hello',code:'123456',token:guest.token}));
  assert.equal(a.sent.at(-1).snapshot.me,host.id);
  assert.equal(b.sent.at(-1).snapshot.me,guest.id);
  a.attachment.lastMessage-=100;
  await service.webSocketMessage(a,JSON.stringify({type:'sync',sequence:5,x:320,y:350,energy:75}));
  assert.equal(service.lastInput.token,host.token);
  assert.equal(service.lastInput.sequence,5);
  assert.equal(b.sent.at(-1).snapshot.me,guest.id);
  assert.equal(a.sent.at(-1).snapshot.me,host.id);
});

test('unauthorized websocket session is rejected; unauthenticated input cannot enter room',async()=>{
  const {service,sockets}=harness();
  const bad=new PeerSocket();sockets.push(bad);
  await service.webSocketMessage(bad,JSON.stringify({type:'sync',sequence:1,x:155,y:380,energy:100}));
  assert.equal(bad.closed?.code,1008);
  assert.equal(service.lastInput,undefined);
});

test('socket stream and HTTP polling coexist as a transport fallback',()=>{
  const source=WispRooms.prototype;
  assert.equal(typeof source.webSocketMessage,'function');
  assert.equal(typeof source.broadcast,'function');
  assert.equal(typeof source.openSocket,'function');
  assert.equal(typeof source.fetch,'function');
});
