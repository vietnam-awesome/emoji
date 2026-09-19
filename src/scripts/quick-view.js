const dialog = document.querySelector('#emoji-quick-view');
const image = dialog?.querySelector('[data-quick-view-image]');
const nameNode = dialog?.querySelector('[data-quick-view-name]');
const sourceNode = dialog?.querySelector('[data-quick-view-source]');
const categoryNode = dialog?.querySelector('[data-quick-view-category]');
const formatNode = dialog?.querySelector('[data-quick-view-format]');
const motionNode = dialog?.querySelector('[data-quick-view-motion]');
const download = dialog?.querySelector('[data-quick-view-download]');
const details = dialog?.querySelector('[data-quick-view-details]');
const favorite = dialog?.querySelector('[data-favorite-action]');
const status = dialog?.querySelector('[data-quick-view-status]');
const exportNote = dialog?.querySelector('[data-quick-view-export-note]');
const close = dialog?.querySelector('[data-quick-view-close]');
const exportButtons = [...(dialog?.querySelectorAll('[data-export-preset]') || [])];

const PRESETS = {
  discord: { size: 128, suffix: 'discord-128' },
  slack: { size: 128, suffix: 'slack-128' },
  twitch: { size: 112, suffix: 'twitch-112' },
  telegram: { size: 100, suffix: 'telegram-100' }
};

let currentRecord = null;

const extensionFromUrl = (url, fallback = 'png') => {
  try {
    return new URL(url, window.location.href).pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || fallback;
  } catch {
    return String(url || '').match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1]?.toLowerCase() || fallback;
  }
};

const recordFromCard = (card) => {
  if (!(card instanceof HTMLElement)) return null;
  const preview = card.querySelector('.emoji-preview');
  const imageNode = preview?.querySelector('img');
  const slug = card.dataset.favoriteKey || card.dataset.downloadKey || decodeURIComponent(preview?.getAttribute('href')?.split('/').filter(Boolean).at(-1) || '');
  if (!slug) return null;
  const imageUrl = card.dataset.favoriteImage || card.dataset.downloadUrl || imageNode?.currentSrc || imageNode?.src || '';
  return {
    slug,
    name: card.dataset.favoriteName || card.dataset.downloadName || card.querySelector('.emoji-name')?.textContent?.trim() || slug,
    image: imageUrl,
    category: card.dataset.favoriteCategory || card.dataset.category || 'Other',
    categorySlug: card.dataset.favoriteCategorySlug || card.dataset.categorySlug || 'other',
    sourceLabel: card.dataset.favoriteSource || card.dataset.sourceLabel || '',
    format: card.dataset.favoriteFormat || extensionFromUrl(imageUrl),
    animated: (card.dataset.favoriteAnimated || card.dataset.animated) === 'yes',
    emoji: card.dataset.favoriteEmoji || '',
    shortcode: card.dataset.favoriteShortcode || '',
    detailUrl: preview?.getAttribute('href') || ''
  };
};

const syncFavoriteButton = (record) => {
  if (!(favorite instanceof HTMLButtonElement)) return;
  favorite.dataset.favoriteKey = record.slug;
  favorite.dataset.favoriteName = record.name;
  favorite.dataset.favoriteImage = record.image;
  favorite.dataset.favoriteCategory = record.category;
  favorite.dataset.favoriteCategorySlug = record.categorySlug;
  favorite.dataset.favoriteSource = record.sourceLabel;
  favorite.dataset.favoriteFormat = record.format;
  favorite.dataset.favoriteAnimated = record.animated ? 'yes' : 'no';
  favorite.dataset.favoriteEmoji = record.emoji;
  favorite.dataset.favoriteShortcode = record.shortcode;
  document.dispatchEvent(new CustomEvent('eplus:favorites-changed'));
};

