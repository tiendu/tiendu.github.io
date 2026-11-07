import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import {startServer} from '../src/node-server.mjs';
const origin = 'http://localhost:4321';
const base = 'http://127.0.0.1:8789';
const delay = ms => new Promise(r => setTimeout(r, ms));

test(`${process.env.NUMBER_TEST_BACKEND==='node'?'Node':'Cloudflare'} backend: 20 seats, lobby, turns, reconnect, host transfer and next round`, {timeout:60000}, async () => {
  const directory = await mkdtemp(join(tmpdir(),'number-worker-'));
  const nodeBackend=process.env.NUMBER_TEST_BACKEND==='node';
  let app;
  if(nodeBackend) app=await startServer({port:8789,host:'127.0.0.1',database:join(directory,'game.sqlite'),origins:origin,maxRooms:1});
  const server = nodeBackend ? null : spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js','dev','--config','wrangler.number.jsonc','--port','8789','--ip','127.0.0.1','--persist-to',directory,'--var',`ALLOWED_ORIGINS:${origin}`,'--var','MAX_ROOMS:1'], {
    stdio:['ignore','pipe','pipe'], env:{...process.env,WRANGLER_SEND_METRICS:'false'}
  });
  let logs='';
  server?.stdout.on('data',d=>{logs=(logs+d).slice(-12000);});
  server?.stderr.on('data',d=>{logs=(logs+d).slice(-12000);});
  const sockets=[];
  function client(id, token, name='Guest') {
    const ws=new WebSocket(`${base.replace('http','ws')}/rooms/${id}`,{origin});
    sockets.push(ws);
    const queue=[];
    ws.on('message', raw=>{ if(String(raw)==='pong') queue.push({type:'pong'}); else queue.push(JSON.parse(raw)); });
    ws.on('error',()=>{});
    ws.on('open',()=>ws.send(JSON.stringify({type:'join',token,name})));
    return {ws, queue, async next(type,predicate=()=>true) {
      const end=Date.now()+5000;
      while(Date.now()<end) {
        const i=queue.findIndex(x=>x.type===type && predicate(x));
        if(i>=0) return queue.splice(i,1)[0];
        await delay(20);
      }
      throw new Error(`Missing ${type}; queue=${JSON.stringify(queue)}; logs=${logs}`);
    }};
  }
  try {
    let started=false;
    for(let i=0;i<200;i++) {
      try { const r=await fetch(base); if(r.status===403) {started=true;break;} } catch {}
      if(server && server.exitCode!==null) break;
      await delay(100);
    }
    assert.ok(started,logs);
    assert.equal((await fetch(`${base}/rooms`,{method:'POST',headers:{Origin:'https://bad.example'}})).status,403);
    const response=await fetch(`${base}/rooms`,{method:'POST',headers:{Origin:origin}});
    assert.equal(response.status,200);
    const {room,token}=await response.json();
    const full=await fetch(`${base}/rooms`,{method:'POST',headers:{Origin:origin}});
    assert.equal(full.status,503); assert.equal(full.headers.get('Retry-After'),'60');
    // Reaching the global cap must not prevent existing players from joining.

    assert.match(room,/^\d{6}$/);
    const a=client(room,token,'Tien');await a.next('joined');
    let state=await a.next('state');assert.equal(state.phase,'lobby');
    const b=client(room,undefined,'Bee');const guestToken=(await b.next('joined')).token;
    await b.next('state');
    const c=client(room,undefined,'Cee');await c.next('joined');await c.next('state');
    state=await a.next('state',s=>s.players.length===3);
    await delay(120);
    b.ws.send(JSON.stringify({type:'start',revision:state.revision}));await b.next('error');
    a.ws.send(JSON.stringify({type:'start',revision:state.revision}));
    state=await a.next('state',s=>s.phase==='playing');
    assert.equal(state.order.length,3);assert.equal('target' in state,false);
    const actors=new Map([[state.player,a]]);
    actors.set((await b.next('state',s=>s.phase==='playing')).player,b);
    actors.set((await c.next('state',s=>s.phase==='playing')).player,c);
    const late=[];
    for(let i=0;i<17;i++) {
      const g=client(room,undefined,'Late '+i);await g.next('joined');
      const v=await g.next('state');assert.equal(v.order.includes(v.player),false);late.push(g);
    }
    state=await a.next('state',s=>s.players.length===20);
    const fullGuest=client(room);assert.equal(await new Promise(r=>fullGuest.ws.once('close',r)),4003);
    b.ws.close();await a.next('state',s=>!s.players.find(p=>p.name==='Bee').connected);
    const rejoined=client(room,guestToken);await rejoined.next('joined');
    const restored=await rejoined.next('state');actors.set(restored.player,rejoined);
    state=await a.next('state',s=>s.revision===restored.revision);
    for(let i=0;!state.over && i<8;i++) {
      await delay(120);const actor=actors.get(state.turn);const old=state.revision;
      actor.ws.send(JSON.stringify({type:'guess',value:Math.floor((state.low+state.high)/2),revision:old}));
      state=await a.next('state',s=>s.revision>old);
    }
    assert.ok(state.over);const loser=state.loser;
    assert.equal(state.players.find(p=>p.id===loser).explosions,1);
    assert.equal(state.players.reduce((sum,p)=>sum+p.explosions,0),1);
    for(const g of [rejoined,c,...late]) {
      const v=await g.next('state',s=>s.over);assert.equal(v.target,state.target);assert.equal(v.loserName,state.loserName);
      assert.equal(v.players.find(p=>p.id===loser).explosions,1);
    }
    await delay(120);a.ws.send(JSON.stringify({type:'start',revision:state.revision}));
    state=await a.next('state',s=>s.round===2);assert.equal(state.order.length,20);assert.equal(state.turn,loser);
    assert.equal('target' in state,false);
    assert.equal(state.players.find(p=>p.id===loser).explosions,1);
    a.ws.send('ping');await a.next('pong');
    await delay(120);a.ws.send(JSON.stringify({type:'leave'}));
    const transferred=await rejoined.next('state',s=>s.players.length===19);
    assert.equal(transferred.host,transferred.player);

  } finally {
    sockets.forEach(ws=>ws.terminate());
    if(app) await app.close();
    if(server) {
    server.kill('SIGTERM');
    await Promise.race([new Promise(r=>server.once('exit',r)),delay(2000)]);
    if(server.exitCode===null) server.kill('SIGKILL');
    }
    await rm(directory,{recursive:true,force:true});
  }
});
