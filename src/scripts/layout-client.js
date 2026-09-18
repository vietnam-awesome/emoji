const normalizeEmojiLabel = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '');

const hideRedundantPair = (nameNode, shortcodeNode) => {
  if (!nameNode || !shortcodeNode) return;
  const name = normalizeEmojiLabel(nameNode.textContent);
  const shortcode = normalizeEmojiLabel(String(shortcodeNode.textContent || '').replace(/^:+|:+$/g, ''));
  if (name && shortcode && name === shortcode) {
    shortcodeNode.hidden = true;
    shortcodeNode.setAttribute('aria-hidden', 'true');
    if ('tabIndex' in shortcodeNode) shortcodeNode.tabIndex = -1;
  }
};

const polishEmojiMetadata = (root) => {
  const cardNodes = [];
  const homeCardNodes = [];
  const suggestionNodes = [];

  if (root instanceof Element) {
    if (root.matches('.emoji-card')) cardNodes.push(root);
    if (root.matches('.home-emoji-card')) homeCardNodes.push(root);
    if (root.matches('.home-search-item')) suggestionNodes.push(root);
  }

  if (root.querySelectorAll) {
    cardNodes.push(...root.querySelectorAll('.emoji-card'));
    homeCardNodes.push(...root.querySelectorAll('.home-emoji-card'));
    suggestionNodes.push(...root.querySelectorAll('.home-search-item'));
  }

  for (const card of cardNodes) {
    hideRedundantPair(card.querySelector('.emoji-name'), card.querySelector('.shortcode'));
  }
  for (const card of homeCardNodes) {
    hideRedundantPair(card.querySelector('.home-emoji-info strong'), card.querySelector('.home-emoji-info > span'));
  }
  for (const item of suggestionNodes) {
    hideRedundantPair(item.querySelector('.home-search-copy strong'), item.querySelector('.home-search-copy > span'));
  }
};

polishEmojiMetadata(document);

const metadataObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node instanceof Element) polishEmojiMetadata(node);
    }
  }
});
metadataObserver.observe(document.body, { childList: true, subtree: true });

document.addEventListener('keydown', (event) => {
  if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  const visibleSearch = document.querySelector(
    '[data-beui-visible-search], #home-emoji-search, #emoji-search:not(.beui-native-proxy), #category-search:not(.beui-native-proxy)'
  );
  if (visibleSearch instanceof HTMLInputElement) {
    event.preventDefault();
    visibleSearch.focus();
    visibleSearch.select();
    return;
  }

  const headerSearch = document.querySelector('[data-header-search-toggle]');
  if (headerSearch instanceof HTMLButtonElement) {
    event.preventDefault();
    headerSearch.click();
  }
});
