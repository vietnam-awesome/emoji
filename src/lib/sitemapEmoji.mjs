// Sitemap priority tiers for emoji detail URLs.
//
// The catalog has no popularity signal (no view/download counts and no
// featured flag), so priority is tiered by record type instead:
// - 0.7 — standard Unicode emoji from the curated libraries (Twemoji,
//   OpenMoji, Noto). These records are identified by a non-empty `hexcode`,
//   the Unicode codepoint field only curated sets carry.
// - 0.4 — community long-tail bulk imports (Discords.com, Emoji.gg,
//   Slackmojis, …), which have no hexcode and make up the overwhelming
//   majority of the catalog. A flat 0.7 for all ~214k URLs told crawlers
//   every page mattered equally and wasted crawl budget on the long tail.
//
// Emoji URLs intentionally carry no <lastmod>: the catalog has no genuine
// page-update date. `addedAt` is the upstream emoji's creation/catalog-add
// date (some date back to 2018) and `syncedAt` is the import pipeline's
// sync timestamp, so emitting either would mislead crawlers about when the
// page itself last changed.

export function emojiSitemapPriority(emoji) {
  return String(emoji?.hexcode || '').trim() ? '0.7' : '0.4';
}
