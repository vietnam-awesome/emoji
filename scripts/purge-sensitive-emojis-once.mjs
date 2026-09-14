import { readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

const DATA_FILE = path.resolve('src/data/emojis.json');
const API_FILE = path.resolve('public/api/emojis.json');

const SENSITIVE_TOKENS = new Set([
  '18+', '18plus', 'adult', 'bdsm', 'blowjob', 'boob', 'boobs', 'cock', 'cum',
  'dick', 'erotic', 'fetish', 'fuck', 'hentai', 'horny', 'lewd', 'naked', 'nude',
  'nudity', 'nsfw', 'onlyfans', 'porn', 'porno', 'pornographic', 'pussy', 'r34',
  'rule34', 'sex', 'sexual', 'tits', 'xxx'
]);

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isSensitiveText(...values) {
  for (const value of values.flat(Infinity)) {
    const raw = String(value || '').toLowerCase();
    if (raw.includes('18+')) return true;
    const normalized = slugify(value);
    if (!normalized) continue;
    const tokens = normalized.split('-').filter(Boolean);
    if (tokens.some((token) => SENSITIVE_TOKENS.has(token))) return true;
    if (/^(?:18-?plus|rule-?34)$/.test(normalized)) return true;
    if (normalized.includes('18-plus') || normalized.includes('rule-34')) return true;
  }
  return false;
}

function isSensitiveRecord(item) {
  if (!item) return false;
  return isSensitiveText(
    item.id,
    item.slug,
    item.name,
    item.shortcode,
    item.group,
    item.subgroup,
    item.category,
    item.categorySlug,
    item.tags || [],
    item.sourceUrl,
    item.upstreamAssetUrl,
    item.attribution
  );
}

const data = JSON.parse(await readFile(DATA_FILE, 'utf8'));
const sensitive = data.filter(isSensitiveRecord);
const kept = data.filter((item) => !isSensitiveRecord(item));

let removedFiles = 0;
let missingFiles = 0;
for (const item of sensitive) {
  const image = String(item.image || '');
  if (!image.startsWith('/emojis/')) continue;
  const file = path.resolve('public', image.replace(/^\/+/, ''));
  try {
    await unlink(file);
    removedFiles += 1;
  } catch (error) {
    if (error?.code === 'ENOENT') missingFiles += 1;
    else throw error;
  }
}

if (kept.some(isSensitiveRecord)) throw new Error('Sensitive records remain after purge.');

const output = `${JSON.stringify(kept, null, 2)}\n`;
await writeFile(DATA_FILE, output);
await writeFile(API_FILE, output);

console.log(`Sensitive records removed: ${sensitive.length}`);
console.log(`Image files removed: ${removedFiles}`);
console.log(`Already-missing image files: ${missingFiles}`);
console.log(`Records remaining: ${kept.length}`);
