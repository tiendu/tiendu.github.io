// Refactor regression tests: paths, storage contracts and room transport.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {REEL_FACES} from '../public/games/unfold/ui/reel.mjs';
import {loadSolo,saveSolo,saveRoom} from '../public/games/unfold/ui/storage.mjs';
import {escapeText} from '../public/games/unfold/ui/dom.mjs';
import {makeRoomRequest} from '../public/games/unfold/online/transport.mjs';
import {paintFoldCanvas} from '../public/games/unfold/render/canvas.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url));
const site=path.join(dir,'../public/games/unfold');
test('the public reel still has exactly the same six stops',()=>{
  assert.deepEqual(REEL_FACES,['DEPLOY','DEPLOY','SUPER','RECLAIM','RECLAIM','REFOLD']);
});
test('HTML escaping preserves safe room names and stops markup injection',()=>{
  assert.equal(escapeText(`<a title="x">&'</a>`),'&lt;a title=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});
test('existing solo saves remain readable and room sessions keep original key',()=>{
  const data=new Map();
  globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const old={version:5,players:[{id:0}],die:{face:1,action:'deploy'},cubes:[{cells:[[1,2]]}]};
  saveSolo('unfold-v05',old);
  const restored=loadSolo('unfold-v05');
  assert.equal(restored.cubes[0].number,1);
  assert.equal(restored.nextCubeNumber,2);
  saveRoom('unfold-room-v13',{code:'123456',token:'seat'});
  assert.equal(JSON.parse(data.get('unfold-room-v13')).code,'123456');
  saveRoom('unfold-room-v13',null);
  assert.equal(data.has('unfold-room-v13'),false);
  delete globalThis.localStorage;
});
test('the HTTP room transport keeps the same endpoint and error contract',async()=>{
  const calls=[];
  const request=makeRoomRequest('https://rooms.example.test',async (url,options)=>{
    calls.push([url,options]);
    return {ok:true,json:async()=>({code:'123456'})};
  });
  assert.deepEqual(await request('create',{mode:'coop'}),{code:'123456'});
  assert.equal(calls[0][0],'https://rooms.example.test/api/unfold/create');
  assert.equal(JSON.parse(calls[0][1].body).mode,'coop');
  await assert.rejects(makeRoomRequest('',async()=>({}))('state'),/room server/);
  await assert.rejects(makeRoomRequest('https://rooms.example.test',async()=>({ok:false,status:403,json:async()=>({error:'Forbidden'})}))('state'),/Forbidden/);
});
test('Neon Grid replaces legacy styles and removes unused frame painters',async()=>{
  const astro=await readFile(path.join(dir,'../src/pages/games/unfold/index.astro'),'utf8');
  assert.match(astro,/styles\/foundation\.css/);
  assert.match(astro,/styles\/operator\.css/);
  assert.ok(astro.indexOf('styles/foundation.css')<astro.indexOf('styles/operator.css'));
  const app=await readFile(path.join(site,'app.mjs'),'utf8');
  assert.doesNotMatch(app,/v1[1-8]\.css/);
  for(const sheet of ['foundation.css','operator.css']){
    const css=await readFile(path.join(site,'styles',sheet),'utf8');
    for(const match of css.matchAll(/url\(['"]?(\.\.\/assets\/[^)'"]+)/g)){
      await access(path.resolve(site,'styles',match[1]));
    }
  }
  assert.equal(typeof paintFoldCanvas,'function');
  assert.doesNotMatch(app,/paintTubeFrame|paintLatchFrame|tubeFrame\(\)/);
  for(const name of ['foundation.css','operator.css']){
    const css=await readFile(path.join(site,'styles',name),'utf8');
    assert.doesNotMatch(css,/\.tube-frame\s*\{/);
    assert.doesNotMatch(css,/console-v17|deck-v16|crate-foundry/);
  }
});
