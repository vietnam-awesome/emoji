import { createHash } from 'node:crypto';

// Preserve existing shard membership; append new IDs as source-specific shards.
export function planIncrementalShards(records, existingChunks, chunkSize = 2500) {
  if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) {
    throw new Error('Emoji shard size must be a positive integer.');
  }
  const pending = new Map();
  for (const record of records) {
    const id = String(record?.id ?? '');
    if (!id) throw new Error('Emoji record has no ID.');
    if (pending.has(id)) throw new Error('Duplicate emoji ID: ' + id);
    pending.set(id, record);
  }
  const chunks = [];
  const changed = [];
  const filenames = new Set();
  for (const chunk of existingChunks) {
    const file = String(chunk.file || '');
    if (!file || filenames.has(file) || !Array.isArray(chunk.records)) {
      throw new Error('Invalid or duplicate existing emoji shard: ' + file);
    }
    filenames.add(file);
    const updated = [];
    for (const old of chunk.records) {
      const id = String(old?.id ?? '');
      if (pending.has(id)) {
        updated.push(pending.get(id));
        pending.delete(id);
      }
    }
    chunks.push({ file, count: updated.length });
    if (JSON.stringify(updated) !== JSON.stringify(chunk.records)) {
      changed.push({ file, records: updated });
    }
  }
  const additions = pending.size;
  const bySource = new Map();
  for (const record of pending.values()) {
    const source = String(record.source || 'unknown')
      .toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 50);
    if (!bySource.has(source)) bySource.set(source, []);
    bySource.get(source).push(record);
  }
  for (const source of [...bySource.keys()].sort()) {
    const sourceRecords = bySource.get(source);
    sourceRecords.sort((a, b) => String(a.id).localeCompare(String(b.id), 'en'));
    for (let offset = 0; offset < sourceRecords.length; offset += chunkSize) {
      const slice = sourceRecords.slice(offset, offset + chunkSize);
      const fingerprint = createHash('sha256')
        .update(JSON.stringify(slice.map((record) => record.id)))
        .digest('hex').slice(0, 20);
      const file = 'delta-' + source + '-' + fingerprint + '.json';
      if (filenames.has(file)) throw new Error('Emoji shard filename collision: ' + file);
      filenames.add(file);
      chunks.push({ file, count: slice.length });
      changed.push({ file, records: slice });
    }
  }
  return { chunks, changed, additions };
}
