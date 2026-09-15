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

function upgradeCard(card) {
  if (!(card instanceof Element) || !card.matches('.emoji-card[data-emoji-card]')) return;
  if (card.querySelector('.emoji-category')) return;

  const shortcode = card.querySelector('.shortcode');
  if (!shortcode) return;

  const meta = card.querySelector('.emoji-meta');
  const categoryNode = meta?.querySelector('span:first-child');
  const category = card.dataset.category || categoryNode?.textContent?.trim() || 'Other';
  const categorySlug = card.dataset.categorySlug || slugifyCategory(category);

  const categoryLink = document.createElement('a');
  categoryLink.className = 'emoji-category';
  categoryLink.href = `${basePrefix}/categories/${encodeURIComponent(categorySlug)}`;
  categoryLink.textContent = category;
  categoryLink.title = `Browse ${category}`;
  shortcode.replaceWith(categoryLink);

  // Legacy JS-rendered Browse cards put category in the first meta slot.
  // Once category moves into the primary metadata row, remove the duplicate.
  if (categoryNode && !card.dataset.sourceLabel) categoryNode.remove();
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
