import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../src/styles/beui-dark-mode.css', import.meta.url), 'utf8');
const header = await readFile(new URL('../src/components/beui/SiteHeader.tsx', import.meta.url), 'utf8');

test('SiteHeader loads BEUI dark-mode hardening styles', () => {
  assert.match(header, /import ['"]\.\.\/\.\.\/styles\/beui-dark-mode\.css['"]/);
});

test('dark theme separates popover, muted, and control surfaces', () => {
  assert.match(css, /:root\.dark\s*\{/);
  assert.match(css, /--popover:\s*#232323/);
  assert.match(css, /--beui-muted:\s*#2b2b2b/);
  assert.match(css, /--beui-control-bg:\s*#202020/);
});

test('menu, select, and search overlays use semantic dark surfaces', () => {
  assert.match(css, /nav\[aria-label="Mobile navigation"\]/);
  assert.match(css, /\[role="listbox"\]/);
  assert.match(css, /\.home-search-results/);
  assert.match(css, /header form\[role="search"\]/);
});

test('BEUI search inputs preserve theme colors including autofill', () => {
  assert.match(css, /input:not\(\.beui-native-proxy\):-webkit-autofill/);
  assert.match(css, /-webkit-text-fill-color:\s*var\(--foreground\)/);
  assert.match(css, /color-scheme:\s*dark/);
});

test('detail zoom lightbox separates dialog, hover, and active surfaces', () => {
  assert.match(css, /\.detail-lightbox\s*\{/);
  assert.match(css, /\.detail-lightbox-zoom-levels\s*\{/);
  assert.match(css, /\.detail-lightbox-zoom-levels button\.is-active/);
  assert.match(css, /background:\s*var\(--beui-muted\)\s*!important/);
  assert.match(css, /\.detail-lightbox-stage/);
});
