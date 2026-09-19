const STORAGE_KEY = 'eplus-emoji-recent-v1';
const CHANGE_EVENT = 'eplus:recent-changed';
const ADD_EVENT = 'eplus:recent-add';
const LIMIT = 40;

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
    shortcode: text(value.shortcode),
    detailUrl: text(value.detailUrl),
    viewedAt: Number(value.viewedAt) || Date.now()
  };
};

const readRecent = () => {
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
      })
      .slice(0, LIMIT);
  } catch {
    return [];
  }
};

const emitChange = (records) => {
  document.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { recent: records } }));
};

const addRecent = (value) => {
  const record = normalizeRecord(value);
  if (!record) return;
  const records = readRecent().filter((item) => item.slug !== record.slug);
  records.unshift({ ...record, viewedAt: Date.now() });
  const trimmed = records.slice(0, LIMIT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    return;
  }
  emitChange(trimmed);
};

const current = document.querySelector('[data-recent-emoji]');
if (current instanceof HTMLElement) {
  addRecent({
    slug: current.dataset.recentSlug,
    name: current.dataset.recentName,
    image: current.dataset.recentImage,
    category: current.dataset.recentCategory,
    categorySlug: current.dataset.recentCategorySlug,
    sourceLabel: current.dataset.recentSource,
    format: current.dataset.recentFormat,
    animated: current.dataset.recentAnimated === 'yes',
    emoji: current.dataset.recentNative,
    shortcode: current.dataset.recentShortcode,
    detailUrl: current.dataset.recentDetailUrl
  });
}

document.addEventListener(ADD_EVENT, (event) => {
  addRecent(event.detail);
});

window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  emitChange(readRecent());
});

window.eplusRecentEmoji = {
  read: readRecent,
  add: addRecent,
  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      return;
    }
    emitChange([]);
  }
};
