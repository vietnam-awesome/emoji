const section = document.querySelector('[data-variant-section]');
const grid = section?.querySelector('[data-variant-grid]');

const normalizeVariantKey = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const expandRecord = (row, license = '', attribution = '') => ({
  slug: row?.s || '',
  name: row?.n || '',
  category: row?.ca || row?.g || 'Other',
  categorySlug: row?.cs || 'other',
  sourceLabel: row?.sl || row?.src || '',
  image: row?.i || '',
  format: row?.f || '',
  animated: Boolean(row?.a),
  emoji: row?.e || '',
  license,
  attribution
});

const createVariantCard = (record) => {
  const basePrefix = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL.replace(/\/$/, '');
  const detailUrl = `${basePrefix}/emoji/${encodeURIComponent(record.slug)}`;
  const categoryUrl = `${basePrefix}/categories/${encodeURIComponent(record.categorySlug || 'other')}`;

  const article = document.createElement('article');
  article.className = 'emoji-card';
  article.dataset.emojiCard = '';
  article.dataset.category = record.category;
  article.dataset.categorySlug = record.categorySlug;
  article.dataset.sourceLabel = record.sourceLabel;
  article.dataset.downloadKey = record.slug;
  article.dataset.downloadName = record.name;
  article.dataset.downloadUrl = record.image;
  article.dataset.favoriteKey = record.slug;
  article.dataset.favoriteName = record.name;
  article.dataset.favoriteImage = record.image;
  article.dataset.favoriteCategory = record.category;
  article.dataset.favoriteCategorySlug = record.categorySlug;
  article.dataset.favoriteSource = record.sourceLabel;
  article.dataset.favoriteFormat = record.format;
  article.dataset.favoriteAnimated = record.animated ? 'yes' : 'no';
  article.dataset.favoriteEmoji = record.emoji;

  const preview = document.createElement('a');
  preview.className = 'emoji-preview is-image-loading';
  preview.href = detailUrl;
  preview.setAttribute('aria-label', `Open ${record.name}`);

  const image = document.createElement('img');
  image.alt = record.name;
  image.loading = 'lazy';
  image.width = 128;
  image.height = 128;
  const settle = () => preview.classList.remove('is-image-loading');
  image.addEventListener('load', settle, { once: true });
  image.addEventListener('error', settle, { once: true });
  image.src = record.image;
  preview.append(image);
  if (image.complete) queueMicrotask(settle);

  if (record.animated) {
    const badge = document.createElement('span');
    badge.className = 'card-motion-badge';
    badge.textContent = 'GIF';
    preview.append(badge);
  }

  const body = document.createElement('div');
  body.className = 'emoji-card-body';

  const titleRow = document.createElement('div');
  titleRow.className = 'emoji-title-row';
  const name = document.createElement('a');
  name.className = 'emoji-name';
  name.href = detailUrl;
  name.textContent = record.name;
  const nativeEmoji = document.createElement('span');
  nativeEmoji.className = 'native-emoji';
  nativeEmoji.setAttribute('aria-hidden', 'true');
  nativeEmoji.textContent = record.emoji || '';
  titleRow.append(name, nativeEmoji);

  const category = document.createElement('a');
  category.className = 'emoji-category';
  category.href = categoryUrl;
  category.textContent = record.category;

  const meta = document.createElement('div');
  meta.className = 'emoji-meta';
  const source = document.createElement('span');
  source.textContent = record.sourceLabel || 'Emoji source';
  const license = document.createElement('span');
  license.textContent = record.license || String(record.format || 'file').toUpperCase();
  meta.append(source, license);

  body.append(titleRow, category, meta);
  article.append(preview, body);
  return article;
};

const loadVariants = async () => {
  if (!(section instanceof HTMLElement) || !(grid instanceof HTMLElement)) return;

  const currentSlug = section.dataset.currentSlug || '';
  const key = normalizeVariantKey(section.dataset.currentHexcode);
  if (!key) return;

  const searchRoot = section.dataset.searchRoot || '/search';
  const prefix = key.slice(0, 2) || 'xx';

  try {
    const [manifestResponse, shardResponse] = await Promise.all([
      fetch(`${searchRoot}/manifest.json`),
      fetch(`${searchRoot}/variants/${prefix}.json`)
    ]);
    if (!manifestResponse.ok || !shardResponse.ok) return;

    const manifest = await manifestResponse.json();
    const shard = await shardResponse.json();
    const entries = Array.isArray(shard?.[key]) ? shard[key] : [];
    if (entries.length < 2) return;

    const chunkSize = Math.max(1, Number(manifest.chunkSize) || 1000);
    const chunkIndexes = [...new Set(entries.map((entry) => Math.floor(Number(entry.id) / chunkSize)))];
    const chunks = new Map();

    await Promise.all(chunkIndexes.map(async (chunkIndex) => {
      const response = await fetch(`${searchRoot}/chunks/${String(chunkIndex).padStart(4, '0')}.json`);
      if (!response.ok) return;
      chunks.set(chunkIndex, await response.json());
    }));

    const records = entries
      .map((entry) => {
        const id = Number(entry.id);
        if (!Number.isInteger(id) || id < 0) return null;
        const chunkIndex = Math.floor(id / chunkSize);
        const row = chunks.get(chunkIndex)?.[id % chunkSize];
        return row ? expandRecord(row, entry.l || '', entry.at || '') : null;
      })
      .filter((record) => record && record.slug !== currentSlug)
      .sort((left, right) =>
        String(left.sourceLabel).localeCompare(String(right.sourceLabel)) ||
        String(left.name).localeCompare(String(right.name))
      )
      .slice(0, 12);

    if (!records.length) return;
    grid.replaceChildren(...records.map(createVariantCard));
    section.hidden = false;
  } catch (error) {
    section.hidden = true;
    console.warn('Could not load emoji variants', error);
  }
};

loadVariants();
