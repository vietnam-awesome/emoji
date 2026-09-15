let connectionPromise;

async function runtimeEnv() {
  try {
    const mod = await import('cloudflare:workers');
    return mod.env || {};
  } catch {
    return globalThis.process?.env || {};
  }
}

async function getConnection() {
  if (!connectionPromise) {
    connectionPromise = (async () => {
      const env = await runtimeEnv();
      const url = String(env.TURSO_DATABASE_URL || '').trim();
      const authToken = String(env.TURSO_AUTH_TOKEN || '').trim();
      if (!url) throw new Error('Missing TURSO_DATABASE_URL');
      if (!authToken) throw new Error('Missing TURSO_AUTH_TOKEN');

      const { connect } = await import('@tursodatabase/serverless');
      return connect({ url, authToken });
    })();
  }
  return connectionPromise;
}

async function query(sql, args = []) {
  const connection = await getConnection();
  return connection.prepare(sql).all(args);
}

function parseRecord(row) {
  if (!row) return null;
  if (row.record_json) {
    try {
      return JSON.parse(String(row.record_json));
    } catch {}
  }
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortcode: row.shortcode,
    emoji: row.emoji || '',
    hexcode: row.hexcode || '',
    group: row.group_name || '',
    subgroup: row.subgroup || '',
    category: row.category || '',
    categorySlug: row.category_slug || '',
    tags: JSON.parse(String(row.tags_json || '[]')),
    source: row.source,
    sourceLabel: row.source_label,
    sourceUrl: row.source_url || '',
    image: row.image,
    format: row.format,
    animated: Boolean(row.animated),
    license: row.license,
    attribution: row.attribution || '',
    addedAt: row.added_at || '',
    syncedAt: row.synced_at || '',
    assetSha256: row.asset_sha256 || '',
    duplicateAsset: Boolean(row.duplicate_asset)
  };
}

function sanitizeFtsQuery(value) {
  const tokens = String(value || '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}_-]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
  return tokens.map((token) => `${token}*`).join(' AND ');
}

function browseWhere({ q = '', category = '', source = '', motion = '' } = {}) {
  const clauses = [];
  const args = [];
  const searchQuery = sanitizeFtsQuery(q);

  if (searchQuery) {
    clauses.push('fts_match(name, shortcode, tags_search, category, source_label, ?)');
    args.push(searchQuery);
  }
  if (category) {
    clauses.push('category_slug = ?');
    args.push(String(category).toLowerCase());
  }
  if (source) {
    clauses.push('source = ?');
    args.push(String(source).toLowerCase());
  }
  if (motion === 'yes') clauses.push('animated = 1');
  if (motion === 'no') clauses.push('animated = 0');

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    args,
    searchQuery
  };
}

export async function listEmoji(options = {}) {
  const pageSize = Math.max(1, Math.min(96, Number(options.pageSize) || 48));
  const page = Math.max(1, Number(options.page) || 1);
  const offset = (page - 1) * pageSize;
  const { where, args, searchQuery } = browseWhere(options);

  const countRows = await query(`SELECT COUNT(*) AS total FROM emojis ${where}`, args);
  const total = Number(countRows[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const safeOffset = (safePage - 1) * pageSize;

  const scoreSelect = searchQuery
    ? ', fts_score(name, shortcode, tags_search, category, source_label, ?) AS score'
    : '';
  const selectArgs = searchQuery ? [searchQuery, ...args, pageSize, safeOffset] : [...args, pageSize, safeOffset];
  const orderBy = searchQuery ? 'ORDER BY score DESC, id' : 'ORDER BY COALESCE(synced_at, added_at) DESC, id';

  const rows = await query(
    `SELECT record_json${scoreSelect}\nFROM emojis\n${where}\n${orderBy}\nLIMIT ? OFFSET ?`,
    selectArgs
  );

  return {
    items: rows.map(parseRecord).filter(Boolean),
    total,
    page: safePage,
    pageSize,
    totalPages
  };
}

export async function getEmojiBySlug(slug) {
  const rows = await query('SELECT record_json FROM emojis WHERE slug = ? LIMIT 1', [String(slug || '')]);
  return parseRecord(rows[0]);
}

export async function getCatalogFacets() {
  const [categoryRows, sourceRows] = await Promise.all([
    query(`SELECT category_slug AS slug, category AS name, COUNT(*) AS count\n      FROM emojis\n      GROUP BY category_slug, category\n      ORDER BY count DESC, name`),
    query(`SELECT source AS slug, source_label AS name, COUNT(*) AS count\n      FROM emojis\n      GROUP BY source, source_label\n      ORDER BY count DESC, name`)
  ]);

  return {
    categories: categoryRows.map((row) => ({ slug: String(row.slug), name: String(row.name), count: Number(row.count || 0) })),
    sources: sourceRows.map((row) => ({ slug: String(row.slug), name: String(row.name), count: Number(row.count || 0) }))
  };
}

export async function getHomeCatalog() {
  const [statsRows, categoryRows, recentRows, animatedRows, heroRows] = await Promise.all([
    query(`SELECT COUNT(*) AS total,\n      SUM(CASE WHEN animated = 1 THEN 1 ELSE 0 END) AS animated,\n      COUNT(DISTINCT category_slug) AS categories,\n      COUNT(DISTINCT source) AS sources\n      FROM emojis`),
    query(`SELECT category_slug AS slug, category AS name, COUNT(*) AS count\n      FROM emojis\n      GROUP BY category_slug, category\n      ORDER BY count DESC, name\n      LIMIT 10`),
    query(`SELECT record_json FROM emojis\n      ORDER BY COALESCE(synced_at, added_at) DESC, id\n      LIMIT 12`),
    query(`SELECT record_json FROM emojis\n      WHERE animated = 1\n      ORDER BY COALESCE(synced_at, added_at) DESC, id\n      LIMIT 12`),
    query(`SELECT record_json FROM emojis\n      ORDER BY id\n      LIMIT 120`)
  ]);

  const stats = statsRows[0] || {};
  return {
    stats: {
      total: Number(stats.total || 0),
      animated: Number(stats.animated || 0),
      categories: Number(stats.categories || 0),
      sources: Number(stats.sources || 0)
    },
    categories: categoryRows.map((row) => ({ slug: String(row.slug), name: String(row.name), count: Number(row.count || 0) })),
    recent: recentRows.map(parseRecord).filter(Boolean),
    animated: animatedRows.map(parseRecord).filter(Boolean),
    heroPool: heroRows.map(parseRecord).filter(Boolean)
  };
}

export async function getEmojiCount() {
  const rows = await query('SELECT COUNT(*) AS total FROM emojis');
  return Number(rows[0]?.total || 0);
}

export async function getEmojiSitemapPage(page, pageSize = 50000) {
  const safeSize = Math.max(1, Math.min(50000, Number(pageSize) || 50000));
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safeSize;
  return query(
    `SELECT slug, COALESCE(synced_at, added_at, '') AS lastmod\n     FROM emojis\n     ORDER BY slug\n     LIMIT ? OFFSET ?`,
    [safeSize, offset]
  );
}
