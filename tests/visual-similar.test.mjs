import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const detail = await readFile(new URL('../src/components/beui/EmojiDetail.astro', import.meta.url), 'utf8');

test('similar emoji can blend metadata with perceptual dHash ranking', () => {
  assert.match(detail, /const VISUAL_CANDIDATE_LIMIT = 18/);
  assert.match(detail, /const VISUAL_CONCURRENCY = 3/);
  assert.match(detail, /const computeDHash/);
  assert.match(detail, /canvas\.width = 9/);
  assert.match(detail, /canvas\.height = 8/);
  assert.match(detail, /const hashDistance/);
  assert.match(detail, /const visualBonus/);
  assert.match(detail, /addVisualSimilarity/);
});

test('visual similar is bounded and gracefully falls back to metadata', () => {
  assert.match(detail, /ranked\.slice\(0, VISUAL_CANDIDATE_LIMIT\)/);
  assert.match(detail, /return \{ ranked, matched: false \}/);
  assert.match(detail, /catch \{\s*return null;/s);
  assert.match(detail, /visualResult\.ranked\.slice\(0, 12\)/);
});

test('detail exposes visual matching state without changing the current image payload', () => {
  assert.match(detail, /data-current-image=\{imageUrl\}/);
  assert.match(detail, /data-similar-description/);
  assert.match(detail, /Ranked by metadata and visual appearance/);
});
