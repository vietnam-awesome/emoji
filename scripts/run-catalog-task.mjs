import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { hydrateCatalog, shardCatalog } from './catalog-storage.mjs';

const [script, ...args] = process.argv.slice(2);
if (!script) {
  console.error('Usage: node scripts/run-catalog-task.mjs <script> [...args]');
  process.exit(2);
}

try {
  await hydrateCatalog({ writePublic: true });

  const result = spawnSync(process.execPath, [path.resolve(script), ...args], {
    stdio: 'inherit',
    env: process.env
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`[catalog] ${script} exited with status ${result.status}`);
    process.exit(result.status ?? 1);
  }

  await shardCatalog();
} catch (error) {
  console.error(`[catalog] task failed: ${error.stack || error.message}`);
  process.exit(1);
}
