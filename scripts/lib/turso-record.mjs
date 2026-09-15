import { createHash } from 'node:crypto';
import { applyEmojiTaxonomy } from './emoji-taxonomy.mjs';

function text(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function bool(value) {
  return value ? 1 : 0;
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

function topicsFor(record) {
  if (!Array.isArray(record.topics)) return [];
  return [...new Set(record.topics.map((topic) => String(topic).trim()).filter(Boolean))];
}

export function normalizeEmojiRecord(inputRecord, shardFile) {
  for (const field of ['id', 'slug', 'name', 'shortcode', 'image', 'source', 'license']) {
    if (!text(inputRecord[field])) {
      throw new Error(`Emoji ${inputRecord.id || '(unknown)'} is missing required field: ${field}`);
    }
  }

  const record = applyEmojiTaxonomy(inputRecord);
  const tags = tagsFor(record);
  const topics = topicsFor(record);
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
    category: String(record.category),
    categorySlug: String(record.categorySlug),
    collection: text(record.collection),
    style: text(record.style),
    topicsJson: JSON.stringify(topics),
    topicsSearch: topics.join(' '),
    sourceCategory: text(record.sourceCategory),
    sourceCategorySlug: text(record.sourceCategorySlug),
    taxonomyVersion: Number(record.taxonomyVersion || 1),
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
  'collection',
  'style',
  'topics_json',
  'topics_search',
  'source_category',
  'source_category_slug',
  'taxonomy_version',
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
    row.collection,
    row.style,
    row.topicsJson,
    row.topicsSearch,
    row.sourceCategory,
    row.sourceCategorySlug,
    row.taxonomyVersion,
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
