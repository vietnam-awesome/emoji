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

test('emoji variants avoid repeating section markup across every static detail page', async () => {
  const detail = await read('src/components/beui/EmojiDetail.astro');
  const client = await read('src/scripts/emoji-variants.js');

  assert.match(detail, /data-variant-hexcode=\{emoji\.hexcode \|\| ''\}/);
  assert.match(detail, /emoji-variants\.js/);
  assert.doesNotMatch(detail, /Other versions/);
  assert.doesNotMatch(detail, /data-variant-section/);
  assert.doesNotMatch(detail, /Array\.from\(\{ length: 4 \}\)/);

  assert.match(client, /createVariantsSection/);
  assert.match(client, /title\.textContent = 'Other versions'/);
  assert.match(client, /detailRoot\.insertBefore\(section, similarSection\)/);
  assert.match(client, /variants\/\$\{prefix\}\.json/);
  assert.match(client, /entry\.l/);
});
