import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { emojiSitemapPriority } from '../src/lib/sitemapEmoji.mjs';

test('sitemap priority tiers curated Unicode records above community imports', () => {
  assert.equal(emojiSitemapPriority({ source: 'twemoji', hexcode: '1F680' }), '0.7');
  assert.equal(emojiSitemapPriority({ source: 'openmoji', hexcode: '1F600' }), '0.7');
  assert.equal(emojiSitemapPriority({ source: 'discords', hexcode: '' }), '0.4');
  assert.equal(emojiSitemapPriority({ source: 'emojigg' }), '0.4');
  assert.equal(emojiSitemapPriority({ source: 'slackmojis', hexcode: '  ' }), '0.4');
});

test('emoji sitemap shard emits no lastmod and uses the tiered priority helper', async () => {
  const shard = await readFile(new URL('../src/pages/sitemaps/emoji-[page].xml.js', import.meta.url), 'utf8');
  assert.doesNotMatch(shard, /<lastmod>/);
  assert.doesNotMatch(shard, /syncedAt|addedAt/);
  assert.match(shard, /emojiSitemapPriority\(emoji\)/);
});
