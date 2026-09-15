import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

const previewBase = process.env.PR_PREVIEW_BASE;
const previewSite = process.env.PR_PREVIEW_SITE;

function normalizeBase(value) {
  if (!value) return '/';
  const clean = String(value).replace(/^\/+|\/+$/g, '');
  return clean ? `/${clean}/` : '/';
}

export default defineConfig({
  site: previewSite || 'https://emoji.eplus.dev',
  base: normalizeBase(previewBase),
  trailingSlash: previewBase ? 'always' : 'never',
  output: 'server',
  adapter: cloudflare({
    prerenderEnvironment: 'node'
  })
});
