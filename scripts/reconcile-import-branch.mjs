import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeImportedSource } from './lib/merge-import-data.mjs';

const source = process.argv.find((a) => a.startsWith('--source='))?.slice(9);
const branch = process.argv.find((a) => a.startsWith('--branch='))?.slice(9);
if (!['emojigg', 'discadia', 'slackmojis', 'discords'].includes(source)) {
  throw new Error('Unsupported import source for reconciliation: ' + source);
}
if (!branch || !branch.startsWith('import/' + source + '-')) {
  throw new Error('Import branch does not match selected source: ' + branch);
}

const cwd = process.cwd();
const scripts = path.dirname(fileURLToPath(import.meta.url));
const prefix = 'public/emojis/community/' + source + '/';
const exec = (program, args, options = {}) => execFileSync(program, args, {
  cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options
});
const git = (...args) => exec('git', args).trim();
const gitSuccessful = (...args) => spawnSync('git', args, { cwd, stdio: 'ignore' }).status === 0;
const runNode = (file, args = [], env = process.env) => exec(process.execPath, [
  path.join(scripts, file), ...args
], { env, stdio: 'inherit' });

if (git('branch', '--show-current') !== branch) throw new Error('Wrong branch checkout.');
if (git('status', '--porcelain')) throw new Error('Worktree must be clean before reconciling.');
git('fetch', 'origin', 'data');
const dataHead = git('rev-parse', 'origin/data');
const importHead = git('rev-parse', 'HEAD');
if (gitSuccessful('merge-base', '--is-ancestor', dataHead, importHead)) {
  console.log('[reconcile] Already based on the latest data; no rebase needed.');
  process.exit(0);
}

const mergeBase = git('merge-base', importHead, dataHead);
runNode('emoji-store.mjs', ['hydrate']);
const saved = JSON.parse(readFileSync('src/data/emojis.json', 'utf8')).filter((r) => r.source === source);
const previousState = JSON.parse(readFileSync('src/data/community-sync-state.json', 'utf8'));
git('reset', '--hard', importHead);
rmSync('src/data/emojis.json', { force: true });

const changedAssets = git('diff', '--name-only', '-z', '--diff-filter=AM', mergeBase, importHead, '--', prefix)
  .split('\0').filter(Boolean);
const existingAssets = new Set(git('ls-tree', '-r', '--name-only', dataHead, '--', prefix)
  .split('\n').filter(Boolean));
const newAssets = changedAssets.filter((file) => !existingAssets.has(file));

console.log('[reconcile] data advanced; preserving ' + newAssets.length + ' new ' + source + ' assets.');
git('merge', '--no-commit', '--no-ff', '-s', 'ours', dataHead);
git('read-tree', '--reset', '-u', dataHead);
if (newAssets.length) {
  const listPath = path.join(process.env.RUNNER_TEMP || '/tmp', 'import-assets-' + process.pid + '.nul');
  writeFileSync(listPath, newAssets.join('\0') + '\0');
  try {
    git('restore', '--source=' + importHead, '--staged', '--worktree',
      '--pathspec-from-file=' + listPath, '--pathspec-file-nul');
  } finally {
    rmSync(listPath, { force: true });
  }
}

rmSync('src/data/emojis.json', { force: true });
runNode('emoji-store.mjs', ['hydrate']);
const latest = JSON.parse(readFileSync('src/data/emojis.json', 'utf8'));
const result = mergeImportedSource(latest, saved, source);
writeFileSync('src/data/emojis.json', JSON.stringify(result.records));
const state = JSON.parse(readFileSync('src/data/community-sync-state.json', 'utf8'));
if (previousState[source]) state[source] = previousState[source];
writeFileSync('src/data/community-sync-state.json', JSON.stringify(state, null, 2) + '\n');

runNode('verify-data.mjs', [], { ...process.env, VERIFY_DATA_SKIP_ASSETS: '1' });
runNode('emoji-store.mjs', ['shard']);
runNode('emoji-store.mjs', ['hydrate']);
runNode('verify-data.mjs', [], {
  ...process.env, VERIFY_DATA_ASSET_PREFIXES: '/emojis/community/' + source + '/'
});
runNode('emoji-store.mjs', ['shard']);

git('add', '-A', 'src/data', prefix);
if (git('ls-remote', 'origin', 'refs/heads/data').split('\t')[0] !== dataHead) {
  throw new Error('data advanced again during reconciliation; refusing stale push.');
}
git('config', 'user.name', 'github-actions[bot]');
git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
git('commit', '-m', 'fix(data): reconcile ' + source + ' import against latest data');
git('push', 'origin', 'HEAD:' + branch);
console.log('[reconcile] Added ' + result.added + ' records, skipped ' + result.skipped + ' duplicates.');
