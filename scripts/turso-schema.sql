CREATE TABLE IF NOT EXISTS emojis (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  shortcode TEXT NOT NULL,
  emoji TEXT,
  hexcode TEXT,
  group_name TEXT,
  subgroup TEXT,
  category TEXT NOT NULL,
  category_slug TEXT NOT NULL,
  collection TEXT,
  style TEXT,
  topics_json TEXT NOT NULL DEFAULT '[]',
  topics_search TEXT NOT NULL DEFAULT '',
  source_category TEXT,
  source_category_slug TEXT,
  taxonomy_version INTEGER NOT NULL DEFAULT 1,
  tags_json TEXT NOT NULL DEFAULT '[]',
  tags_search TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  source_label TEXT NOT NULL,
  source_url TEXT,
  image TEXT NOT NULL,
  format TEXT NOT NULL,
  animated INTEGER NOT NULL DEFAULT 0,
  license TEXT NOT NULL,
  attribution TEXT,
  added_at TEXT,
  synced_at TEXT,
  asset_sha256 TEXT,
  duplicate_asset INTEGER NOT NULL DEFAULT 0,
  shard_file TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  record_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_emojis_slug ON emojis(slug);
CREATE INDEX IF NOT EXISTS idx_emojis_category ON emojis(category_slug, id);
CREATE INDEX IF NOT EXISTS idx_emojis_source ON emojis(source, id);
CREATE INDEX IF NOT EXISTS idx_emojis_animated ON emojis(animated, id);
CREATE INDEX IF NOT EXISTS idx_emojis_synced_at ON emojis(synced_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_emojis_shard ON emojis(shard_file);

CREATE TABLE IF NOT EXISTS emoji_sync_shards (
  file TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  synced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS emoji_sync_runs (
  run_id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  manifest_sha256 TEXT NOT NULL,
  expected_total INTEGER NOT NULL,
  actual_total INTEGER,
  changed_shards INTEGER NOT NULL DEFAULT 0,
  removed_shards INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);
