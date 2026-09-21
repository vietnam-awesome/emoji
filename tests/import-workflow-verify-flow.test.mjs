import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

for (const [label, path] of [
  ['Emoji.gg', '.github/workflows/import-emojigg.yml'],
  ['Community', '.github/workflows/import-community.yml'],
]) {
  test(`${label} import checkpoints before metadata-only verification`, async () => {
    const workflow = await read(path);

    const checkpoint = workflow.indexOf('Commit and push import checkpoint');
    const verify = workflow.indexOf('Verify emoji metadata');

    assert.ok(checkpoint >= 0, 'checkpoint step should exist');
    assert.ok(verify > checkpoint, 'verification must happen after the pushed checkpoint');
    assert.match(workflow, /VERIFY_DATA_SKIP_ASSETS: '1'/);
    assert.match(workflow, /Checkpoint pushed before verification/);
    assert.match(workflow, /git push --set-upstream origin "HEAD:\$IMPORT_BRANCH"/);
    assert.doesNotMatch(workflow, /- name: Verify emoji index\n/);
  });
}
