import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

// Full HTTP transport smoke test with a real ephemeral Node process.
test('room HTTP API creates, joins, starts and enforces credentials/CORS',async()=>{
  const port=39000+Math.floor(Math.random()*10000);
  const child=spawn(process.execPath,['server/unfold/server.mjs'],{cwd:new URL('..',import.meta.url).pathname,
    env:{...process.env,UNFOLD_ROOM_PORT:String(port),UNFOLD_ROOM_HOST:'127.0.0.1',UNFOLD_ALLOWED_ORIGINS:'https://example.test'},stdio:'ignore'});
  const url=`http://127.0.0.1:${port}`;
  const req=async(route,data,origin='https://example.test')=>{
    const resp=await fetch(`${url}/api/unfold/${route}`,{method:'POST',headers:{'Content-Type':'application/json','Origin':origin},body:JSON.stringify(data)});
    return {code:resp.status,data:await resp.json(),allow:resp.headers.get('access-control-allow-origin')};
  };
  try{
    let ready=false;
    for(let i=0;i<80;i++){
      try{const res=await fetch(`${url}/api/unfold/health`);if(res.ok){ready=true;break;}}
      catch{}await delay(40);
    }
    assert(ready,'server should start');
    const a=await req('create',{name:'Alice',mode:'competitive'});
    assert.equal(a.code,200);assert.equal(a.allow,'https://example.test');
    const b=await req('join',{code:a.data.code,name:'Bob'});
    assert.equal(b.code,200);assert.equal(b.data.snapshot.seats.length,2);
    const bad=await req('state',{code:a.data.code,token:'wrong'});assert.equal(bad.code,403);
    const wrongOrigin=await req('create',{name:'Bad',mode:'coop'},'https://evil.test');assert.equal(wrongOrigin.code,403);
    const started=await req('start',{code:a.data.code,token:a.data.token});assert.equal(started.code,200);
    assert.equal(started.data.game.mode,'competitive');
    const rejoin=await req('join',{code:a.data.code,token:b.data.token});assert.equal(rejoin.data.snapshot.seat,1);
  }finally{child.kill('SIGTERM');}
});
