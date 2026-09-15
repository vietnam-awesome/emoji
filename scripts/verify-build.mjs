import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const dist = path.resolve('dist');
const dataFile = path.resolve('src/data/emojis.json');
// The site is deployed on the custom domain https://emoji.eplus.dev with Astro base '/'.
// Do not infer '/emoji' merely because the build runs inside GitHub Actions.
const base = (process.env.VERIFY_BASE ?? '').replace(/\/+$/g, '');
const detailLimitEnv = Number.parseInt(process.env.VERIFY_DETAIL_LIMIT ?? '500', 10);
const detailLimit = Number.isFinite(detailLimitEnv) ? detailLimitEnv : 500;
const verifyAllDetails = detailLimit <= 0;
const fastVerify = process.env.VERIFY_FAST === '1';
let errors = 0;
let checked = 0;

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function sampleRecords(records, limit) {
  if (limit <= 0 || records.length <= limit) return records;
  if (limit === 1) return [records[0]];

  const sampled = [];
  const seen = new Set();
  for (let index = 0; index < limit; index += 1) {
    const recordIndex = Math.round((index * (records.length - 1)) / (limit - 1));
    if (seen.has(recordIndex)) continue;
    seen.add(recordIndex);
    sampled.push(records[recordIndex]);
  }
  return sampled;
}

async function findHtmlFiles(root) {
  const pending = [root];
  const htmlFiles = [];

  while (pending.length) {
    const dir = pending.pop();
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Detail pages all use the same template. Avoid reading ~197k HTML files on
        // every routine verification; representative detail files are added below.
        if (!verifyAllDetails && dir === root && entry.name === 'emoji') continue;
        pending.push(full);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.html')) htmlFiles.push(full);
    }
  }

  if (!verifyAllDetails) {
    try {
      const records = JSON.parse(await readFile(dataFile, 'utf8'));
      if (!Array.isArray(records)) throw new Error('catalog is not an array');

      for (const record of sampleRecords(records, detailLimit)) {
        const slug = String(record?.slug || '');
        if (!slug) continue;
        const candidates = [
          path.join(root, 'emoji', slug, 'index.html'),
          path.join(root, 'emoji', `${slug}.html`)
        ];
        let found = '';
        for (const candidate of candidates) {
          if (await exists(candidate)) {
            found = candidate;
            break;
          }
        }
        if (found) htmlFiles.push(found);
        else {
          console.error(`[missing sampled detail] /emoji/${slug}`);
          errors += 1;
        }
      }
    } catch (error) {
      console.error(`[verify] could not load detail sample: ${error instanceof Error ? error.message : error}`);
      errors += 1;
    }
  }

  return [...new Set(htmlFiles)];
}

function cleanUrl(value) {
  return value.split('#')[0].split('?')[0];
}

function isExternal(value) {
  return /^(?:[a-z]+:)?\/\//i.test(value) || /^(?:mailto:|tel:|data:|javascript:|#)/i.test(value);
}

const htmlFiles = await findHtmlFiles(dist);

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const attrs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);

  for (const raw of attrs) {
    if (!raw || isExternal(raw)) continue;
    const url = cleanUrl(raw);
    if (!url.startsWith('/')) continue;
    checked += 1;

    if (base && url !== base && !url.startsWith(`${base}/`)) {
      console.error(`[bad base] ${path.relative(dist, file)} -> ${url}`);
      errors += 1;
      continue;
    }

    let relative = base && url.startsWith(base) ? url.slice(base.length) : url;
    relative = relative.replace(/^\//, '');

    if (!relative) {
      if (!await exists(path.join(dist, 'index.html'))) {
        console.error(`[missing target] ${url}`);
        errors += 1;
      }
      continue;
    }

    const direct = path.join(dist, relative);
    const routeIndex = path.join(dist, relative, 'index.html');
    const routeHtml = path.join(dist, `${relative}.html`);

    if (!await exists(direct) && !await exists(routeIndex) && !await exists(routeHtml)) {
      // Fast CI intentionally builds only a representative detail sample.
      if (fastVerify && url.startsWith('/emoji/')) continue;
      console.error(`[missing target] ${path.relative(dist, file)} -> ${url}`);
      errors += 1;
    }
  }
}

if (errors) {
  console.error(`\nBuild verification failed with ${errors} broken internal URL(s).`);
  process.exit(1);
}

const detailMode = verifyAllDetails ? 'all detail pages' : `${detailLimit} sampled detail pages`;
console.log(`Verified ${checked} internal URLs across ${htmlFiles.length} HTML pages (${detailMode}).`);
