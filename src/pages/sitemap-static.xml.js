import categories from '../data/categories.json';

const SITE = 'https://emoji.eplus.dev';

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function urlEntry({ loc, changefreq = '', priority = '' }) {
  return [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : '',
    priority ? `    <priority>${priority}</priority>` : '',
    '  </url>'
  ].filter(Boolean).join('\n');
}

export function GET() {
  const entries = [
    { loc: `${SITE}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${SITE}/emojis`, changefreq: 'daily', priority: '0.9' },
    { loc: `${SITE}/categories`, changefreq: 'weekly', priority: '0.8' },
    { loc: `${SITE}/kitchen`, changefreq: 'monthly', priority: '0.8' },
    { loc: `${SITE}/editor`, changefreq: 'monthly', priority: '0.8' },
    { loc: `${SITE}/cutter`, changefreq: 'monthly', priority: '0.8' },
    ...categories.map((category) => ({
      loc: `${SITE}/categories/${category.slug}`,
      changefreq: 'weekly',
      priority: '0.7'
    })),
    { loc: `${SITE}/llms.txt`, changefreq: 'weekly', priority: '0.4' },
    { loc: `${SITE}/agents.md`, changefreq: 'weekly', priority: '0.4' }
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/sitemap/0.9">',
    ...entries.map(urlEntry),
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
