import emojis from '../../data/emojis.json';

export const prerender = true;

const SITE = 'https://emoji.eplus.dev';
const PAGE_SIZE = 50000;

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function dateOnly(value) {
  const match = String(value || '').match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] || '';
}

function urlEntry(emoji) {
  const lastmod = dateOnly(emoji.syncedAt || emoji.addedAt);
  return [
    '  <url>',
    `    <loc>${escapeXml(`${SITE}/emoji/${encodeURIComponent(String(emoji.slug))}`)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : '',
    '    <changefreq>monthly</changefreq>',
    '    <priority>0.7</priority>',
    '  </url>'
  ].filter(Boolean).join('\n');
}

export function getStaticPaths() {
  const pages = Math.max(1, Math.ceil(emojis.length / PAGE_SIZE));
  return Array.from({ length: pages }, (_, index) => ({ params: { page: String(index + 1) } }));
}

export function GET({ params }) {
  const page = Number.parseInt(String(params.page || ''), 10);
  const start = (page - 1) * PAGE_SIZE;
  const rows = emojis.slice(start, start + PAGE_SIZE);
  if (!rows.length) return new Response('Not found', { status: 404 });

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...rows.map(urlEntry),
    '</urlset>',
    ''
  ].join('\n');

  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
