import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateImageAsset } from './lib/emojigg-asset.mjs';
import {
  applyEmojiTaxonomy,
  CANONICAL_CATEGORIES,
  TAXONOMY_VERSION
} from './lib/emoji-taxonomy.mjs';

const DATA_FILE = path.resolve('src/data/emojis.json');
const ASSET_DIR = path.resolve('public/emojis/eplus');
const META_FILE = path.join(ASSET_DIR, 'metadata.json');
const SOURCE_ID = 'eplus';
const SOURCE_LABEL = 'ePlus Originals';
const SOURCE_URL = 'https://emoji.eplus.dev/';
const IMAGE_PREFIX = '/emojis/eplus/';
const SUPPORTED_EXTENSIONS = new Set(['.png', '.gif', '.webp', '.jpg', '.jpeg']);

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function titleCase(value) {
  return String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function hashBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function normalizeShortcode(value, fallback) {
  const normalized = String(value || fallback || '').trim().replace(/^:+|:+$/g, '');
  if (!normalized) throw new Error('ePlus emoji shortcode cannot be empty.');
  return normalized;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeMetadata(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw;
}

function metadataFor(metadata, filename, slug) {
  const byFilename = metadata[filename];
  const bySlug = metadata[slug];
  const value = byFilename ?? bySlug ?? {};
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function explicitCategory(record, configuredCategory) {
  const categorySlug = slugify(configuredCategory);
  if (!categorySlug) return record;
  if (!Object.hasOwn(CANONICAL_CATEGORIES, categorySlug)) {
    throw new Error(
      `Unsupported category "${configuredCategory}". Allowed: ${Object.keys(CANONICAL_CATEGORIES).join(', ')}`
    );
  }
  return {
    ...record,
    category: CANONICAL_CATEGORIES[categorySlug],
    categorySlug,
    taxonomyVersion: TAXONOMY_VERSION
  };
}

async function listAssets() {
  let entries;
  try {
    entries = await readdir(ASSET_DIR, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error('public/emojis/eplus does not exist. Add original emoji files there first.');
    }
    throw error;
  }

  const assets = entries
    .filter((entry) => entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (!assets.length) {
    throw new Error('No supported ePlus original emoji assets found in public/emojis/eplus.');
  }
  return assets;
}

const existing = await readJson(DATA_FILE, []);
if (!Array.isArray(existing)) throw new Error('src/data/emojis.json is not an array. Run emoji-store:hydrate first.');

const metadata = normalizeMetadata(await readJson(META_FILE, {}));
const assetFiles = await listAssets();
const existingById = new Map(existing.map((emoji) => [emoji.id, emoji]));
const hashOwners = new Map(
  existing
    .filter((emoji) => emoji.assetSha256 && emoji.source !== SOURCE_ID)
    .map((emoji) => [emoji.assetSha256, emoji.id])
);
const generated = [];
const seenSlugs = new Map();
const now = new Date().toISOString();

for (const filename of assetFiles) {
  const ext = path.extname(filename).toLowerCase();
  const basename = path.basename(filename, ext);
  const slug = slugify(basename);
  if (!slug) throw new Error(`Could not derive a slug from asset filename: ${filename}`);

  const previousFilename = seenSlugs.get(slug);
  if (previousFilename) {
    throw new Error(`Duplicate ePlus slug "${slug}" from ${previousFilename} and ${filename}. Rename one asset.`);
  }
  seenSlugs.set(slug, filename);

  const config = metadataFor(metadata, filename, slug);
  const buffer = await readFile(path.join(ASSET_DIR, filename));
  const detected = validateImageAsset(buffer, '', filename);
  const normalizedExt = ext === '.jpeg' ? '.jpg' : ext;
  if (detected.ext !== normalizedExt) {
    throw new Error(`${filename} has extension ${ext}, but its bytes are ${detected.ext}. Rename or re-export the file.`);
  }

  const id = `eplus-${slug}`;
  const current = existingById.get(id);
  const assetSha256 = hashBuffer(buffer);
  const duplicateId = hashOwners.get(assetSha256);
  const configuredTags = Array.isArray(config.tags) ? config.tags : [];
  const tags = unique([
    ...configuredTags,
    ...slug.split('-'),
    'eplus',
    'original',
    'original-style',
    'custom-emoji',
    detected.animated ? 'animated' : 'static'
  ]);

  const rawRecord = {
    ...current,
    id,
    slug: `eplus-${slug}`,
    name: String(config.name || titleCase(basename) || slug),
    shortcode: normalizeShortcode(config.shortcode, `eplus_${slug.replace(/-/g, '_')}`),
    group: 'eplus-originals',
    subgroup: String(config.subgroup || 'originals'),
    tags,
    source: SOURCE_ID,
    sourceLabel: SOURCE_LABEL,
    sourceUrl: String(config.sourceUrl || SOURCE_URL),
    image: `${IMAGE_PREFIX}${filename}`,
    format: detected.format,
    animated: detected.animated,
    license: String(config.license || 'ePlus original artwork'),
    attribution: String(config.attribution || 'ePlus Emoji'),
    addedAt: current?.addedAt || String(config.addedAt || now.slice(0, 10)),
    syncedAt: now,
    assetSha256,
    assetBytes: buffer.length,
    duplicateAsset: Boolean(duplicateId && duplicateId !== id)
  };

  let record = applyEmojiTaxonomy(rawRecord);
  record = explicitCategory(record, config.categorySlug || config.category);
  generated.push(record);

  if (!hashOwners.has(assetSha256)) hashOwners.set(assetSha256, id);
  console.log(
    `[ePlus Originals] ${filename} -> ${record.slug} (${record.categorySlug})` +
    (record.duplicateAsset ? ` duplicate=${duplicateId}` : '')
  );
}

const retained = existing.filter((emoji) => {
  if (emoji.source !== SOURCE_ID) return true;
  if (!String(emoji.image || '').startsWith(IMAGE_PREFIX)) return true;
  return false;
});

const all = [...generated, ...retained].sort((a, b) => {
  const date = String(b.syncedAt || b.addedAt || '').localeCompare(String(a.syncedAt || a.addedAt || ''));
  return date || String(a.name || '').localeCompare(String(b.name || ''));
});

await writeJson(DATA_FILE, all);
console.log(
  `[ePlus Originals] synced ${generated.length} asset(s); removed/replaced ${existing.length - retained.length} previous ePlus record(s); total=${all.length}`
);
