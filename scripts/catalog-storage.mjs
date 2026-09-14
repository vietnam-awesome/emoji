import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const DATA_FILE = path.resolve('src/data/emojis.json');
export const PUBLIC_API_FILE = path.resolve('public/api/emojis.json');
export const SHARD_DIR = path.resolve('src/data/emoji-shards');
export const SHARD_MANIFEST = path.join(SHARD_DIR, 'manifest.json');
export const BUCKET_COUNT = 128;

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function canonicalSort(records) {
  return [...records].sort((a, b) => {
    const date = String(b.syncedAt || b.addedAt || '').localeCompare(String(a.syncedAt || a.addedAt || ''));
    if (date) return date;
    const name = String(a.name || '').localeCompare(String(b.name || ''));
    if (name) return name;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

function dedupe(records) {
  const byId = new Map();
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    const id = String(record.id || '').trim();
    if (!id) continue;
    byId.set(id, record);
  }
  return [...byId.values()];
}

async function readShardCatalog() {
  if (!(await exists(SHARD_DIR))) return [];

  const files = (await readdir(SHARD_DIR))
    .filter((name) => /^bucket-\d{3}\.json$/.test(name))
    .sort();

  const records = [];
  for (const file of files) {
    const chunk = await readJson(path.join(SHARD_DIR, file));
    if (!Array.isArray(chunk)) throw new Error(`Invalid emoji shard: ${file}`);
    records.push(...chunk);
  }
  return canonicalSort(dedupe(records));
}

export async function loadCatalog({ preferMonolith = true } = {}) {
  if (preferMonolith && await exists(DATA_FILE)) {
    const records = await readJson(DATA_FILE);
    if (!Array.isArray(records)) throw new Error('src/data/emojis.json must contain an array');
    return dedupe(records);
  }

  const shards = await readShardCatalog();
  if (shards.length) return shards;

  if (!preferMonolith && await exists(DATA_FILE)) {
    const records = await readJson(DATA_FILE);
    if (!Array.isArray(records)) throw new Error('src/data/emojis.json must contain an array');
    return dedupe(records);
  }

  if (await exists(PUBLIC_API_FILE)) {
    const records = await readJson(PUBLIC_API_FILE);
    if (!Array.isArray(records)) throw new Error('public/api/emojis.json must contain an array');
    return dedupe(records);
  }

  throw new Error('No emoji catalog found. Expected src/data/emojis.json or src/data/emoji-shards/*.json');
}

function bucketIndex(record) {
  const key = String(record.id || record.slug || record.name || 'emoji');
  return createHash('sha256').update(key).digest()[0] % BUCKET_COUNT;
}

function bucketFilename(index) {
  return `bucket-${String(index).padStart(3, '0')}.json`;
}

export async function hydrateCatalog({ writePublic = true } = {}) {
  const records = await loadCatalog({ preferMonolith: true });
  const payload = `${JSON.stringify(records)}\n`;

  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, payload);

  if (writePublic) {
    await mkdir(path.dirname(PUBLIC_API_FILE), { recursive: true });
    await writeFile(PUBLIC_API_FILE, payload);
  }

  console.log(`[catalog] hydrated ${records.length} records${writePublic ? ' + public API' : ''}`);
  return records;
}

export async function shardCatalog() {
  const records = await loadCatalog({ preferMonolith: true });
  if (!records.length) throw new Error('Refusing to shard an empty emoji catalog');

  const buckets = Array.from({ length: BUCKET_COUNT }, () => []);
  for (const record of records) buckets[bucketIndex(record)].push(record);

  await rm(SHARD_DIR, { recursive: true, force: true });
  await mkdir(SHARD_DIR, { recursive: true });

  const files = [];
  for (let index = 0; index < buckets.length; index += 1) {
    if (!buckets[index].length) continue;
    buckets[index].sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
    const file = bucketFilename(index);
    await writeFile(path.join(SHARD_DIR, file), `${JSON.stringify(buckets[index])}\n`);
    files.push(file);
  }

  await writeFile(SHARD_MANIFEST, `${JSON.stringify({
    version: 1,
    bucketCount: BUCKET_COUNT,
    count: records.length,
    files
  }, null, 2)}\n`);

  // These two aggregate files are generated only in CI/dev now. Keeping them in
  // Git would eventually hit GitHub's hard 100 MiB per-file limit.
  await rm(DATA_FILE, { force: true });
  await rm(PUBLIC_API_FILE, { force: true });

  console.log(`[catalog] sharded ${records.length} records into ${files.length} files; removed aggregate JSON from Git working tree`);
  return { count: records.length, files };
}

export async function catalogStatus() {
  const records = await loadCatalog({ preferMonolith: true });
  const sources = new Map();
  for (const record of records) {
    const source = String(record.source || 'unknown');
    sources.set(source, (sources.get(source) || 0) + 1);
  }
  console.log(`[catalog] total=${records.length}`);
  for (const [source, count] of [...sources.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`[catalog] ${source}=${count}`);
  }
  return records;
}

async function main() {
  const command = process.argv[2] || 'status';
  if (command === 'hydrate') {
    await hydrateCatalog({ writePublic: !process.argv.includes('--no-public') });
    return;
  }
  if (command === 'shard') {
    await shardCatalog();
    return;
  }
  if (command === 'status') {
    await catalogStatus();
    return;
  }
  throw new Error(`Unknown catalog-storage command: ${command}`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(`[catalog] ${error.stack || error.message}`);
    process.exit(1);
  });
}
