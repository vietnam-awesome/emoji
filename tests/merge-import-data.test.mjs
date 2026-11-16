import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeImportedSource } from '../scripts/lib/merge-import-data.mjs';

const record = (id, source, hash = id) => ({ id, slug: id, source, assetSha256: hash });
test('preserve latest records from all sources', () => {
  const latest = [record('base', 'slackmojis')];
  const result = mergeImportedSource(latest, [record('new', 'emojigg')], 'emojigg');
  assert.equal(result.added, 1);
  assert.deepEqual(result.records.map((r) => r.id), ['base', 'new']);
  assert.equal(latest.length, 1);
});
test('deduplicate by ID, slug and asset SHA', () => {
  const latest = [record('a', 'emojigg'), record('b', 'slackmojis')];
  const imported = [record('a', 'emojigg'), record('c', 'emojigg', 'b'), record('d', 'emojigg', 'd')];
  const result = mergeImportedSource(latest, imported, 'emojigg');
  assert.equal(result.added, 1);
  assert.equal(result.skipped, 2);
  assert.equal(result.records.at(-1).id, 'd');
});
test('do not merge unrelated sources or invalid records', () => {
  const result = mergeImportedSource([], [record('c', 'slackmojis')], 'emojigg');
  assert.equal(result.added, 0);
  assert.throws(() => mergeImportedSource([], [{ source: 'emojigg', id: '' }], 'emojigg'), /Invalid/);
});