const openQuickView = (record) => {
  if (!(dialog instanceof HTMLDialogElement) || !record) return;
  currentRecord = record;

  if (image instanceof HTMLImageElement) {
    image.src = record.image;
    image.alt = record.name;
  }
  if (nameNode) nameNode.textContent = record.name;
  if (sourceNode) sourceNode.textContent = record.sourceLabel || 'Emoji library';
  if (categoryNode) categoryNode.textContent = record.category || 'Other';
  if (formatNode) formatNode.textContent = String(record.format || 'png').toUpperCase();
  if (motionNode instanceof HTMLElement) motionNode.hidden = !record.animated;

  if (download instanceof HTMLAnchorElement) {
    download.href = record.image;
    download.download = `${record.slug}.${record.format || extensionFromUrl(record.image)}`;
    download.textContent = `Download ${String(record.format || 'file').toUpperCase()}`;
  }
  if (details instanceof HTMLAnchorElement) details.href = record.detailUrl || `/emoji/${encodeURIComponent(record.slug)}`;

  syncFavoriteButton(record);

  for (const button of exportButtons) {
    if (!(button instanceof HTMLButtonElement)) continue;
    button.disabled = record.animated;
    button.setAttribute('aria-disabled', String(record.animated));
  }

  if (exportNote) {
    exportNote.textContent = record.animated
      ? 'Animated export keeps the original file for now. GIF resize/optimization will be handled by the GIF tools feature.'
      : 'Static exports preserve transparency and fit the image inside a square canvas.';
  }
  if (status) status.textContent = '';

  document.dispatchEvent(new CustomEvent('eplus:recent-add', { detail: record }));
  if (!dialog.open) dialog.showModal();
};

document.addEventListener('click', (event) => {
  const target = event.target;
  const trigger = target instanceof Element ? target.closest('[data-quick-view-trigger]') : null;
  if (!(trigger instanceof HTMLAnchorElement)) return;
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const card = trigger.closest('.emoji-card[data-emoji-card]');
  const record = recordFromCard(card);
  if (!record) return;
  event.preventDefault();
  openQuickView(record);
});

close?.addEventListener('click', () => {
  if (dialog instanceof HTMLDialogElement) dialog.close();
});

dialog?.addEventListener('click', (event) => {
  if (event.target === dialog && dialog instanceof HTMLDialogElement) dialog.close();
});

async function loadSourceBitmap(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Image returned HTTP ${response.status}`);
  const blob = await response.blob();
  if ('createImageBitmap' in window) return createImageBitmap(blob);

  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = objectUrl;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not encode PNG')), 'image/png');
  });
}

async function exportPreset(key, button) {
  if (!currentRecord || currentRecord.animated) return;
  const preset = PRESETS[key];
  if (!preset) return;

  button.disabled = true;
  if (status) status.textContent = `Preparing ${key} export…`;

  try {
    const source = await loadSourceBitmap(currentRecord.image);
    const width = source.width || source.naturalWidth || preset.size;
    const height = source.height || source.naturalHeight || preset.size;
    const scale = Math.min(preset.size / width, preset.size / height);
    const drawWidth = Math.max(1, Math.round(width * scale));
    const drawHeight = Math.max(1, Math.round(height * scale));
    const x = Math.round((preset.size - drawWidth) / 2);
    const y = Math.round((preset.size - drawHeight) / 2);

    const canvas = document.createElement('canvas');
    canvas.width = preset.size;
    canvas.height = preset.size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    context.clearRect(0, 0, preset.size, preset.size);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, x, y, drawWidth, drawHeight);
    source.close?.();

    const blob = await canvasBlob(canvas);
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `${currentRecord.slug}-${preset.suffix}.png`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

    const kb = Math.ceil(blob.size / 1024);
    let suffix = `${preset.size}×${preset.size} PNG · ${kb} KB`;
    if (key === 'discord' && blob.size >= 256 * 1024) suffix += ' · over Discord’s 256 KB limit';
    if (key === 'slack' && blob.size >= 128 * 1024) suffix += ' · Slack recommends under 128 KB';
    if (status) status.textContent = `Exported ${suffix}.`;
  } catch (error) {
    console.error('Platform export failed', error);
    if (status) status.textContent = 'Could not export this image. Try downloading the original file instead.';
  } finally {
    button.disabled = false;
  }
}

for (const button of exportButtons) {
  button.addEventListener('click', () => {
    if (!(button instanceof HTMLButtonElement)) return;
    exportPreset(button.dataset.exportPreset, button);
  });
}
