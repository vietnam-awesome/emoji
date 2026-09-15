import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  applyEmojiTaxonomy,
  classifyEmoji,
  summarizeTaxonomy,
  TAXONOMY_VERSION
} from './lib/emoji-taxonomy.mjs';

const SHARD_DIR = path.resolve('src/data/emojis');
const MANIFEST_FILE = path.join(SHARD_DIR, 'index.json');
const CATEGORY_DATA_FILE = path.resolve('src/data/categories.json');
const writeChanges = process.argv.includes('--write');

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
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

const manifest = await readJson(MANIFEST_FILE);
const entries = Array.isArray(manifest.chunks) ? manifest.chunks : [];
if (!entries.length) throw new Error('Emoji shard manifest contains no chunks.');

const all = [];
const pendingWrites = [];
const confidence = { high: 0, medium: 0, low: 0 };
const basis = new Map();
const lowExamples = [];
let changedRecords = 0;

for (const entry of entries) {
  const filename = typeof entry === 'string' ? entry : entry.file;
  if (!filename) throw new Error('Invalid shard entry in manifest.');
  const file = path.join(SHARD_DIR, filename);
  const records = await readJson(file);
  if (!Array.isArray(records)) throw new Error(`${filename} is not an array.`);

  const classifiedRecords = [];
  for (const record of records) {
    const classification = classifyEmoji(record);
    const classified = applyEmojiTaxonomy(record);
    confidence[classification.confidence] += 1;
    basis.set(classification.basis, (basis.get(classification.basis) || 0) + 1);

    if (classification.confidence === 'low' && lowExamples.length < 25) {
      lowExamples.push({
        id: record.id,
        name: record.name,
        source: record.source,
        sourceCategory: classification.sourceCategory,
        category: classification.category
      });
    }

    if (JSON.stringify(classified) !== JSON.stringify(record)) changedRecords += 1;
    classifiedRecords.push(classified);
    all.push(classified);
  }

  pendingWrites.push({ file, records: classifiedRecords });
}

if (Number.isFinite(manifest.total) && all.length !== manifest.total) {
  throw new Error(`Manifest total mismatch: expected=${manifest.total}, loaded=${all.length}`);
}

const summary = summarizeTaxonomy(all);
const total = all.length;
const pct = (value) => total ? `${((value / total) * 100).toFixed(1)}%` : '0.0%';

console.log(`\nCanonical emoji taxonomy v${TAXONOMY_VERSION}`);
console.log(`Mode: ${writeChanges ? 'WRITE' : 'DRY RUN'}`);
console.log(`Records: ${total.toLocaleString('en-US')}`);
console.log(`Records that would change: ${changedRecords.toLocaleString('en-US')}`);
console.log(`Confidence: high=${confidence.high.toLocaleString('en-US')} (${pct(confidence.high)}), medium=${confidence.medium.toLocaleString('en-US')} (${pct(confidence.medium)}), low=${confidence.low.toLocaleString('en-US')} (${pct(confidence.low)})`);
console.log('\nCategories:');
for (const item of summary.categories) {
  console.log(`  ${item.slug.padEnd(16)} ${String(item.count).padStart(8)}  animated=${item.animated}`);
}

console.log('\nClassification basis:');
for (const [name, count] of [...basis.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${name.padEnd(18)} ${String(count).padStart(8)}`);
}

if (summary.collections.length) {
  console.log('\nTop collections:');
  for (const item of summary.collections.slice(0, 12)) console.log(`  ${item.slug.padEnd(16)} ${String(item.count).padStart(8)}`);
}

if (summary.styles.length) {
  console.log('\nStyles:');
  for (const item of summary.styles) console.log(`  ${item.slug.padEnd(16)} ${String(item.count).padStart(8)}`);
}

if (lowExamples.length) {
  console.log('\nLow-confidence examples (review these before WRITE):');
  for (const item of lowExamples) {
    console.log(`  ${item.id} | ${item.source} | ${item.sourceCategory || '-'} | ${item.name} -> ${item.category}`);
  }
}

if (!writeChanges) {
  console.log('\nDry run complete. Re-run with --write after reviewing the distribution.');
  process.exit(0);
}

for (const item of pendingWrites) await writeJson(item.file, item.records);
await writeJson(CATEGORY_DATA_FILE, summary.categories);
await writeJson(MANIFEST_FILE, {
  ...manifest,
  taxonomyVersion: TAXONOMY_VERSION
});

console.log(`\nWrote taxonomy v${TAXONOMY_VERSION} to ${pendingWrites.length} shard(s) and refreshed src/data/categories.json.`);
