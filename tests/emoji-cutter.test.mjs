import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Emoji Sheet Cutter is a client-only public browser tool', async () => {
  const page = await read('src/pages/cutter.astro');
  const client = await read('src/components/cutter/EmojiSheetCutter.tsx');

  assert.match(page, /Emoji Sheet Cutter/);
  assert.match(page, /libraryManifestUrl/);
  assert.match(page, /<EmojiSheetCutter editorUrl=\{editorUrl\} libraryManifestUrl=\{libraryManifestUrl\} client:only="react"/);
  assert.match(client, /accept="image\/\*"/);
  assert.match(client, /multiple/);
  assert.match(client, /window\.addEventListener\("paste"/);
  assert.match(client, /navigator\.clipboard\?\.read/);
  assert.match(client, /fetch\(libraryManifestUrl/);
  assert.doesNotMatch(client, /new FormData/);
  assert.doesNotMatch(client, /method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/);
});

test('Sheet Cutter auto-detects emoji and keeps manual crop as fallback', async () => {
  const client = await read('src/components/cutter/EmojiSheetCutter.tsx');

  assert.match(client, /detectEmojiRegions/);
  assert.match(client, /DETECT_MAX_DIMENSION/);
  assert.match(client, /runAutoDetect/);
  assert.match(client, /detectedRegions/);
  assert.match(client, /selectedRegionIndexes/);
  assert.match(client, /manualRegions/);
  assert.match(client, /Save selected \{selectedRegionIndexes\.length\}/);
  assert.match(client, /selectAllRegions/);
  assert.match(client, /clearRegionSelection/);
  assert.match(client, /toggleRegion/);
  assert.match(client, /cutter-detected-region/);
  assert.match(client, /onPointerDown/);
  assert.match(client, /onPointerMove/);
  assert.match(client, /squareLock/);
  assert.match(client, /showGrid/);
  assert.match(client, /setZoom/);
  assert.match(client, /manual crop fallback/i);
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


test('Sheet Cutter provides a shared library plus local upload/paste sources', async () => {
  const [page, client, styles] = await Promise.all([
    read('src/pages/cutter.astro'),
    read('src/components/cutter/EmojiSheetCutter.tsx'),
    read('src/styles/cutter.css'),
  ]);

  assert.match(page, /data\/public\/cutter\/library\.json/);
  assert.doesNotMatch(client, /data:image\/svg\+xml/);
  assert.match(client, /fetch\(item\.image\)/);
  assert.match(client, /sourceMode/);
  assert.match(client, /Shared sheet library|shared library/i);
  assert.match(client, /Use sheet/);
  assert.match(client, /origin: "library"/);
  assert.match(client, /origin: "local"/);
  assert.match(styles, /\.cutter-library-grid/);
  assert.match(styles, /\.cutter-source-tabs/);
  assert.match(styles, /\.cutter-detected-region/);
  assert.doesNotMatch(styles, /0 0 0 9999px/);
});


test('Sheet Cutter supports selecting many detected and manual crop boxes at once', async () => {
  const [client, styles] = await Promise.all([
    read('src/components/cutter/EmojiSheetCutter.tsx'),
    read('src/styles/cutter.css'),
  ]);

  assert.match(client, /const \[manualRegions, setManualRegions\]/);
  assert.match(client, /const \[selectedRegionIndexes, setSelectedRegionIndexes\]/);
  assert.match(client, /const dragRect/);
  assert.match(client, /setManualRegions\(\(regions\) => \[\.\.\.regions, rect\]\)/);
  assert.match(client, /Select all/);
  assert.match(client, /Save selected \{selectedRegionIndexes\.length\}/);
  assert.match(client, /aria-pressed=\{selected\}/);
  assert.match(client, /is-manual/);
  assert.match(styles, /\.cutter-detected-region\.is-selected/);
  assert.match(styles, /\.cutter-detected-region\.is-manual/);
  assert.match(styles, /\.cutter-multi-actions/);
});
