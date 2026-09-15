import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const shardDir = path.resolve('src/data/emojis');
const outputFile = path.resolve('src/data/emojis.json');
const requestedLimit = Number.parseInt(process.env.PREVIEW_EMOJI_LIMIT || '600', 10);
const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : 600;

function sampleEvenly(records, count) {
  if (records.length <= count) return records;
  if (count === 1) return [records[0]];

  const sampled = [];
  const seen = new Set();
  for (let index = 0; index < count; index += 1) {
    const recordIndex = Math.round((index * (records.length - 1)) / (count - 1));
    if (seen.has(recordIndex)) continue;
    seen.add(recordIndex);
    sampled.push(records[recordIndex]);
  }
  return sampled;
}

const shardFiles = (await readdir(shardDir))
  .filter((file) => /^chunk-\d+\.json$/.test(file))
  .sort();

if (!shardFiles.length) {
  throw new Error('No representative emoji shards are available for PR preview.');
}

const recordsByShard = [];
for (const file of shardFiles) {
  const records = JSON.parse(await readFile(path.join(shardDir, file), 'utf8'));
  if (!Array.isArray(records)) throw new Error(`Preview shard ${file} is not an array.`);
  recordsByShard.push({ file, records });
}

const perShard = Math.max(1, Math.ceil((limit * 2) / recordsByShard.length));
const candidates = recordsByShard.flatMap(({ records }) => sampleEvenly(records, perShard));

const groups = new Map();
for (const record of candidates) {
  const key = String(record.categorySlug || record.category || 'other').trim().toLowerCase() || 'other';
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(record);
}

const queues = [...groups.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, records]) => records);
const selected = [];
const seenSlugs = new Set();

while (selected.length < limit && queues.some((queue) => queue.length)) {
  for (const queue of queues) {
    while (queue.length) {
      const record = queue.shift();
      const slug = String(record?.slug || '');
      if (!slug || seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);
      selected.push(record);
      break;
    }
    if (selected.length >= limit) break;
  }
}

if (!selected.length) throw new Error('Representative preview catalog is empty.');

await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(selected)}\n`);

const sourceCounts = new Map();
for (const record of selected) {
  const source = String(record.source || 'unknown');
  sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
}

console.log(
  `[preview-data] selected ${selected.length.toLocaleString('en-US')} emoji from ` +
  `${shardFiles.length} representative shard(s), ${groups.size} category group(s); ` +
  `sources=${[...sourceCounts.entries()].map(([source, count]) => `${source}:${count}`).join(', ')}`
);
