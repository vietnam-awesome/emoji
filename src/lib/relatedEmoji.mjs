// Deterministic related-emoji picker used to render server-side internal
// links on emoji detail pages. The detail page's other discovery sections
// ("Similar emoji", "Random emoji") are populated in the browser, so without
// this picker the static HTML of a detail page links to no other emoji page
// and crawlers can only reach the catalog through the sitemap.
//
// Selection is fully deterministic for a given catalog: candidates are drawn
// from prebuilt buckets with a slug-seeded stride sample (the same sampling
// pattern as src/lib/similarEmoji.mjs), preferring
//   1. the same category and the same source,
//   2. the same category,
//   3. the same source,
//   4. the curated Unicode set (records carrying a hexcode) as a final
//      fallback for categories/sources too small to fill the section.

const compact = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '');

const hashString = (value) => {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const bucketPush = (map, key, index) => {
  const value = compact(key);
  if (!value) return;
  const bucket = map.get(value);
  if (bucket) bucket.push(index);
  else map.set(value, [index]);
};

export function createRelatedEmojiPicker(catalog, options = {}) {
  const records = Array.isArray(catalog) ? catalog : [];
  const defaultLimit = Math.max(0, Number(options.limit) || 12);

  const byCategory = new Map();
  const bySource = new Map();
  const byCategorySource = new Map();
  const curated = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const categoryKey = compact(record?.categorySlug || record?.category);
    const sourceKey = compact(record?.source);
    bucketPush(byCategory, record?.categorySlug || record?.category, index);
    bucketPush(bySource, record?.source, index);
    if (categoryKey && sourceKey) {
      let bySourceInCategory = byCategorySource.get(categoryKey);
      if (!bySourceInCategory) {
        bySourceInCategory = new Map();
        byCategorySource.set(categoryKey, bySourceInCategory);
      }
      bucketPush(bySourceInCategory, record?.source, index);
    }
    if (String(record?.hexcode || '').trim()) curated.push(index);
  }

  const sampleInto = (picked, seen, bucket, count, seed, targetSlug) => {
    if (!bucket?.length || count <= 0 || picked.length >= seen.limit) return;

    // Walk the bucket from a seeded start with a stride that is coprime to
    // the bucket length, so the walk is a permutation: it spreads picks
    // evenly across the bucket yet still visits every position, which a
    // float-stride sample cannot guarantee.
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    let stride = Math.max(1, Math.floor(bucket.length / count));
    while (gcd(stride, bucket.length) !== 1) stride += 1;

    const start = seed % bucket.length;
    let added = 0;
    for (let offset = 0; offset < bucket.length && added < count && picked.length < seen.limit; offset += 1) {
      const record = records[bucket[(start + offset * stride) % bucket.length]];
      if (!record?.slug || record.slug === targetSlug || seen.slugs.has(record.slug)) continue;
      seen.slugs.add(record.slug);
      picked.push(record);
      added += 1;
    }
  };

  return (target, limit = defaultLimit) => {
    const totalLimit = Math.max(0, Number(limit) || 0);
    if (!target || !records.length || !totalLimit) return [];

    const seed = hashString(target.slug || target.id || target.name);
    const seen = { slugs: new Set(), limit: totalLimit };
    const picked = [];
    const categoryKey = compact(target.categorySlug || target.category);
    const sourceKey = compact(target.source);

    sampleInto(picked, seen, byCategorySource.get(categoryKey)?.get(sourceKey), totalLimit, seed, target.slug);
    sampleInto(picked, seen, byCategory.get(categoryKey), totalLimit, seed >>> 1, target.slug);
    sampleInto(picked, seen, bySource.get(sourceKey), totalLimit, seed >>> 2, target.slug);
    sampleInto(picked, seen, curated, totalLimit, seed >>> 3, target.slug);

    return picked.slice(0, totalLimit);
  };
}
