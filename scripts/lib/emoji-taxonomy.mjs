const TAXONOMY_VERSION = 1;

export const CANONICAL_CATEGORIES = Object.freeze({
  reactions: 'Reactions',
  people: 'People',
  animals: 'Animals',
  nature: 'Nature',
  'food-drink': 'Food & Drink',
  activities: 'Activities',
  'travel-places': 'Travel & Places',
  objects: 'Objects',
  symbols: 'Symbols',
  flags: 'Flags',
  gaming: 'Gaming',
  entertainment: 'Entertainment',
  brands: 'Brands',
  meme: 'Meme',
  other: 'Other'
});

export { TAXONOMY_VERSION };

const CATEGORY_SLUGS = new Set(Object.keys(CANONICAL_CATEGORIES));

const EMOJIGG_CATEGORY_RULES = Object.freeze({
  aesthetic: { style: 'aesthetic' },
  animals: { category: 'animals' },
  animated: {},
  anime: { category: 'entertainment', collection: 'anime' },
  blobs: { category: 'reactions', collection: 'blob' },
  celebrity: { category: 'people', collection: 'celebrity' },
  cute: { category: 'reactions', topics: ['cute'] },
  flags: { category: 'flags' },
  gaming: { category: 'gaming' },
  hearts: { category: 'reactions', topics: ['love'] },
  letters: { category: 'symbols' },
  logos: { category: 'brands' },
  meme: { category: 'meme' },
  'original-style': { style: 'original' },
  other: {},
  pepe: { category: 'meme', collection: 'pepe' },
  'pixel-art': { style: 'pixel-art' },
  reactions: { category: 'reactions' },
  recolors: { style: 'recolor' },
  thinking: { category: 'reactions', topics: ['thinking'] },
  'tv-movie': { category: 'entertainment' },
  utility: { category: 'objects' }
});

const UNICODE_GROUP_RULES = Object.freeze({
  'smileys-emotion': 'reactions',
  'people-body': 'people',
  'food-drink': 'food-drink',
  activities: 'activities',
  'travel-places': 'travel-places',
  objects: 'objects',
  symbols: 'symbols',
  flags: 'flags',
  component: 'symbols'
});

const CATEGORY_KEYWORDS = Object.freeze({
  reactions: [
    'reaction', 'reactions', 'smile', 'happy', 'laugh', 'lol', 'lmao', 'cry', 'sad', 'angry', 'rage', 'mad',
    'thinking', 'think', 'wow', 'shock', 'shocked', 'surprise', 'surprised', 'clap', 'wave', 'hug',
    'kiss', 'heart', 'love', 'blush', 'wink', 'facepalm', 'shrug', 'pray', 'thumbsup', 'thumbsdown',
    'pog', 'kekw', 'monka', 'copium', 'face'
  ],
  people: [
    'person', 'people', 'man', 'woman', 'boy', 'girl', 'baby', 'child', 'adult', 'hand', 'finger',
    'body', 'hair', 'beard', 'celebrity', 'human'
  ],
  animals: [
    'animal', 'animals', 'cat', 'dog', 'frog', 'bunny', 'rabbit', 'bear', 'fox', 'wolf', 'bird', 'fish', 'shark',
    'snake', 'horse', 'cow', 'pig', 'monkey', 'lion', 'tiger', 'hamster', 'duck', 'chicken', 'bee',
    'butterfly', 'spider', 'paw'
  ],
  nature: [
    'nature', 'flower', 'tree', 'plant', 'leaf', 'sun', 'moon', 'cloud', 'rain', 'snow', 'weather',
    'fire', 'water', 'earth', 'mountain', 'ocean', 'beach'
  ],
  'food-drink': [
    'food', 'drink', 'pizza', 'burger', 'taco', 'sushi', 'coffee', 'tea', 'beer', 'wine', 'cake',
    'cookie', 'candy', 'fruit', 'apple', 'banana', 'bread', 'cheese', 'rice'
  ],
  activities: [
    'activity', 'activities', 'sport', 'soccer', 'football', 'basketball', 'baseball', 'tennis', 'golf', 'medal',
    'trophy', 'running', 'swimming', 'cycling', 'workout', 'exercise', 'party', 'dance'
  ],
  'travel-places': [
    'travel', 'place', 'places', 'car', 'taxi', 'bus', 'train', 'plane', 'airplane', 'ship', 'boat', 'rocket',
    'map', 'building', 'house', 'hotel', 'city', 'airport', 'station'
  ],
  objects: [
    'object', 'objects', 'phone', 'computer', 'laptop', 'keyboard', 'camera', 'bell', 'gift', 'tool', 'hammer',
    'book', 'money', 'key', 'lock', 'clock', 'light', 'bulb', 'microphone', 'headphone', 'headphones'
  ],
  symbols: [
    'symbol', 'symbols', 'letter', 'alphabet', 'number', 'arrow', 'check', 'cross', 'warning', 'question',
    'exclamation', 'plus', 'minus', 'circle', 'square', 'button'
  ],
  flags: ['flag', 'flags', 'country-flag', 'nation-flag'],
  gaming: [
    'gaming', 'game', 'gamer', 'xbox', 'playstation', 'nintendo', 'steam', 'minecraft', 'roblox',
    'fortnite', 'valorant', 'league', 'dota', 'overwatch', 'genshin', 'pokemon'
  ],
  entertainment: [
    'entertainment', 'anime', 'movie', 'film', 'television', 'tv', 'music', 'song', 'singer', 'artist', 'kpop',
    'cartoon', 'disney', 'marvel', 'character'
  ],
  brands: ['brand', 'brands', 'logo', 'logos', 'company-logo'],
  meme: [
    'meme', 'memes', 'pepe', 'wojak', 'troll', 'sus', 'amongus', 'among-us', 'sigma', 'gigachad', 'kekw',
    'monka', 'copium', 'poggers', 'rage-comic'
  ]
});

