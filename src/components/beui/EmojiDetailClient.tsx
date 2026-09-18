import { useEffect, useMemo, useState } from 'react';
import SiteHeader from './SiteHeader';
import '../../scripts/favorites.js';

type Manifest = {
  total: number;
  chunkSize: number;
  categories?: Array<{ value: string; file: string }>;
};

type EmojiRecord = {
  slug: string;
  name: string;
  shortcode: string;
  group: string;
  category: string;
  categorySlug: string;
  tags: string[];
  source: string;
  sourceLabel: string;
  image: string;
  format: string;
  animated: boolean;
  emoji: string;
  hexcode: string;
  collection: string;
  style: string;
  topics: string[];
  license: string;
  attribution: string;
  sourceUrl: string;
};

interface Props {
  recordId: number;
  slug: string;
}

const basePrefix = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL.replace(/\/$/, '');
const searchRoot = `${basePrefix}/search`;

function expand(row: any): EmojiRecord {
  return {
    slug: String(row?.s || ''),
    name: String(row?.n || ''),
    shortcode: String(row?.c || ''),
    group: String(row?.g || ''),
    category: String(row?.ca || ''),
    categorySlug: String(row?.cs || ''),
    tags: Array.isArray(row?.t) ? row.t : [],
    source: String(row?.src || ''),
    sourceLabel: String(row?.sl || ''),
    image: String(row?.i || ''),
    format: String(row?.f || ''),
    animated: Boolean(row?.a),
    emoji: String(row?.e || ''),
    hexcode: String(row?.h || ''),
    collection: String(row?.co || ''),
    style: String(row?.st || ''),
    topics: Array.isArray(row?.tp) ? row.tp : [],
    license: String(row?.li || ''),
    attribution: String(row?.at || ''),
    sourceUrl: String(row?.su || '')
  };
}

async function fetchJson(path: string) {
  const response = await fetch(`${searchRoot}/${path.replace(/^\/+/, '')}`);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
  return response.json();
}

async function fetchRecordById(id: number, manifest?: Manifest) {
  const meta: Manifest = manifest || await fetchJson('manifest.json');
  const chunkSize = Math.max(1, Number(meta.chunkSize) || 1000);
  const chunkIndex = Math.floor(id / chunkSize);
  const chunk = await fetchJson(`chunks/${String(chunkIndex).padStart(4, '0')}.json`);
  const row = chunk?.[id % chunkSize];
  return row ? expand(row) : null;
}

