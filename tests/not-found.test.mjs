import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('../src/pages/404.astro', import.meta.url), 'utf8');
const component = await readFile(new URL('../src/components/beui/NotFoundExperience.tsx', import.meta.url), 'utf8');

test('404 page samples a larger catalog pool and renders 48 emoji', () => {
  assert.match(page, /const visibleCount = Math\.min\(48, emojis\.length\)/);
  assert.match(page, /const poolSize = Math\.min\(visibleCount \* 3, emojis\.length\)/);
  assert.match(page, /visibleCount=\{visibleCount\}/);
});

test('404 emoji selection is shuffled client-side on each visit', () => {
  assert.match(component, /function shuffledCopy<T>/);
  assert.match(component, /Math\.random\(\)/);
  assert.match(component, /setVisibleItems\(shuffledCopy\(items\)\.slice\(0, cappedCount\)\)/);
});
