import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const catalogPagesCss = await readFile(new URL('../src/styles/catalog-pages.css', import.meta.url), 'utf8');
const cardClient = await readFile(new URL('../src/scripts/emoji-card-client.js', import.meta.url), 'utf8');
const categoryPage = await readFile(new URL('../src/pages/categories/[slug].astro', import.meta.url), 'utf8');

test('category detail receives the same responsive polish as collection pages', () => {
  assert.match(catalogPagesCss, /body\[data-page="category-detail"\] \.category-detail-page/);
  assert.match(catalogPagesCss, /body\[data-page="category-detail"\] \.category-stats/);
  assert.match(catalogPagesCss, /body\[data-page="category-detail"\] \.category-actions/);
  assert.match(catalogPagesCss, /body\[data-page="category-detail"\] \.category-detail-page \.emoji-grid/);
  assert.match(catalogPagesCss, /body\[data-page="category-detail"\] \.related-category-list/);
});

test('dynamically loaded category cards are upgraded to the current card UI', () => {
  assert.match(categoryPage, /function createEmojiCard\(emoji\)/);
  assert.match(categoryPage, /className = 'shortcode'/);
  assert.match(cardClient, /function ensureDownloadAction\(card\)/);
  assert.match(cardClient, /className = 'emoji-card-download'/);
  assert.match(cardClient, /dataset\.beuiTooltip = `Download \$\{name\}`/);
  assert.match(cardClient, /className = 'emoji-category'/);
  assert.match(cardClient, /MutationObserver/);
});
