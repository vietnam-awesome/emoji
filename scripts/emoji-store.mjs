import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_FILE = path.resolve('src/data/emojis.json');
const API_FILE = path.resolve('public/api/emojis.json');
const SHARD_DIR = path.resolve('src/data/emojis');
const MANIFEST_FILE = path.join(SHARD_DIR, 'index.json');
const DEFAULT_CHUNK_SIZE = 2500;

async function exists(file) {
  try {
    await readFile(file);
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

async function hydrate() {
  let emojis;
  if (await exists(DATA_FILE)) {
    emojis = await readJson(DATA_FILE);
    if (!Array.isArray(emojis)) throw new Error('src/data/emojis.json is not an array.');
  } else {
    emojis = await loadShards();
    await writeJson(DATA_FILE, emojis);
  }

  await writeJson(API_FILE, emojis);
  console.log(`[emoji-store] hydrated ${emojis.length.toLocaleString('en-US')} records into working JSON files`);
}

async function shard() {
  let emojis;
  if (await exists(DATA_FILE)) {
    emojis = await readJson(DATA_FILE);
  } else {
    emojis = await loadShards();
  }
  if (!Array.isArray(emojis)) throw new Error('Emoji data is not an array.');

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
    total: emojis.length,
    chunkSize,
    chunks
  });

  await rm(DATA_FILE, { force: true });
  await rm(API_FILE, { force: true });

  const files = await readdir(SHARD_DIR);
  console.log(`[emoji-store] sharded ${emojis.length.toLocaleString('en-US')} records into ${chunks.length} chunks (${files.length} files including manifest)`);
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
