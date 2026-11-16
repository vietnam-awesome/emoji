// Combine a completed import with the latest data catalog without losing another source.
export function mergeImportedSource(latest, imported, source) {
  const records = [...latest];
  const ids = new Set(records.map((r) => String(r.id)));
  const slugs = new Set(records.map((r) => String(r.slug)));
  const hashes = new Set(records.map((r) => r.assetSha256).filter(Boolean));
  let added = 0;
  let skipped = 0;
  for (const record of imported) {
    if (record.source !== source) continue;
    if (!record.id || !record.slug) throw new Error('Invalid imported emoji record.');
    if (ids.has(String(record.id)) || slugs.has(String(record.slug)) ||
        (record.assetSha256 && hashes.has(record.assetSha256))) {
      skipped++;
      continue;
    }
    records.push(record);
    ids.add(String(record.id));
    slugs.add(String(record.slug));
    if (record.assetSha256) hashes.add(record.assetSha256);
    added++;
  }
  return { records, added, skipped };
}
