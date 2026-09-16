import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dist = path.resolve('dist');
const base = String(process.env.PR_PREVIEW_BASE || process.argv[2] || '/')
  .replace(/^\/+|\/+$/g, '');
const publicBase = base ? `/${base}/` : '/';
const previewRoot = publicBase.replace(/\/$/, '');

async function collectHtmlFiles(root) {
  const files = [];
  const pending = [root];

  while (pending.length) {
    const dir = pending.pop();
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        pending.push(full);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.html')) {
        files.push(full);
      }
    }
  }

  return files;
}

const htmlFiles = await collectHtmlFiles(dist);
const routeMap = new Map();

for (const file of htmlFiles) {
  const relative = path.relative(dist, file).split(path.sep).join('/');
  if (relative === 'index.html') {
    routeMap.set(publicBase, `${publicBase}index.html`);
    routeMap.set(publicBase.replace(/\/$/, ''), `${publicBase}index.html`);
    continue;
  }

  if (!relative.endsWith('/index.html')) continue;
  const route = relative.slice(0, -'/index.html'.length);
  routeMap.set(`${publicBase}${route}`, `${publicBase}${route}/index.html`);
  routeMap.set(`${publicBase}${route}/`, `${publicBase}${route}/index.html`);
}

function rewriteUrl(value) {
  if (!value.startsWith('/')) return value;

  const splitAt = value.search(/[?#]/);
  const pathname = splitAt === -1 ? value : value.slice(0, splitAt);
  const suffix = splitAt === -1 ? '' : value.slice(splitAt);
  const mapped = routeMap.get(pathname);
  return mapped ? `${mapped}${suffix}` : value;
}

const runtimeRouter = previewRoot
  ? `<script data-pr-preview-router>\n(() => {\n  const root = ${JSON.stringify(previewRoot)};\n  const mapUrl = (value) => {\n    const url = new URL(value, window.location.href);\n    if (url.origin !== window.location.origin) return null;\n    if (url.pathname !== root && !url.pathname.startsWith(root + '/')) return null;\n    const relative = url.pathname.slice(root.length);\n    if (!relative || relative === '/' || relative.endsWith('/index.html')) return null;\n    const last = relative.split('/').filter(Boolean).at(-1) || '';\n    if (/\\.[a-z0-9]{1,8}$/i.test(last)) return null;\n    url.pathname = url.pathname.replace(/\\/+$/, '') + '/index.html';\n    return url;\n  };\n\n  document.addEventListener('click', (event) => {\n    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;\n    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;\n    if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute('download') || anchor.target === '_blank') return;\n    const mapped = mapUrl(anchor.href);\n    if (!mapped) return;\n    event.preventDefault();\n    window.location.assign(mapped.href);\n  }, true);\n\n  document.addEventListener('submit', (event) => {\n    const form = event.target;\n    if (!(form instanceof HTMLFormElement)) return;\n    const mapped = mapUrl(form.action);\n    if (mapped) form.action = mapped.href;\n  }, true);\n})();\n</script>`
  : '';

let rewrites = 0;
let runtimeInjections = 0;
for (const file of htmlFiles) {
  const original = await readFile(file, 'utf8');
  let updated = original.replace(/\b(href|action)=(['"])(.*?)\2/g, (match, attr, quote, value) => {
    const next = rewriteUrl(value);
    if (next === value) return match;
    rewrites += 1;
    return `${attr}=${quote}${next}${quote}`;
  });

  if (runtimeRouter && !updated.includes('data-pr-preview-router')) {
    if (updated.includes('</body>')) updated = updated.replace('</body>', `${runtimeRouter}</body>`);
    else updated += runtimeRouter;
    runtimeInjections += 1;
  }

  if (updated !== original) await writeFile(file, updated);
}

console.log(
  `Prepared ${htmlFiles.length} HTML files for static PR preview; rewrote ${rewrites} route link(s); ` +
  `injected runtime routing into ${runtimeInjections} page(s).`
);