const TOPIC_KEYWORDS = Object.freeze({
  happy: ['happy', 'smile', 'joy', 'yay'],
  sad: ['sad', 'cry', 'crying', 'tears'],
  angry: ['angry', 'mad', 'rage'],
  laugh: ['laugh', 'lol', 'lmao', 'rofl', 'kekw'],
  thinking: ['thinking', 'think', 'hmm'],
  love: ['love', 'heart', 'kiss'],
  cute: ['cute', 'kawaii', 'adorable'],
  shocked: ['shock', 'shocked', 'surprise', 'surprised', 'wow'],
  party: ['party', 'celebrate', 'celebration'],
  approval: ['yes', 'approve', 'approved', 'thumbsup'],
  rejection: ['no', 'nope', 'reject', 'thumbsdown']
});

const COLLECTION_KEYWORDS = Object.freeze({
  pepe: ['pepe'],
  blob: ['blob', 'blobs'],
  anime: ['anime'],
  wojak: ['wojak'],
  celebrity: ['celebrity']
});

const STYLE_KEYWORDS = Object.freeze({
  'pixel-art': ['pixel-art', 'pixelart'],
  aesthetic: ['aesthetic'],
  recolor: ['recolor', 'recolors', 'recoloured', 'recolored'],
  original: ['original-style'],
  '3d': ['3d', '3-d'],
  monochrome: ['monochrome', 'black-white', 'black-and-white']
});

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeTags(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

function sourceCategoryFor(record) {
  const explicit = String(record?.sourceCategory || '').trim();
  if (explicit) return explicit;

  const current = String(record?.category || '').trim();
  if (!current) return '';

  const currentSlug = slugify(record?.categorySlug || current);
  if (record?.taxonomyVersion === TAXONOMY_VERSION && CATEGORY_SLUGS.has(currentSlug)) return '';
  return current;
}

function searchableParts(record, sourceCategory) {
  return unique([
    record?.name,
    record?.slug,
    record?.shortcode,
    record?.group,
    record?.subgroup,
    sourceCategory,
    record?.sourceCategorySlug,
    record?.source,
    ...normalizeTags(record?.tags)
  ].map((value) => slugify(value)));
}

function hasKeyword(parts, keyword) {
  const wanted = slugify(keyword);
  if (!wanted) return false;
  return parts.some((part) => part === wanted || part.startsWith(`${wanted}-`) || part.endsWith(`-${wanted}`) || part.includes(`-${wanted}-`));
}

function firstKeywordMatch(parts, ruleSet) {
  for (const [name, keywords] of Object.entries(ruleSet)) {
    if (keywords.some((keyword) => hasKeyword(parts, keyword))) return name;
  }
  return null;
}

function unicodeCategory(record) {
  const group = slugify(record?.group);
  if (!group) return null;

  if (group === 'animals-nature') {
    const subgroup = slugify(record?.subgroup);
    if (/animal|bird|amphibian|reptile|marine|bug/.test(subgroup)) return 'animals';
    return 'nature';
  }

  return UNICODE_GROUP_RULES[group] || null;
}

function keywordCategory(parts) {
  let best = null;
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (hasKeyword(parts, keyword)) score += 1;
    }
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }

  return { category: best, score: bestScore };
}

export function classifyEmoji(record) {
  const sourceCategory = sourceCategoryFor(record);
  const sourceCategorySlug = slugify(record?.sourceCategorySlug || sourceCategory);
  const parts = searchableParts(record, sourceCategory);

  let category = null;
  let basis = 'fallback';
  let confidence = 'low';
  let collection = firstKeywordMatch(parts, COLLECTION_KEYWORDS);
  let style = firstKeywordMatch(parts, STYLE_KEYWORDS);
  const topics = [];

  if (String(record?.source || '').toLowerCase() === 'emojigg' && sourceCategorySlug) {
    const rule = EMOJIGG_CATEGORY_RULES[sourceCategorySlug];
    if (rule) {
      if (rule.category) {
        category = rule.category;
        basis = 'source-category';
        confidence = 'high';
      }
      collection ||= rule.collection || null;
      style ||= rule.style || null;
      topics.push(...(rule.topics || []));
    }
  }

  if (!category) {
    const fromUnicode = unicodeCategory(record);
    if (fromUnicode) {
      category = fromUnicode;
      basis = 'unicode-group';
      confidence = 'high';
    }
  }

  if (!category) {
    const fromKeywords = keywordCategory(parts);
    if (fromKeywords.category) {
      category = fromKeywords.category;
      basis = 'keywords';
      confidence = fromKeywords.score >= 2 ? 'high' : 'medium';
    }
  }

  category ||= 'other';

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((keyword) => hasKeyword(parts, keyword))) topics.push(topic);
  }

  if (record?.animated) topics.push('animated');

  return {
    version: TAXONOMY_VERSION,
    category,
    categoryLabel: CANONICAL_CATEGORIES[category],
    collection,
    style,
    topics: unique(topics).sort(),
    confidence,
    basis,
    sourceCategory: sourceCategory || null,
    sourceCategorySlug: sourceCategory ? sourceCategorySlug : null
  };
}

export function applyEmojiTaxonomy(record) {
  const classified = classifyEmoji(record);
  const next = {
    ...record,
    category: classified.categoryLabel,
    categorySlug: classified.category,
    taxonomyVersion: classified.version
  };

  if (classified.sourceCategory) {
    next.sourceCategory = classified.sourceCategory;
    next.sourceCategorySlug = classified.sourceCategorySlug;
  } else {
    delete next.sourceCategory;
    delete next.sourceCategorySlug;
  }

  if (classified.collection) next.collection = classified.collection;
  else delete next.collection;

  if (classified.style) next.style = classified.style;
  else delete next.style;

  if (classified.topics.length) next.topics = classified.topics;
  else delete next.topics;

  return next;
}

export function summarizeTaxonomy(records) {
  const summary = new Map(
    Object.keys(CANONICAL_CATEGORIES).map((slug) => [slug, {
      slug,
      name: CANONICAL_CATEGORIES[slug],
      count: 0,
      animated: 0,
      static: 0
    }])
  );

  const confidence = { high: 0, medium: 0, low: 0 };
  const collections = new Map();
  const styles = new Map();

  for (const record of records) {
    const classified = classifyEmoji(record);
    const bucket = summary.get(classified.category) || summary.get('other');
    bucket.count += 1;
    if (record?.animated) bucket.animated += 1;
    else bucket.static += 1;
    confidence[classified.confidence] += 1;

    if (classified.collection) collections.set(classified.collection, (collections.get(classified.collection) || 0) + 1);
    if (classified.style) styles.set(classified.style, (styles.get(classified.style) || 0) + 1);
  }

  return {
    version: TAXONOMY_VERSION,
    categories: [...summary.values()].filter((item) => item.count > 0).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    confidence,
    collections: [...collections.entries()].sort((a, b) => b[1] - a[1]).map(([slug, count]) => ({ slug, count })),
    styles: [...styles.entries()].sort((a, b) => b[1] - a[1]).map(([slug, count]) => ({ slug, count }))
  };
}
