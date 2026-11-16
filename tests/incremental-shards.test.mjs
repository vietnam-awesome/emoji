import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planIncrementalShards } from '../scripts/lib/incremental-shards.mjs';
const item = (id, source = 'emojigg', name = id) => ({ id, source, name });

test('new records never shift legacy shards', () => {
  const old = [item('a', 'slackmojis'), item('b', 'discadia')];
  const result = planIncrementalShards([...old, item('c')], [{ file: 'chunk-0001.json', records: old }], 2);
  assert.equal(result.additions, 1);
  assert.equal(result.changed.length, 1);
  assert.equal(result.changed[0].records[0].id, 'c');
  assert.equal(result.chunks[0].file, 'chunk-0001.json');
  assert.equal(result.chunks[0].count, 2);
  assert.match(result.chunks[1].file, /^delta-emojigg-[a-f0-9]+\.json$/);
});

test('repeated sharding is idempotent', () => {
  const old = [item('a')];
  const first = planIncrementalShards([item('a'), item('b')], [{ file: 'chunk-0001.json', records: old }]);
  const next = planIncrementalShards([item('a'), item('b')], [
    { file: 'chunk-0001.json', records: old },
    { file: first.changed[0].file, records: first.changed[0].records }
  ]);
  assert.equal(next.additions, 0);
  assert.deepEqual(next.changed, []);
  assert.deepEqual(next.chunks, first.chunks);
});

test('separate sources append separately and record changes stay in place', () => {
  const old = [item('a', 'slackmojis')];
  const result = planIncrementalShards(
    [item('a', 'slackmojis', 'updated'), item('b', 'emojigg'), item('c', 'discadia')],
    [{ file: 'chunk-0001.json', records: old }]
  );
  assert.equal(result.additions, 2);
  assert.equal(result.changed.length, 3);
  assert.equal(result.changed[0].records[0].name, 'updated');
  assert.ok(result.chunks.some((x) => x.file.startsWith('delta-discadia-')));
  assert.ok(result.chunks.some((x) => x.file.startsWith('delta-emojigg-')));
});

test('duplicate IDs fail closed', () => {
  assert.throws(() => planIncrementalShards([item('x'), item('x')], []), /Duplicate emoji ID/);
});
