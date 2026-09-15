import { getEmojiSitemapPage } from '../../lib/catalog-db.mjs';

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

function urlEntry(row) {
  const lastmod = dateOnly(row.lastmod);
  return [
    '  <url>',
    `    <loc>${escapeXml(`${SITE}/emoji/${encodeURIComponent(String(row.slug))}`)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : '',
    '    <changefreq>monthly</changefreq>',
    '    <priority>0.7</priority>',
    '  </url>'
  ].filter(Boolean).join('\n');
}

export async function GET({ params }) {
  const page = Number.parseInt(String(params.page || ''), 10);
  if (!Number.isFinite(page) || page < 1) {
    return new Response('Not found', { status: 404 });
  }

  const rows = await getEmojiSitemapPage(page, PAGE_SIZE);
  if (!rows.length) return new Response('Not found', { status: 404 });

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...rows.map(urlEntry),
    '</urlset>',
    ''
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600'
    }
  });
}
