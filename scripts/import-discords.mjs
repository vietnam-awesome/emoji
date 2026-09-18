import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateImageAsset } from './lib/emojigg-asset.mjs';
import { isSensitiveText } from './lib/content-safety.mjs';
import {
  discordEmojiAssetInfo,
  discordsTagInfo,
  discordsTagUrl
} from './lib/discords.mjs';

const args = process.argv.slice(2);
const valueFor = (name, fallback) => {
  const pair = args.find((arg) => arg.startsWith(`--${name}=`));
  if (pair) return pair.slice(name.length + 3);
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const tag = String(valueFor('tag', 'all')).trim();
const rawLimit = Number.parseInt(valueFor('limit', '200'), 10);
const limit = Number.isFinite(rawLimit) ? Math.max(0, rawLimit) : 200;
const concurrency = Math.max(1, Math.min(8, Number.parseInt(valueFor('concurrency', '4'), 10) || 4));
const rawStartBatch = Number.parseInt(valueFor('start-batch', '1'), 10);
const startBatch = Number.isFinite(rawStartBatch) ? Math.max(1, rawStartBatch) : 1;
// Kept as --max-pages for workflow compatibility. It now means the number of
// rendered batches to scan, starting at --start-batch.
const maxPages = Math.max(1, Math.min(1000, Number.parseInt(valueFor('max-pages', '25'), 10) || 25));
const endBatch = startBatch + maxPages - 1;
const delayMs = Math.max(0, Math.min(5000, Number.parseInt(valueFor('delay-ms', '300'), 10) || 0));
const maxBytes = 8 * 1024 * 1024;

const SOURCE = {
  id: 'discords',
  label: 'Discords.com',
  home: 'https://discords.com/emoji-list'
};

const DATA_FILE = path.resolve('src/data/emojis.json');
const API_FILE = path.resolve('public/api/emojis.json');
const STATE_FILE = path.resolve('src/data/community-sync-state.json');
const OUT_ROOT = path.resolve('public/emojis/community', SOURCE.id);

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function titleize(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isAdultText(...values) {
  return isSensitiveText(...values);
}

function isAdultRecord(item) {
  if (!item || item.source !== SOURCE.id) return false;
  return isAdultText(
    item.name,
    item.slug,
    item.shortcode,
    item.category,
    item.categorySlug,
    item.group,
    item.subgroup,
    item.tags || []
  );
}

function hashBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function purgeAdultAssets(items) {
  let removed = 0;
  for (const item of items) {
    if (!String(item.image || '').startsWith(`/emojis/community/${SOURCE.id}/`)) continue;
    const file = path.resolve('public', String(item.image).replace(/^\/+/, ''));
    try {
      await unlink(file);
      removed += 1;
    } catch (error) {
      if (error?.code !== 'ENOENT') console.warn(`[${SOURCE.label}] could not remove adult asset ${file}: ${error.message}`);
    }
  }
  return removed;
}

async function discoverTagUrls(page) {
  await page.goto(SOURCE.home, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
  if (delayMs) await page.waitForTimeout(delayMs);

  const hrefs = await page.locator('a[href*="/emoji-list/tag/"]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('href')).filter(Boolean)
  );

  const tags = new Map();
  let adultCategoriesSkipped = 0;
  for (const href of hrefs) {
    const info = discordsTagInfo(href);
    if (!info) continue;
    if (isAdultText(info.slug, info.name)) {
      adultCategoriesSkipped += 1;
      continue;
    }
    tags.set(info.slug.toLowerCase(), info);
  }

  let discovered = [...tags.values()].sort((a, b) => a.name.localeCompare(b.name));

  if (discovered.length === 0) {
    const savedCategories = state?.[SOURCE.id]?.categories || {};
    const fallback = new Map();

    for (const [savedSlug, saved] of Object.entries(savedCategories)) {
      const name = String(saved?.name || titleize(savedSlug)).trim();
      const slug = slugify(savedSlug || name);
      if (!slug || isAdultText(slug, name)) {
        if (slug) adultCategoriesSkipped += 1;
        continue;
      }

      const info = discordsTagInfo(saved?.url || discordsTagUrl(name)) || {
        slug,
        name,
        url: discordsTagUrl(name)
      };
      fallback.set(info.slug.toLowerCase(), info);
    }

    discovered = [...fallback.values()].sort((a, b) => a.name.localeCompare(b.name));
    if (discovered.length > 0) {
      console.warn(
        `[${SOURCE.label}] live category links were not exposed by ${SOURCE.home}; ` +
        `reusing ${discovered.length} safe categories from the previous sync state`
      );
    }
  }

  console.log(
    `[${SOURCE.label}] discovered ${discovered.length} safe categories from ${SOURCE.home}` +
    (adultCategoriesSkipped ? `; skipped ${adultCategoriesSkipped} adult categories` : '')
  );
  return discovered;
}

async function resolveTargets(page) {
  const normalized = slugify(tag);
  if (isAdultText(tag)) throw new Error(`Discords.com category "${tag}" is blocked by the 18+ filter.`);

  if (!normalized || normalized === 'home' || normalized === 'trending') {
    return [{ slug: 'home', name: 'Trending', url: SOURCE.home }];
  }

  const categories = await discoverTagUrls(page);
  if (normalized === 'all') return categories;

  const exact = categories.find((item) =>
    item.slug.toLowerCase() === normalized || slugify(item.name) === normalized
  );
  if (exact) return [exact];

  // Friendly fallback for inputs such as "cat" when the real upstream category is "Blob Cats".
  const partial = categories.filter((item) =>
    item.slug.toLowerCase().includes(normalized) || slugify(item.name).includes(normalized)
  );
  if (partial.length === 1) {
    console.log(`[${SOURCE.label}] resolved category "${tag}" -> "${partial[0].name}" (${partial[0].slug})`);
    return partial;
  }

  // If Discords stops exposing its category navigation, retain the old direct-tag behavior
  // for safe single-category imports.
  if (categories.length === 0) {
    const info = discordsTagInfo(discordsTagUrl(tag));
    const target = info || { slug: normalized, name: titleize(tag), url: discordsTagUrl(tag) };
    if (isAdultText(target.slug, target.name)) throw new Error(`Discords.com category "${tag}" is blocked by the 18+ filter.`);
    return [target];
  }

  const suggestions = partial.slice(0, 8).map((item) => item.name).join(', ');
  throw new Error(
    `Discords.com category "${tag}" was not found.` +
    (suggestions ? ` Possible matches: ${suggestions}.` : ' Use --tag=all to import all discovered categories.')
  );
}

async function collectRenderedImages(page, target, found, renderedSeen, collect) {
  const images = await page.locator('img').evaluateAll((nodes) => nodes.map((node) => ({
    src: node.getAttribute('src') || node.getAttribute('data-src') || node.getAttribute('data-lazy-src') || '',
    alt: node.getAttribute('alt') || '',
    title: node.getAttribute('title') || ''
  })));

  let added = 0;
  let adultFiltered = 0;
  for (const image of images) {
    const info = discordEmojiAssetInfo(image.src, image.alt || image.title, target.url);
    if (!info || renderedSeen.has(info.id)) continue;
    renderedSeen.add(info.id);

    if (isAdultText(target.slug, target.name, info.name)) {
      adultFiltered += 1;
      continue;
    }
    if (!collect || found.has(info.id)) continue;

    found.set(info.id, { ...info, tag: target.slug, tagName: target.name });
    added += 1;
  }
  return { added, adultFiltered };
}

async function renderedEmojiCount(page) {
  return page.locator([
    'img[src*="cdn.discordapp.com/emojis/"]',
    'img[src*="media.discordapp.net/emojis/"]',
    'img[data-src*="cdn.discordapp.com/emojis/"]',
    'img[data-src*="media.discordapp.net/emojis/"]',
    'img[data-lazy-src*="cdn.discordapp.com/emojis/"]',
    'img[data-lazy-src*="media.discordapp.net/emojis/"]'
  ].join(', ')).count();
}

async function visibleLoadMoreButton(page) {
  const candidates = page.getByRole('button', { name: /load more/i });
  const count = await candidates.count();
  for (let index = count - 1; index >= 0; index -= 1) {
    const candidate = candidates.nth(index);
    if (await candidate.isVisible().catch(() => false)) return candidate;
  }

  // Fallback for markup where the accessible name is unavailable.
  const fallback = page.locator('button').filter({ hasText: /load more/i });
  const fallbackCount = await fallback.count();
  for (let index = fallbackCount - 1; index >= 0; index -= 1) {
    const candidate = fallback.nth(index);
    if (await candidate.isVisible().catch(() => false)) return candidate;
  }
  return null;
}

async function discoverImages(page, target, remainingLimit, ignoreDiscoveryLimit = false) {
  const found = new Map();
  const renderedSeen = new Set();
  let stalledClicks = 0;
  let adultFiltered = 0;
  let lastBatch = 0;
  let complete = false;

  await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (delayMs) await page.waitForTimeout(delayMs);

  for (let batchNumber = 1; batchNumber <= endBatch; batchNumber += 1) {
    lastBatch = batchNumber;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    if (delayMs) await page.waitForTimeout(delayMs);

    const collecting = batchNumber >= startBatch;
    const batch = await collectRenderedImages(page, target, found, renderedSeen, collecting);
    adultFiltered += batch.adultFiltered;

    if (collecting) {
      console.log(
        `[${SOURCE.label}/${target.slug}] batch ${batchNumber}: +${batch.added}, ` +
        `selected-range total ${found.size}, adult-filtered ${adultFiltered}`
      );
    } else if (batchNumber === 1 || batchNumber % 10 === 0 || batchNumber === startBatch - 1) {
      console.log(`[${SOURCE.label}/${target.slug}] fast-forward batch ${batchNumber}/${startBatch - 1}`);
    }

    if (collecting && !ignoreDiscoveryLimit && remainingLimit > 0 && found.size >= remainingLimit) break;
    if (batchNumber >= endBatch) break;

    const loadMore = await visibleLoadMoreButton(page);
    if (!loadMore) {
      complete = true;
      console.log(`[${SOURCE.label}/${target.slug}] Load more not found; category complete at batch ${batchNumber}`);
      break;
    }

    const beforeCount = await renderedEmojiCount(page);
    await loadMore.scrollIntoViewIfNeeded().catch(() => {});
    await loadMore.click({ timeout: 10000 });

    const grew = await page.waitForFunction(
      (before) => {
        const selector = [
          'img[src*="cdn.discordapp.com/emojis/"]',
          'img[src*="media.discordapp.net/emojis/"]',
          'img[data-src*="cdn.discordapp.com/emojis/"]',
          'img[data-src*="media.discordapp.net/emojis/"]',
          'img[data-lazy-src*="cdn.discordapp.com/emojis/"]',
          'img[data-lazy-src*="media.discordapp.net/emojis/"]'
        ].join(', ');
        return document.querySelectorAll(selector).length > before;
      },
      beforeCount,
      { timeout: 10000 }
    ).then(() => true).catch(() => false);

    if (!grew) {
      const afterCount = await renderedEmojiCount(page);
      stalledClicks = afterCount > beforeCount ? 0 : stalledClicks + 1;
      if (stalledClicks >= 2) {
        complete = true;
        console.log(`[${SOURCE.label}/${target.slug}] Load more stopped adding emoji; stopping at batch ${batchNumber}`);
        break;
      }
    } else {
      stalledClicks = 0;
    }
  }

  return {
    items: [...found.values()],
    adultFiltered,
    lastBatch,
    complete,
    nextBatch: complete ? null : lastBatch + 1
  };
}

async function downloadAsset(context, item) {
  const response = await context.request.get(item.assetUrl, {
    headers: {
      Referer: item.pageUrl,
      'User-Agent': 'Mozilla/5.0 VietnamAwesomeEmojiBot/1.0'
    },
    timeout: 60000
  });
  if (!response.ok()) throw new Error(`HTTP ${response.status()}`);

  const buffer = await response.body();
  if (!buffer.length || buffer.length > maxBytes) throw new Error(`size ${buffer.length} is invalid`);
  const contentType = response.headers()['content-type'] || '';
  const detected = validateImageAsset(buffer, contentType, item.assetUrl);

  await mkdir(OUT_ROOT, { recursive: true });
  const filename = `${item.id}${detected.ext}`;
  await writeFile(path.join(OUT_ROOT, filename), buffer);

  return {
    ...detected,
    hash: hashBuffer(buffer),
    image: `/emojis/community/${SOURCE.id}/${filename}`
  };
}

async function runPool(items, worker, size) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(size, Math.max(1, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

const rawExisting = await readJson(DATA_FILE, []);
const adultExisting = rawExisting.filter(isAdultRecord);
const purgedAdultAssets = await purgeAdultAssets(adultExisting);
const existing = rawExisting.filter((emoji) => !isAdultRecord(emoji));
if (adultExisting.length) {
  console.log(
    `[${SOURCE.label}] purged ${adultExisting.length} existing 18+ records and ${purgedAdultAssets} local assets`
  );
}

const byId = new Map(existing.map((emoji) => [emoji.id, emoji]));
const byHash = new Map(existing.filter((emoji) => emoji.assetSha256).map((emoji) => [emoji.assetSha256, emoji.id]));
const state = await readJson(STATE_FILE, {});

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
let discovered = [];
let imported = 0;
let failed = 0;
let adultFilteredThisRun = 0;
const categoryStats = {};

try {
  const page = await context.newPage();
  try {
    const targets = await resolveTargets(page);
    if (targets.length === 0) throw new Error('No safe Discords.com categories were discovered.');

    const seen = new Map();
    const allCategories = slugify(tag) === 'all';

    for (const target of targets) {
      // For --tag=all, discover every category in the selected batch range before
      // applying the import limit. Otherwise a global limit can trap the crawler
      // on the first category.
      const remaining = allCategories || limit === 0 ? 0 : Math.max(0, limit - seen.size);
      if (!allCategories && limit > 0 && remaining === 0) break;

      const result = await discoverImages(page, target, remaining, allCategories);
      adultFilteredThisRun += result.adultFiltered;
      categoryStats[target.slug] = {
        name: target.name,
        url: target.url,
        discovered: result.items.length,
        startBatch,
        batchesRequested: maxPages,
        lastBatchReached: result.lastBatch,
        nextBatch: result.nextBatch,
        complete: result.complete,
        adultFiltered: result.adultFiltered,
        lastRunAt: new Date().toISOString()
      };

      for (const item of result.items) if (!seen.has(item.id)) seen.set(item.id, item);
    }
    discovered = [...seen.values()];
  } finally {
    await page.close();
  }

  const missing = discovered.filter((item) => !byId.has(`discords-${item.id}`));
  const chosen = limit === 0 ? missing : missing.slice(0, limit);
  console.log(
    `[${SOURCE.label}] range=${startBatch}-${endBatch}, discovered=${discovered.length}, ` +
    `adult-filtered=${adultFilteredThisRun}, missing=${missing.length}, selected=${chosen.length}`
  );

  await runPool(chosen, async (item, index) => {
    try {
      if (isAdultText(item.tag, item.tagName, item.name)) {
        adultFilteredThisRun += 1;
        console.warn(`[${SOURCE.label}] skipped adult emoji before download: ${item.name}`);
        return;
      }

      const asset = await downloadAsset(context, item);
      const now = new Date().toISOString();
      const id = `discords-${item.id}`;
      const current = byId.get(id);
      const duplicateId = byHash.get(asset.hash);
      const short = slugify(item.name) || `emoji-${item.id}`;

      const record = {
        id,
        slug: `discords-${short}-${item.id}`,
        name: item.name || `Discord Emoji ${item.id}`,
        shortcode: short.replaceAll('-', '_'),
        group: 'community',
        subgroup: item.tag === 'home' ? 'discords' : `discords-${slugify(item.tag)}`,
        category: item.tagName || titleize(item.tag),
        categorySlug: slugify(item.tagName || item.tag),
        tags: [...new Set(['discords', 'discord', 'custom-emoji', item.tag, asset.animated ? 'animated' : 'static'].filter(Boolean))],
        source: SOURCE.id,
        sourceLabel: SOURCE.label,
        sourceUrl: item.pageUrl,
        upstreamAssetUrl: item.assetUrl,
        image: asset.image,
        format: asset.format,
        animated: asset.animated,
        license: 'Source terms / rights vary',
        attribution: 'Discords.com / Discord CDN / original server contributor',
        addedAt: current?.addedAt || now.slice(0, 10),
        syncedAt: now,
        assetSha256: asset.hash,
        duplicateAsset: Boolean(duplicateId && duplicateId !== id)
      };

      byId.set(id, record);
      if (!byHash.has(asset.hash)) byHash.set(asset.hash, id);
      imported += 1;
      console.log(`[${SOURCE.label}] ${index + 1}/${chosen.length} imported ${record.shortcode}`);
    } catch (error) {
      failed += 1;
      console.warn(`[${SOURCE.label}] ${item.assetUrl} skipped: ${error.message}`);
    }
  }, concurrency);

  state[SOURCE.id] = {
    tag,
    startBatch,
    batchesRequested: maxPages,
    endBatch,
    categories: categoryStats,
    discovered: discovered.length,
    adultFilteredThisRun,
    purgedAdultRecords: adultExisting.length,
    purgedAdultAssets,
    missingBeforeRun: missing.length,
    attemptedThisRun: chosen.length,
    importedThisRun: imported,
    failedThisRun: failed,
    lastRunAt: new Date().toISOString()
  };

  const all = [...byId.values()].sort((a, b) => {
    const date = String(b.syncedAt || b.addedAt || '').localeCompare(String(a.syncedAt || a.addedAt || ''));
    return date || String(a.name || '').localeCompare(String(b.name || ''));
  });

  await writeJson(DATA_FILE, all);
  await writeJson(API_FILE, all);
  await writeJson(STATE_FILE, state);
  console.log(
    `[${SOURCE.label}] done. imported=${imported}, failed=${failed}, ` +
    `adult-filtered=${adultFilteredThisRun}, purged-adult=${adultExisting.length}, total=${all.length}`
  );
} finally {
  await context.close();
  await browser.close();
}
