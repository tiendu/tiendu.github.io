import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const gameFile = join(root, 'public/games/wisp/game.js');
const assets = join(root, 'public/games/wisp/assets');

test('every listed WISP SVG asset exists and no obsolete ground names are requested', async () => {
  const source = await readFile(gameFile, 'utf8');
  const declaration = source.split('const SPRITE_FILES = {')[1]?.split('};')[0];
  assert.ok(declaration, 'SPRITE_FILES not found');
  const entries = [...declaration.matchAll(/(\w+):\s*'([^']+)'/g)];
  assert.ok(entries.length > 0, 'no WISP assets registered');
  assert.equal(new Set(entries.map(([, key]) => key)).size, entries.length, 'duplicate sprite key');
  for (const [,key,filename] of entries) {
    await assert.doesNotReject(access(join(assets,filename)), `${key} => ${filename}`);
  }
  assert.equal(entries.filter(([, , filename])=>filename.startsWith('ground-')).length,0);
});
