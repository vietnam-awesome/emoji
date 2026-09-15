import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyEmojiTaxonomy,
  classifyEmoji,
  summarizeTaxonomy
} from '../scripts/lib/emoji-taxonomy.mjs';

test('separates Emoji.gg collection/style metadata from semantic category', () => {
  const pepe = classifyEmoji({
    source: 'emojigg',
    category: 'Pepe',
    categorySlug: 'pepe',
    name: 'Pepe Laugh',
    tags: ['pepe', 'laugh']
  });
  assert.equal(pepe.category, 'meme');
  assert.equal(pepe.collection, 'pepe');
  assert.ok(pepe.topics.includes('laugh'));

  const pixel = classifyEmoji({
    source: 'emojigg',
    category: 'Pixel Art',
    categorySlug: 'pixel-art',
    name: 'Pixel Cat',
    tags: ['cat']
  });
  assert.equal(pixel.category, 'animals');
  assert.equal(pixel.style, 'pixel-art');
});

test('uses Unicode semantic groups as high-confidence categories', () => {
  const food = classifyEmoji({
    source: 'twemoji',
    group: 'Food & Drink',
    subgroup: 'food-fruit',
    name: 'Red Apple'
  });
  assert.equal(food.category, 'food-drink');
  assert.equal(food.confidence, 'high');

  const nature = classifyEmoji({
    source: 'openmoji',
    group: 'Animals & Nature',
    subgroup: 'plant-flower',
    name: 'Sunflower'
  });
  assert.equal(nature.category, 'nature');
});

test('classifies community records from metadata keywords', () => {
  const gaming = classifyEmoji({
    source: 'discords',
    group: 'community',
    category: 'Minecraft',
    name: 'Diamond Sword',
    tags: ['gaming', 'minecraft']
  });
  assert.equal(gaming.category, 'gaming');

  const cat = classifyEmoji({
    source: 'slackmojis',
    group: 'community',
    name: 'party cat',
    tags: ['cat', 'party']
  });
  assert.equal(cat.category, 'animals');
  assert.ok(cat.topics.includes('party'));
});

test('applyEmojiTaxonomy preserves upstream category while canonicalizing category', () => {
  const record = applyEmojiTaxonomy({
    id: 'emojigg-1',
    source: 'emojigg',
    category: 'Anime',
    categorySlug: 'anime',
    name: 'Naruto Smile',
    tags: ['anime']
  });

  assert.equal(record.category, 'Entertainment');
  assert.equal(record.categorySlug, 'entertainment');
  assert.equal(record.sourceCategory, 'Anime');
  assert.equal(record.sourceCategorySlug, 'anime');
  assert.equal(record.collection, 'anime');
  assert.equal(record.taxonomyVersion, 1);
});

test('preserves upstream category even when its slug matches canonical category', () => {
  const once = applyEmojiTaxonomy({
    id: 'emojigg-animal-1',
    source: 'emojigg',
    category: 'Animals',
    categorySlug: 'animals',
    name: 'Tiny Fox',
    tags: ['fox']
  });
  assert.equal(once.categorySlug, 'animals');
  assert.equal(once.sourceCategory, 'Animals');
  assert.deepEqual(applyEmojiTaxonomy(once), once);
});

test('taxonomy application is idempotent', () => {
  const once = applyEmojiTaxonomy({
    id: 'emojigg-2',
    source: 'emojigg',
    category: 'Pepe',
    categorySlug: 'pepe',
    name: 'Pepe Think',
    tags: ['pepe', 'thinking']
  });
  const twice = applyEmojiTaxonomy(once);
  assert.deepEqual(twice, once);
});

test('summarizes only canonical categories', () => {
  const records = [
    { source: 'emojigg', category: 'Pepe', categorySlug: 'pepe', name: 'Pepe Laugh', animated: true },
    { source: 'twemoji', group: 'Food & Drink', subgroup: 'food-fruit', name: 'Apple', animated: false },
    { source: 'slackmojis', group: 'community', name: 'Unknown Thing', animated: false }
  ];
  const summary = summarizeTaxonomy(records);
  assert.equal(summary.version, 1);
  assert.equal(summary.categories.reduce((sum, item) => sum + item.count, 0), 3);
  assert.ok(summary.categories.every((item) => !['Pepe', 'Animated', 'Pixel Art'].includes(item.name)));
});
