import test from 'node:test';
import assert from 'node:assert/strict';

import { chooseShardCount, formatBytes, stableShard } from '../scripts/asset-shards.mjs';

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

test('chooseShardCount grows until every hash shard fits the target', () => {
  const files = Array.from({ length: 20 }, (_, index) => ({
    relative: `emoji-${index}.gif`,
    bytes: 100
  }));

  const count = chooseShardCount(files, 500);
  assert.ok(count >= 4);

  const sizes = Array.from({ length: count }, () => 0);
  for (const file of files) {
    sizes[stableShard(file.relative, count) - 1] += file.bytes;
  }
  assert.ok(Math.max(...sizes) <= 500);
});

test('chooseShardCount rejects an asset larger than the target', () => {
  assert.throws(
    () => chooseShardCount([{ relative: 'huge.gif', bytes: 701 }], 700),
    /single asset/
  );
});

test('formatBytes returns readable values', () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1024), '1.00 KB');
  assert.equal(formatBytes(1024 * 1024 * 700), '700 MB');
});
