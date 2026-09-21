import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { CANONICAL_CATEGORIES, TAXONOMY_VERSION } from './lib/emoji-taxonomy.mjs';

const emojis = JSON.parse(await readFile('src/data/emojis.json', 'utf8'));
const ids = new Set();
const slugs = new Set();
const canonicalCategories = new Set(Object.keys(CANONICAL_CATEGORIES));
const verifyAssets = process.env.VERIFY_DATA_SKIP_ASSETS !== '1';
const assetPrefixes = String(process.env.VERIFY_DATA_ASSET_PREFIXES || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => {
    const normalized = value.startsWith('/') ? value : `/${value}`;
    return normalized.endsWith('/') ? normalized : `${normalized}/`;
  });
let errors = 0;
let checkedAssets = 0;
let skippedAssetChecks = 0;

function twemojiFilename(hexcode) {
  return `${hexcode
    .split('-')
    .filter((part) => part.toUpperCase() !== 'FE0F')
    .map((part) => part.toLowerCase().replace(/^0+/, '') || '0')
    .join('-')}.svg`;
}

function localImagePath(emoji) {
  if (emoji.image.startsWith('/emojis/')) return emoji.image;
  if (emoji.source === 'openmoji') return `/emojis/openmoji/${emoji.hexcode}.svg`;
  if (emoji.source === 'twemoji') return `/emojis/twemoji/${twemojiFilename(emoji.hexcode)}`;
  return null;
}

for (const emoji of emojis) {
  for (const field of ['id', 'slug', 'name', 'shortcode', 'image', 'source', 'license']) {
    if (!emoji[field]) {
      console.error(`[missing] ${emoji.id || '(unknown)'}: ${field}`);
      errors += 1;
    }
  }

  if (!canonicalCategories.has(String(emoji.categorySlug || ''))) {
    console.error(`[taxonomy category] ${emoji.id}: ${emoji.category || '(missing)'} / ${emoji.categorySlug || '(missing)'}`);
    errors += 1;
  }
  if (Number(emoji.taxonomyVersion) !== TAXONOMY_VERSION) {
    console.error(`[taxonomy version] ${emoji.id}: expected=${TAXONOMY_VERSION}, actual=${emoji.taxonomyVersion ?? '(missing)'}`);
    errors += 1;
  }

  if (ids.has(emoji.id)) {
    console.error(`[duplicate id] ${emoji.id}`);
    errors += 1;
  }
  if (slugs.has(emoji.slug)) {
    console.error(`[duplicate slug] ${emoji.slug}`);
    errors += 1;
  }
  ids.add(emoji.id);
  slugs.add(emoji.slug);

  const image = localImagePath(emoji);
  if (!image) {
    console.error(`[external asset not supported] ${emoji.id}: ${emoji.image}`);
    errors += 1;
    continue;
  }

  if (!verifyAssets) continue;

  if (assetPrefixes.length > 0 && !assetPrefixes.some((prefix) => image.startsWith(prefix))) {
    skippedAssetChecks += 1;
    continue;
  }

  checkedAssets += 1;
  const localPath = path.resolve('public', image.replace(/^\//, ''));
  try {
    await access(localPath);
  } catch {
    console.error(`[missing local asset] ${emoji.id}: ${localPath}`);
    errors += 1;
  }
}

if (errors) {
  console.error(`\nData verification failed with ${errors} error(s).`);
  process.exit(1);
}

let assetSummary;
if (!verifyAssets) {
  assetSummary = 'metadata-only; local asset checks skipped';
} else if (assetPrefixes.length > 0) {
  assetSummary =
    `checked ${checkedAssets.toLocaleString('en-US')} local asset(s) in scoped prefix(es) ${assetPrefixes.join(', ')}` +
    `; skipped ${skippedAssetChecks.toLocaleString('en-US')} out-of-scope asset check(s)`;
} else {
  assetSummary = `checked all ${checkedAssets.toLocaleString('en-US')} local asset(s)`;
}
console.log(`Verified ${emojis.length} emoji records, canonical taxonomy v${TAXONOMY_VERSION}; ${assetSummary}.`);
