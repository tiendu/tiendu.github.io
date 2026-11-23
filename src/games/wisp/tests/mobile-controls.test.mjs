import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root = new URL('../../../../',import.meta.url);
const source = path => readFileSync(new URL(path,root),'utf8');

test('mobile jump control sits below the frame instead of being pinned to the viewport',()=>{
  const html=source('public/games/wisp/play.html');
  assert.match(html,/\.game-actions \{ position:static; margin-top:7px;/);
  assert.doesNotMatch(html,/\.game-actions \{ position:fixed/);
  assert.match(html,/id="jump-hint"/);
  assert.match(html,/HOLD TO GLIDE/);
});

test('MENU is in the header, outside the playable canvas and HUD',()=>{
  const menu=source('public/games/wisp/menu.js');
  const css=source('public/games/wisp/menu.css');
  assert.match(menu,/querySelector\('\.game-header'\)\.append\(menuBtn,exitBtn\)/);
  assert.doesNotMatch(menu,/document\.body\.append\(menuBtn,exitBtn\)/);
  assert.match(css,/#wisp-menu-trigger,#wisp-exit-room\{position:static/);
});

test('jump feedback distinguishes held input from real downward glide',()=>{
  const game=source('public/games/wisp/game.js');
  const html=source('public/games/wisp/play.html');
  assert.match(game,/if \(gliding && game\.vy > 0\) setJumpFeedback\('gliding'\)/);
  assert.match(game,/setJumpFeedback\('idle'\)/);
  assert.match(game,/GLIDING · RELEASE TO DROP/);
  assert.match(html,/@media\(prefers-reduced-motion:reduce\).*animation:none!important/);
});
