import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const editorPage = await readFile(new URL('../src/pages/editor.astro', import.meta.url), 'utf8');
const editorClient = await readFile(new URL('../src/components/editor/EmojiEditor.tsx', import.meta.url), 'utf8');
const detail = await readFile(new URL('../src/components/beui/EmojiDetail.astro', import.meta.url), 'utf8');
const sitemap = await readFile(new URL('../src/pages/sitemap-static.xml.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('editor is a client-only static page with local image processing', () => {
  assert.match(editorPage, /<EmojiEditor[^>]+client:only="react"/);
  assert.match(editorClient, /document\.createElement\('canvas'\)/);
  assert.match(editorClient, /canvas\.toBlob/);
  assert.match(editorClient, /navigator\.clipboard\.write/);
  assert.match(editorClient, /fetch\(url, \{ mode: 'cors', credentials: 'omit' \}\)/);
  assert.doesNotMatch(editorClient, /fetch\([^)]*method:\s*['"]POST/);
});

test('editor uses BEUI Select instead of native select controls', () => {
  assert.match(editorClient, /from '\.\.\/motion\/select'/);
  assert.match(editorClient, /<SelectTrigger/);
  assert.match(editorClient, /<SelectContent/);
  assert.doesNotMatch(editorClient, /<select\b/i);
});

test('animated GIF editor decodes frames, controls speed and re-encodes GIF', () => {
  assert.equal(packageJson.dependencies['gifuct-js'], '2.1.2');
  assert.equal(packageJson.dependencies.gifenc, '1.0.3');
  assert.match(editorClient, /import\('gifuct-js'\)/);
  assert.match(editorClient, /decompressFrames/);
  assert.match(editorClient, /GIF_SPEEDS/);
  assert.match(editorClient, /currentFrame/);
  assert.match(editorClient, /import\('gifenc'\)/);
  assert.match(editorClient, /GIFEncoder/);
  assert.match(editorClient, /writeFrame/);
  assert.match(editorClient, /GIF · animated/);
});

test('emoji detail exposes an editor action and preserves animated source hint', () => {
  assert.match(detail, /withBase\('\/editor', base\)/);
  assert.match(detail, /Edit emoji/);
  assert.match(detail, /animated=1/);
});

test('editor is discoverable to crawlers', () => {
  assert.match(sitemap, /\$\{SITE\}\/editor/);
});