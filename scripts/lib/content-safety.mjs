import { unlink } from 'node:fs/promises';
import path from 'node:path';

// Keep this list intentionally focused on explicit/NSFW terms. Broad terms such as
// "ass" are avoided because they create false positives in ordinary emoji names.
const SENSITIVE_TOKENS = new Set([
  '18+', '18plus', 'adult', 'bdsm', 'blowjob', 'boob', 'boobs', 'cock', 'cum',
  'dick', 'erotic', 'fetish', 'fuck', 'hentai', 'horny', 'lewd', 'naked', 'nude',
  'nudity', 'nsfw', 'onlyfans', 'porn', 'porno', 'pornographic', 'pussy', 'r34',
  'rule34', 'sex', 'sexual', 'tits', 'xxx'
]);

// These are safe to match inside concatenated names such as HentaiFuckUwU.
const STRONG_COMPACT_MARKERS = [
  '18plus', 'blowjob', 'hentai', 'nsfw', 'onlyfans', 'porn', 'porno',
  'pornographic', 'rule34', 'sexual', 'xxx'
];

function textParts(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, ' ')
    .trim();
}

export function isSensitiveText(...values) {
  for (const value of values.flat(Infinity)) {
    const normalized = textParts(value);
    if (!normalized) continue;
    if (normalized.includes('18+')) return true;

    const tokens = normalized.split(/\s+/).filter(Boolean);
    if (tokens.some((token) => SENSITIVE_TOKENS.has(token))) return true;

    const compact = normalized.replace(/[^a-z0-9]/g, '');
    if (STRONG_COMPACT_MARKERS.some((marker) => compact.includes(marker))) return true;
  }
  return false;
}

export function isSensitiveEmojiRecord(record) {
  if (!record || typeof record !== 'object') return false;
  return isSensitiveText(
    record.name,
    record.slug,
    record.shortcode,
    record.category,
    record.categorySlug,
    record.group,
    record.subgroup,
    record.tags || []
  );
}

export function filterSensitiveEmojiRecords(records) {
  const allowed = [];
  const blocked = [];
  for (const record of records || []) {
    (isSensitiveEmojiRecord(record) ? blocked : allowed).push(record);
  }
  return { allowed, blocked };
}

export async function removeSensitiveLocalAssets(records, publicRoot = path.resolve('public')) {
  let removed = 0;
  for (const record of records || []) {
    const image = String(record?.image || '');
    if (!image.startsWith('/emojis/community/')) continue;

    const relative = image.replace(/^\/+/, '');
    const file = path.resolve(publicRoot, relative);
    const root = `${path.resolve(publicRoot)}${path.sep}`;
    if (!file.startsWith(root)) continue;

    try {
      await unlink(file);
      removed += 1;
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        console.warn(`[content-safety] could not remove ${relative}: ${error.message}`);
      }
    }
  }
  return removed;
}
