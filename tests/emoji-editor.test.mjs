import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const editorPage = await readFile(new URL('../src/pages/editor.astro', import.meta.url), 'utf8');
const editorClient = await readFile(new URL('../src/components/editor/EmojiEditor.tsx', import.meta.url), 'utf8');
const detail = await readFile(new URL('../src/components/beui/EmojiDetail.astro', import.meta.url), 'utf8');
const sitemap = await readFile(new URL('../src/pages/sitemap-static.xml.js', import.meta.url), 'utf8');

test('editor is a client-only static page with local image processing', () => {
  assert.match(editorPage, /<EmojiEditor[^>]+client:only="react"/);
  assert.match(editorClient, /document\.createElement\('canvas'\)/);
  assert.match(editorClient, /canvas\.toBlob/);
  assert.match(editorClient, /navigator\.clipboard\.write/);
  assert.match(editorClient, /fetch\(url, \{ mode: 'cors', credentials: 'omit' \}\)/);
  assert.doesNotMatch(editorClient, /fetch\([^)]*method:\s*['"]POST/);
});

test('emoji detail exposes an editor action and preserves animated flattening notice', () => {
  assert.match(detail, /withBase\('\/editor', base\)/);
  assert.match(detail, /Edit emoji/);
  assert.match(detail, /Edit static frame/);
  assert.match(detail, /animated=1/);
});

test('editor is discoverable to crawlers', () => {
  assert.match(sitemap, /\$\{SITE\}\/editor/);
});
