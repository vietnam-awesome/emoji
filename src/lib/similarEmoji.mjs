const normalize = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const compact = (value) => normalize(value).replace(/\s+/g, '');

const values = (input) => Array.isArray(input)
  ? input.map(normalize).filter(Boolean)
  : [];

const sharedCount = (left, right) => {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  let count = 0;
  for (const value of new Set(left)) {
    if (rightSet.has(value)) count += 1;
  }
  return count;
};

const wordSet = (record) => new Set(
  normalize([record?.name, record?.shortcode].filter(Boolean).join(' '))
    .split(/\s+/)
    .filter((word) => word.length > 1)
);

const matching = (left, right) => {
  const a = compact(left);
  const b = compact(right);
  return Boolean(a && b && a === b);
};

export function similarityScore(target, candidate) {
  if (!target || !candidate) return Number.NEGATIVE_INFINITY;
  if ((target.id && target.id === candidate.id) || (target.slug && target.slug === candidate.slug)) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;

  if (matching(target.hexcode, candidate.hexcode)) score += 36;
  if (matching(target.categorySlug || target.category, candidate.categorySlug || candidate.category)) score += 14;
  if (matching(target.group, candidate.group)) score += 7;
  if (matching(target.collection, candidate.collection)) score += 5;
  if (matching(target.style, candidate.style)) score += 3;
  if (matching(target.shortcode, candidate.shortcode)) score += 8;

  score += Math.min(sharedCount(values(target.tags), values(candidate.tags)) * 5, 20);
  score += Math.min(sharedCount(values(target.topics), values(candidate.topics)) * 3, 9);

  const targetWords = wordSet(target);
  const candidateWords = wordSet(candidate);
  let sharedWords = 0;
  for (const word of targetWords) {
    if (candidateWords.has(word)) sharedWords += 1;
  }
  score += Math.min(sharedWords * 2, 6);

  if (matching(target.source, candidate.source)) score += 1;
  if (Boolean(target.animated) === Boolean(candidate.animated)) score += 1;
  if (matching(target.format, candidate.format)) score += 0.5;

  return score;
}

const bucketPush = (map, key, index) => {
  const value = compact(key);
  if (!value) return;
  const bucket = map.get(value);
  if (bucket) bucket.push(index);
  else map.set(value, [index]);
};

const hashString = (value) => {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const addSample = (targetSet, bucket, maxItems, seed, totalLimit) => {
  if (!bucket?.length || targetSet.size >= totalLimit) return;

  if (bucket.length <= maxItems) {
    for (const index of bucket) {
      targetSet.add(index);
      if (targetSet.size >= totalLimit) return;
    }
    return;
  }

  const start = seed % bucket.length;
  const stride = bucket.length / maxItems;
  for (let offset = 0; offset < maxItems && targetSet.size < totalLimit; offset += 1) {
    const position = Math.floor((start + offset * stride) % bucket.length);
    targetSet.add(bucket[position]);
  }
};

export function createSimilarEmojiResolver(catalog, options = {}) {
  const records = Array.isArray(catalog) ? catalog : [];
  const candidateLimit = Math.max(80, Number(options.candidateLimit) || 640);
  const byHexcode = new Map();
  const byCategory = new Map();
  const byGroup = new Map();
  const byCollection = new Map();
  const byStyle = new Map();

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    bucketPush(byHexcode, record?.hexcode, index);
    bucketPush(byCategory, record?.categorySlug || record?.category, index);
    bucketPush(byGroup, record?.group, index);
    bucketPush(byCollection, record?.collection, index);
    bucketPush(byStyle, record?.style, index);
  }

  return (target, limit = 12) => {
    if (!target || !records.length) return [];

    const candidates = new Set();
    const seed = hashString(target.slug || target.id || target.name);
    addSample(candidates, byHexcode.get(compact(target.hexcode)), 80, seed, candidateLimit);
    addSample(candidates, byCategory.get(compact(target.categorySlug || target.category)), 260, seed, candidateLimit);
    addSample(candidates, byGroup.get(compact(target.group)), 180, seed >>> 1, candidateLimit);
    addSample(candidates, byCollection.get(compact(target.collection)), 120, seed >>> 2, candidateLimit);
    addSample(candidates, byStyle.get(compact(target.style)), 100, seed >>> 3, candidateLimit);

    return [...candidates]
      .map((index) => ({ record: records[index], score: similarityScore(target, records[index]) }))
      .filter(({ score }) => Number.isFinite(score) && score > 0)
      .sort((left, right) =>
        right.score - left.score ||
        String(left.record?.name || '').localeCompare(String(right.record?.name || '')) ||
        String(left.record?.id || '').localeCompare(String(right.record?.id || ''))
      )
      .slice(0, Math.max(0, Number(limit) || 0))
      .map(({ record }) => record);
  };
}
