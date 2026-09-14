import { createHash } from 'node:crypto';

function text(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function bool(value) {
  return value ? 1 : 0;
}

function categoryFor(record) {
  return text(record.category) || text(record.group)?.replaceAll('-', ' ') || 'other';
}

function categorySlugFor(record, category) {
  if (text(record.categorySlug)) return text(record.categorySlug);
  return String(category)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'other';
}

function tagsFor(record) {
  if (Array.isArray(record.tags)) {
    return [...new Set(record.tags.map((tag) => String(tag).trim()).filter(Boolean))];
  }
  if (typeof record.tags === 'string') {
    return [...new Set(record.tags.split(',').map((tag) => tag.trim()).filter(Boolean))];
  }
  return [];
}

export function normalizeEmojiRecord(record, shardFile) {
  for (const field of ['id', 'slug', 'name', 'shortcode', 'image', 'source', 'license']) {
    if (!text(record[field])) {
      throw new Error(`Emoji ${record.id || '(unknown)'} is missing required field: ${field}`);
    }
  }

  const tags = tagsFor(record);
  const category = categoryFor(record);
  const recordJson = JSON.stringify(record);

  return {
    id: String(record.id),
    slug: String(record.slug),
    name: String(record.name),
    shortcode: String(record.shortcode),
    emoji: text(record.emoji),
    hexcode: text(record.hexcode),
    groupName: text(record.group),
    subgroup: text(record.subgroup),
    category,
    categorySlug: categorySlugFor(record, category),
    tagsJson: JSON.stringify(tags),
    tagsSearch: tags.join(' '),
    source: String(record.source),
    sourceLabel: text(record.sourceLabel) || String(record.source),
    sourceUrl: text(record.sourceUrl),
    image: String(record.image),
    format: text(record.format) || 'unknown',
    animated: bool(record.animated),
    license: String(record.license),
    attribution: text(record.attribution),
    addedAt: text(record.addedAt),
    syncedAt: text(record.syncedAt),
    assetSha256: text(record.assetSha256),
    duplicateAsset: bool(record.duplicateAsset),
    shardFile,
    contentHash: createHash('sha256').update(recordJson).digest('hex'),
    recordJson
  };
}

export const EMOJI_COLUMNS = [
  'id',
  'slug',
  'name',
  'shortcode',
  'emoji',
  'hexcode',
  'group_name',
  'subgroup',
  'category',
  'category_slug',
  'tags_json',
  'tags_search',
  'source',
  'source_label',
  'source_url',
  'image',
  'format',
  'animated',
  'license',
  'attribution',
  'added_at',
  'synced_at',
  'asset_sha256',
  'duplicate_asset',
  'shard_file',
  'content_hash',
  'record_json'
];

export function emojiArgs(row) {
  return [
    row.id,
    row.slug,
    row.name,
    row.shortcode,
    row.emoji,
    row.hexcode,
    row.groupName,
    row.subgroup,
    row.category,
    row.categorySlug,
    row.tagsJson,
    row.tagsSearch,
    row.source,
    row.sourceLabel,
    row.sourceUrl,
    row.image,
    row.format,
    row.animated,
    row.license,
    row.attribution,
    row.addedAt,
    row.syncedAt,
    row.assetSha256,
    row.duplicateAsset,
    row.shardFile,
    row.contentHash,
    row.recordJson
  ];
}
