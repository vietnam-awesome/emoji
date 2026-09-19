const STORAGE_KEY = 'eplus-emoji-packs-v1';
const CHANGE_EVENT = 'eplus:packs-changed';
const SAVE_REQUEST_EVENT = 'eplus:pack-save-request';
const MAX_PACKS = 50;
const MAX_ITEMS = 500;

const text = (value) => String(value || '').trim();

const normalizeItem = (value) => {
  if (!value || typeof value !== 'object') return null;
  const slug = text(value.slug || value.key);
  if (!slug) return null;
  return {
    slug,
    name: text(value.name) || slug,
    image: text(value.image || value.url),
    category: text(value.category) || 'Other',
    categorySlug: text(value.categorySlug) || 'other',
    sourceLabel: text(value.sourceLabel),
    format: text(value.format) || text(value.filename).split('.').pop() || 'png',
    animated: Boolean(value.animated),
    emoji: text(value.emoji),
    shortcode: text(value.shortcode),
    detailUrl: text(value.detailUrl)
  };
};

const normalizePack = (value) => {
  if (!value || typeof value !== 'object') return null;
  const id = text(value.id);
  const name = text(value.name);
  if (!id || !name) return null;
  const seen = new Set();
  const items = (Array.isArray(value.items) ? value.items : [])
    .map(normalizeItem)
    .filter((item) => {
      if (!item || seen.has(item.slug)) return false;
      seen.add(item.slug);
      return true;
    })
    .slice(0, MAX_ITEMS);
  return {
    id,
    name,
    createdAt: Number(value.createdAt) || Date.now(),
    updatedAt: Number(value.updatedAt) || Date.now(),
    items
  };
};

const readPacks = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizePack).filter(Boolean).slice(0, MAX_PACKS);
  } catch {
    return [];
  }
};

const writePacks = (packs) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(packs.slice(0, MAX_PACKS)));
    return true;
  } catch {
    return false;
  }
};

const emitChange = (packs) => {
  document.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { packs } }));
};

const createId = () => {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `pack-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const saveItems = ({ items, targetId = 'new', name = '' }) => {
  const normalizedItems = (Array.isArray(items) ? items : []).map(normalizeItem).filter(Boolean);
  if (!normalizedItems.length) return { ok: false, message: 'Select at least one emoji.' };

  const packs = readPacks();
  const now = Date.now();

  if (targetId && targetId !== 'new') {
    const pack = packs.find((item) => item.id === targetId);
    if (!pack) return { ok: false, message: 'That pack no longer exists.' };
    const merged = new Map(pack.items.map((item) => [item.slug, item]));
    for (const item of normalizedItems) merged.set(item.slug, item);
    pack.items = [...merged.values()].slice(0, MAX_ITEMS);
    pack.updatedAt = now;
    if (!writePacks(packs)) return { ok: false, message: 'Could not save this pack in local storage.' };
    emitChange(packs);
    return { ok: true, pack, message: `Added to ${pack.name}.` };
  }

  const packName = text(name);
  if (!packName) return { ok: false, message: 'Enter a pack name.' };
  if (packs.length >= MAX_PACKS) return { ok: false, message: `Pack limit reached (${MAX_PACKS}).` };

  const pack = {
    id: createId(),
    name: packName.slice(0, 60),
    createdAt: now,
    updatedAt: now,
    items: normalizedItems.slice(0, MAX_ITEMS)
  };
  packs.unshift(pack);
  if (!writePacks(packs)) return { ok: false, message: 'Could not save this pack in local storage.' };
  emitChange(packs);
  return { ok: true, pack, message: `Created ${pack.name}.` };
};

const deletePack = (packId) => {
  const packs = readPacks().filter((pack) => pack.id !== packId);
  if (!writePacks(packs)) return false;
  emitChange(packs);
  return true;
};

const removeItems = (packId, slugs) => {
  const remove = new Set(Array.isArray(slugs) ? slugs.map(text).filter(Boolean) : []);
  const packs = readPacks();
  const pack = packs.find((item) => item.id === packId);
  if (!pack || !remove.size) return false;
  pack.items = pack.items.filter((item) => !remove.has(item.slug));
  pack.updatedAt = Date.now();
  if (!writePacks(packs)) return false;
  emitChange(packs);
  return true;
};

const dialog = document.querySelector('#emoji-pack-dialog');
const form = dialog?.querySelector('[data-pack-dialog-form]');
const target = dialog?.querySelector('[data-pack-target]');
const nameField = dialog?.querySelector('[data-pack-name-field]');
const nameInput = dialog?.querySelector('[data-pack-name]');
const countNode = dialog?.querySelector('[data-pack-dialog-count]');
const statusNode = dialog?.querySelector('[data-pack-dialog-status]');
const closeButton = dialog?.querySelector('[data-pack-dialog-close]');
const cancelButton = dialog?.querySelector('[data-pack-dialog-cancel]');
let pendingItems = [];

const populateTargets = () => {
  if (!(target instanceof HTMLSelectElement)) return;
  const current = target.value;
  target.replaceChildren();
  const fresh = document.createElement('option');
  fresh.value = 'new';
  fresh.textContent = 'Create a new pack';
  target.append(fresh);
  for (const pack of readPacks()) {
    const option = document.createElement('option');
    option.value = pack.id;
    option.textContent = `${pack.name} (${pack.items.length})`;
    target.append(option);
  }
  target.value = [...target.options].some((option) => option.value === current) ? current : 'new';
};

const syncNameField = () => {
  if (!(target instanceof HTMLSelectElement) || !(nameField instanceof HTMLElement)) return;
  const isNew = target.value === 'new';
  nameField.hidden = !isNew;
  if (isNew && nameInput instanceof HTMLInputElement) queueMicrotask(() => nameInput.focus());
};

document.addEventListener(SAVE_REQUEST_EVENT, (event) => {
  const items = event.detail?.items;
  pendingItems = (Array.isArray(items) ? items : []).map(normalizeItem).filter(Boolean);
  if (!pendingItems.length || !(dialog instanceof HTMLDialogElement)) return;
  populateTargets();
  if (target instanceof HTMLSelectElement) target.value = 'new';
  if (nameInput instanceof HTMLInputElement) nameInput.value = '';
  if (countNode) countNode.textContent = `${pendingItems.length} emoji selected`;
  if (statusNode) statusNode.textContent = '';
  syncNameField();
  dialog.showModal();
});

target?.addEventListener('change', syncNameField);

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  const result = saveItems({
    items: pendingItems,
    targetId: target instanceof HTMLSelectElement ? target.value : 'new',
    name: nameInput instanceof HTMLInputElement ? nameInput.value : ''
  });
  if (!result.ok) {
    if (statusNode) statusNode.textContent = result.message;
    return;
  }
  if (statusNode) statusNode.textContent = result.message;
  window.setTimeout(() => {
    if (dialog instanceof HTMLDialogElement) dialog.close();
  }, 320);
});

const closeDialog = () => {
  if (dialog instanceof HTMLDialogElement) dialog.close();
};
closeButton?.addEventListener('click', closeDialog);
cancelButton?.addEventListener('click', closeDialog);
dialog?.addEventListener('click', (event) => {
  if (event.target === dialog) closeDialog();
});

window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  emitChange(readPacks());
});

window.eplusEmojiPacks = {
  read: readPacks,
  saveItems,
  delete: deletePack,
  removeItems,
  storageKey: STORAGE_KEY
};

// Let pages that subscribe after initial HTML parsing refresh from the
// authoritative localStorage state as soon as the pack module is ready.
queueMicrotask(() => emitChange(readPacks()));
