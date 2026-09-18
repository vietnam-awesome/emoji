const STORAGE_KEY = 'eplus-emoji-favorites-v1';
const CHANGE_EVENT = 'eplus:favorites-changed';

const text = (value) => String(value || '').trim();

const normalizeRecord = (value) => {
  if (!value || typeof value !== 'object') return null;
  const slug = text(value.slug);
  if (!slug) return null;
  return {
    slug,
    name: text(value.name) || slug,
    image: text(value.image),
    category: text(value.category) || 'Other',
    categorySlug: text(value.categorySlug) || 'other',
    sourceLabel: text(value.sourceLabel),
    format: text(value.format),
    animated: Boolean(value.animated),
    emoji: text(value.emoji),
    shortcode: text(value.shortcode)
  };
};

const readFavorites = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    const seen = new Set();
    return parsed
      .map(normalizeRecord)
      .filter((record) => {
        if (!record || seen.has(record.slug)) return false;
        seen.add(record.slug);
        return true;
      });
  } catch {
    return [];
  }
};

const writeFavorites = (records) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    return false;
  }
  return true;
};

const recordFromCard = (card) => {
  const image = card.querySelector('.emoji-preview img');
  const name = card.querySelector('.emoji-name');
  const category = card.querySelector('.emoji-category');
  const detailHref = card.querySelector('.emoji-preview')?.getAttribute('href') || '';
  const fallbackSlug = decodeURIComponent(detailHref.split('/').filter(Boolean).at(-1) || '');
  const format = card.dataset.favoriteFormat || card.dataset.downloadFilename?.split('.').pop() || '';

  return normalizeRecord({
    slug: card.dataset.favoriteKey || card.dataset.downloadKey || fallbackSlug,
    name: card.dataset.favoriteName || card.dataset.downloadName || name?.textContent,
    image: card.dataset.favoriteImage || card.dataset.downloadUrl || image?.currentSrc || image?.src,
    category: card.dataset.favoriteCategory || card.dataset.category || category?.textContent,
    categorySlug: card.dataset.favoriteCategorySlug || card.dataset.categorySlug,
    sourceLabel: card.dataset.favoriteSource || card.dataset.sourceLabel,
    format,
    animated: (card.dataset.favoriteAnimated || card.dataset.animated) === 'yes',
    emoji: card.dataset.favoriteEmoji,
    shortcode: card.dataset.favoriteShortcode
  });
};

const recordFromAction = (button) => {
  const card = button.closest('.emoji-card[data-emoji-card]');
  if (card instanceof HTMLElement) return recordFromCard(card);
  return normalizeRecord({
    slug: button.dataset.favoriteKey,
    name: button.dataset.favoriteName,
    image: button.dataset.favoriteImage,
    category: button.dataset.favoriteCategory,
    categorySlug: button.dataset.favoriteCategorySlug,
    sourceLabel: button.dataset.favoriteSource,
    format: button.dataset.favoriteFormat,
    animated: button.dataset.favoriteAnimated === 'yes',
    emoji: button.dataset.favoriteEmoji,
    shortcode: button.dataset.favoriteShortcode
  });
};

const heartSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const ensureCardAction = (card) => {
  if (!(card instanceof HTMLElement) || card.dataset.cardVariant === 'compact') return null;
  let button = card.querySelector('[data-favorite-action]');
  if (button instanceof HTMLButtonElement) return button;

  button = document.createElement('button');
  button.type = 'button';
  button.className = 'emoji-card-favorite';
  button.dataset.favoriteAction = '';
  button.innerHTML = heartSvg;
  card.prepend(button);
  return button;
};

const syncAction = (button, favoriteSlugs) => {
  if (!(button instanceof HTMLButtonElement)) return;
  const record = recordFromAction(button);
  if (!record) return;
  const active = favoriteSlugs.has(record.slug);
  const label = active ? `Remove ${record.name} from My Emoji` : `Save ${record.name} to My Emoji`;
  button.classList.toggle('is-favorite', active);
  button.setAttribute('aria-pressed', String(active));
  button.setAttribute('aria-label', label);
  button.dataset.beuiTooltip = label;
  button.title = label;
  const labelNode = button.querySelector('[data-favorite-label]');
  if (labelNode) labelNode.textContent = active ? 'Saved to My Emoji' : 'Save to My Emoji';
  const card = button.closest('.emoji-card[data-emoji-card]');
  card?.classList.toggle('is-favorite', active);
};

const syncTree = (root = document) => {
  const favoriteSlugs = new Set(readFavorites().map((record) => record.slug));
  const cards = [];
  if (root instanceof HTMLElement && root.matches('.emoji-card[data-emoji-card]')) cards.push(root);
  root.querySelectorAll?.('.emoji-card[data-emoji-card]').forEach((card) => cards.push(card));
  for (const card of cards) ensureCardAction(card);

  const actions = [];
  if (root instanceof HTMLElement && root.matches('[data-favorite-action]')) actions.push(root);
  root.querySelectorAll?.('[data-favorite-action]').forEach((button) => actions.push(button));
  for (const action of actions) syncAction(action, favoriteSlugs);
};

const emitChange = (records) => {
  document.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { favorites: records } }));
};

document.addEventListener('click', (event) => {
  const target = event.target;
  const button = target instanceof Element ? target.closest('[data-favorite-action]') : null;
  if (!(button instanceof HTMLButtonElement)) return;

  const record = recordFromAction(button);
  if (!record) return;
  event.preventDefault();

  const favorites = readFavorites();
  const index = favorites.findIndex((item) => item.slug === record.slug);
  if (index >= 0) favorites.splice(index, 1);
  else favorites.unshift(record);

  if (!writeFavorites(favorites)) return;
  syncTree(document);
  emitChange(favorites);
});

syncTree(document);

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node instanceof HTMLElement) syncTree(node);
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });

window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  const favorites = readFavorites();
  syncTree(document);
  emitChange(favorites);
});

document.addEventListener(CHANGE_EVENT, () => syncTree(document));
