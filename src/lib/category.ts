export interface EmojiCategoryLike {
  categorySlug?: string;
  category?: string;
  group?: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  reactions: '🔥',
  animals: '🐾',
  gaming: '🎮',
  meme: '😂',
  people: '🙂',
  entertainment: '🎬',
  activities: '⚽',
  brands: '🏷️',
  nature: '🌿',
  symbols: '✨',
  objects: '🧩',
  'food-drink': '🍜',
  flags: '🏳️',
  'travel-places': '✈️',
  other: '🗂️'
};

export function slugifyCategory(value: string) {
  return String(value || 'other')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'other';
}

export function emojiCategorySlug(emoji: EmojiCategoryLike) {
  return slugifyCategory(emoji.categorySlug || emoji.category || emoji.group || 'other');
}

export function categoryIcon(slug: string) {
  return CATEGORY_ICONS[slug] || '😀';
}
