import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/components/beui/BackToTop.tsx', import.meta.url), 'utf8');

test('back-to-top uses page-relative reveal threshold', () => {
  assert.match(source, /document\.documentElement\.scrollHeight - window\.innerHeight/);
  assert.match(source, /MIN_SCROLLABLE_DISTANCE = 160/);
  assert.match(source, /MIN_REVEAL_DISTANCE = 120/);
  assert.match(source, /MAX_REVEAL_DISTANCE = 320/);
  assert.match(source, /REVEAL_RATIO = 0\.18/);
});

test('back-to-top reacts to dynamic page height changes', () => {
  assert.match(source, /new ResizeObserver\(sync\)/);
  assert.match(source, /resizeObserver\?\.observe\(document\.documentElement\)/);
  assert.match(source, /canScroll && window\.scrollY >= revealAt/);
});
