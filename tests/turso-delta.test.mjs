import test from 'node:test';
import assert from 'node:assert/strict';
import { planEmojiDelta } from '../scripts/lib/turso-delta.mjs';

test('only inserts genuinely new rows', () => {
  const local = [
    { id: 'a', contentHash: 'same-a' },
    { id: 'b', contentHash: 'new-b' }
  ];
  const remote = [
    { id: 'a', content_hash: 'same-a' }
  ];

  const delta = planEmojiDelta(local, remote);
  assert.equal(delta.inserted, 1);
  assert.equal(delta.updated, 0);
  assert.equal(delta.deleted, 0);
  assert.equal(delta.unchanged, 1);
  assert.deepEqual(delta.upserts.map((row) => row.id), ['b']);
});

test('updates only rows whose content hash changed', () => {
  const local = [
    { id: 'a', contentHash: 'same-a' },
    { id: 'b', contentHash: 'new-b' }
  ];
  const remote = [
    { id: 'a', content_hash: 'same-a' },
    { id: 'b', content_hash: 'old-b' }
  ];

  const delta = planEmojiDelta(local, remote);
  assert.equal(delta.inserted, 0);
  assert.equal(delta.updated, 1);
  assert.equal(delta.deleted, 0);
  assert.equal(delta.unchanged, 1);
  assert.deepEqual(delta.upserts.map((row) => row.id), ['b']);
});

test('deletes only rows no longer present locally', () => {
  const local = [{ id: 'a', contentHash: 'same-a' }];
  const remote = [
    { id: 'a', content_hash: 'same-a' },
    { id: 'stale', content_hash: 'old' }
  ];

  const delta = planEmojiDelta(local, remote);
  assert.equal(delta.deleted, 1);
  assert.deepEqual(delta.deleteIds, ['stale']);
});

test('force rewrites existing rows but still distinguishes inserts', () => {
  const local = [
    { id: 'a', contentHash: 'same-a' },
    { id: 'b', contentHash: 'new-b' }
  ];
  const remote = [{ id: 'a', content_hash: 'same-a' }];

  const delta = planEmojiDelta(local, remote, { force: true });
  assert.equal(delta.inserted, 1);
  assert.equal(delta.updated, 1);
  assert.equal(delta.unchanged, 0);
  assert.equal(delta.mutations, 2);
});

test('rejects duplicate local ids before writing', () => {
  assert.throws(
    () => planEmojiDelta([
      { id: 'dup', contentHash: '1' },
      { id: 'dup', contentHash: '2' }
    ], []),
    /Duplicate local emoji id/
  );
});
