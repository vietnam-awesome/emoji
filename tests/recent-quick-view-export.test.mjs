import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('emoji cards open quick view without adding another card action button', async () => {
  const card = await read('src/components/EmojiCard.astro');
  assert.match(card, /data-quick-view-trigger/);
  assert.match(card, /Quick view \$\{emoji\.name\}/);
  assert.doesNotMatch(card, /emoji-card-quick-view/);
});

test('recent history is browser-local and capped', async () => {
  const recent = await read('src/scripts/recent.js');
  const page = await read('src/pages/recent.astro');
  assert.match(recent, /eplus-emoji-recent-v1/);
  assert.match(recent, /const LIMIT = 40/);
  assert.match(recent, /eplus:recent-add/);
  assert.match(page, /Recently viewed/);
  assert.match(page, /noindex, follow/);
});

test('quick view includes static platform export presets', async () => {
  const component = await read('src/components/beui/EmojiQuickView.astro');
  const script = await read('src/scripts/quick-view.js');
  assert.match(component, /data-export-preset="discord"/);
  assert.match(component, /data-export-preset="slack"/);
  assert.match(component, /data-export-preset="twitch"/);
  assert.match(component, /data-export-preset="telegram"/);
  assert.match(script, /discord: \{ size: 128/);
  assert.match(script, /slack: \{ size: 128/);
  assert.match(script, /twitch: \{ size: 112/);
  assert.match(script, /telegram: \{ size: 100/);
  assert.match(script, /button\.disabled = record\.animated/);
});

test('layout loads quick view and recent history globally', async () => {
  const layout = await read('src/layouts/Layout.astro');
  assert.match(layout, /EmojiQuickView/);
  assert.match(layout, /recent\.js/);
  assert.match(layout, /quick-view\.js/);
  assert.match(layout, /Recently viewed/);
});
