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
  assert.match(menu,/WISP_TEST/);
  assert.match(menu,/wm-wisps/);
  assert.match(menu,/wisp:online-race-start/);
  assert.match(online,/wisp:online-state/);
  assert.match(online,/wisp:online-race-start/);
  assert.match(online,/create\(\{name,wisp\}\)/);
  for(const filename of ['menu.css','menu.js',...['moss','ember','dew','gale','dusk'].map(x=>'assets/'+x+'.svg')])
    await access(join(root,'public/games/wisp',filename));
});
