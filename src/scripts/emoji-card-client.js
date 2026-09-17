const basePrefix = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL.replace(/\/$/, '');

function slugifyCategory(value) {
  return String(value || 'other')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'other';
}

function filenameFromCard(card, imageUrl) {
  const existing = card.dataset.downloadFilename;
  if (existing) return existing;

  const detailHref = card.querySelector('.emoji-preview')?.getAttribute('href') || '';
  const slug = decodeURIComponent(detailHref.split('/').filter(Boolean).at(-1) || 'emoji');
  let extension = 'png';
  try {
    const pathname = new URL(imageUrl, window.location.href).pathname;
    extension = pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || extension;
  } catch {
    extension = String(imageUrl).match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1]?.toLowerCase() || extension;
  }
  return `${slug}.${extension}`;
}

function ensureDownloadAction(card) {
  if (card.querySelector('.emoji-card-download')) return;
  const image = card.querySelector('.emoji-preview img');
  if (!(image instanceof HTMLImageElement) || !image.src) return;

  const name = card.querySelector('.emoji-name')?.textContent?.trim() || image.alt || 'emoji';
  const filename = filenameFromCard(card, image.src);
  const action = document.createElement('a');
  action.className = 'emoji-card-download';
  action.href = image.src;
  action.download = filename;
  action.dataset.beuiTooltip = `Download ${name}`;
  action.setAttribute('aria-label', `Download ${name}`);
  action.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" /></svg>';
  card.prepend(action);

  card.dataset.downloadKey ||= filename.replace(/\.[a-z0-9]+$/i, '');
  card.dataset.downloadName ||= name;
  card.dataset.downloadUrl ||= image.src;
  card.dataset.downloadFilename ||= filename;
}

function upgradeCard(card) {
  if (!(card instanceof Element) || !card.matches('.emoji-card[data-emoji-card]')) return;

  const shortcode = card.querySelector('.shortcode');
  const meta = card.querySelector('.emoji-meta');
  const categoryNode = meta?.querySelector('span:first-child');
  const category = card.dataset.category || categoryNode?.textContent?.trim() || 'Other';
  const categorySlug = card.dataset.categorySlug || slugifyCategory(category);

  if (!card.querySelector('.emoji-category') && shortcode) {
    const categoryLink = document.createElement('a');
    categoryLink.className = 'emoji-category';
    categoryLink.href = `${basePrefix}/categories/${encodeURIComponent(categorySlug)}`;
    categoryLink.textContent = category;
    categoryLink.dataset.beuiTooltip = `Browse ${category}`;
    shortcode.replaceWith(categoryLink);

    // Legacy JS-rendered cards put category in the first meta slot. Once the
    // category moves into the primary metadata row, remove that duplicate.
    if (categoryNode && !card.dataset.sourceLabel) categoryNode.remove();
  }

  ensureDownloadAction(card);
}

function upgradeTree(root) {
  if (!(root instanceof Element || root instanceof Document)) return;
  if (root instanceof Element && root.matches('.emoji-card[data-emoji-card]')) upgradeCard(root);
  root.querySelectorAll?.('.emoji-card[data-emoji-card]').forEach(upgradeCard);
}

upgradeTree(document);

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node instanceof Element) upgradeTree(node);
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });
