import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Emoji Sheet Cutter is a client-only public browser tool', async () => {
  const page = await read('src/pages/cutter.astro');
  const client = await read('src/components/cutter/EmojiSheetCutter.tsx');

  assert.match(page, /Emoji Sheet Cutter/);
  assert.match(page, /<EmojiSheetCutter editorUrl=\{editorUrl\} client:only="react"/);
  assert.match(client, /accept="image\/\*"/);
  assert.match(client, /multiple/);
  assert.match(client, /window\.addEventListener\("paste"/);
  assert.match(client, /navigator\.clipboard\?\.read/);
  assert.doesNotMatch(client, /fetch\(/);
});

test('Sheet Cutter supports manual square crop, zoom, grid guides and multiple saved cuts', async () => {
  const client = await read('src/components/cutter/EmojiSheetCutter.tsx');

  assert.match(client, /onPointerDown/);
  assert.match(client, /onPointerMove/);
  assert.match(client, /squareLock/);
  assert.match(client, /showGrid/);
  assert.match(client, /gridColumns/);
  assert.match(client, /gridRows/);
  assert.match(client, /setZoom/);
  assert.match(client, /setCrops/);
  assert.match(client, /Draw directly on the image|Drag directly on the image/);
});

test('Sheet Cutter exports PNG crops, ZIP batches and editor handoff locally', async () => {
  const client = await read('src/components/cutter/EmojiSheetCutter.tsx');

  assert.match(client, /canvas\.toBlob/);
  assert.match(client, /image\/png/);
  assert.match(client, /buildZip/);
  assert.match(client, /Download ZIP/);
  assert.match(client, /ClipboardItem/);
  assert.match(client, /eplus-emoji-editor-handoff/);
  assert.match(client, /handoff=cutter/);
  assert.match(client, /64 × 64 PNG/);
  assert.match(client, /512 × 512 PNG/);
});

test('Sheet Cutter is discoverable from navigation, footer and responsive styles', async () => {
  const [header, layout, styles] = await Promise.all([
    read('src/components/beui/SiteHeader.tsx'),
    read('src/layouts/Layout.astro'),
    read('src/styles/cutter.css'),
  ]);

  assert.match(header, /label: 'Cutter'/);
  assert.match(header, /routePath === '\/cutter'/);
  assert.match(layout, /Sheet Cutter/);
  assert.match(styles, /\.cutter-workspace/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /\.cutter-results-grid/);
});
