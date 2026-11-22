import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../../..');
const file=(path)=>readFile(join(root,path),'utf8');
test('WISP polygon menu and multiplayer bridge load in order',async()=>{
  const page=await file('public/games/wisp/play.html');
  const online=await file('public/games/wisp/online.js');
  const menu=await file('public/games/wisp/menu.js');
  assert.ok(page.includes('href="menu.css"'));
  assert.ok(page.indexOf('<script src="online.js"></script>')<page.indexOf('<script src="menu.js"></script>'));
  assert.match(menu,/WispGame/);
  assert.match(menu,/wm-wisps/);
  assert.match(menu,/wisp:online-race-start/);
  assert.match(online,/wisp:online-state/);
  assert.match(online,/wisp:online-race-start/);
  assert.match(online,/create:options=>enter\('create',options\)/);
  assert.doesNotMatch(online,/createElement\('section'\)|wisp-online-entry|id=\"wisp-name\"/);
  assert.match(online,/generation!==epoch/);
  for(const filename of ['menu.css','menu.js',...['moss','ember','dew','gale','dusk'].map(x=>'assets/'+x+'.svg')])
    await access(join(root,'public/games/wisp',filename));
});

test('published WISP page contains only player controls, no development panel',async()=>{
  const page=await file('public/games/wisp/play.html');
  const runner=await file('public/games/wisp/game.js');
  const online=await file('public/games/wisp/online.js');
  assert.match(page,/class="run-dashboard"/);
  assert.match(page,/id="jump"/);
  assert.match(page,/id="restart"[^>]*hidden/);
  for(const id of ['watchMoss','autoplay','hitboxes','orbSmall','orbLarge',
    'forceWarning','forceFrenzy','forceRetreat','previewFire','previewDeath',
    'demoClimb','stageInspect','startEnergy','courseSeed','dropTimber']) {
    assert.equal(page.includes(`id="${id}"`),false,`Development control ${id} leaked`);
  }
  assert.match(runner,/window\.WispGame/);
  assert.match(runner,/if\(\['localhost','127\.0\.0\.1',''\]\.includes\(location\.hostname\)\)/);
  assert.match(online,/game\.startOnline/);
  assert.doesNotMatch(online,/window\.WISP_TEST/);
  assert.doesNotMatch(runner,/const LAYOUT =|function runScenario\(|function drawCourse\(|function inspectStage\(/);
  assert.match(runner,/function stepProcedural\(/);
});
