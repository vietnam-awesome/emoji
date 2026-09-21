import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { TAXONOMY_VERSION } from '../scripts/lib/emoji-taxonomy.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const verifyScript = path.join(repoRoot, 'scripts', 'verify-data.mjs');

const makeRecord = (id, image) => ({
  id,
  slug: id,
  name: id,
  shortcode: `:${id}:`,
  image,
  source: 'test-source',
  license: 'Test',
  category: 'Other',
  categorySlug: 'other',
  taxonomyVersion: TAXONOMY_VERSION,
});

const runVerify = (cwd, env = {}) =>
  spawnSync(process.execPath, [verifyScript], {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });

test('VERIFY_DATA_ASSET_PREFIXES checks only assets present in a sparse checkout scope', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'emoji-verify-scope-'));
  try {
    await mkdir(path.join(root, 'src', 'data'), { recursive: true });
    await mkdir(path.join(root, 'public', 'emojis', 'community', 'emojigg'), { recursive: true });

    const records = [
      makeRecord('emojigg-1', '/emojis/community/emojigg/one.png'),
      makeRecord('slackmojis-1', '/emojis/community/slackmojis/missing.png'),
    ];
    await writeFile(
      path.join(root, 'src', 'data', 'emojis.json'),
      JSON.stringify(records),
    );
    await writeFile(
      path.join(root, 'public', 'emojis', 'community', 'emojigg', 'one.png'),
      'fixture',
    );

    const scoped = runVerify(root, {
      VERIFY_DATA_ASSET_PREFIXES: '/emojis/community/emojigg/',
    });
    assert.equal(scoped.status, 0, scoped.stderr);
    assert.match(scoped.stdout, /checked 1 local asset\(s\)/);
    assert.match(scoped.stdout, /skipped 1 out-of-scope asset check\(s\)/);

    await rm(path.join(root, 'public', 'emojis', 'community', 'emojigg', 'one.png'));
    const missingScoped = runVerify(root, {
      VERIFY_DATA_ASSET_PREFIXES: '/emojis/community/emojigg/',
    });
    assert.equal(missingScoped.status, 1);
    assert.match(missingScoped.stderr, /\[missing local asset\] emojigg-1/);
    assert.doesNotMatch(missingScoped.stderr, /slackmojis-1/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('all sparse data workflows declare an explicit asset-verification mode', async () => {
  const expectations = new Map([
    ['.github/workflows/ci.yml', "VERIFY_DATA_SKIP_ASSETS: '1'"],
    ['.github/workflows/import-emojigg.yml', "VERIFY_DATA_ASSET_PREFIXES: '/emojis/community/emojigg/'"],
    ['.github/workflows/import-community.yml', "VERIFY_DATA_ASSET_PREFIXES: '/emojis/community/slackmojis/,/emojis/community/discadia/'"],
    ['.github/workflows/import-discords.yml', "VERIFY_DATA_ASSET_PREFIXES: '/emojis/community/discords/'"],
    ['.github/workflows/import-eplus.yml', "VERIFY_DATA_ASSET_PREFIXES: '/emojis/eplus/'"],
    ['.github/workflows/sync-emojis.yml', "VERIFY_DATA_ASSET_PREFIXES: '/emojis/openmoji/,/emojis/twemoji/,/emojis/noto/'"],
  ]);

  for (const [relativePath, expected] of expectations) {
    const { readFile } = await import('node:fs/promises');
    const content = await readFile(path.join(repoRoot, relativePath), 'utf8');
    assert.match(content, /verify-data\.mjs|npm run check:data/, `${relativePath} must run catalog verification`);
    assert.ok(content.includes(expected), `${relativePath} must declare: ${expected}`);
  }
});
