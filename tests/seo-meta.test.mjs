import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const layout = await readFile(new URL('../src/layouts/Layout.astro', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../public/site.webmanifest', import.meta.url), 'utf8'));

function pngDimensions(buffer) {
  assert.equal(buffer.toString('ascii', 1, 4), 'PNG');
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

test('head exposes crawler-compatible favicon variants', async () => {
  assert.match(layout, /rel="icon" href=\{faviconIcoUrl\} sizes="any"/);
  assert.match(layout, /rel="icon" type="image\/png" sizes="48x48" href=\{faviconPngUrl\}/);
  assert.match(layout, /rel="apple-touch-icon" sizes="180x180"/);
  assert.match(layout, /rel="manifest" href=\{manifestUrl\}/);

  const icon48 = await readFile(new URL('../public/favicon-48x48.png', import.meta.url));
  assert.deepEqual(pngDimensions(icon48), { width: 48, height: 48 });

  const apple = await readFile(new URL('../public/apple-touch-icon.png', import.meta.url));
  assert.deepEqual(pngDimensions(apple), { width: 180, height: 180 });

  const ico = await readFile(new URL('../public/favicon.ico', import.meta.url));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
});

test('manifest provides installable high-resolution icons', () => {
  assert.equal(manifest.name, 'ePlus Emoji');
  assert.ok(manifest.icons.some((icon) => icon.src === '/android-chrome-192x192.png' && icon.sizes === '192x192'));
  assert.ok(manifest.icons.some((icon) => icon.src === '/android-chrome-512x512.png' && icon.sizes === '512x512'));
});

test('head includes keywords, publisher, Open Graph and Twitter cards', async () => {
  assert.match(layout, /<meta name="keywords" content=\{keywordsText\}/);
  assert.match(layout, /<meta name="publisher" content=\{publisherName\}/);
  assert.match(layout, /'@type': 'Organization'/);
  assert.match(layout, /publisher: \{ '@id': publisherId \}/);
  assert.match(layout, /property="og:site_name" content="ePlus Emoji"/);
  assert.match(layout, /property="og:image" content=\{absoluteSocialImageUrl\}/);
  assert.match(layout, /const defaultSocialImageWidth = 1731;/);
  assert.match(layout, /const defaultSocialImageHeight = 909;/);
  assert.match(layout, /property="og:image:width" content=\{String\(defaultSocialImageWidth\)\}/);
  assert.match(layout, /property="og:image:height" content=\{String\(defaultSocialImageHeight\)\}/);
  assert.match(layout, /name="twitter:card" content="summary_large_image"/);
  assert.match(layout, /name="twitter:image" content=\{absoluteSocialImageUrl\}/);

  const ogImage = await readFile(new URL('../public/og-default.png', import.meta.url));
  assert.deepEqual(pngDimensions(ogImage), { width: 1731, height: 909 });
});
