const poolNode = document.querySelector('#hero-random-pool');
const randomGrid = document.querySelector('#hero-random-grid');
const shuffleButton = document.querySelector('#hero-shuffle');

if (poolNode && randomGrid) {
  try {
    const pool = JSON.parse(poolNode.textContent || '[]');
    const renderRandom = () => {
      for (let index = pool.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
      }

      const fragment = document.createDocumentFragment();
      for (const emoji of pool.slice(0, 12)) {
        const link = document.createElement('a');
        link.href = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/emoji/${encodeURIComponent(emoji.slug)}`;
        link.title = emoji.name;

        const image = document.createElement('img');
        image.src = emoji.image;
        image.alt = emoji.name;
        image.loading = 'eager';
        image.width = 64;
        image.height = 64;
        image.className = '!size-16 !max-h-16 !max-w-16 object-contain';
        link.append(image);

        if (emoji.animated) {
          const badge = document.createElement('span');
          badge.textContent = 'GIF';
          link.append(badge);
        }

        fragment.append(link);
      }
      randomGrid.replaceChildren(fragment);
    };

    renderRandom();
    shuffleButton?.addEventListener('click', renderRandom);
  } catch (error) {
    console.error('Could not shuffle hero emoji', error);
  }
}

const homeSearchShell = document.querySelector('#home-search-shell');
const homeSearchInput = document.querySelector('#home-emoji-search');
const homeSearchPanel = document.querySelector('#home-search-results');
const homeSearchList = document.querySelector('#home-search-list');
const homeSearchSummary = document.querySelector('#home-search-summary');
const homeSearchAll = document.querySelector('#home-search-all');

if (homeSearchShell && homeSearchInput && homeSearchPanel && homeSearchList && homeSearchSummary && homeSearchAll) {
  const RESULT_LIMIT = 8;
  const CANDIDATE_LIMIT = 40;
  const basePrefix = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL.replace(/\/$/, '');
  const searchRoot = `${basePrefix}/search`;
  const browseRoot = `${basePrefix}/emojis`;
  const assetBase = String(homeSearchShell.dataset.assetBase || '').replace(/\/$/, '');
  const jsonCache = new Map();
  const chunkCache = new Map();
  let manifestPromise;
  let debounceTimer;
  let requestVersion = 0;

  const normalizeSearch = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const fetchJson = (path) => {
    const url = `${searchRoot}/${String(path).replace(/^\/+/, '')}`;
    if (!jsonCache.has(url)) {
      jsonCache.set(url, fetch(url).then((response) => {
        if (!response.ok) throw new Error(`Search asset ${url} returned HTTP ${response.status}`);
        return response.json();
      }).catch((error) => {
        jsonCache.delete(url);
        throw error;
      }));
    }
    return jsonCache.get(url);
  };

  const getManifest = () => {
    if (!manifestPromise) manifestPromise = fetchJson('manifest.json');
    return manifestPromise;
  };

  const intersectSorted = (left, right) => {
    const rightSet = new Set(right);
    return left.filter((id) => rightSet.has(id));
  };

  const idsForToken = async (token) => {
    const prefix = token.slice(0, Math.min(2, token.length));
    if (!prefix) return [];
    let shard;
    try {
      shard = await fetchJson(`q/${prefix}.json`);
    } catch {
      return [];
    }
    const ids = new Set();
    for (const [indexedToken, tokenIds] of Object.entries(shard)) {
      if (!indexedToken.startsWith(token)) continue;
      for (const id of tokenIds) ids.add(id);
    }
    return [...ids].sort((a, b) => a - b);
  };

  const idsForQuery = async (value) => {
    const tokens = normalizeSearch(value).split(/\s+/).filter(Boolean).slice(0, 6);
    if (!tokens.length) return [];
    const lists = await Promise.all(tokens.map(idsForToken));
    if (lists.some((list) => list.length === 0)) return [];
    lists.sort((a, b) => a.length - b.length);
    return lists.slice(1).reduce((ids, list) => intersectSorted(ids, list), lists[0]);
  };

  const expandRecord = (row) => ({
    slug: row.s,
    name: row.n,
    shortcode: row.c,
    category: row.ca,
    sourceLabel: row.sl,
    image: row.i,
    animated: Boolean(row.a)
  });

  const getChunk = async (chunkIndex) => {
    if (!chunkCache.has(chunkIndex)) {
      chunkCache.set(chunkIndex, fetchJson(`chunks/${String(chunkIndex).padStart(4, '0')}.json`));
    }
    return chunkCache.get(chunkIndex);
  };

  const recordsForIds = async (ids) => {
    const manifest = await getManifest();
    const needed = [...new Set(ids.map((id) => Math.floor(id / manifest.chunkSize)))];
    await Promise.all(needed.map(getChunk));
    return Promise.all(ids.map(async (id) => {
      const chunkIndex = Math.floor(id / manifest.chunkSize);
      const chunk = await getChunk(chunkIndex);
      return expandRecord(chunk[id % manifest.chunkSize]);
    }));
  };

  const scoreRecord = (emoji, query) => {
    const normalized = normalizeSearch(query);
    const name = normalizeSearch(emoji.name);
    const shortcode = normalizeSearch(emoji.shortcode);
    if (name === normalized || shortcode === normalized) return 0;
    if (name.startsWith(normalized) || shortcode.startsWith(normalized)) return 1;
    if (name.includes(normalized) || shortcode.includes(normalized)) return 2;
    return 3;
  };

  const assetUrl = (emoji) => {
    if (!emoji.image) return '';
    if (emoji.image.startsWith('/emojis/') && assetBase) return `${assetBase}${emoji.image}`;
    return emoji.image.startsWith('/') ? `${basePrefix}${emoji.image}` : emoji.image;
  };

  const closeSuggestions = () => {
    homeSearchPanel.hidden = true;
    homeSearchInput.setAttribute('aria-expanded', 'false');
  };

  const openSuggestions = () => {
    homeSearchPanel.hidden = false;
    homeSearchInput.setAttribute('aria-expanded', 'true');
  };

  const renderResult = (emoji) => {
    const link = document.createElement('a');
    link.className = 'home-search-item';
    link.href = `${basePrefix}/emoji/${encodeURIComponent(emoji.slug)}`;

    const preview = document.createElement('span');
    preview.className = 'home-search-thumb';
    const image = document.createElement('img');
    image.src = assetUrl(emoji);
    image.alt = '';
    image.loading = 'lazy';
    image.width = 42;
    image.height = 42;
    preview.append(image);
    if (emoji.animated) {
      const badge = document.createElement('small');
      badge.textContent = 'GIF';
      preview.append(badge);
    }

    const copy = document.createElement('span');
    copy.className = 'home-search-copy';
    const name = document.createElement('strong');
    name.textContent = emoji.name;
    const shortcode = document.createElement('span');
    shortcode.textContent = `:${emoji.shortcode}:`;
    copy.append(name, shortcode);

    const meta = document.createElement('small');
    meta.className = 'home-search-meta';
    meta.textContent = emoji.category || emoji.sourceLabel || '';
    link.append(preview, copy, meta);
    return link;
  };

  const showSuggestionSkeletons = () => {
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 4; index += 1) {
      const row = document.createElement('div');
      row.className = 'home-search-skeleton';
      row.setAttribute('aria-hidden', 'true');

      const thumb = document.createElement('span');
      thumb.className = 'home-search-skeleton-thumb';

      const copy = document.createElement('span');
      copy.className = 'home-search-skeleton-copy';
      const title = document.createElement('span');
      title.className = 'home-search-skeleton-line home-search-skeleton-line--title';
      const meta = document.createElement('span');
      meta.className = 'home-search-skeleton-line home-search-skeleton-line--meta';
      copy.append(title, meta);

      const tail = document.createElement('span');
      tail.className = 'home-search-skeleton-tail';
      row.append(thumb, copy, tail);
      fragment.append(row);
    }
    homeSearchList.replaceChildren(fragment);
  };

  const runSuggestions = async () => {
    const rawQuery = homeSearchInput.value.trim();
    const query = normalizeSearch(rawQuery);
    if (query.length < 2) {
      requestVersion += 1;
      closeSuggestions();
      return;
    }

    const version = ++requestVersion;
    showSuggestionSkeletons();
    homeSearchSummary.textContent = 'Searching…';
    homeSearchAll.href = `${browseRoot}?q=${encodeURIComponent(rawQuery)}`;
    openSuggestions();

    try {
      const ids = await idsForQuery(rawQuery);
      if (version !== requestVersion) return;

      if (!ids.length) {
        homeSearchSummary.textContent = 'No emoji found';
        const empty = document.createElement('div');
        empty.className = 'home-search-empty';
        empty.textContent = 'Try another name, shortcode, tag or category.';
        homeSearchList.replaceChildren(empty);
        return;
      }

      const candidates = await recordsForIds(ids.slice(0, CANDIDATE_LIMIT));
      if (version !== requestVersion) return;
      candidates.sort((a, b) => scoreRecord(a, rawQuery) - scoreRecord(b, rawQuery) || a.name.localeCompare(b.name));
      const results = candidates.slice(0, RESULT_LIMIT);
      const fragment = document.createDocumentFragment();
      for (const emoji of results) fragment.append(renderResult(emoji));
      homeSearchList.replaceChildren(fragment);
      homeSearchSummary.textContent = `${ids.length.toLocaleString('en-US')} match${ids.length === 1 ? '' : 'es'}`;
    } catch (error) {
      if (version !== requestVersion) return;
      console.error('Could not load home search suggestions', error);
      homeSearchSummary.textContent = 'Search suggestions unavailable';
      const fallback = document.createElement('div');
      fallback.className = 'home-search-empty';
      fallback.textContent = 'Press Enter to search the full emoji library.';
      homeSearchList.replaceChildren(fallback);
    }
  };

  homeSearchInput.addEventListener('input', () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(runSuggestions, 160);
  });

  homeSearchInput.addEventListener('focus', () => {
    if (normalizeSearch(homeSearchInput.value).length >= 2) runSuggestions();
  });

  homeSearchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSuggestions();
  });

  document.addEventListener('pointerdown', (event) => {
    if (!homeSearchShell.contains(event.target)) closeSuggestions();
  });
}
