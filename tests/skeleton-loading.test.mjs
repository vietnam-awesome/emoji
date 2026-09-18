import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const emojiCard = await readFile(new URL('../src/components/EmojiCard.astro', import.meta.url), 'utf8');
const cardClient = await readFile(new URL('../src/scripts/emoji-card-client.js', import.meta.url), 'utf8');
const browsePage = await readFile(new URL('../src/pages/emojis/index.astro', import.meta.url), 'utf8');
const homeClient = await readFile(new URL('../src/scripts/home.js', import.meta.url), 'utf8');
const editorPage = await readFile(new URL('../src/pages/editor.astro', import.meta.url), 'utf8');
const editorClient = await readFile(new URL('../src/components/editor/EmojiEditor.tsx', import.meta.url), 'utf8');
const editorCss = await readFile(new URL('../src/styles/editor.css', import.meta.url), 'utf8');
const beuiCss = await readFile(new URL('../src/styles/beui.css', import.meta.url), 'utf8');

test('emoji cards expose an image skeleton until the asset settles', () => {
  assert.match(emojiCard, /emoji-preview is-image-loading/);
  assert.match(cardClient, /function setupImageSkeleton\(card\)/);
  assert.match(cardClient, /image\.addEventListener\('load', settle, \{ once: true \}\)/);
  assert.match(cardClient, /image\.addEventListener\('error', settle, \{ once: true \}\)/);
  assert.match(cardClient, /MutationObserver/);
  assert.match(beuiCss, /\.emoji-preview\.is-image-loading::after/);
  assert.match(beuiCss, /@keyframes beui-skeleton-shimmer/);
});

test('catalog async states render a responsive skeleton grid instead of a spinner-only overlay', () => {
  assert.match(browsePage, /class="catalog-skeleton-grid" aria-hidden="true"/);
  assert.match(browsePage, /Array\.from\(\{ length: 12 \}\)/);
  assert.match(beuiCss, /\.catalog-skeleton-grid \{ display: grid; grid-template-columns: repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(beuiCss, /\.catalog-skeleton-card/);
  assert.match(beuiCss, /\.catalog-skeleton-media/);
  assert.match(beuiCss, /@media \(max-width:430px\)[\s\S]*\.catalog-skeleton-grid \{ grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
});

test('home search uses skeleton rows while suggestion shards are loading', () => {
  assert.match(homeClient, /const showSuggestionSkeletons = \(\) =>/);
  assert.match(homeClient, /showSuggestionSkeletons\(\)/);
  assert.match(homeClient, /home-search-skeleton/);
  assert.match(beuiCss, /\.home-search-skeleton/);
  assert.match(beuiCss, /\.home-search-skeleton-thumb/);
});

test('editor has skeletons before React hydration and while loading an image', () => {
  assert.match(editorPage, /slot="fallback"/);
  assert.match(editorPage, /editor-page-skeleton/);
  assert.match(editorPage, /editor-stage-skeleton/);
  assert.match(editorPage, /editor-controls-skeleton/);
  assert.match(editorClient, /className="editor-stage-loading"/);
  assert.match(editorClient, /className="editor-stage-skeleton"/);
  assert.match(editorClient, /className="editor-visually-hidden">Loading image/);
  assert.match(editorCss, /\.editor-page-skeleton/);
  assert.match(editorCss, /@keyframes editor-skeleton-shimmer/);
});
