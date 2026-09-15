import { access, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  filterSensitiveEmojiRecords,
  removeSensitiveLocalAssets
} from './lib/content-safety.mjs';
import {
  applyEmojiTaxonomy,
  summarizeTaxonomy,
  TAXONOMY_VERSION
} from './lib/emoji-taxonomy.mjs';

const DATA_FILE = path.resolve('src/data/emojis.json');
const CATEGORY_DATA_FILE = path.resolve('src/data/categories.json');
const SHARD_DIR = path.resolve('src/data/emojis');
const MANIFEST_FILE = path.join(SHARD_DIR, 'index.json');
const DEFAULT_CHUNK_SIZE = 2500;

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

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function loadShards() {
  if (!(await exists(MANIFEST_FILE))) {
    throw new Error('Emoji shard manifest is missing and src/data/emojis.json does not exist.');
  }

  const manifest = await readJson(MANIFEST_FILE);
  if (!Array.isArray(manifest.chunks) || manifest.chunks.length === 0) {
    return [];
  }

  const all = [];
  for (const chunk of manifest.chunks) {
    const filename = typeof chunk === 'string' ? chunk : chunk.file;
    if (!filename) throw new Error('Emoji shard manifest contains an invalid chunk entry.');
    const records = await readJson(path.join(SHARD_DIR, filename));
    if (!Array.isArray(records)) throw new Error(`Emoji shard ${filename} is not an array.`);
    all.push(...records);
  }

  if (Number.isFinite(manifest.total) && all.length !== manifest.total) {
    throw new Error(`Emoji shard count mismatch: manifest=${manifest.total}, loaded=${all.length}`);
  }
  return all;
}

async function sanitizeCatalog(records, phase) {
  const { allowed, blocked } = filterSensitiveEmojiRecords(records);
  if (!blocked.length) return allowed;

  const removedAssets = await removeSensitiveLocalAssets(blocked);
  const bySource = new Map();
  for (const record of blocked) {
    const source = String(record?.source || 'unknown');
    bySource.set(source, (bySource.get(source) || 0) + 1);
  }
  const summary = [...bySource.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([source, count]) => `${source}:${count}`)
    .join(', ');

  console.warn(
    `[content-safety] ${phase}: blocked ${blocked.length.toLocaleString('en-US')} sensitive record(s)` +
    `; removed ${removedAssets.toLocaleString('en-US')} local asset(s)` +
    (summary ? `; sources=${summary}` : '')
  );
  return allowed;
}

function logOtherBreakdown(classified, phase) {
  const otherRecords = classified.filter((record) => record.categorySlug === 'other');
  if (!otherRecords.length) return;

  const bySource = new Map();
  const samples = new Map();
  for (const record of otherRecords) {
    const source = String(record.source || 'unknown');
    bySource.set(source, (bySource.get(source) || 0) + 1);
    if (!samples.has(source)) samples.set(source, []);
    if (samples.get(source).length < 5) {
      samples.get(source).push(
        `${record.name || record.shortcode || record.id}` +
        (record.sourceCategory ? ` [${record.sourceCategory}]` : '')
      );
    }
  }

  const ordered = [...bySource.entries()].sort((a, b) => b[1] - a[1]);
  console.log(
    `[taxonomy] ${phase}: Other by source: ` +
    ordered.map(([source, count]) => `${source}=${count.toLocaleString('en-US')}`).join(', ')
  );
  for (const [source, count] of ordered.slice(0, 8)) {
    console.log(
      `[taxonomy] ${phase}: Other samples ${source} (${count.toLocaleString('en-US')}): ` +
      samples.get(source).join(' | ')
    );
  }
}

function classifyCatalog(records, phase) {
  const classified = records.map(applyEmojiTaxonomy);
  const summary = summarizeTaxonomy(classified);
  const other = summary.categories.find((item) => item.slug === 'other')?.count || 0;
  console.log(
    `[taxonomy] ${phase}: v${TAXONOMY_VERSION}, ${classified.length.toLocaleString('en-US')} records, ` +
    `${summary.categories.length} canonical categories, ${other.toLocaleString('en-US')} in Other`
  );
  logOtherBreakdown(classified, phase);
  return { classified, summary };
}

async function writeCategorySummary(summary) {
  await writeJson(CATEGORY_DATA_FILE, summary.categories);
}

async function hydrate() {
  let emojis;
  if (await exists(DATA_FILE)) {
    emojis = await readJson(DATA_FILE);
    if (!Array.isArray(emojis)) throw new Error('src/data/emojis.json is not an array.');
  } else {
    emojis = await loadShards();
  }

  emojis = await sanitizeCatalog(emojis, 'hydrate');
  const { classified, summary } = classifyCatalog(emojis, 'hydrate');
  await writeJson(DATA_FILE, classified);
  await writeCategorySummary(summary);
  console.log(`[emoji-store] hydrated ${classified.length.toLocaleString('en-US')} safe, classified records into the working JSON file`);
}

async function shard() {
  let emojis;
  if (await exists(DATA_FILE)) {
    emojis = await readJson(DATA_FILE);
  } else {
    emojis = await loadShards();
  }
  if (!Array.isArray(emojis)) throw new Error('Emoji data is not an array.');

  emojis = await sanitizeCatalog(emojis, 'shard');
  const { classified, summary } = classifyCatalog(emojis, 'shard');
  emojis = classified;

  const chunkSizeArg = Number.parseInt(process.env.EMOJI_SHARD_SIZE || '', 10);
  const chunkSize = Number.isFinite(chunkSizeArg) && chunkSizeArg > 0 ? chunkSizeArg : DEFAULT_CHUNK_SIZE;

  await rm(SHARD_DIR, { recursive: true, force: true });
  await mkdir(SHARD_DIR, { recursive: true });

  const chunks = [];
  for (let offset = 0, index = 0; offset < emojis.length; offset += chunkSize, index += 1) {
    const records = emojis.slice(offset, offset + chunkSize);
    const filename = `chunk-${String(index + 1).padStart(4, '0')}.json`;
    await writeJson(path.join(SHARD_DIR, filename), records);
    chunks.push({ file: filename, count: records.length });
  }

  await writeJson(MANIFEST_FILE, {
    version: 1,
    taxonomyVersion: TAXONOMY_VERSION,
    total: emojis.length,
    chunkSize,
    chunks
  });
  await writeCategorySummary(summary);

  await rm(DATA_FILE, { force: true });

  const files = await readdir(SHARD_DIR);
  console.log(`[emoji-store] sharded ${emojis.length.toLocaleString('en-US')} safe, classified records into ${chunks.length} chunks (${files.length} files including manifest)`);
}

const command = String(process.argv[2] || '').toLowerCase();
if (command === 'hydrate') {
  await hydrate();
} else if (command === 'shard') {
  await shard();
} else {
  console.error('Usage: node scripts/emoji-store.mjs <hydrate|shard>');
  process.exitCode = 2;
}
