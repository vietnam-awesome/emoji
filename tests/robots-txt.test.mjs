import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const robots = await readFile(new URL('../public/robots.txt', import.meta.url), 'utf8');

test('robots allows public pages and points to the sitemap index', () => {
  assert.match(robots, /^User-agent:\s*\*$/m);
  assert.match(robots, /^Allow:\s*\/$/m);
  assert.match(robots, /^Sitemap:\s*https:\/\/emoji\.eplus\.dev\/sitemap\.xml$/m);
});

test('robots keeps generated client search shards out of crawler queues', () => {
  assert.match(robots, /^Disallow:\s*\/search\/$/m);
});
