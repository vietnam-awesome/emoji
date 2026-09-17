import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const editorPage = await readFile(new URL('../src/pages/editor.astro', import.meta.url), 'utf8');
const editorClient = await readFile(new URL('../src/components/editor/EmojiEditor.tsx', import.meta.url), 'utf8');
const frameTimeline = await readFile(new URL('../src/components/editor/GifFrameTimeline.tsx', import.meta.url), 'utf8');
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
  assert.doesNotMatch(editorClient, /<select(?:\s|>)/);
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
  assert.match(editorClient, /filter\(\(frame\) => frame\.enabled\)/);
  assert.match(editorClient, /GIF · animated/);
});

test('GIF timeline supports include, duplicate, delete and per-frame delay editing', () => {
  assert.match(editorClient, /toggleFrame/);
  assert.match(editorClient, /duplicateFrame/);
  assert.match(editorClient, /deleteFrame/);
  assert.match(editorClient, /changeFrameDelay/);
  assert.match(frameTimeline, /from '\.\.\/motion\/checkbox'/);
  assert.match(frameTimeline, /from '\.\.\/motion\/range-slider'/);
  assert.match(frameTimeline, /from '\.\.\/motion\/bottom-sheet'/);
  assert.match(frameTimeline, /Include in GIF/);
  assert.match(frameTimeline, /Duplicate/);
  assert.match(frameTimeline, /Delete/);
  assert.match(frameTimeline, /Frame delay/);
});

test('GIF frame operations participate in editor undo and redo history', () => {
  assert.match(editorClient, /type HistorySnapshot/);
  assert.match(editorClient, /frames: GifTimelineFrame\[\]/);
  assert.match(editorClient, /pushHistory\(\)/);
  assert.match(editorClient, /applySnapshot/);
});

test('emoji detail exposes an editor action and preserves animated source hint', () => {
  assert.match(detail, /withBase\('\/editor', base\)/);
  assert.match(detail, /Edit emoji/);
  assert.match(detail, /Edit GIF/);
  assert.match(detail, /animated=1/);
});

test('editor is discoverable to crawlers', () => {
  assert.match(sitemap, /\$\{SITE\}\/editor/);
});