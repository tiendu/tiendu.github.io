import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root=new URL('../../../../public/games/wisp/',import.meta.url);
const source=readFileSync(new URL('remote-motion.js',root),'utf8');
function create(){
  const window={};
  vm.runInNewContext(source,{window,performance:{now:()=>0}});
  return window.WispRemoteMotion.create();
}
const running=(x,y,overrides={})=>({
  code:'123456',seed:123,startAt:1000,state:'running',me:'own',
  players:[{id:'own',x:155,y:380,alive:true},
    {id:'peer',x,y,alive:true,connected:true}],...overrides
});

test('remote motion interpolates between sparse polling snapshots',()=>{
  const buffer=create();
  buffer.ingest(running(155,380),1000);
  buffer.ingest(running(215,300),1250);
  const midway=buffer.sample('peer',1345); // display time = 1125
  assert.ok(Math.abs(midway.x-185)<.01);
  assert.ok(Math.abs(midway.y-340)<.01);
  const later=buffer.sample('peer',1450); // display time = 1230
  assert.ok(later.x>midway.x && later.x<215);
  assert.ok(later.y<midway.y);
});

test('unchanged poll results do not restart interpolation',()=>{
  const buffer=create();
  buffer.ingest(running(155,380),1000);
  buffer.ingest(running(215,380),1250);
  const before=buffer.sample('peer',1350).x;
  buffer.ingest(running(215,380),1370);
  assert.ok(buffer.sample('peer',1400).x>before);
});

test('small packet gaps allow bounded prediction but no runaway movement',()=>{
  const buffer=create();
  buffer.ingest(running(155,380),1000);
  buffer.ingest(running(215,380),1250);
  const predicted=buffer.sample('peer',1580);
  assert.ok(predicted.x>215 && predicted.x<245);
  const stopped=buffer.sample('peer',3500);
  assert.equal(stopped.x,215);
  assert.equal(stopped.vx,0);
});

test('vertical motion is smoothed and the server state is never changed',()=>{
  const buffer=create();
  const packet=running(215,260);
  buffer.ingest(running(155,380),1000);
  buffer.ingest(packet,1250);
  const frame=buffer.sample('peer',1345);
  assert.ok(frame.vy<0);
  assert.equal(packet.players[1].x,215);
  assert.equal(packet.players[1].y,260);
});

test('other race, disconnected peer and eliminated peer do not leak motion',()=>{
  const buffer=create();
  buffer.ingest(running(155,380),1000);
  buffer.ingest(running(215,340),1250);
  buffer.ingest(running(255,380,{players:[
    {id:'own',alive:true,x:155,y:380},
    {id:'peer',alive:true,connected:false,x:255,y:380}]}),1500);
  assert.equal(buffer.sample('peer',1950).x,255);
  buffer.ingest(running(300,380,{seed:456}),2000);
  assert.equal(buffer.sample('peer',2400).x,300);
  buffer.ingest(running(300,380,{players:[{id:'own',alive:true,x:155,y:380},{id:'peer',alive:false,x:300,y:380}]}),2500);
  assert.equal(buffer.sample('peer',2600),null);
  buffer.ingest({...running(155,380),state:'lobby'},3000);
  assert.equal(buffer.sample('peer',3000),null);
});

test('a fresh network snapshot does not cause a visible position jump',()=>{
  const buffer=create();
  buffer.ingest(running(155,380),1000);
  buffer.ingest(running(215,380),1250);
  const before=buffer.sample('peer',1499).x;
  buffer.ingest(running(275,380),1500);
  const after=buffer.sample('peer',1500).x;
  assert.ok(Math.abs(after-before)<2,`jumped ${after-before} pixels`);
});

test('online renderer and spectator camera use sampled movement',()=>{
  const online=readFileSync(new URL('online.js',root),'utf8');
  const menu=readFileSync(new URL('menu.js',root),'utf8');
  assert.match(online,/remoteMotion\?\.ingest\(s\)/);
  assert.match(online,/remoteMotion\?\.sample\(p\.id\)\|\|p/);
  assert.match(online,/remoteMotion\?\.sample\(leader\.id\)/);
  assert.match(menu,/if\(s\?\.state==='running'&&raceRunning\)return/);
});

test('browser loads remote-motion helper before the online renderer',()=>{
  const page=readFileSync(new URL('play.html',root),'utf8');
  assert.ok(page.indexOf('<script src="remote-motion.js"></script>')>=0);
  assert.ok(page.indexOf('<script src="remote-motion.js"></script>')<page.indexOf('<script src="online.js"></script>'));
});
