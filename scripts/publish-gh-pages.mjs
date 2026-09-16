#!/usr/bin/env node

import { appendFileSync, copyFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const publishBranch = process.env.PUBLISH_BRANCH || 'gh-pages';
const sourceRef = process.env.SOURCE_REF || 'HEAD';
const deployMode = process.env.DEPLOY_MODE || 'site';
const distDir = resolve(repoRoot, process.env.DIST_DIR || 'dist');
const outputFile = process.env.GITHUB_OUTPUT || '';

if (!['site', 'assets'].includes(deployMode)) {
  throw new Error(`Unsupported DEPLOY_MODE: ${deployMode}`);
}

function runGit(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    env: { ...process.env, ...(options.env || {}) },
    input: options.input,
    encoding: options.encoding ?? 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });

  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : result.stderr;
    const stdout = Buffer.isBuffer(result.stdout) ? result.stdout.toString('utf8') : result.stdout;
    throw new Error(`git ${args.join(' ')} failed\n${stderr || stdout || ''}`.trim());
  }

  return result.stdout;
}

function tryGit(args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024
  });
  return result.status === 0 ? result.stdout.trim() : '';
}

function treeEntryName(entry) {
  const tab = entry.indexOf('\t');
  return tab === -1 ? '' : entry.slice(tab + 1);
}

function replaceRootTreeEntry(treeSha, name, childTreeSha) {
  const raw = runGit(['ls-tree', '-z', treeSha], { encoding: 'buffer' });
  const entries = raw
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .filter((entry) => treeEntryName(entry) !== name);

  entries.push(`040000 tree ${childTreeSha}\t${name}`);
  entries.sort((left, right) => Buffer.compare(
    Buffer.from(treeEntryName(left), 'utf8'),
    Buffer.from(treeEntryName(right), 'utf8')
  ));

  const input = Buffer.from(`${entries.join('\0')}\0`, 'utf8');
  return runGit(['mktree', '-z'], { input, encoding: 'buffer' }).toString('utf8').trim();
}

function setOutput(key, value) {
  if (outputFile) appendFileSync(outputFile, `${key}=${value}\n`);
  console.log(`${key}=${value}`);
}

const emojiTree = runGit(['rev-parse', `${sourceRef}:public/emojis`]).trim();
const remoteRef = `refs/remotes/origin/${publishBranch}`;
const parentCommit = tryGit(['rev-parse', '--verify', remoteRef]);
let rootTree;
let tempIndexDir = '';

try {
  if (deployMode === 'assets') {
    if (!parentCommit) {
      throw new Error('Asset-only publish requires an existing gh-pages branch. Run a full site publish first.');
    }
    const parentTree = runGit(['rev-parse', `${parentCommit}^{tree}`]).trim();
    rootTree = replaceRootTreeEntry(parentTree, 'emojis', emojiTree);
  } else {
    if (!existsSync(distDir)) {
      throw new Error(`Build output does not exist: ${distDir}`);
    }
    if (existsSync(join(distDir, 'emojis'))) {
      throw new Error('dist/emojis exists. Production UI builds must not materialize the emoji asset catalog.');
    }

    writeFileSync(join(distDir, '.nojekyll'), '');
    const sourceCname = resolve(repoRoot, 'public/CNAME');
    const distCname = join(distDir, 'CNAME');
    if (existsSync(sourceCname) && !existsSync(distCname)) copyFileSync(sourceCname, distCname);

    tempIndexDir = mkdtempSync(join(tmpdir(), 'emoji-pages-index-'));
    const indexFile = join(tempIndexDir, 'index');
    const indexEnv = { GIT_INDEX_FILE: indexFile };
    const gitDir = resolve(repoRoot, runGit(['rev-parse', '--git-dir']).trim());

    runGit(['read-tree', '--empty'], { env: indexEnv });
    runGit([
      `--git-dir=${gitDir}`,
      `--work-tree=${distDir}`,
      'add', '-A', '--', '.'
    ], { env: indexEnv });

    const distTree = runGit(['write-tree'], { env: indexEnv }).trim();
    rootTree = replaceRootTreeEntry(distTree, 'emojis', emojiTree);
  }

  const previousTree = parentCommit ? runGit(['rev-parse', `${parentCommit}^{tree}`]).trim() : '';
  if (previousTree && previousTree === rootTree) {
    console.log('gh-pages already matches the requested production tree.');
    setOutput('changed', 'false');
    setOutput('commit', parentCommit);
    setOutput('tree', rootTree);
    setOutput('emoji_tree', emojiTree);
    setOutput('mode', deployMode);
  } else {
    const sourceSha = runGit(['rev-parse', sourceRef]).trim();
    const commitArgs = ['commit-tree', rootTree];
    if (parentCommit) commitArgs.push('-p', parentCommit);

    const identity = {
      GIT_AUTHOR_NAME: 'github-actions[bot]',
      GIT_AUTHOR_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
      GIT_COMMITTER_NAME: 'github-actions[bot]',
      GIT_COMMITTER_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com'
    };
    const message = `deploy: ${deployMode} from ${sourceSha.slice(0, 12)}\n`;
    const commitSha = runGit(commitArgs, { env: identity, input: message }).trim();

    console.log(`Prepared ${publishBranch} commit ${commitSha}`);
    console.log(`Source: ${sourceSha}`);
    console.log(`Emoji tree reused from ${sourceRef}:public/emojis: ${emojiTree}`);
    console.log(`Deployment mode: ${deployMode}`);

    setOutput('changed', 'true');
    setOutput('commit', commitSha);
    setOutput('tree', rootTree);
    setOutput('emoji_tree', emojiTree);
    setOutput('mode', deployMode);
  }
} finally {
  if (tempIndexDir) rmSync(tempIndexDir, { recursive: true, force: true });
}
