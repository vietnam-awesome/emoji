import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = new URL('../src/', import.meta.url);
const tooltipLayer = await readFile(new URL('../src/components/beui/TooltipLayer.tsx', import.meta.url), 'utf8');
const siteHeader = await readFile(new URL('../src/components/beui/SiteHeader.tsx', import.meta.url), 'utf8');
const detail = await readFile(new URL('../src/components/beui/EmojiDetail.astro', import.meta.url), 'utf8');
const card = await readFile(new URL('../src/components/EmojiCard.astro', import.meta.url), 'utf8');

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(full));
    else if (/\.(?:astro|tsx|jsx|ts|js)$/.test(entry.name)) files.push(full);
  }
  return files;
}

test('SiteHeader mounts the shared BEUI tooltip layer', () => {
  assert.match(siteHeader, /import TooltipLayer from ['"]\.\/TooltipLayer['"]/);
  assert.match(siteHeader, /<TooltipLayer\s*\/>/);
});

test('tooltip layer supports hover, keyboard focus, motion, and dynamic native-title migration', () => {
  assert.match(tooltipLayer, /data-beui-tooltip/);
  assert.match(tooltipLayer, /createPortal/);
  assert.match(tooltipLayer, /onPointerOver/);
  assert.match(tooltipLayer, /onFocusIn/);
  assert.match(tooltipLayer, /MutationObserver/);
  assert.match(tooltipLayer, /removeAttribute\("title"\)/);
  assert.match(tooltipLayer, /attributeFilter:\s*\["title"\]/);
});

test('detail tags and emoji card actions use BEUI tooltips instead of native titles', () => {
  assert.match(detail, /data-beui-tooltip=\{`Browse emoji related to \$\{tag\}`\}/);
  assert.match(detail, /data-beui-tooltip=\{`Zoom \$\{emoji\.name\}`\}/);
  assert.match(card, /data-beui-tooltip=\{`Select \$\{emoji\.name\}`\}/);
  assert.match(card, /data-beui-tooltip=\{`Download \$\{emoji\.name\}`\}/);
});

test('source does not use native title attributes on interactive HTML controls', async () => {
  const files = await sourceFiles(root);
  const violations = [];
  const nativeTitle = /<(?:a|button|label|input|select|textarea|summary)\b[^>]*\btitle\s*=/gis;

  for (const file of files) {
    const content = await readFile(file, 'utf8');
    if (nativeTitle.test(content)) {
      violations.push(path.relative(root.pathname, file));
    }
    nativeTitle.lastIndex = 0;
  }

  assert.deepEqual(violations, [], `Replace native title attributes with data-beui-tooltip in: ${violations.join(', ')}`);
});
