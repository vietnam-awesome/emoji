import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRelatedEmojiPicker } from '../src/lib/relatedEmoji.mjs';

const record = (overrides) => ({
  id: overrides.slug,
  name: overrides.slug,
  shortcode: '',
  hexcode: '',
  categorySlug: 'animals',
  category: 'Animals',
  source: 'discords',
  ...overrides
});

test('related picker prefers the same category and source and excludes the current emoji', () => {
  const target = record({ slug: 'target', categorySlug: 'animals', source: 'discords' });
  const catalog = [
    target,
    record({ slug: 'same-both-1', categorySlug: 'animals', source: 'discords' }),
    record({ slug: 'same-both-2', categorySlug: 'animals', source: 'discords' }),
    record({ slug: 'same-category', categorySlug: 'animals', source: 'slackmojis' }),
    record({ slug: 'same-source', categorySlug: 'gaming', source: 'discords' }),
    record({ slug: 'unrelated', categorySlug: 'gaming', source: 'slackmojis' })
  ];

  const pick = createRelatedEmojiPicker(catalog);
  const result = pick(target, 3);

  assert.equal(result.length, 3);
  assert.ok(result.every((item) => item.slug !== 'target'));
  assert.deepEqual(
    new Set(result.slice(0, 2).map((item) => item.slug)),
    new Set(['same-both-1', 'same-both-2'])
  );
  assert.equal(result[2].slug, 'same-category');
});

test('related picker is deterministic for the same catalog and target', () => {
  const catalog = Array.from({ length: 80 }, (_, index) =>
    record({ slug: `emoji-${index}`, categorySlug: index % 2 ? 'animals' : 'gaming', source: index % 3 ? 'discords' : 'emojigg' })
  );
  const pick = createRelatedEmojiPicker(catalog);
  const first = pick(catalog[10]).map((item) => item.slug);
  const second = pick(catalog[10]).map((item) => item.slug);
  assert.equal(first.length, 12);
  assert.deepEqual(first, second);
  assert.ok(!first.includes('emoji-10'));
});

test('related picker falls back to the curated Unicode set for tiny categories', () => {
  const target = record({ slug: 'lonely', categorySlug: 'rare', source: 'tiny-source' });
  const catalog = [
    target,
    record({ slug: 'unicode-1', categorySlug: 'smileys', source: 'twemoji', hexcode: '1F600' }),
    record({ slug: 'unicode-2', categorySlug: 'smileys', source: 'openmoji', hexcode: '1F601' }),
    record({ slug: 'community', categorySlug: 'gaming', source: 'emojigg' })
  ];

  const pick = createRelatedEmojiPicker(catalog);
  const result = pick(target, 2);
  assert.deepEqual(new Set(result.map((item) => item.slug)), new Set(['unicode-1', 'unicode-2']));
});

test('emoji detail renders a server-side related section fed from static paths', async () => {
  const detail = await readFile(new URL('../src/components/beui/EmojiDetail.astro', import.meta.url), 'utf8');
  const page = await readFile(new URL('../src/pages/emoji/[slug].astro', import.meta.url), 'utf8');
  assert.match(detail, /related-emoji-title/);
  assert.match(detail, /<EmojiCard emoji=\{item\} \/>/);
  assert.match(page, /createRelatedEmojiPicker\(emojis\)/);
  assert.match(page, /related: relatedPicker\(emoji\)/);
});
