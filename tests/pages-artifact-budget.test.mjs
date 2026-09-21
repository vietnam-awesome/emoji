import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(new URL('../.github/workflows/deploy-pages.yml', import.meta.url), 'utf8');

test('Pages deploy fails before upload at the 10 GiB hard limit', () => {
  assert.match(workflow, /hard_limit=\$\(\(10 \* 1024 \* 1024 \* 1024\)\)/);
  assert.match(workflow, /if \[ "\$bytes" -ge "\$hard_limit" \]/);
  assert.match(workflow, /Reduce generated HTML\/assets before upload/);
});

test('Pages deploy reports a size breakdown near the hard limit', () => {
  assert.match(workflow, /soft_limit=\$\(\(9 \* 1024 \* 1024 \* 1024\)\)/);
  assert.match(workflow, /Largest top-level output directories/);
  assert.match(workflow, /du -h -d 1 dist \| sort -hr \| head -20/);
});
