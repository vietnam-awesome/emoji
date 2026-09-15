import assert from 'node:assert/strict';
import test from 'node:test';
import { emojiArgs, normalizeEmojiRecord } from '../scripts/lib/turso-record.mjs';

test('normalizes emoji metadata and canonical taxonomy for Turso', () => {
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
  assert.equal(row.category, 'Reactions');
  assert.equal(row.categorySlug, 'reactions');
  assert.equal(row.collection, 'pepe');
  assert.equal(row.topicsJson, '["happy"]');
  assert.equal(row.taxonomyVersion, 1);
  assert.equal(row.tagsJson, '["pepe","happy"]');
  assert.equal(row.tagsSearch, 'pepe happy');
  assert.equal(row.sourceLabel, 'Community');
  assert.equal(row.animated, 0);
  assert.equal(row.shardFile, 'chunk-0001.json');
  assert.match(row.contentHash, /^[a-f0-9]{64}$/);

  const stored = JSON.parse(row.recordJson);
  assert.equal(stored.categorySlug, 'reactions');
  assert.equal(stored.collection, 'pepe');
  assert.equal(emojiArgs(row).length, 34);
});

test('preserves upstream category separately from canonical category', () => {
  const row = normalizeEmojiRecord({
    id: 'emojigg-anime-1',
    slug: 'emojigg-anime-1',
    name: 'Anime Smile',
    shortcode: 'anime_smile',
    image: '/emojis/community/emojigg/anime.png',
    source: 'emojigg',
    sourceLabel: 'Emoji.gg',
    category: 'Anime',
    categorySlug: 'anime',
    tags: ['anime'],
    license: 'COMMUNITY-SOURCE'
  }, 'chunk-0001.json');

  assert.equal(row.categorySlug, 'entertainment');
  assert.equal(row.collection, 'anime');
  assert.equal(row.sourceCategory, 'Anime');
  assert.equal(row.sourceCategorySlug, 'anime');
});

test('rejects records missing required fields', () => {
  assert.throws(
    () => normalizeEmojiRecord({ id: 'broken' }, 'chunk.json'),
    /missing required field: slug/
  );
});
