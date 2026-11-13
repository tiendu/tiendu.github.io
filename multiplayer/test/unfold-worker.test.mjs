import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{UnfoldRooms} from '../../server/unfold/worker.mjs';

function mockCloudflare(){
  const database=new Map();
  const storage={
    async get(key){return structuredClone(database.get(key));},
    async put(key,value){database.set(key,structuredClone(value));},
    async delete(key){database.delete(key);},
    async list({prefix}){return new Map([...database].filter(([key])=>key.startsWith(prefix)).map(([k,v])=>[k,structuredClone(v)]));}
  };
  const state={storage,blockConcurrencyWhile(fn){return Promise.resolve().then(fn);}};
  const config={UNFOLD_ALLOWED_ORIGINS:'https://tiendu.github.io'};
  let object=new UnfoldRooms(state,config);
  const env={...config,UNFOLD_ROOMS:{idFromName(name){assert.equal(name,'unfold-room-registry-v1');return name;},get(){return {fetch:req=>object.fetch(req)};}}};
  const restart=()=>{object=new UnfoldRooms(state,config);};
  const call=async(op,body,origin='https://tiendu.github.io')=>{
    const req=new Request(`https://unfold.test/api/unfold/${op}`,{
      method:'POST',headers:{'Origin':origin,'Content-Type':'application/json'},body:JSON.stringify(body)
    });
    const res=await worker.fetch(req,env);
    return {status:res.status,data:await res.json(),allow:res.headers.get('Access-Control-Allow-Origin')};
  };
  return {env,call,restart,database};
}

test('Cloudflare room API preserves authority, CORS, and player state across instance restart',async()=>{
  const ctx=mockCloudflare();
  const {call,env}=ctx;
  const health=await worker.fetch(new Request('https://unfold.test/api/unfold/health'),env);
  assert.equal(health.status,200);
  assert.equal((await health.json()).backend,'cloudflare-durable-object');
  const blocked=await call('create',{name:'Evil'},'https://other.example');
  assert.equal(blocked.status,403);
  assert.equal(blocked.allow,null);
  const preflight=await worker.fetch(new Request('https://unfold.test/api/unfold/create',{
    method:'OPTIONS',headers:{'Origin':'https://tiendu.github.io','Access-Control-Request-Method':'POST'}
  }),env);
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'https://tiendu.github.io');
  const alice=await call('create',{name:'Alice',mode:'coop'});
  assert.equal(alice.status,200);
  assert.equal(alice.allow,'https://tiendu.github.io');
  assert.match(alice.data.code,/^\d{6}$/);
  const bob=await call('join',{code:alice.data.code,name:'Bob'});
  assert.equal(bob.status,200);
  const unauthorized=await call('start',{code:alice.data.code,token:bob.data.token});
  assert.equal(unauthorized.status,403);
  const started=await call('start',{code:alice.data.code,token:alice.data.token});
  assert.equal(started.status,200);
  assert.equal(started.data.game.mode,'coop');
  // Exercise an actual authoritative turn and confirm it survives eviction.
  await new Promise(resolve => setTimeout(resolve, 800));
  const activeToken=started.data.game.active===0?alice.data.token:bob.data.token;
  const passed=await call('pass',{code:alice.data.code,token:activeToken,turn:started.data.game.turn});
  assert.equal(passed.status,200);
  assert.equal(passed.data.game.turn,started.data.game.turn+1);
  const revision=passed.data.revision;
  ctx.restart(); // Simulated isolate eviction: same durable storage, new object instance.
  const state=await call('state',{code:alice.data.code,token:bob.data.token});
  assert.equal(state.status,200);
  assert.equal(state.data.revision,revision);
  assert.equal(state.data.seats.length,2);
  assert.deepEqual(state.data.game,passed.data.game);
  const rejoin=await call('join',{code:alice.data.code,token:bob.data.token});
  assert.equal(rejoin.status,200);
  assert.equal(rejoin.data.snapshot.seat,1);
});

test('Cloudflare room API rejects invalid input, missing bindings and unsupported origins',async()=>{
  const ctx=mockCloudflare();
  const badMethod=await worker.fetch(new Request('https://unfold.test/api/unfold/create'),ctx.env);
  assert.equal(badMethod.status,404);
  const badJson=await worker.fetch(new Request('https://unfold.test/api/unfold/create',{
    method:'POST',body:'not-json',headers:{Origin:'https://tiendu.github.io'}
  }),ctx.env);
  assert.equal(badJson.status,400);
  const huge=await worker.fetch(new Request('https://unfold.test/api/unfold/create',{
    method:'POST',body:'a'.repeat(8193),headers:{Origin:'https://tiendu.github.io'}
  }),ctx.env);
  assert.equal(huge.status,413);
  const missing=await worker.fetch(new Request('https://unfold.test/api/unfold/create',{
    method:'POST',body:'{}',headers:{Origin:'https://tiendu.github.io'}
  }),{});
  assert.equal(missing.status,503);
  const evilPreflight=await worker.fetch(new Request('https://unfold.test/api/unfold/create',{
    method:'OPTIONS',headers:{Origin:'https://evil.example'}
  }),ctx.env);
  assert.equal(evilPreflight.status,403);
});
