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
  assert.match(detail, /data-variant-section/);
  assert.doesNotMatch(detail, /Other versions/);
  assert.doesNotMatch(detail, /detail-client-card-skeleton/);
  assert.match(detail, /emoji-variants\.js/);
  assert.match(client, /Other versions/);
  assert.match(client, /renderVariantSection/);
  assert.match(client, /variants\/\$\{prefix\}\.json/);
  assert.match(client, /entry\.l/);
  assert.match(client, /section\.replaceChildren\(heading, grid\)/);
  assert.match(client, /section\.hidden = false/);
});


test('hidden detail discovery grids stay empty in static HTML', async () => {
  const detail = await read('src/components/beui/EmojiDetail.astro');
  assert.match(detail, /<div class="detail-similar-grid" data-similar-grid><\/div>/);
  assert.match(detail, /<div class="detail-random-grid" data-random-grid><\/div>/);
  assert.doesNotMatch(detail, /Array\.from\(\{ length: 6 \}\)/);
});
