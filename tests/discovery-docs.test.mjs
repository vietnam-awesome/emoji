import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const repoAgents = await readFile(new URL('../AGENTS.md', import.meta.url), 'utf8');
const publicAgents = await readFile(new URL('../public/agents.md', import.meta.url), 'utf8');
const llms = await readFile(new URL('../public/llms.txt', import.meta.url), 'utf8');
const staticSitemap = await readFile(new URL('../src/pages/sitemap-static.xml.js', import.meta.url), 'utf8');

test('public editor stays synchronized across discovery surfaces', () => {
  assert.match(staticSitemap, /\$\{SITE\}\/editor/);
  assert.match(publicAgents, /https:\/\/emoji\.eplus\.dev\/editor/);
  assert.match(llms, /https:\/\/emoji\.eplus\.dev\/editor/);
});

test('agent instructions require public discovery docs to move together', () => {
  assert.match(repoAgents, /sitemap-static\.xml\.js/);
  assert.match(repoAgents, /public\/agents\.md/);
  assert.match(repoAgents, /public\/llms\.txt/);
  assert.match(repoAgents, /\/editor/);
});

test('agent discovery docs do not advertise removed legacy JSON APIs', () => {
  for (const contents of [publicAgents, llms]) {
    assert.doesNotMatch(contents, /https:\/\/emoji\.eplus\.dev\/api\/emojis\.json/);
    assert.doesNotMatch(contents, /https:\/\/emoji\.eplus\.dev\/api\/categories\.json/);
  }
});
