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

if (!['site', 'assets', 'details'].includes(deployMode)) {
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

function parseTreeEntry(entry) {
  const tab = entry.indexOf('\t');
  if (tab === -1) throw new Error(`Invalid git tree entry: ${entry}`);
  const [mode, type, sha] = entry.slice(0, tab).split(' ');
  return { mode, type, sha, name: entry.slice(tab + 1), raw: entry };
}

function readTreeEntries(treeSha) {
  if (!treeSha) return [];
  const raw = runGit(['ls-tree', '-z', treeSha], { encoding: 'buffer' });
  return raw
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
}

function writeTreeEntries(entries) {
  const sorted = [...entries].sort((left, right) => Buffer.compare(
    Buffer.from(treeEntryName(left), 'utf8'),
    Buffer.from(treeEntryName(right), 'utf8')
  ));

  if (sorted.length === 0) {
    return runGit(['mktree'], { input: '' }).trim();
  }

  const input = Buffer.from(`${sorted.join('\0')}\0`, 'utf8');
  // gh-pages is intentionally fetched as a partial clone. Preserved tree entries may
  // therefore reference blobs that exist on GitHub but are not materialized locally.
  // --missing lets mktree keep those references without downloading the whole asset set.
  return runGit(['mktree', '--missing', '-z'], { input, encoding: 'buffer' }).toString('utf8').trim();
}

function replaceTreeEntry(treeSha, name, replacementEntry) {
  const entries = readTreeEntries(treeSha)
    .filter((entry) => treeEntryName(entry) !== name);

  if (replacementEntry) entries.push(replacementEntry);
  return writeTreeEntries(entries);
}

function replaceRootTreeEntry(treeSha, name, childTreeSha) {
  return replaceTreeEntry(
    treeSha,
    name,
    childTreeSha ? `040000 tree ${childTreeSha}\t${name}` : ''
  );
}

function replaceBlobTreeEntry(treeSha, name, blobSha) {
  return replaceTreeEntry(
    treeSha,
    name,
    blobSha ? `100644 blob ${blobSha}\t${name}` : ''
  );
}

function mergeTrees(baseTreeSha, overlayTreeSha) {
  if (!baseTreeSha) return overlayTreeSha || '';
  if (!overlayTreeSha) return baseTreeSha;
  if (baseTreeSha === overlayTreeSha) return baseTreeSha;

  const entriesByName = new Map(
    readTreeEntries(baseTreeSha).map((raw) => {
      const entry = parseTreeEntry(raw);
      return [entry.name, entry];
    })
  );

  for (const raw of readTreeEntries(overlayTreeSha)) {
    const overlay = parseTreeEntry(raw);
    const base = entriesByName.get(overlay.name);

    if (base?.type === 'tree' && overlay.type === 'tree') {
      const mergedChild = mergeTrees(base.sha, overlay.sha);
      entriesByName.set(overlay.name, {
        ...overlay,
        sha: mergedChild,
        raw: `${overlay.mode} tree ${mergedChild}\t${overlay.name}`
      });
      continue;
    }

    entriesByName.set(overlay.name, overlay);
  }

  return writeTreeEntries([...entriesByName.values()].map((entry) => entry.raw));
}

function getTreeEntry(treeish, path) {
  const result = tryGit(['rev-parse', `${treeish}:${path}`]);
  return result || '';
}

function buildDirectoryTree(directory) {
  const tempIndexDir = mkdtempSync(join(tmpdir(), 'emoji-pages-index-'));
  try {
    const indexFile = join(tempIndexDir, 'index');
    const indexEnv = { GIT_INDEX_FILE: indexFile };
    const gitDir = resolve(repoRoot, runGit(['rev-parse', '--git-dir']).trim());

    runGit(['read-tree', '--empty'], { env: indexEnv });
    runGit([
      `--git-dir=${gitDir}`,
      `--work-tree=${directory}`,
      'add', '-A', '--', '.'
    ], { env: indexEnv });

    return runGit(['write-tree'], { env: indexEnv }).trim();
  } finally {
    rmSync(tempIndexDir, { recursive: true, force: true });
  }
}

function setOutput(key, value) {
  if (outputFile) appendFileSync(outputFile, `${key}=${value}\n`);
  console.log(`${key}=${value}`);
}

const sourceEmojiTree = getTreeEntry(sourceRef, 'public/emojis');
const remoteRef = `refs/remotes/origin/${publishBranch}`;
const parentCommit = tryGit(['rev-parse', '--verify', remoteRef]);
const parentTree = parentCommit ? runGit(['rev-parse', `${parentCommit}^{tree}`]).trim() : '';
const deployedEmojiTree = parentCommit ? getTreeEntry(parentCommit, 'emojis') : '';
const deployedEmojiIndex = parentCommit ? getTreeEntry(parentCommit, 'emojis/index.html') : '';
const deployedDetailTree = parentCommit ? getTreeEntry(parentCommit, 'emoji') : '';
const deployedAstroTree = parentCommit ? getTreeEntry(parentCommit, '_astro') : '';

let emojiTree = deployedEmojiTree || sourceEmojiTree;
let detailTree = deployedDetailTree;
let rootTree;

if (deployMode === 'assets') {
  if (!parentCommit) {
    throw new Error('Asset-only publish requires an existing gh-pages branch. Run a UI publish first.');
  }
  if (!sourceEmojiTree) {
    throw new Error(`Emoji source tree is missing at ${sourceRef}:public/emojis`);
  }

  // /emojis contains the binary catalog plus the Astro collection route index.
  // Advance only the binary catalog while preserving the route index generated by UI deploys.
  emojiTree = sourceEmojiTree;
  if (deployedEmojiIndex) {
    emojiTree = replaceBlobTreeEntry(emojiTree, 'index.html', deployedEmojiIndex);
  }
  rootTree = replaceRootTreeEntry(parentTree, 'emojis', emojiTree);
} else {
  if (!existsSync(distDir)) {
    throw new Error(`Build output does not exist: ${distDir}`);
  }

  const distTree = buildDirectoryTree(distDir);
  const distAstroTree = getTreeEntry(distTree, '_astro');

  if (deployMode === 'details') {
    if (!parentCommit) {
      throw new Error('Emoji-detail publish requires an existing gh-pages branch. Run a UI publish first.');
    }

    detailTree = getTreeEntry(distTree, 'emoji');
    if (!detailTree) {
      throw new Error('Emoji detail output is missing from dist. Expected dist/emoji/<slug>/index.html.');
    }

    // Detail publishes touch only /emoji and add any newly generated hashed Astro assets.
    // Existing hashed assets are kept so preserved pages never lose their referenced files.
    rootTree = replaceRootTreeEntry(parentTree, 'emoji', detailTree);
    const mergedAstroTree = mergeTrees(deployedAstroTree, distAstroTree);
    if (mergedAstroTree) {
      rootTree = replaceRootTreeEntry(rootTree, '_astro', mergedAstroTree);
    }
  } else {
    writeFileSync(join(distDir, '.nojekyll'), '');
    const sourceCname = resolve(repoRoot, 'public/CNAME');
    const distCname = join(distDir, 'CNAME');
    if (existsSync(sourceCname) && !existsSync(distCname)) copyFileSync(sourceCname, distCname);

    // Rebuild the dist tree after adding production-only files.
    const siteTree = buildDirectoryTree(distDir);
    const distEmojiRouteTree = getTreeEntry(siteTree, 'emojis');
    const distDetailTree = getTreeEntry(siteTree, 'emoji');
    const siteAstroTree = getTreeEntry(siteTree, '_astro');

    if (distDetailTree) {
      throw new Error(
        'UI-only build unexpectedly contains /emoji detail pages. ' +
        'Set SKIP_EMOJI_DETAIL_PAGES=1 so the existing detail tree can be preserved.'
      );
    }

    const assetEmojiTree = deployedEmojiTree || sourceEmojiTree;
    if (!assetEmojiTree) {
      throw new Error('No emoji asset tree is available. Publish emoji assets once before deploying the UI.');
    }
    if (!distEmojiRouteTree) {
      throw new Error('The Astro /emojis route is missing from dist. Expected dist/emojis/index.html.');
    }

    // UI publishes replace normal UI output, but preserve both expensive emoji trees:
    // - /emojis binary assets, overlaying only the fresh collection index
    // - /emoji static detail pages, which are rebuilt only when emoji/detail data changes
    emojiTree = mergeTrees(assetEmojiTree, distEmojiRouteTree);
    rootTree = replaceRootTreeEntry(siteTree, 'emojis', emojiTree);
    if (deployedDetailTree) {
      rootTree = replaceRootTreeEntry(rootTree, 'emoji', deployedDetailTree);
    }

    // Preserved detail HTML can reference older hashed Astro assets. Keep those files and
    // overlay the current UI assets rather than deleting the old hashes on every UI deploy.
    const mergedAstroTree = mergeTrees(deployedAstroTree, siteAstroTree);
    if (mergedAstroTree) {
      rootTree = replaceRootTreeEntry(rootTree, '_astro', mergedAstroTree);
    }
  }
}

const previousTree = parentCommit ? runGit(['rev-parse', `${parentCommit}^{tree}`]).trim() : '';
if (previousTree && previousTree === rootTree) {
  console.log('gh-pages already matches the requested production tree.');
  setOutput('changed', 'false');
  setOutput('commit', parentCommit);
  setOutput('tree', rootTree);
  setOutput('emoji_tree', emojiTree || '');
  setOutput('detail_tree', detailTree || '');
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
  console.log(`Emoji asset tree: ${emojiTree || '(unchanged)'}`);
  console.log(`Emoji detail tree: ${detailTree || '(none)'}`);
  console.log(`Deployment mode: ${deployMode}`);

  setOutput('changed', 'true');
  setOutput('commit', commitSha);
  setOutput('tree', rootTree);
  setOutput('emoji_tree', emojiTree || '');
  setOutput('detail_tree', detailTree || '');
  setOutput('mode', deployMode);
}
