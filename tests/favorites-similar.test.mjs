import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createSimilarEmojiResolver, similarityScore } from '../src/lib/similarEmoji.mjs';

const target = {
  id: 'target',
  slug: 'target',
  name: 'Party Cat',
  shortcode: 'party_cat',
  hexcode: '1F431',
  categorySlug: 'animals-nature',
  group: 'animals',
  tags: ['cat', 'party', 'happy'],
  source: 'openmoji',
  format: 'svg',
  animated: false
};

test('similar emoji resolver prioritizes the same Unicode identity and excludes the current emoji', () => {
  const catalog = [
    target,
    { ...target, id: 'same-hex', slug: 'same-hex', name: 'Cat', source: 'twemoji', tags: ['cat'] },
    { ...target, id: 'same-category', slug: 'same-category', name: 'Happy Dog', hexcode: '1F436', tags: ['happy'], source: 'noto' },
    { id: 'unrelated', slug: 'unrelated', name: 'Car', categorySlug: 'travel-places', group: 'travel', tags: ['vehicle'], source: 'noto', format: 'svg', animated: false }
  ];

  const resolve = createSimilarEmojiResolver(catalog);
  const result = resolve(target, 3);

  assert.equal(result[0].id, 'same-hex');
  assert.ok(result.some((item) => item.id === 'same-category'));
  assert.ok(!result.some((item) => item.id === target.id));
  assert.ok(!result.some((item) => item.id === 'unrelated'));
});

test('shared tags improve similarity score', () => {
  const shared = { ...target, id: 'shared', slug: 'shared', hexcode: '1F436', tags: ['cat', 'party'] };
  const categoryOnly = { ...target, id: 'category', slug: 'category', hexcode: '1F437', tags: [] };
  assert.ok(similarityScore(target, shared) > similarityScore(target, categoryOnly));
});

test('favorites UI is wired through cards, detail, layout, header and My Emoji page', async () => {
  const [card, detail, layout, header, favoritesPage, favoritesClient] = await Promise.all([
    readFile(new URL('../src/components/EmojiCard.astro', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/beui/EmojiDetail.astro', import.meta.url), 'utf8'),
    readFile(new URL('../src/layouts/Layout.astro', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/beui/SiteHeader.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/favorites.astro', import.meta.url), 'utf8'),
    readFile(new URL('../src/scripts/favorites.js', import.meta.url), 'utf8')
  ]);

  assert.match(card, /data-favorite-action/);
  assert.match(detail, /data-favorite-action/);
  assert.match(detail, /Similar emoji/);
  assert.match(layout, /favorites\.js/);
  assert.match(header, /My Emoji/);
  assert.match(favoritesPage, /eplus-emoji-favorites-v1/);
  assert.match(favoritesClient, /MutationObserver/);
  assert.match(favoritesClient, /eplus:favorites-changed/);
});
