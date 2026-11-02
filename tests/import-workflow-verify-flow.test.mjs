import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

for (const [label, path, verifyStep, prefix] of [
  ['Emoji.gg', '.github/workflows/import-emojigg.yml', 'Verify Emoji.gg metadata and checked-out assets', '/emojis/community/emojigg/'],
  ['Discadia', '.github/workflows/import-community.yml', 'Verify Discadia metadata and checked-out assets', '/emojis/community/discadia/'],
  ['Slackmojis', '.github/workflows/import-slackmojis.yml', 'Verify Slackmojis metadata and checked-out assets', '/emojis/community/slackmojis/'],
]) {
  test(`${label} import checkpoints before scoped verification`, async () => {
    const workflow = await read(path);

    const checkpoint = workflow.indexOf('Commit and push import checkpoint');
    const verify = workflow.indexOf(verifyStep);
    const scopedVerify = workflow.indexOf('VERIFY_DATA_ASSET_PREFIXES', verify);

    assert.ok(checkpoint >= 0, 'checkpoint step should exist');
    assert.ok(verify > checkpoint, 'verification must happen after the pushed checkpoint');
    assert.ok(scopedVerify > checkpoint, 'scoped verification must happen after the checkpoint');
    assert.ok(workflow.includes(`VERIFY_DATA_ASSET_PREFIXES: '${prefix}'`));
    assert.match(workflow, /Checkpoint pushed before verification/);
    assert.match(workflow, /git push --set-upstream origin "HEAD:\$IMPORT_BRANCH"/);
    assert.doesNotMatch(workflow, /VERIFY_DATA_SKIP_ASSETS: '1'/);
  });
}

test('Chromium import jobs pin an Ubuntu version supported by Playwright 1.55', async () => {
  for (const path of [
    '.github/workflows/import-community.yml',
    '.github/workflows/import-emojigg.yml',
    '.github/workflows/import-discords.yml',
  ]) {
    const workflow = await read(path);
    assert.match(workflow, /run: npx playwright install --with-deps chromium/);
    assert.match(workflow, /runs-on: ubuntu-24\.04/);
    assert.doesNotMatch(workflow, /runs-on: ubuntu-latest/, `${path} must not drift onto an unsupported runner`);
  }
});

test('licensed sync normalizes new taxonomy before verifying it', async () => {
  const workflow = await read('.github/workflows/sync-emojis.yml');
  const sync = workflow.indexOf('name: Sync licensed emoji assets');
  const normalize = workflow.indexOf('name: Normalize synced emoji taxonomy');
  const verify = workflow.indexOf('name: Verify licensed metadata and checked-out assets');
  const shard = workflow.indexOf('name: Shard emoji index for Git');
  assert.ok(sync >= 0 && normalize > sync, 'sync must precede taxonomy normalization');
  assert.ok(verify > normalize, 'verification must follow taxonomy normalization');
  assert.ok(shard > verify, 'the existing post-verification shard step must remain');
  assert.ok(workflow.slice(normalize, verify).includes('node ../app/scripts/emoji-store.mjs hydrate'));
});

test('Slackmojis runs independently without Chromium or Discadia import', async () => {
  const slack = await read('.github/workflows/import-slackmojis.yml');
  const discadia = await read('.github/workflows/import-community.yml');
  assert.match(slack, /name: Import Slackmojis Emoji/);
  assert.match(slack, /run: node \.\.\/app\/scripts\/import-slackmojis\.mjs/);
  assert.match(slack, /--mode="\$SLACKMOJIS_MODE"/);
  assert.match(slack, /--limit="\$IMPORT_LIMIT"/);
  assert.match(slack, /--concurrency="\$SLACKMOJIS_CONCURRENCY"/);
  assert.doesNotMatch(slack, /playwright install|import-community\.mjs|public\/emojis\/community\/discadia/);
  assert.match(slack, /--draft; then/);
  assert.match(slack, /group: emoji-data-write/);
  assert.match(discadia, /run: node \.\.\/app\/scripts\/import-community\.mjs --source=discadia/);
  assert.doesNotMatch(discadia, /import-slackmojis\.mjs|public\/emojis\/community\/slackmojis/);
  assert.match(discadia, /cron: '30 0 \* \* 0'/);
  assert.match(slack, /cron: '30 12 \* \* 0'/);
});
