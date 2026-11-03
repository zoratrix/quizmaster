/**
 * Проверка целостности игровых паков: битое медиа и полностью испорченный файл.
 * Запуск: node tests/e2e/pack-integrity.mjs
 */
import { _electron as electron } from 'playwright-core';
import AdmZip from 'adm-zip';
import path from 'node:path';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const artifacts = path.join(root, 'tests/e2e/artifacts');
const userData = path.join(artifacts, 'userdata-integrity');
const demoPack = path.join(root, 'packs', 'demo-space.quizpack');
const brokenPack = path.join(artifacts, 'broken-media.quizpack');
const garbagePack = path.join(artifacts, 'garbage.quizpack');

let failures = 0;
let app = null;

function check(name, condition, details = '') {
  if (condition) console.log(`  ✓ ${name}`);
  else {
    failures += 1;
    console.error(`  ✗ ${name} ${details}`);
  }
}

async function main() {
  await rm(userData, { recursive: true, force: true });
  await mkdir(artifacts, { recursive: true });
  console.log('\nQuizMaster — проверка целостности паков\n');

  // 1. Пак с повреждённым медиа: портим первый байт картинки внутри архива
  const zip = new AdmZip(demoPack);
  const mediaEntry = zip.getEntries().find((entry) => entry.entryName.startsWith('media/'));
  if (!mediaEntry) throw new Error('В демо-паке нет медиа');
  const data = mediaEntry.getData();
  data[0] = data[0] ^ 0xff;
  zip.updateFile(mediaEntry.entryName, data);
  await writeFile(brokenPack, zip.toBuffer());

  // 2. Полностью испорченный файл
  await writeFile(garbagePack, Buffer.from('это не zip-архив, а мусор', 'utf8'));
  check('Подготовлены тестовые паки', (await readFile(brokenPack)).length > 1000);

  app = await electron.launch({
    args: ['.', '--no-sandbox', '--disable-gpu'],
    cwd: root,
    env: { ...process.env, QM_USER_DATA: userData, QM_E2E: '1' }
  });
  const editor = await app.firstWindow();
  await editor.waitForFunction(() => Boolean(window.qm), null, { timeout: 20000 });

  const broken = await editor.evaluate(async (packPath) => {
    const result = await window.qm.pack.openPath(packPath);
    return { rounds: result.pack.rounds.length, issues: result.issues };
  }, brokenPack);
  check('Пак с испорченным медиа всё равно открывается', broken.rounds === 2, JSON.stringify(broken));
  check(
    'Проблема целостности медиа обнаружена',
    broken.issues.some((issue) => issue.includes('повреждён') || issue.includes('контрольная сумма')),
    broken.issues.join(' | ')
  );

  const garbage = await editor.evaluate(async (packPath) => {
    try {
      await window.qm.pack.openPath(packPath);
      return { ok: true, message: '' };
    } catch (error) {
      return { ok: false, message: String(error.message ?? error) };
    }
  }, garbagePack);
  check('Испорченный файл отвергается с понятным сообщением', garbage.ok === false, JSON.stringify(garbage));
  check(
    'Сообщение объясняет причину',
    /поврежд|архив|manifest|не игровой пак/i.test(garbage.message),
    garbage.message
  );

  await app.close();
  console.log(`\nИтог: ${failures === 0 ? 'ВСЁ ОК' : `ОШИБОК: ${failures}`}`);
  if (failures > 0) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error('\nТЕСТ УПАЛ:', error);
  process.exitCode = 1;
  await app?.close().catch(() => undefined);
  setTimeout(() => process.exit(1), 400);
});
