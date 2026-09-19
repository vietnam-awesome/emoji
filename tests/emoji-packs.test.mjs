import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('selection bar can save selected emoji into packs', async () => {
  const selection = await read('src/components/beui/CatalogDownloadClient.tsx');
  assert.match(selection, /eplus:pack-save-request/);
  assert.match(selection, /PackagePlus/);
  assert.match(selection, /Save selected emoji as a pack/);
  assert.match(selection, /eplus:selection-clear/);
});

test('packs are browser-local and support create add delete and remove', async () => {
  const packs = await read('src/scripts/packs.js');
  assert.match(packs, /eplus-emoji-packs-v1/);
  assert.match(packs, /const MAX_PACKS = 50/);
  assert.match(packs, /const MAX_ITEMS = 500/);
  assert.match(packs, /saveItems/);
  assert.match(packs, /deletePack/);
  assert.match(packs, /removeItems/);
});

test('packs page reuses emoji cards and ZIP selection flow', async () => {
  const page = await read('src/pages/packs.astro');
  assert.match(page, /createEmojiCard/);
  assert.match(page, /Select all/);
  assert.match(page, /Remove selected/);
  assert.match(page, /data-emoji-select/);
  assert.match(page, /noindex, follow/);
});

test('pack dialog is wired globally', async () => {
  const layout = await read('src/layouts/Layout.astro');
  const dialog = await read('src/components/beui/EmojiPackDialog.astro');
  assert.match(layout, /EmojiPackDialog/);
  assert.match(layout, /packs\.js/);
  assert.match(layout, /Emoji Packs/);
  assert.match(dialog, /Create a new pack/);
});
