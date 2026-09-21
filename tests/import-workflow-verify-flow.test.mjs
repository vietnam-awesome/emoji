import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

for (const [label, path, prefix] of [
  ['Emoji.gg', '.github/workflows/import-emojigg.yml', '/emojis/community/emojigg/'],
  ['Community', '.github/workflows/import-community.yml', '/emojis/community/slackmojis/,/emojis/community/discadia/'],
]) {
  test(`${label} import checkpoints before scoped verification`, async () => {
    const workflow = await read(path);

    const checkpoint = workflow.indexOf('Commit and push import checkpoint');
    const verify = workflow.indexOf('Verify ');
    const scopedVerify = workflow.indexOf('VERIFY_DATA_ASSET_PREFIXES');

    assert.ok(checkpoint >= 0, 'checkpoint step should exist');
    assert.ok(verify > checkpoint, 'verification must happen after the pushed checkpoint');
    assert.ok(scopedVerify > checkpoint, 'scoped verification must happen after the checkpoint');
    assert.ok(workflow.includes(`VERIFY_DATA_ASSET_PREFIXES: '${prefix}'`));
    assert.match(workflow, /Checkpoint pushed before verification/);
    assert.match(workflow, /git push --set-upstream origin "HEAD:\$IMPORT_BRANCH"/);
    assert.doesNotMatch(workflow, /VERIFY_DATA_SKIP_ASSETS: '1'/);
  });
}
