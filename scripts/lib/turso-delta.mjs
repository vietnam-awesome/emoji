export function planEmojiDelta(localRows, remoteRows, { force = false } = {}) {
  const remoteHashes = new Map();
  for (const row of remoteRows || []) {
    const id = String(row?.id ?? '');
    if (!id) continue;
    remoteHashes.set(id, row?.content_hash == null ? null : String(row.content_hash));
  }

  const localIds = new Set();
  const upserts = [];
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const row of localRows || []) {
    const id = String(row?.id ?? '');
    if (!id) throw new Error('Local Turso row is missing id.');
    if (localIds.has(id)) throw new Error(`Duplicate local emoji id: ${id}`);
    localIds.add(id);

    const existsRemotely = remoteHashes.has(id);
    const remoteHash = remoteHashes.get(id);
    const changed = force || !existsRemotely || remoteHash !== row.contentHash;

    if (!changed) {
      unchanged += 1;
      continue;
    }

    upserts.push(row);
    if (existsRemotely) updated += 1;
    else inserted += 1;
  }

  const deleteIds = [];
  for (const id of remoteHashes.keys()) {
    if (!localIds.has(id)) deleteIds.push(id);
  }

  return {
    upserts,
    deleteIds,
    inserted,
    updated,
    deleted: deleteIds.length,
    unchanged,
    mutations: upserts.length + deleteIds.length
  };
}
