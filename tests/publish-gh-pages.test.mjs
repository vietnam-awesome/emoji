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

test('publisher reuses emoji trees and supports asset-only updates', () => {
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

    mkdirSync(join(fixture, 'dist/assets'), { recursive: true });
    writeFileSync(join(fixture, 'dist/index.html'), '<h1>hello</h1>\n');
    writeFileSync(join(fixture, 'dist/assets/app.css'), 'body{}\n');

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
    assert.ok(first.commit);

    const sourceEmojiTree = git(fixture, 'rev-parse', 'HEAD:public/emojis');
    const publishedEmojiTree = git(fixture, 'rev-parse', `${first.commit}:emojis`);
    assert.equal(publishedEmojiTree, sourceEmojiTree);
    assert.equal(git(fixture, 'show', `${first.commit}:index.html`), '<h1>hello</h1>');
    assert.equal(git(fixture, 'show', `${first.commit}:CNAME`), 'emoji.example.test');
    assert.doesNotThrow(() => git(fixture, 'cat-file', '-e', `${first.commit}:.nojekyll`));

    git(fixture, 'update-ref', 'refs/remotes/origin/gh-pages', first.commit);
    const firstIndexBlob = git(fixture, 'rev-parse', `${first.commit}:index.html`);

    writeFileSync(join(fixture, 'public/emojis/community/two.webp'), 'emoji-two');
    git(fixture, 'add', 'public/emojis/community/two.webp');
    git(fixture, 'commit', '-q', '-m', 'add second emoji');
    rmSync(join(fixture, 'dist'), { recursive: true, force: true });

    const secondOutput = join(fixture, 'publisher-second.out');
    runPublisher(fixture, {
      DEPLOY_MODE: 'assets',
      DIST_DIR: 'dist',
      PUBLISH_BRANCH: 'gh-pages',
      SOURCE_REF: 'HEAD',
      GITHUB_OUTPUT: secondOutput
    });

    const second = readOutputs(secondOutput);
    assert.equal(second.changed, 'true');
    assert.equal(git(fixture, 'rev-parse', `${second.commit}^`), first.commit);
    assert.equal(
      git(fixture, 'rev-parse', `${second.commit}:emojis`),
      git(fixture, 'rev-parse', 'HEAD:public/emojis')
    );
    assert.equal(git(fixture, 'rev-parse', `${second.commit}:index.html`), firstIndexBlob);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
