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
const assetTreeMarker = '.emoji-assets-tree';

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

function parseTreeEntries(treeSha) {
  if (!treeSha) return [];
  const raw = runGit(['ls-tree', '-z', treeSha], { encoding: 'buffer' }).toString('utf8');
  return raw
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const tab = entry.indexOf('\t');
      if (tab === -1) throw new Error(`Invalid git tree entry: ${entry}`);
      const [mode, type, sha] = entry.slice(0, tab).split(' ');
      return { mode, type, sha, name: entry.slice(tab + 1) };
    });
}

function treeSortKey(entry) {
  return Buffer.from(`${entry.name}${entry.type === 'tree' ? '/' : ''}`, 'utf8');
}

function writeTreeEntries(entries) {
  const ordered = [...entries].sort((left, right) => Buffer.compare(treeSortKey(left), treeSortKey(right)));
  const payload = Buffer.from(
    `${ordered.map((entry) => `${entry.mode} ${entry.type} ${entry.sha}\t${entry.name}`).join('\0')}\0`,
    'utf8'
  );
  return runGit(['mktree', '-z'], { input: payload, encoding: 'buffer' }).toString('utf8').trim();
}

function upsertTreeEntry(treeSha, replacement) {
  const entries = parseTreeEntries(treeSha);
  const index = entries.findIndex((entry) => entry.name === replacement.name);
  if (index === -1) entries.push(replacement);
  else entries[index] = replacement;
  return writeTreeEntries(entries);
}

function mergeDisjointTrees(baseTreeSha, overlayTreeSha, label) {
  const base = parseTreeEntries(baseTreeSha);
  const overlay = parseTreeEntries(overlayTreeSha);
  const baseByName = new Map(base.map((entry) => [entry.name, entry]));

  for (const entry of overlay) {
    if (baseByName.has(entry.name)) {
      throw new Error(
        `${label} tree collision at ${entry.name}. ` +
        'Generated /emojis routes and production emoji asset top-level paths must remain disjoint.'
      );
    }
  }

  return writeTreeEntries([...base, ...overlay]);
}

function subtractExactTreeEntries(mergedTreeSha, subtractTreeSha, label) {
  const merged = parseTreeEntries(mergedTreeSha);
  const subtract = new Map(parseTreeEntries(subtractTreeSha).map((entry) => [entry.name, entry]));
  const kept = [];

  for (const entry of merged) {
    const previousAsset = subtract.get(entry.name);
    if (!previousAsset) {
      kept.push(entry);
      continue;
    }

    if (
      previousAsset.mode !== entry.mode ||
      previousAsset.type !== entry.type ||
      previousAsset.sha !== entry.sha
    ) {
      throw new Error(
        `${label} cannot safely remove previous asset entry ${entry.name}: ` +
        'the published tree no longer matches the recorded asset tree.'
      );
    }
  }

  for (const name of subtract.keys()) {
    if (!merged.some((entry) => entry.name === name)) {
      throw new Error(`${label} is missing previously published asset entry ${name}. Run a full site publish.`);
    }
  }

  return writeTreeEntries(kept);
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

    const previousEmojiTree = tryGit(['show', `${parentCommit}:${assetTreeMarker}`]);
    if (!previousEmojiTree) {
      throw new Error(`Published ${publishBranch} is missing ${assetTreeMarker}. Run a full site publish first.`);
    }

    const parentTree = runGit(['rev-parse', `${parentCommit}^{tree}`]).trim();
    const publishedEmojiTree = runGit(['rev-parse', `${parentCommit}:emojis`]).trim();
    const generatedRouteTree = subtractExactTreeEntries(
      publishedEmojiTree,
      previousEmojiTree.trim(),
      'Asset-only publish'
    );
    const mergedEmojiTree = mergeDisjointTrees(
      emojiTree,
      generatedRouteTree,
      'Asset-only publish'
    );

    rootTree = upsertTreeEntry(parentTree, {
      mode: '040000',
      type: 'tree',
      sha: mergedEmojiTree,
      name: 'emojis'
    });

    const markerBlob = runGit(['hash-object', '-w', '--stdin'], { input: `${emojiTree}\n` }).trim();
    rootTree = upsertTreeEntry(rootTree, {
      mode: '100644',
      type: 'blob',
      sha: markerBlob,
      name: assetTreeMarker
    });
  } else {
    if (!existsSync(distDir)) {
      throw new Error(`Build output does not exist: ${distDir}`);
    }

    writeFileSync(join(distDir, '.nojekyll'), '');
    writeFileSync(join(distDir, assetTreeMarker), `${emojiTree}\n`);
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
    const generatedEmojiRouteTree = tryGit(['rev-parse', `${distTree}:emojis`]);
    const mergedEmojiTree = generatedEmojiRouteTree
      ? mergeDisjointTrees(emojiTree, generatedEmojiRouteTree, 'Full site publish')
      : emojiTree;

    rootTree = upsertTreeEntry(distTree, {
      mode: '040000',
      type: 'tree',
      sha: mergedEmojiTree,
      name: 'emojis'
    });
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
    console.log(`Emoji asset tree reused from ${sourceRef}:public/emojis: ${emojiTree}`);
    console.log('Generated /emojis route entries are merged into the same published subtree.');
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
