import test from 'node:test';
import assert from 'node:assert/strict';

import { formatBytes, stableShard } from '../scripts/asset-shards.mjs';

test('stableShard is deterministic and 1-based', () => {
  const path = 'slackmojis/taiyaki-99839.gif';
  const first = stableShard(path, 8);
  const second = stableShard(path, 8);

  assert.equal(first, second);
  assert.ok(first >= 1 && first <= 8);
});

test('stableShard normalizes Windows path separators', () => {
  assert.equal(
    stableShard('slackmojis\\taiyaki-99839.gif', 8),
    stableShard('slackmojis/taiyaki-99839.gif', 8)
  );
});

test('stableShard validates shard count', () => {
  assert.throws(() => stableShard('emoji.gif', 0), /Invalid shard count/);
  assert.throws(() => stableShard('emoji.gif', -1), /Invalid shard count/);
});

test('formatBytes returns readable values', () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1024), '1.00 KB');
  assert.equal(formatBytes(1024 * 1024 * 700), '700 MB');
});
