import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createTursoClient } from './lib/turso-client.mjs';
import { planEmojiDelta } from './lib/turso-delta.mjs';
import { EMOJI_COLUMNS, emojiArgs, normalizeEmojiRecord } from './lib/turso-record.mjs';

const SHARD_DIR = path.resolve('src/data/emojis');
const MANIFEST_FILE = path.join(SHARD_DIR, 'index.json');
const CORE_SCHEMA_FILE = path.resolve('scripts/turso-schema.sql');
const FTS_SCHEMA_FILE = path.resolve('scripts/turso-fts.sql');

const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const schemaOnly = args.has('--schema-only');
const skipFts = args.has('--no-fts');
const dryRun = args.has('--dry-run');
const optimizeFts = args.has('--optimize-fts');
const batchSize = Math.max(25, Number.parseInt(process.env.TURSO_BATCH_SIZE || '200', 10) || 200);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function splitSql(sql) {
  return sql
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function applySqlFile(client, filename) {
  const sql = await readFile(filename, 'utf8');
  const statements = splitSql(sql);
  if (statements.length) await client.batch(statements);
}

function chunkEntry(entry) {
  if (typeof entry === 'string') return { file: entry, count: null };
  return { file: entry.file, count: Number.isFinite(entry.count) ? entry.count : null };
}

const placeholders = EMOJI_COLUMNS.map(() => '?').join(', ');
const updates = EMOJI_COLUMNS
  .filter((column) => column !== 'id')
  .map((column) => `${column}=excluded.${column}`)
  .join(', ');
const UPSERT_SQL = `
  INSERT INTO emojis (${EMOJI_COLUMNS.join(', ')})
  VALUES (${placeholders})
  ON CONFLICT(id) DO UPDATE SET ${updates}
`;

async function indexExists(client, name) {
  try {
    const rows = await client.query(
      "SELECT name FROM sqlite_schema WHERE type = 'index' AND name = ? LIMIT 1",
      [name]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function ensureFts(client) {
  if (skipFts) {
    console.log('[turso] FTS setup skipped by --no-fts.');
    return false;
  }
  if (client.flavor !== 'turso') {
    console.warn('[turso] TURSO_DATABASE_URL is a libSQL database. Turso Tantivy FTS requires a turso:// database, so FTS setup is skipped.');
    return false;
  }
  if (await indexExists(client, 'idx_emojis_fts')) return true;

  console.log('[turso] creating full-text search index...');
  await applySqlFile(client, FTS_SCHEMA_FILE);
  return true;
}

async function loadLocalCatalog(entries) {
  const rows = [];
  const shardHashes = new Map();

  for (const entry of entries) {
    const filename = entry.file;
    const raw = await readFile(path.join(SHARD_DIR, filename), 'utf8');
    shardHashes.set(filename, sha256(raw));

    const records = JSON.parse(raw);
    if (!Array.isArray(records)) throw new Error(`Shard ${filename} is not a JSON array.`);
    if (entry.count !== null && records.length !== entry.count) {
      throw new Error(`Shard count mismatch for ${filename}: manifest=${entry.count}, actual=${records.length}`);
    }

    for (const record of records) rows.push(normalizeEmojiRecord(record, filename));
  }

  return { rows, shardHashes };
}

async function deleteEmojiRows(client, ids) {
  for (let offset = 0; offset < ids.length; offset += batchSize) {
    const batch = ids.slice(offset, offset + batchSize);
    const placeholders = batch.map(() => '?').join(', ');
    await client.run(`DELETE FROM emojis WHERE id IN (${placeholders})`, batch);
  }
}

async function upsertEmojiRows(client, rows) {
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize).map((row) => ({
      sql: UPSERT_SQL,
      args: emojiArgs(row)
    }));
    await client.batch(batch);
  }
}

async function syncShardMetadata(client, changedEntries, removedFiles, shardHashes) {
  for (const file of removedFiles) {
    await client.run('DELETE FROM emoji_sync_shards WHERE file = ?', [file]);
  }

  for (let offset = 0; offset < changedEntries.length; offset += batchSize) {
    const now = new Date().toISOString();
    const batch = changedEntries.slice(offset, offset + batchSize).map((entry) => ({
      sql: `INSERT INTO emoji_sync_shards (file, sha256, record_count, synced_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(file) DO UPDATE SET
              sha256=excluded.sha256,
              record_count=excluded.record_count,
              synced_at=excluded.synced_at`,
      args: [entry.file, shardHashes.get(entry.file), entry.count ?? 0, now]
    }));
    if (batch.length) await client.batch(batch);
  }
}

const client = await createTursoClient();
const manifestRaw = await readFile(MANIFEST_FILE, 'utf8');
const manifest = JSON.parse(manifestRaw);
const entries = Array.isArray(manifest.chunks) ? manifest.chunks.map(chunkEntry) : [];

if (!entries.length) throw new Error('Emoji shard manifest has no chunks.');
if (!Number.isFinite(manifest.total)) throw new Error('Emoji shard manifest is missing a numeric total.');

console.log(`[turso] database flavor: ${client.flavor}`);

if (schemaOnly) {
  console.log('[turso] applying core schema...');
  await applySqlFile(client, CORE_SCHEMA_FILE);
  await ensureFts(client);
  console.log('[turso] schema ready.');
  process.exit(0);
}

if (!dryRun) {
  console.log('[turso] applying core schema...');
  await applySqlFile(client, CORE_SCHEMA_FILE);
} else {
  console.log('[turso] dry run: schema writes and all mutations are disabled.');
}

const { rows: localRows, shardHashes } = await loadLocalCatalog(entries);
if (localRows.length !== manifest.total) {
  throw new Error(`Local row count mismatch: manifest=${manifest.total}, loaded=${localRows.length}`);
}

// Read only id + content_hash from Turso. This is intentionally cheap relative to
// rewriting unchanged rows and lets the sync operate independently of shard movement.
const remoteRows = await client.query('SELECT id, content_hash FROM emojis');
const delta = planEmojiDelta(localRows, remoteRows, { force });

const remoteStateRows = await client.query('SELECT file, sha256, record_count FROM emoji_sync_shards');
const remoteStates = new Map(remoteStateRows.map((row) => [String(row.file), row]));
const localFiles = new Set(entries.map((entry) => entry.file));
const changedShardEntries = entries.filter((entry) =>
  force || remoteStates.get(entry.file)?.sha256 !== shardHashes.get(entry.file)
);
const removedShardFiles = [...remoteStates.keys()].filter((file) => !localFiles.has(file));

console.log(`[turso] manifest: ${manifest.total.toLocaleString('en-US')} records in ${entries.length} shards`);
console.log(`[turso] delta: +${delta.inserted.toLocaleString('en-US')} new, ~${delta.updated.toLocaleString('en-US')} changed, -${delta.deleted.toLocaleString('en-US')} deleted, ${delta.unchanged.toLocaleString('en-US')} unchanged`);
console.log(`[turso] estimated emoji row mutations: ${delta.mutations.toLocaleString('en-US')}${force ? ' (force enabled)' : ''}`);
console.log(`[turso] shard metadata: ${changedShardEntries.length} changed, ${removedShardFiles.length} removed`);

if (dryRun) {
  console.log('[turso] dry run complete; Turso was not modified.');
  process.exit(0);
}

const manifestHash = sha256(manifestRaw);
const runId = `${Date.now()}-${(process.env.GITHUB_SHA || 'local').slice(0, 12)}`;
const startedAt = new Date().toISOString();

await client.run(
  `INSERT INTO emoji_sync_runs (
     run_id, started_at, status, manifest_sha256, expected_total, changed_shards, removed_shards
   ) VALUES (?, ?, 'running', ?, ?, ?, ?)`,
  [runId, startedAt, manifestHash, manifest.total, changedShardEntries.length, removedShardFiles.length]
);

try {
  // Delete stale IDs first so a replacement row can safely reuse a unique slug.
  if (delta.deleteIds.length) {
    console.log(`[turso] deleting ${delta.deleteIds.length.toLocaleString('en-US')} stale row(s)...`);
    await deleteEmojiRows(client, delta.deleteIds);
  }

  if (delta.upserts.length) {
    console.log(`[turso] writing only ${delta.upserts.length.toLocaleString('en-US')} new/changed row(s)...`);
    await upsertEmojiRows(client, delta.upserts);
  }

  await syncShardMetadata(client, changedShardEntries, removedShardFiles, shardHashes);

  const countRows = await client.query('SELECT COUNT(*) AS total FROM emojis');
  const actualTotal = Number(countRows[0]?.total ?? 0);
  if (actualTotal !== manifest.total) {
    throw new Error(`Turso row count mismatch: expected=${manifest.total}, actual=${actualTotal}`);
  }

  const ftsReady = await ensureFts(client);
  if (optimizeFts && ftsReady && await indexExists(client, 'idx_emojis_fts')) {
    console.log('[turso] optimizing FTS index by explicit request...');
    await client.run('OPTIMIZE INDEX idx_emojis_fts');
  } else if (ftsReady && delta.mutations > 0) {
    console.log('[turso] FTS optimize skipped; index updates incrementally with row mutations.');
  }

  await client.run(
    `UPDATE emoji_sync_runs
     SET finished_at = ?, status = 'success', actual_total = ?
     WHERE run_id = ?`,
    [new Date().toISOString(), actualTotal, runId]
  );

  console.log(`[turso] sync complete: ${actualTotal.toLocaleString('en-US')} rows; ${delta.mutations.toLocaleString('en-US')} emoji row mutation(s) this run.`);
} catch (error) {
  try {
    const countRows = await client.query('SELECT COUNT(*) AS total FROM emojis');
    const actualTotal = Number(countRows[0]?.total ?? 0);
    await client.run(
      `UPDATE emoji_sync_runs
       SET finished_at = ?, status = 'failed', actual_total = ?, error_message = ?
       WHERE run_id = ?`,
      [new Date().toISOString(), actualTotal, String(error?.message || error).slice(0, 2000), runId]
    );
  } catch (updateError) {
    console.error('[turso] could not record failed sync state:', updateError);
  }
  throw error;
}
