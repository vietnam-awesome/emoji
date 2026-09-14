import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createTursoClient } from './lib/turso-client.mjs';
import { EMOJI_COLUMNS, emojiArgs, normalizeEmojiRecord } from './lib/turso-record.mjs';

const SHARD_DIR = path.resolve('src/data/emojis');
const MANIFEST_FILE = path.join(SHARD_DIR, 'index.json');
const CORE_SCHEMA_FILE = path.resolve('scripts/turso-schema.sql');
const FTS_SCHEMA_FILE = path.resolve('scripts/turso-fts.sql');

const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const schemaOnly = args.has('--schema-only');
const skipFts = args.has('--no-fts');
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

async function syncShard(client, entry, expectedHash) {
  const filename = entry.file;
  const shardPath = path.join(SHARD_DIR, filename);
  const raw = await readFile(shardPath, 'utf8');
  const actualHash = sha256(raw);
  if (actualHash !== expectedHash) {
    throw new Error(`Shard changed while syncing: ${filename}`);
  }

  const records = JSON.parse(raw);
  if (!Array.isArray(records)) throw new Error(`Shard ${filename} is not a JSON array.`);
  if (entry.count !== null && records.length !== entry.count) {
    throw new Error(`Shard count mismatch for ${filename}: manifest=${entry.count}, actual=${records.length}`);
  }

  // Delete rows previously owned by this shard. Upserts below safely handle records that
  // moved between shards because shard_file is updated on conflict.
  await client.run('DELETE FROM emojis WHERE shard_file = ?', [filename]);

  for (let offset = 0; offset < records.length; offset += batchSize) {
    const batch = records.slice(offset, offset + batchSize).map((record) => {
      const row = normalizeEmojiRecord(record, filename);
      return { sql: UPSERT_SQL, args: emojiArgs(row) };
    });
    await client.batch(batch);
  }

  await client.run(
    `INSERT INTO emoji_sync_shards (file, sha256, record_count, synced_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(file) DO UPDATE SET
       sha256=excluded.sha256,
       record_count=excluded.record_count,
       synced_at=excluded.synced_at`,
    [filename, actualHash, records.length, new Date().toISOString()]
  );

  return records.length;
}

const client = await createTursoClient();
const manifestRaw = await readFile(MANIFEST_FILE, 'utf8');
const manifest = JSON.parse(manifestRaw);
const entries = Array.isArray(manifest.chunks) ? manifest.chunks.map(chunkEntry) : [];

if (!entries.length) throw new Error('Emoji shard manifest has no chunks.');
if (!Number.isFinite(manifest.total)) throw new Error('Emoji shard manifest is missing a numeric total.');

console.log(`[turso] database flavor: ${client.flavor}`);
console.log(`[turso] applying core schema...`);
await applySqlFile(client, CORE_SCHEMA_FILE);

if (schemaOnly) {
  await ensureFts(client);
  console.log('[turso] schema ready.');
  process.exit(0);
}

const remoteStateRows = await client.query('SELECT file, sha256, record_count FROM emoji_sync_shards');
const remoteStates = new Map(remoteStateRows.map((row) => [String(row.file), row]));
const localFiles = new Set(entries.map((entry) => entry.file));
const localHashes = new Map();

for (const entry of entries) {
  const raw = await readFile(path.join(SHARD_DIR, entry.file));
  localHashes.set(entry.file, sha256(raw));
}

const changed = entries.filter((entry) => force || remoteStates.get(entry.file)?.sha256 !== localHashes.get(entry.file));
const removed = [...remoteStates.keys()].filter((file) => !localFiles.has(file));
const manifestHash = sha256(manifestRaw);
const runId = `${Date.now()}-${(process.env.GITHUB_SHA || 'local').slice(0, 12)}`;
const startedAt = new Date().toISOString();

await client.run(
  `INSERT INTO emoji_sync_runs (
     run_id, started_at, status, manifest_sha256, expected_total, changed_shards, removed_shards
   ) VALUES (?, ?, 'running', ?, ?, ?, ?)`,
  [runId, startedAt, manifestHash, manifest.total, changed.length, removed.length]
);

console.log(`[turso] manifest: ${manifest.total.toLocaleString('en-US')} records in ${entries.length} shards`);
console.log(`[turso] changed shards: ${changed.length}; removed shards: ${removed.length}; force=${force}`);

try {
  for (const file of removed) {
    console.log(`[turso] removing stale shard ${file}`);
    await client.batch([
      { sql: 'DELETE FROM emojis WHERE shard_file = ?', args: [file] },
      { sql: 'DELETE FROM emoji_sync_shards WHERE file = ?', args: [file] }
    ]);
  }

  let imported = 0;
  for (let index = 0; index < changed.length; index += 1) {
    const entry = changed[index];
    console.log(`[turso] syncing ${entry.file} (${index + 1}/${changed.length})...`);
    imported += await syncShard(client, entry, localHashes.get(entry.file));
  }

  const countRows = await client.query('SELECT COUNT(*) AS total FROM emojis');
  const actualTotal = Number(countRows[0]?.total ?? 0);
  if (actualTotal !== manifest.total) {
    throw new Error(`Turso row count mismatch: expected=${manifest.total}, actual=${actualTotal}`);
  }

  const ftsReady = await ensureFts(client);
  if (ftsReady && changed.length >= 10 && await indexExists(client, 'idx_emojis_fts')) {
    console.log('[turso] optimizing FTS index after bulk changes...');
    await client.run('OPTIMIZE INDEX idx_emojis_fts');
  }

  await client.run(
    `UPDATE emoji_sync_runs
     SET finished_at = ?, status = 'success', actual_total = ?
     WHERE run_id = ?`,
    [new Date().toISOString(), actualTotal, runId]
  );

  console.log(`[turso] sync complete: ${actualTotal.toLocaleString('en-US')} rows; ${imported.toLocaleString('en-US')} records written this run.`);
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
