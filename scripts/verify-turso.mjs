import { readFile } from 'node:fs/promises';
import { createTursoClient } from './lib/turso-client.mjs';

const manifest = JSON.parse(await readFile('src/data/emojis/index.json', 'utf8'));
const client = await createTursoClient();
let errors = 0;

const countRows = await client.query('SELECT COUNT(*) AS total FROM emojis');
const total = Number(countRows[0]?.total ?? 0);

if (total !== manifest.total) {
  console.error(`[turso] row count mismatch: expected=${manifest.total}, actual=${total}`);
  errors += 1;
} else {
  console.log(`[turso] row count OK: ${total.toLocaleString('en-US')}`);
}

const shardRows = await client.query('SELECT COUNT(*) AS total FROM emoji_sync_shards');
const shardCount = Number(shardRows[0]?.total ?? 0);
const expectedShards = Array.isArray(manifest.chunks) ? manifest.chunks.length : 0;
if (shardCount !== expectedShards) {
  console.error(`[turso] shard state mismatch: expected=${expectedShards}, actual=${shardCount}`);
  errors += 1;
} else {
  console.log(`[turso] shard state OK: ${shardCount}`);
}

const invalidRows = await client.query(`
  SELECT id, slug
  FROM emojis
  WHERE id IS NULL OR id = ''
     OR slug IS NULL OR slug = ''
     OR name IS NULL OR name = ''
     OR shortcode IS NULL OR shortcode = ''
     OR image IS NULL OR image = ''
     OR source IS NULL OR source = ''
  LIMIT 5
`);
if (invalidRows.length) {
  console.error('[turso] required-field validation failed:', invalidRows);
  errors += 1;
} else {
  console.log('[turso] required fields OK');
}

const duplicateRows = await client.query(`
  SELECT slug, COUNT(*) AS total
  FROM emojis
  GROUP BY slug
  HAVING COUNT(*) > 1
  LIMIT 5
`);
if (duplicateRows.length) {
  console.error('[turso] duplicate slugs found:', duplicateRows);
  errors += 1;
} else {
  console.log('[turso] slug uniqueness OK');
}

if (client.flavor === 'turso') {
  const indexRows = await client.query(
    "SELECT name FROM sqlite_schema WHERE type = 'index' AND name = 'idx_emojis_fts' LIMIT 1"
  );
  if (!indexRows.length) {
    console.error('[turso] idx_emojis_fts is missing');
    errors += 1;
  } else {
    const query = String(process.env.TURSO_VERIFY_QUERY || 'pepe').trim().replace(/["'():^~*\\]/g, ' ');
    if (query) {
      const searchRows = await client.query(
        `SELECT id, slug, name,
           fts_score(name, shortcode, tags_search, category, source_label, ?) AS score
         FROM emojis
         WHERE fts_match(name, shortcode, tags_search, category, source_label, ?)
         ORDER BY score DESC
         LIMIT 5`,
        [`${query}*`, `${query}*`]
      );
      console.log(`[turso] FTS smoke query "${query}*" returned ${searchRows.length} result(s)`);
    }
  }
} else {
  console.warn('[turso] libSQL database detected; Turso Tantivy FTS verification skipped.');
}

const latestRuns = await client.query(`
  SELECT run_id, status, expected_total, actual_total, changed_shards, removed_shards, finished_at
  FROM emoji_sync_runs
  ORDER BY started_at DESC
  LIMIT 1
`);
if (latestRuns[0]) console.log('[turso] latest sync:', latestRuns[0]);

if (errors) {
  console.error(`\nTurso verification failed with ${errors} error(s).`);
  process.exit(1);
}

console.log('\nTurso catalog verification passed.');
