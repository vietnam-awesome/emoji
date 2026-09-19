export function createEmojiCard(item, basePrefix = '') {
  const slug = String(item?.slug || '').trim();
  const name = String(item?.name || slug || 'emoji').trim();
  const category = String(item?.category || 'Other').trim();
  const categorySlug = String(item?.categorySlug || 'other').trim();
  const sourceLabel = String(item?.sourceLabel || '').trim();
  const format = String(item?.format || 'png').trim().toLowerCase();
  const imageUrl = String(item?.image || '').trim();
  const detailUrl = item?.detailUrl || `${basePrefix}/emoji/${encodeURIComponent(slug)}`;

  const card = document.createElement('article');
  card.className = 'emoji-card';
  card.dataset.emojiCard = '';
  card.dataset.cardVariant = 'default';
  card.dataset.downloadKey = slug;
  card.dataset.downloadName = name;
  card.dataset.downloadUrl = imageUrl;
  card.dataset.downloadFilename = `${slug}.${format || 'png'}`;
  card.dataset.favoriteKey = slug;
  card.dataset.favoriteName = name;
  card.dataset.favoriteImage = imageUrl;
  card.dataset.favoriteCategory = category;
  card.dataset.favoriteCategorySlug = categorySlug;
  card.dataset.favoriteSource = sourceLabel;
  card.dataset.favoriteFormat = format;
  card.dataset.favoriteAnimated = item?.animated ? 'yes' : 'no';
  card.dataset.favoriteEmoji = String(item?.emoji || '');
  card.dataset.favoriteShortcode = String(item?.shortcode || '');
  card.dataset.category = category;
  card.dataset.categorySlug = categorySlug;
  card.dataset.sourceLabel = sourceLabel;
  card.dataset.animated = item?.animated ? 'yes' : 'no';

  const preview = document.createElement('a');
  preview.className = 'emoji-preview is-image-loading';
  preview.href = detailUrl;
  preview.dataset.quickViewTrigger = '';
  preview.setAttribute('aria-label', `Quick view ${name}`);

  const image = document.createElement('img');
  image.src = imageUrl;
  image.alt = name;
  image.loading = 'lazy';
  image.width = 128;
  image.height = 128;
  const settle = () => preview.classList.remove('is-image-loading');
  if (image.complete) queueMicrotask(settle);
  else {
    image.addEventListener('load', settle, { once: true });
    image.addEventListener('error', settle, { once: true });
  }
  preview.append(image);

  if (item?.animated) {
    const badge = document.createElement('span');
    badge.className = 'card-motion-badge';
    badge.textContent = 'GIF';
    preview.append(badge);
  }

  const body = document.createElement('div');
  body.className = 'emoji-card-body';

  const titleRow = document.createElement('div');
  titleRow.className = 'emoji-title-row';

  const title = document.createElement('a');
  title.className = 'emoji-name';
  title.href = detailUrl;
  title.textContent = name;
  titleRow.append(title);

  if (item?.emoji) {
    const native = document.createElement('span');
    native.className = 'native-emoji';
    native.setAttribute('aria-hidden', 'true');
    native.textContent = item.emoji;
    titleRow.append(native);
  }

  const categoryLink = document.createElement('a');
  categoryLink.className = 'emoji-category';
  categoryLink.href = `${basePrefix}/categories/${encodeURIComponent(categorySlug)}`;
  categoryLink.textContent = category;

  const meta = document.createElement('div');
  meta.className = 'emoji-meta';
  const source = document.createElement('span');
  source.textContent = sourceLabel || 'Library';
  const kind = document.createElement('span');
  kind.textContent = item?.animated ? 'Animated' : (format || 'Static').toUpperCase();
  meta.append(source, kind);

  body.append(titleRow, categoryLink, meta);
  card.append(preview, body);
  return card;
}
