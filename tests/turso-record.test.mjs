import assert from 'node:assert/strict';
import test from 'node:test';
import { emojiArgs, normalizeEmojiRecord } from '../scripts/lib/turso-record.mjs';

test('normalizes emoji metadata for Turso', () => {
  const record = {
    id: 'community-pepe-happy',
    slug: 'community-pepe-happy',
    name: 'Pepe Happy',
    shortcode: 'pepe_happy',
    image: '/emojis/community/pepe-happy.png',
    source: 'community',
    sourceLabel: 'Community',
    license: 'Source license',
    group: 'smileys-emotion',
    tags: ['pepe', 'happy', 'pepe'],
    animated: false,
    addedAt: '2026-09-14'
  };

  const row = normalizeEmojiRecord(record, 'chunk-0001.json');

  assert.equal(row.id, record.id);
  assert.equal(row.category, 'smileys emotion');
  assert.equal(row.categorySlug, 'smileys-emotion');
  assert.equal(row.tagsJson, '["pepe","happy"]');
  assert.equal(row.tagsSearch, 'pepe happy');
  assert.equal(row.sourceLabel, 'Community');
  assert.equal(row.animated, 0);
  assert.equal(row.shardFile, 'chunk-0001.json');
  assert.match(row.contentHash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.parse(row.recordJson).name, 'Pepe Happy');
  assert.equal(emojiArgs(row).length, 27);
});

test('rejects records missing required fields', () => {
  assert.throws(
    () => normalizeEmojiRecord({ id: 'broken' }, 'chunk.json'),
    /missing required field: slug/
  );
});
