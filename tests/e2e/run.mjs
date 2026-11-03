/**
 * Запуск всех e2e-проверок: node tests/e2e/run.mjs
 * Требуется собранное приложение (npm run build) и рабочий стол Windows.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tests = ['smoke.mjs', 'ui-flow.mjs', 'pack-integrity.mjs'];

let failed = 0;
for (const test of tests) {
  console.log(`\n===== ${test} =====`);
  const result = spawnSync(process.execPath, [path.join(here, test)], { stdio: 'inherit', cwd: path.resolve(here, '../..') });
  if (result.status !== 0) failed += 1;
}

console.log(`\n===== Итог e2e: ${failed === 0 ? 'ВСЁ ОК' : `провалено файлов: ${failed}`} =====`);
if (failed > 0) process.exitCode = 1;
