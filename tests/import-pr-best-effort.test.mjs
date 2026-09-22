import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const workflows = [
  '.github/workflows/import-community.yml',
  '.github/workflows/import-discords.yml',
  '.github/workflows/import-emojigg.yml',
  '.github/workflows/import-eplus.yml',
  '.github/workflows/sync-emojis.yml',
];

for (const path of workflows) {
  test(`${path} treats review PR creation as best-effort`, async () => {
    const workflow = await read(path);

    assert.match(workflow, /compare_url=/);
    assert.match(workflow, /gh pr list/);
    assert.match(workflow, /if gh pr create/);
    assert.match(workflow, /Automatic PR creation is unavailable/);
    assert.match(workflow, /Create the PR manually:/);
    assert.match(workflow, /exit 0/);
    assert.match(workflow, /Recovery summary/);

    assert.doesNotMatch(
      workflow,
      /pr_url="\$\(gh pr create/,
      'unprotected command substitution would make a verified import fail when Actions cannot create PRs',
    );
  });
}
