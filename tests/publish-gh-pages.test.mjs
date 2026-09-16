import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publisher = join(repoRoot, 'scripts/publish-gh-pages.mjs');

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function runPublisher(cwd, env) {
  const result = spawnSync(process.execPath, [publisher], {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

function readOutputs(path) {
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
      })
  );
}

function writeUiDist(fixture, version) {
  rmSync(join(fixture, 'dist'), { recursive: true, force: true });
  mkdirSync(join(fixture, 'dist/emojis'), { recursive: true });
  mkdirSync(join(fixture, 'dist/_astro'), { recursive: true });
  writeFileSync(join(fixture, 'dist/index.html'), `<h1>ui-${version}</h1>\n`);
  writeFileSync(join(fixture, 'dist/emojis/index.html'), `<h1>emoji-list-${version}</h1>\n`);
  writeFileSync(join(fixture, `dist/_astro/ui-${version}.css`), `/* ui-${version} */\n`);
}

test('publisher keeps UI, emoji details, binary assets, and hashed assets independently deployable', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'emoji-gh-pages-test-'));

  try {
    git(fixture, 'init', '-q');
    git(fixture, 'config', 'user.name', 'Test');
    git(fixture, 'config', 'user.email', 'test@example.com');

    mkdirSync(join(fixture, 'public/emojis/community'), { recursive: true });
    writeFileSync(join(fixture, 'public/emojis/community/one.webp'), 'emoji-one');
    writeFileSync(join(fixture, 'public/CNAME'), 'emoji.example.test\n');
    writeFileSync(join(fixture, 'README.md'), 'fixture\n');
    git(fixture, 'add', '.');
    git(fixture, 'commit', '-q', '-m', 'initial source');

    writeUiDist(fixture, 'v1');
    const firstOutput = join(fixture, 'publisher-first.out');
    runPublisher(fixture, {
      DEPLOY_MODE: 'site',
      DIST_DIR: 'dist',
      PUBLISH_BRANCH: 'gh-pages',
      SOURCE_REF: 'HEAD',
      GITHUB_OUTPUT: firstOutput
    });

    const first = readOutputs(firstOutput);
    assert.equal(first.changed, 'true');
    assert.equal(git(fixture, 'show', `${first.commit}:index.html`), '<h1>ui-v1</h1>');
    assert.equal(git(fixture, 'show', `${first.commit}:emojis/index.html`), '<h1>emoji-list-v1</h1>');
    assert.equal(git(fixture, 'show', `${first.commit}:emojis/community/one.webp`), 'emoji-one');
    assert.equal(git(fixture, 'show', `${first.commit}:CNAME`), 'emoji.example.test');
    assert.doesNotThrow(() => git(fixture, 'cat-file', '-e', `${first.commit}:.nojekyll`));

    git(fixture, 'update-ref', 'refs/remotes/origin/gh-pages', first.commit);
    const firstIndexBlob = git(fixture, 'rev-parse', `${first.commit}:index.html`);

    rmSync(join(fixture, 'dist'), { recursive: true, force: true });
    mkdirSync(join(fixture, 'dist/emoji/sample'), { recursive: true });
    mkdirSync(join(fixture, 'dist/_astro'), { recursive: true });
    writeFileSync(join(fixture, 'dist/emoji/sample/index.html'), '<h1>detail-sample</h1>\n');
    writeFileSync(join(fixture, 'dist/_astro/detail.css'), '/* detail */\n');

    const detailOutput = join(fixture, 'publisher-detail.out');
    runPublisher(fixture, {
      DEPLOY_MODE: 'details',
      DIST_DIR: 'dist',
      PUBLISH_BRANCH: 'gh-pages',
      SOURCE_REF: 'HEAD',
      GITHUB_OUTPUT: detailOutput
    });

    const details = readOutputs(detailOutput);
    assert.equal(details.changed, 'true');
    assert.equal(git(fixture, 'rev-parse', `${details.commit}^`), first.commit);
    assert.equal(git(fixture, 'show', `${details.commit}:emoji/sample/index.html`), '<h1>detail-sample</h1>');
    assert.equal(git(fixture, 'rev-parse', `${details.commit}:index.html`), firstIndexBlob);
    assert.doesNotThrow(() => git(fixture, 'cat-file', '-e', `${details.commit}:_astro/ui-v1.css`));
    assert.doesNotThrow(() => git(fixture, 'cat-file', '-e', `${details.commit}:_astro/detail.css`));

    git(fixture, 'update-ref', 'refs/remotes/origin/gh-pages', details.commit);
    const detailBlob = git(fixture, 'rev-parse', `${details.commit}:emoji/sample/index.html`);

    writeUiDist(fixture, 'v2');
    const secondUiOutput = join(fixture, 'publisher-ui-v2.out');
    runPublisher(fixture, {
      DEPLOY_MODE: 'site',
      DIST_DIR: 'dist',
      PUBLISH_BRANCH: 'gh-pages',
      SOURCE_REF: 'HEAD',
      GITHUB_OUTPUT: secondUiOutput
    });

    const secondUi = readOutputs(secondUiOutput);
    assert.equal(secondUi.changed, 'true');
    assert.equal(git(fixture, 'show', `${secondUi.commit}:index.html`), '<h1>ui-v2</h1>');
    assert.equal(git(fixture, 'show', `${secondUi.commit}:emojis/index.html`), '<h1>emoji-list-v2</h1>');
    assert.equal(git(fixture, 'show', `${secondUi.commit}:emojis/community/one.webp`), 'emoji-one');
    assert.equal(git(fixture, 'rev-parse', `${secondUi.commit}:emoji/sample/index.html`), detailBlob);
    assert.doesNotThrow(() => git(fixture, 'cat-file', '-e', `${secondUi.commit}:_astro/detail.css`));
    assert.doesNotThrow(() => git(fixture, 'cat-file', '-e', `${secondUi.commit}:_astro/ui-v2.css`));

    git(fixture, 'update-ref', 'refs/remotes/origin/gh-pages', secondUi.commit);
    const secondUiIndexBlob = git(fixture, 'rev-parse', `${secondUi.commit}:index.html`);
    const secondUiEmojiIndexBlob = git(fixture, 'rev-parse', `${secondUi.commit}:emojis/index.html`);

    writeFileSync(join(fixture, 'public/emojis/community/two.webp'), 'emoji-two');
    git(fixture, 'add', 'public/emojis/community/two.webp');
    git(fixture, 'commit', '-q', '-m', 'add second emoji');
    rmSync(join(fixture, 'dist'), { recursive: true, force: true });

    const assetOutput = join(fixture, 'publisher-assets.out');
    runPublisher(fixture, {
      DEPLOY_MODE: 'assets',
      DIST_DIR: 'dist',
      PUBLISH_BRANCH: 'gh-pages',
      SOURCE_REF: 'HEAD',
      GITHUB_OUTPUT: assetOutput
    });

    const assets = readOutputs(assetOutput);
    assert.equal(assets.changed, 'true');
    assert.equal(git(fixture, 'rev-parse', `${assets.commit}^`), secondUi.commit);
    assert.equal(git(fixture, 'show', `${assets.commit}:emojis/community/two.webp`), 'emoji-two');
    assert.equal(git(fixture, 'rev-parse', `${assets.commit}:emojis/index.html`), secondUiEmojiIndexBlob);
    assert.equal(git(fixture, 'rev-parse', `${assets.commit}:emoji/sample/index.html`), detailBlob);
    assert.equal(git(fixture, 'rev-parse', `${assets.commit}:index.html`), secondUiIndexBlob);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
