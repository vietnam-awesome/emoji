import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('static search emits sharded exact-Unicode variant groups', async () => {
  const build = await read('scripts/build-static-search.mjs');
  assert.match(build, /const variantGroups = new Map\(\)/);
  assert.match(build, /OUT_DIR, 'variants'/);
  assert.match(build, /variantGroupCount/);
  assert.match(build, /license/);
});

test('emoji detail exposes other source versions without adding per-page build work', async () => {
  const detail = await read('src/components/beui/EmojiDetail.astro');
  const client = await read('src/scripts/emoji-variants.js');
  assert.match(detail, /Other versions/);
  assert.match(detail, /data-variant-section/);
  assert.match(detail, /emoji-variants\.js/);
  assert.match(client, /variants\/\$\{prefix\}\.json/);
  assert.match(client, /entry\.l/);
  assert.match(client, /section\.hidden = false/);
});
