#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SOURCE = 'public/emojis';
const DEFAULT_SHARD_COUNT = 8;

function normalizeRelativePath(value) {
  return String(value || '').replaceAll('\\', '/').replace(/^\/+/, '');
}

export function stableShard(relativePath, shardCount = DEFAULT_SHARD_COUNT) {
  const count = Number.parseInt(String(shardCount), 10);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`Invalid shard count: ${shardCount}`);
  }

  const normalized = normalizeRelativePath(relativePath);
  if (!normalized) throw new Error('Asset path is required.');

  const digest = createHash('sha256').update(normalized).digest();
  return (digest.readUInt32BE(0) % count) + 1;
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = -1;
  do {
    size /= 1024;
    unitIndex += 1;
  } while (size >= 1024 && unitIndex < units.length - 1);
  return `${size.toFixed(size >= 100 ? 0 : size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

async function walkFiles(rootDir, currentDir = rootDir, files = []) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(rootDir, absolute, files);
      continue;
    }
    if (!entry.isFile()) continue;

    const stats = await lstat(absolute);
    files.push({
      absolute,
      relative: normalizeRelativePath(path.relative(rootDir, absolute)),
      bytes: stats.size
    });
  }
  return files;
}

function parseArgs(argv) {
  const args = {
    source: DEFAULT_SOURCE,
    count: DEFAULT_SHARD_COUNT,
    report: '',
    exportShard: 0,
    out: ''
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--source' && next) {
      args.source = next;
      index += 1;
    } else if (arg === '--count' && next) {
      args.count = Number.parseInt(next, 10);
      index += 1;
    } else if (arg === '--report' && next) {
      args.report = next;
      index += 1;
    } else if (arg === '--export-shard' && next) {
      args.exportShard = Number.parseInt(next, 10);
      index += 1;
    } else if (arg === '--out' && next) {
      args.out = next;
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/asset-shards.mjs [options]\n\nOptions:\n  --source <dir>          Asset source directory (default: public/emojis)\n  --count <n>             Number of stable shards (default: 8)\n  --report <file>         Write a JSON shard report\n  --export-shard <n>      Export one shard (1-based)\n  --out <dir>             Export destination; required with --export-shard\n  -h, --help              Show this help\n\nExamples:\n  node scripts/asset-shards.mjs --count 8 --report .tmp/emoji-shards.json\n  node scripts/asset-shards.mjs --count 8 --export-shard 1 --out .tmp/shard-01\n`);
}

async function exportShard(files, shardNumber, shardCount, outDir) {
  if (!Number.isInteger(shardNumber) || shardNumber < 1 || shardNumber > shardCount) {
    throw new Error(`--export-shard must be between 1 and ${shardCount}.`);
  }
  if (!outDir) throw new Error('--out is required with --export-shard.');

  const resolvedOut = path.resolve(outDir);
  await rm(resolvedOut, { recursive: true, force: true });
  await mkdir(path.join(resolvedOut, 'emojis'), { recursive: true });

  let copied = 0;
  let bytes = 0;
  for (const file of files) {
    if (stableShard(file.relative, shardCount) !== shardNumber) continue;
    const destination = path.join(resolvedOut, 'emojis', file.relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(file.absolute, destination);
    copied += 1;
    bytes += file.bytes;
  }

  await writeFile(path.join(resolvedOut, '.nojekyll'), '');
  await writeFile(
    path.join(resolvedOut, 'shard.json'),
    `${JSON.stringify({ shard: shardNumber, shardCount, files: copied, bytes }, null, 2)}\n`
  );

  console.log(`Exported shard ${String(shardNumber).padStart(2, '0')} to ${resolvedOut}: ${copied.toLocaleString('en-US')} files, ${formatBytes(bytes)}`);
}

export async function buildShardPlan(sourceDir, shardCount = DEFAULT_SHARD_COUNT) {
  const count = Number.parseInt(String(shardCount), 10);
  if (!Number.isInteger(count) || count < 1) throw new Error(`Invalid shard count: ${shardCount}`);

  const resolvedSource = path.resolve(sourceDir);
  const files = await walkFiles(resolvedSource);
  const shards = Array.from({ length: count }, (_, index) => ({
    shard: index + 1,
    files: 0,
    bytes: 0
  }));

  for (const file of files) {
    const shardNumber = stableShard(file.relative, count);
    const shard = shards[shardNumber - 1];
    shard.files += 1;
    shard.bytes += file.bytes;
  }

  return {
    source: resolvedSource,
    shardCount: count,
    totalFiles: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    shards,
    files
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const plan = await buildShardPlan(args.source, args.count);
  if (!plan.totalFiles) throw new Error(`No files found under ${plan.source}`);

  console.log(`Emoji asset shard plan: ${plan.totalFiles.toLocaleString('en-US')} files, ${formatBytes(plan.totalBytes)}, ${plan.shardCount} shards`);
  console.log('');
  console.log('Shard  Files       Size');
  console.log('-----  ----------  ----------');
  for (const shard of plan.shards) {
    console.log(
      `${String(shard.shard).padStart(2, '0')}     ${String(shard.files.toLocaleString('en-US')).padStart(10)}  ${formatBytes(shard.bytes).padStart(10)}`
    );
  }

  if (args.report) {
    const reportPath = path.resolve(args.report);
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(
      reportPath,
      `${JSON.stringify({
        version: 1,
        strategy: 'sha256-path-modulo',
        source: plan.source,
        shardCount: plan.shardCount,
        totalFiles: plan.totalFiles,
        totalBytes: plan.totalBytes,
        shards: plan.shards
      }, null, 2)}\n`
    );
    console.log(`\nReport written to ${reportPath}`);
  }

  if (args.exportShard) {
    await exportShard(plan.files, args.exportShard, plan.shardCount, args.out);
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
