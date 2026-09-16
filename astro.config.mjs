import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

const previewBase = process.env.PR_PREVIEW_BASE;
const previewSite = process.env.PR_PREVIEW_SITE;
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

function normalizeBase(value) {
  if (!value) return '/';
  const clean = String(value).replace(/^\/+|\/+$/g, '');
  return clean ? `/${clean}/` : '/';
}

export default defineConfig({
  site: previewSite || (isGitHubActions ? 'https://emoji.eplus.dev' : 'http://localhost:4321'),
  base: normalizeBase(previewBase),
  trailingSlash: previewBase ? 'always' : 'never',
  output: 'static',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()]
  }
});