function normalize(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function compact(value: unknown) {
  return normalize(value).replace(/\s+/g, '');
}

function sharedCount(left: string[], right: string[]) {
  const rightSet = new Set((right || []).map(normalize).filter(Boolean));
  let count = 0;
  for (const value of new Set((left || []).map(normalize).filter(Boolean))) {
    if (rightSet.has(value)) count += 1;
  }
  return count;
}

function wordSet(record: EmojiRecord) {
  return new Set(
    normalize([record.name, record.shortcode].filter(Boolean).join(' '))
      .split(/\s+/)
      .filter((word) => word.length > 1)
  );
}

function same(left: unknown, right: unknown) {
  const a = compact(left);
  const b = compact(right);
  return Boolean(a && b && a === b);
}

function scoreSimilar(target: EmojiRecord, candidate: EmojiRecord) {
  if (!candidate || candidate.slug === target.slug) return Number.NEGATIVE_INFINITY;
  let score = 0;
  if (same(target.hexcode, candidate.hexcode)) score += 36;
  if (same(target.categorySlug || target.category, candidate.categorySlug || candidate.category)) score += 14;
  if (same(target.group, candidate.group)) score += 7;
  if (same(target.collection, candidate.collection)) score += 5;
  if (same(target.style, candidate.style)) score += 3;
  if (same(target.shortcode, candidate.shortcode)) score += 8;
  score += Math.min(sharedCount(target.tags, candidate.tags) * 5, 20);
  score += Math.min(sharedCount(target.topics, candidate.topics) * 3, 9);

  const targetWords = wordSet(target);
  const candidateWords = wordSet(candidate);
  let sharedWords = 0;
  for (const word of targetWords) if (candidateWords.has(word)) sharedWords += 1;
  score += Math.min(sharedWords * 2, 6);

  if (same(target.source, candidate.source)) score += 1;
  if (target.animated === candidate.animated) score += 1;
  if (same(target.format, candidate.format)) score += 0.5;
  return score;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

async function fetchRecordsByIds(ids: number[], manifest: Manifest) {
  const chunkSize = Math.max(1, Number(manifest.chunkSize) || 1000);
  const chunkIndexes = [...new Set(ids.map((id) => Math.floor(id / chunkSize)))];
  const chunks = new Map<number, any[]>();

  await Promise.all(chunkIndexes.map(async (chunkIndex) => {
    const rows = await fetchJson(`chunks/${String(chunkIndex).padStart(4, '0')}.json`);
    chunks.set(chunkIndex, rows);
  }));

  return ids.map((id) => {
    const chunkIndex = Math.floor(id / chunkSize);
    const row = chunks.get(chunkIndex)?.[id % chunkSize];
    return row ? expand(row) : null;
  }).filter(Boolean) as EmojiRecord[];
}

function EmojiCard({ emoji }: { emoji: EmojiRecord }) {
  const detailUrl = `${basePrefix}/emoji/${encodeURIComponent(emoji.slug)}`;
  const categorySlug = emoji.categorySlug || 'other';
  const category = emoji.category || emoji.group || 'Other';
  const categoryUrl = `${basePrefix}/categories/${encodeURIComponent(categorySlug)}`;

  return (
    <article
      className="emoji-card"
      data-emoji-card
      data-category={category}
      data-category-slug={categorySlug}
      data-source-label={emoji.sourceLabel}
      data-download-key={emoji.slug}
      data-download-name={emoji.name}
      data-download-url={emoji.image}
      data-favorite-key={emoji.slug}
      data-favorite-name={emoji.name}
      data-favorite-image={emoji.image}
      data-favorite-category={category}
      data-favorite-category-slug={categorySlug}
      data-favorite-source={emoji.sourceLabel}
      data-favorite-format={emoji.format}
      data-favorite-animated={emoji.animated ? 'yes' : 'no'}
      data-favorite-emoji={emoji.emoji}
      data-favorite-shortcode={emoji.shortcode}
    >
      <button
        className="emoji-card-favorite"
        type="button"
        data-favorite-action
        aria-label={`Save ${emoji.name} to My Emoji`}
        aria-pressed="false"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      <a className="emoji-card-download" href={emoji.image} download aria-label={`Download ${emoji.name}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </a>
      <a className="emoji-preview" href={detailUrl} aria-label={`Open ${emoji.name}`}>
        <img src={emoji.image} alt={emoji.name} loading="lazy" width={128} height={128} />
        {emoji.animated && <span className="card-motion-badge">GIF</span>}
      </a>
      <div className="emoji-card-body">
        <div className="emoji-title-row">
          <a className="emoji-name" href={detailUrl}>{emoji.name}</a>
          {emoji.emoji && <span className="native-emoji" aria-hidden="true">{emoji.emoji}</span>}
        </div>
        <a className="emoji-category" href={categoryUrl}>{category}</a>
        <div className="emoji-meta">
          <span>{emoji.sourceLabel}</span>
          <span>{emoji.animated ? 'Animated' : String(emoji.format || 'Static').toUpperCase()}</span>
        </div>
      </div>
    </article>
  );
}

export default function EmojiDetailClient({ recordId, slug }: Props) {
  const [emoji, setEmoji] = useState<EmojiRecord | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [similar, setSimilar] = useState<EmojiRecord[]>([]);
  const [random, setRandom] = useState<EmojiRecord[]>([]);
  const [error, setError] = useState('');
  const [zoomOpen, setZoomOpen] = useState(false);
  const [shareLabel, setShareLabel] = useState('Share');
  const [randomNonce, setRandomNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meta: Manifest = await fetchJson('manifest.json');
        const record = await fetchRecordById(recordId, meta);
        if (cancelled) return;
        if (!record || record.slug !== slug) {
          setError('Emoji data is unavailable.');
          return;
        }
        setManifest(meta);
        setEmoji(record);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load emoji data.');
      }
    })();
    return () => { cancelled = true; };
  }, [recordId, slug]);

  useEffect(() => {
    if (!emoji || !manifest) return;
    let cancelled = false;

    (async () => {
      try {
        const categoryEntry = manifest.categories?.find((entry) => entry.value === (emoji.categorySlug || emoji.category));
        if (!categoryEntry) return;
        const categoryIds: number[] = await fetchJson(`facets/category/${categoryEntry.file}`);
        if (!Array.isArray(categoryIds) || categoryIds.length < 2) return;

        const sampleLimit = Math.min(240, categoryIds.length);
        const seed = hashString(emoji.slug);
        const start = seed % categoryIds.length;
        const stride = categoryIds.length / Math.max(1, sampleLimit);
        const ids: number[] = [];
        const seen = new Set<number>();

        for (let index = 0; index < sampleLimit; index += 1) {
          const position = Math.floor((start + index * stride) % categoryIds.length);
          const id = categoryIds[position];
          if (id === recordId || seen.has(id)) continue;
          seen.add(id);
          ids.push(id);
        }

        const candidates = await fetchRecordsByIds(ids, manifest);
        const ranked = candidates
          .map((record) => ({ record, score: scoreSimilar(emoji, record) }))
          .filter(({ score }) => Number.isFinite(score) && score > 0)
          .sort((left, right) => right.score - left.score || left.record.name.localeCompare(right.record.name))
          .slice(0, 12)
          .map(({ record }) => record);

        if (!cancelled) setSimilar(ranked);
      } catch {
        if (!cancelled) setSimilar([]);
      }
    })();

    return () => { cancelled = true; };
  }, [emoji, manifest, recordId]);

  useEffect(() => {
    if (!emoji || !manifest) return;
    let cancelled = false;

    (async () => {
      try {
        const total = Math.max(0, Number(manifest.total) || 0);
        if (total < 2) return;

        const targetCount = Math.min(24, total - 1);
        const ids: number[] = [];
        const seen = new Set<number>([recordId]);
        let state = hashString(`${emoji.slug}:${randomNonce}:${Date.now()}`);

        for (let attempt = 0; ids.length < targetCount && attempt < targetCount * 20; attempt += 1) {
          state = (Math.imul(state ^ 0x9e3779b9, 1664525) + 1013904223) >>> 0;
          const id = state % total;
          if (seen.has(id)) continue;
          seen.add(id);
          ids.push(id);
        }

        const records = await fetchRecordsByIds(ids, manifest);
        if (!cancelled) setRandom(records.slice(0, 24));
      } catch {
        if (!cancelled) setRandom([]);
      }
    })();

    return () => { cancelled = true; };
  }, [emoji, manifest, recordId, randomNonce]);

  const category = emoji?.category || emoji?.group || 'Other';
  const categorySlug = emoji?.categorySlug || 'other';
  const categoryUrl = `${basePrefix}/categories/${encodeURIComponent(categorySlug)}`;
  const editorUrl = emoji
    ? `${basePrefix}/editor?src=${encodeURIComponent(emoji.image)}&name=${encodeURIComponent(emoji.name)}${emoji.animated ? '&animated=1' : ''}`
    : '#';

  const hasDistinctShortcode = useMemo(() => {
    if (!emoji?.shortcode) return false;
    return compact(emoji.shortcode) !== compact(emoji.name);
  }, [emoji]);

  const onShare = async () => {
    if (!emoji) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: emoji.name, url: window.location.href });
        return;
      }
      await navigator.clipboard.writeText(window.location.href);
      setShareLabel('Copied!');
      window.setTimeout(() => setShareLabel('Share'), 1200);
    } catch {
      setShareLabel('Copy failed');
      window.setTimeout(() => setShareLabel('Share'), 1200);
    }
  };

  return (
    <>
      <SiteHeader
        homeUrl={`${basePrefix}/` || '/'}
        emojisUrl={`${basePrefix}/emojis`}
        categoriesUrl={`${basePrefix}/categories`}
        routePath={`/emoji/${slug}`}
      />

      <main>
        <div className="shell">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <a href={`${basePrefix}/` || '/'}>Home</a>
            <span aria-hidden="true">/</span>
            <a href={categoryUrl}>{category}</a>
            <span aria-hidden="true">/</span>
            <span>{emoji?.name || 'Emoji'}</span>
          </nav>
        </div>

        {!emoji && !error && (
          <section className="shell detail-page" aria-busy="true">
            <div className="detail-grid">
              <aside className="detail-preview"><div className="detail-preview-canvas is-image-loading" style={{ minHeight: 260 }} /></aside>
              <div className="detail-content"><p className="eyebrow">Loading emoji…</p><h1>Loading…</h1></div>
            </div>
          </section>
        )}

        {error && (
          <section className="shell detail-page">
            <div className="category-empty">{error}</div>
          </section>
        )}

        {emoji && (
          <section className="shell detail-page">
            <div className="detail-grid">
              <aside className="detail-preview" aria-label={`${emoji.name} preview`}>
                <div className="detail-preview-head">
                  <span>Preview</span>
                  <span>Original size</span>
                </div>
                <button
                  className="detail-preview-image-button"
                  type="button"
                  aria-label={`Zoom ${emoji.name}`}
                  onClick={() => setZoomOpen(true)}
                >
                  <span className="detail-preview-canvas">
                    <img src={emoji.image} alt={emoji.name} />
                  </span>
                </button>
                <div className="detail-preview-actions">
                  <button className="secondary-action detail-preview-action" type="button" onClick={() => setZoomOpen(true)}>
                    Zoom preview
                  </button>
                  <a className="primary-action detail-preview-action" href={editorUrl}>Edit emoji</a>
                </div>
              </aside>

              <div className="detail-content">
                <div className="detail-title-row">
                  <div>
                    <p className="eyebrow">{emoji.sourceLabel}</p>
                    <h1>{emoji.name}</h1>
                  </div>
                  {emoji.emoji && <span className="detail-native" aria-hidden="true">{emoji.emoji}</span>}
                </div>

                {hasDistinctShortcode && (
                  <button
                    className="copy-large"
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(`:${emoji.shortcode}:`)}
                  >
                    <span>:{emoji.shortcode}:</span>
                    <strong>Copy shortcode</strong>
                  </button>
                )}

                <div className="tag-list" aria-label="Related emoji tags">
                  {emoji.tags.slice(0, 12).map((tag) => (
                    <a key={tag} href={`${basePrefix}/emojis?q=${encodeURIComponent(tag)}`}>{tag}</a>
                  ))}
                </div>

                <div className="detail-actions">
                  <a className="primary-action" href={emoji.image} download>Download {String(emoji.format || '').toUpperCase()}</a>
                  <button
                    className="secondary-action detail-favorite-action"
                    type="button"
                    data-favorite-action
                    data-favorite-key={emoji.slug}
                    data-favorite-name={emoji.name}
                    data-favorite-image={emoji.image}
                    data-favorite-category={category}
                    data-favorite-category-slug={categorySlug}
                    data-favorite-source={emoji.sourceLabel}
                    data-favorite-format={emoji.format}
                    data-favorite-animated={emoji.animated ? 'yes' : 'no'}
                    data-favorite-emoji={emoji.emoji}
                    data-favorite-shortcode={emoji.shortcode}
                    aria-label={`Save ${emoji.name} to My Emoji`}
                    aria-pressed="false"
                  >
                    ♥
                    <span className="sr-only" data-favorite-label>Save to My Emoji</span>
                  </button>
                  <button className="secondary-action" type="button" onClick={onShare}>{shareLabel}</button>
                </div>

                <dl className="metadata-list">
                  <div><dt>Category</dt><dd><a href={categoryUrl}>{category}</a></dd></div>
                  {hasDistinctShortcode && <div><dt>Shortcode</dt><dd>:{emoji.shortcode}:</dd></div>}
                  {emoji.collection && <div><dt>Collection</dt><dd>{emoji.collection}</dd></div>}
                  {emoji.style && <div><dt>Style</dt><dd>{emoji.style}</dd></div>}
                  <div><dt>Source</dt><dd>{emoji.sourceUrl ? <a href={emoji.sourceUrl} rel="noreferrer">{emoji.sourceLabel}</a> : emoji.sourceLabel}</dd></div>
                  <div><dt>Format</dt><dd>{String(emoji.format || '').toUpperCase()}{emoji.animated ? ' · Animated' : ''}</dd></div>
                  {emoji.hexcode && <div><dt>Hexcode</dt><dd>{emoji.hexcode}</dd></div>}
                  {emoji.license && <div><dt>License</dt><dd>{emoji.license}</dd></div>}
                  {emoji.attribution && <div><dt>Attribution</dt><dd>{emoji.attribution}</dd></div>}
                </dl>
              </div>
            </div>

            {similar.length > 0 && (
              <section className="detail-similar" aria-labelledby="similar-emoji-title">
                <div className="section-heading-modern">
                  <div>
                    <p className="section-kicker">Discovery</p>
                    <h2 id="similar-emoji-title">Similar emoji</h2>
                    <p>Related by category, tags, collection and style.</p>
                  </div>
                  <a href={categoryUrl}>More in {category} <span>→</span></a>
                </div>
                <div className="detail-similar-grid">
                  {similar.map((item) => <EmojiCard key={item.slug} emoji={item} />)}
                </div>
              </section>
            )}

            {random.length > 0 && (
              <section className="detail-random" aria-labelledby="random-emoji-title">
                <div className="section-heading-modern">
                  <div>
                    <p className="section-kicker">Explore</p>
                    <h2 id="random-emoji-title">Random emoji</h2>
                    <p>A fresh mix from across the library.</p>
                  </div>
                  <button className="detail-random-shuffle" type="button" onClick={() => setRandomNonce((value) => value + 1)}>
                    Shuffle
                  </button>
                </div>
                <div className="detail-random-grid">
                  {random.slice(0, 6).map((item) => <EmojiCard key={item.slug} emoji={item} />)}
                </div>
              </section>
            )}
          </section>
        )}
      </main>

      <footer className="site-footer">
        <div className="shell footer-bottom">
          <span>Built by ePlus.DEV</span>
          <span>Search, copy and download emoji for communities, apps and creative projects.</span>
        </div>
      </footer>

      {zoomOpen && emoji && (
        <div className="detail-lightbox" role="dialog" aria-modal="true" aria-label={`Preview ${emoji.name}`}>
          <div className="detail-lightbox-shell">
            <div className="detail-lightbox-toolbar">
              <span>Original image</span>
              <button className="detail-lightbox-close" type="button" onClick={() => setZoomOpen(false)}>×</button>
            </div>
            <div className="detail-lightbox-stage">
              <img src={emoji.image} alt={emoji.name} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
