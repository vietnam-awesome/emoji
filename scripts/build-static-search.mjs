import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@libsql/client';

const DATA_FILE = path.resolve('src/data/emojis.json');
const CATEGORY_FILE = path.resolve('src/data/categories.json');
const OUT_DIR = path.resolve('public/search');
const CHUNK_SIZE = 1000;
const DB_PAGE_SIZE = 5000;
const DEFAULT_ASSET_ORIGIN = 'https://raw.githubusercontent.com/vietnam-awesome/emoji/data/public';
const ASSET_ORIGIN = String(
  process.env.PR_PREVIEW_ASSET_ORIGIN ||
  process.env.EMOJI_ASSET_ORIGIN ||
  DEFAULT_ASSET_ORIGIN
)
  .trim()
  .replace(/\/+$/, '');

function safeSlug(value, fallback = 'unknown') {
  const slug = String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

function normalizeSearch(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function recordTokens(record) {
  const values = [
    record.name,
    record.shortcode,
    record.category,
    record.categorySlug,
    record.sourceLabel,
    record.collection,
    record.style,
    ...(Array.isArray(record.tags) ? record.tags : []),
    ...(Array.isArray(record.topics) ? record.topics : [])
  ];

  const tokens = new Set();
  for (const value of values) {
    for (const token of normalizeSearch(value).split(/\s+/).filter(Boolean)) {
      if (token.length <= 64) tokens.add(token);
    }
  }
  return [...tokens];
}

function assetUrl(value) {
  const image = String(value || '');
  if (image.startsWith('/emojis/') && ASSET_ORIGIN) return `${ASSET_ORIGIN}${image}`;
  return image;
}

function compactRecord(record) {
  return {
    s: String(record.slug || ''),
    n: String(record.name || ''),
    c: String(record.shortcode || ''),
    g: String(record.group || ''),
    ca: String(record.category || ''),
    cs: String(record.categorySlug || ''),
    t: Array.isArray(record.tags) ? record.tags.slice(0, 16) : [],
    src: String(record.source || ''),
    sl: String(record.sourceLabel || ''),
    i: assetUrl(record.image),
    f: String(record.format || ''),
    a: Boolean(record.animated),
    e: String(record.emoji || ''),
    h: String(record.hexcode || ''),
    co: String(record.collection || ''),
    st: String(record.style || ''),
    tp: Array.isArray(record.topics) ? record.topics.slice(0, 12) : []
  };
}

async function writeJson(file, value, pretty = false) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, pretty ? 2 : 0)}${pretty ? '\n' : ''}`);
}

async function loadLocalCatalog() {
  const records = JSON.parse(await readFile(DATA_FILE, 'utf8'));
  if (!Array.isArray(records)) throw new Error('src/data/emojis.json must contain an array');
  return records;
}

async function loadTursoCatalog(url, authToken) {
  const client = createClient({ url, authToken });
  const records = [];
  let offset = 0;

  while (true) {
    const result = await client.execute({
      sql: `SELECT record_json FROM emojis\n            ORDER BY COALESCE(synced_at, added_at) DESC, id\n            LIMIT ? OFFSET ?`,
      args: [DB_PAGE_SIZE, offset]
    });

    if (!result.rows.length) break;
    for (const row of result.rows) {
      if (!row.record_json) continue;
      records.push(JSON.parse(String(row.record_json)));
    }

    offset += result.rows.length;
    console.log(`[static-data] Turso export: ${offset.toLocaleString('en-US')} rows`);
    if (result.rows.length < DB_PAGE_SIZE) break;
  }

  await writeFile(DATA_FILE, `${JSON.stringify(records)}\n`);
  return records;
}

async function loadCatalog() {
  const source = String(process.env.STATIC_DATA_SOURCE || 'local').trim().toLowerCase();

  if (source === 'local') {
    console.log('[static-data] using hydrated repository shards (zero Turso reads)');
    return loadLocalCatalog();
  }

  if (source !== 'turso') {
    throw new Error(`Unsupported STATIC_DATA_SOURCE=${source}; expected local or turso`);
  }

  const url = String(process.env.TURSO_DATABASE_URL || '').trim();
  const authToken = String(process.env.TURSO_AUTH_TOKEN || '').trim();
  if (!url || !authToken) {
    throw new Error('STATIC_DATA_SOURCE=turso requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
  }

  console.log('[static-data] explicitly exporting catalog from Turso');
  return loadTursoCatalog(url, authToken);
}

function addFacet(map, key, name, id, animated) {
  const value = String(key || '').trim().toLowerCase();
  if (!value) return;
  if (!map.has(value)) map.set(value, { name: String(name || key), ids: [], animated: 0, static: 0 });
  const item = map.get(value);
  item.ids.push(id);
  if (animated) item.animated += 1;
  else item.static += 1;
}

function countBucket() {
  return { total: 0, animated: 0, static: 0 };
}

function incrementBucket(bucket, animated) {
  bucket.total += 1;
  if (animated) bucket.animated += 1;
  else bucket.static += 1;
}

function addCompatibility(compatibility, category, source, animated) {
  incrementBucket(compatibility.totals, animated);

  if (!compatibility.categories[category]) compatibility.categories[category] = countBucket();
  incrementBucket(compatibility.categories[category], animated);

  if (!source) return;
  if (!compatibility.sources[source]) compatibility.sources[source] = countBucket();
  incrementBucket(compatibility.sources[source], animated);

  if (!compatibility.categorySource[category]) compatibility.categorySource[category] = {};
  if (!compatibility.categorySource[category][source]) compatibility.categorySource[category][source] = countBucket();
  incrementBucket(compatibility.categorySource[category][source], animated);
}

function addTokenToPrefix(index, prefix, token, id) {
  if (!prefix) return;
  if (!index.has(prefix)) index.set(prefix, new Map());
  const shard = index.get(prefix);
  if (!shard.has(token)) shard.set(token, []);
  shard.get(token).push(id);
}

function addToken(index, token, id) {
  addTokenToPrefix(index, token.slice(0, 1), token, id);
  if (token.length > 1) addTokenToPrefix(index, token.slice(0, 2), token, id);
}

const records = await loadCatalog();
await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

const compact = records.map(compactRecord);
const categories = new Map();
const sources = new Map();
const tokenIndex = new Map();
const animatedIds = [];
const staticIds = [];
const variantGroups = new Map();
const compatibility = {
  totals: countBucket(),
  categories: {},
  sources: {},
  categorySource: {}
};

for (let id = 0; id < records.length; id += 1) {
  const record = records[id];
  const category = String(record.categorySlug || safeSlug(record.category)).trim().toLowerCase();
  const source = String(record.source || '').trim().toLowerCase();
  const animated = Boolean(record.animated);
  const variantKey = safeSlug(record.hexcode, '');

  if (variantKey) {
    if (!variantGroups.has(variantKey)) variantGroups.set(variantKey, []);
    variantGroups.get(variantKey).push({
      id,
      l: String(record.license || ''),
      at: String(record.attribution || '')
    });
  }

  addFacet(categories, category, record.category, id, animated);
  addFacet(sources, source, record.sourceLabel || record.source, id, animated);
  addCompatibility(compatibility, category, source, animated);
  (animated ? animatedIds : staticIds).push(id);
  for (const token of recordTokens(record)) addToken(tokenIndex, token, id);
}

const chunkCount = Math.ceil(compact.length / CHUNK_SIZE);
for (let chunk = 0; chunk < chunkCount; chunk += 1) {
  const start = chunk * CHUNK_SIZE;
  await writeJson(
    path.join(OUT_DIR, 'chunks', `${String(chunk).padStart(4, '0')}.json`),
    compact.slice(start, start + CHUNK_SIZE)
  );
}

const variantShards = new Map();
let variantGroupCount = 0;
for (const [key, entries] of variantGroups) {
  if (entries.length < 2) continue;
  const prefix = key.slice(0, 2) || 'xx';
  if (!variantShards.has(prefix)) variantShards.set(prefix, new Map());
  variantShards.get(prefix).set(key, entries);
  variantGroupCount += 1;
}

for (const [prefix, groups] of variantShards) {
  await writeJson(
    path.join(OUT_DIR, 'variants', `${prefix}.json`),
    Object.fromEntries([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)))
  );
}

const categoryManifest = [];
for (const [value, item] of categories) {
  const file = `${safeSlug(value)}.json`;
  await writeJson(path.join(OUT_DIR, 'facets', 'category', file), item.ids);
  categoryManifest.push({
    value,
    name: item.name,
    count: item.ids.length,
    animated: item.animated,
    static: item.static,
    file
  });
}
categoryManifest.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

const sourceManifest = [];
for (const [value, item] of sources) {
  const file = `${safeSlug(value)}.json`;
  await writeJson(path.join(OUT_DIR, 'facets', 'source', file), item.ids);
  sourceManifest.push({ value, name: item.name, count: item.ids.length, file });
}
sourceManifest.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

await writeJson(path.join(OUT_DIR, 'facets', 'motion', 'yes.json'), animatedIds);
await writeJson(path.join(OUT_DIR, 'facets', 'motion', 'no.json'), staticIds);

for (const [prefix, tokens] of tokenIndex) {
  const payload = Object.fromEntries([...tokens.entries()].sort(([a], [b]) => a.localeCompare(b)));
  await writeJson(path.join(OUT_DIR, 'q', `${prefix}.json`), payload);
}

await writeJson(path.join(OUT_DIR, 'manifest.json'), {
  version: 2,
  total: records.length,
  chunkSize: CHUNK_SIZE,
  chunkCount,
  categories: categoryManifest.map(({ value, name, count, file }) => ({ value, name, count, file })),
  sources: sourceManifest,
  motion: { yes: animatedIds.length, no: staticIds.length },
  compatibility,
  variants: { groupCount: variantGroupCount, shards: [...variantShards.keys()].sort() }
});

await writeJson(
  CATEGORY_FILE,
  categoryManifest.map(({ value, name, count, animated, static: staticCount }) => ({
    slug: value,
    name,
    count,
    animated,
    static: staticCount
  })),
  true
);

console.log(
  `[static-data] generated ${records.length.toLocaleString('en-US')} records, ` +
  `${chunkCount} catalog chunks and ${tokenIndex.size} search-prefix shards`
);
