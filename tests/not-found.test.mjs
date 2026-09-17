import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('../src/pages/404.astro', import.meta.url), 'utf8');
const component = await readFile(new URL('../src/components/beui/NotFoundExperience.tsx', import.meta.url), 'utf8');

test('404 page renders 48 emoji and wires static-search random sources', () => {
  assert.match(page, /const visibleCount = Math\.min\(48, emojis\.length\)/);
  assert.match(page, /withBase\('\/search\/manifest\.json', base\)/);
  assert.match(page, /withBase\('\/search\/chunks', base\)/);
  assert.match(page, /searchManifestHref=\{searchManifestHref\}/);
  assert.match(page, /searchChunksHref=\{searchChunksHref\}/);
});

test('404 picks a random static-search chunk on every visit', () => {
  assert.match(component, /const chunkIndex = Math\.floor\(Math\.random\(\) \* chunkCount\)/);
  assert.match(component, /padStart\(4, "0"\)/);
  assert.match(component, /fetch\(searchManifestHref, \{ cache: "no-store" \}\)/);
  assert.match(component, /fetch\(chunkUrl, \{ cache: "no-store" \}\)/);
  assert.match(component, /shuffledCopy\(candidates\)\.slice\(0, targetCount\)/);
});

test('404 keeps a build-time fallback when search assets are unavailable', () => {
  assert.match(component, /setVisibleItems\(shuffledCopy\(items\)\.slice\(0, fallbackCount\)\)/);
  assert.match(component, /Keep the build-time fallback when search assets are unavailable/);
});
