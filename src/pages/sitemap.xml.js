import { getEmojiCount } from '../lib/catalog-db.mjs';

const SITE = 'https://emoji.eplus.dev';
const SITEMAP_PAGE_SIZE = 50000;

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function sitemapEntry(loc) {
  return [
    '  <sitemap>',
    `    <loc>${escapeXml(loc)}</loc>`,
    '  </sitemap>'
  ].join('\n');
}

export async function GET() {
  const total = await getEmojiCount();
  const emojiSitemaps = Math.max(1, Math.ceil(total / SITEMAP_PAGE_SIZE));
  const entries = [
    `${SITE}/sitemap-static.xml`,
    ...Array.from({ length: emojiSitemaps }, (_, index) => `${SITE}/sitemaps/emoji-${index + 1}.xml`)
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(sitemapEntry),
    '</sitemapindex>',
    ''
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600'
    }
  });
}
