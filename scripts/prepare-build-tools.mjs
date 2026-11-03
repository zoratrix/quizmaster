/**
 * Подготовка инструментов сборки установщика.
 *
 * electron-builder скачивает архив winCodeSign, внутри которого есть файлы-ссылки
 * (symlink) для macOS. На некоторых компьютерах Windows без прав администратора
 * распаковка ссылок запрещена, и сборка падает. Здесь мы заранее распаковываем
 * из уже скачанного архива только нужный инструмент rcedit (правка иконки и
 * свойств exe) в то место кэша, откуда electron-builder его берёт.
 *
 * Запуск: node scripts/prepare-build-tools.mjs
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheRoot = path.join(root, '.cache', 'electron-builder');
const winCodeSignCache = path.join(cacheRoot, 'winCodeSign');
const rceditDir = path.join(winCodeSignCache, 'winCodeSign-2.6.0');
const rceditExe = path.join(rceditDir, 'rcedit-x64.exe');

async function main() {
  if (existsSync(rceditExe)) {
    console.log('Инструменты сборки уже подготовлены (rcedit на месте).');
    return;
  }
  if (!existsSync(winCodeSignCache)) {
    console.log('Кэш инструментов пуст — нечего распаковывать. Сборка скачает всё сама.');
    return;
  }

  const files = await readdir(winCodeSignCache).catch(() => []);
  const archive = files.find((file) => file.toLowerCase().endsWith('.7z'));
  if (!archive) {
    console.log('Архив инструментов не найден. Сборка скачает всё сама.');
    return;
  }

  const sevenZip = path.join(root, 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');
  if (!existsSync(sevenZip)) {
    console.log('Не найден 7za (node_modules/7zip-bin). Пропускаю подготовку.');
    return;
  }

  await mkdir(rceditDir, { recursive: true });
  console.log(`Распаковываю rcedit из ${path.join(winCodeSignCache, archive)}`);
  const result = spawnSync(
    sevenZip,
    ['x', path.join(winCodeSignCache, archive), `-o${rceditDir}`, 'rcedit-x64.exe', 'rcedit-ia32.exe', '-y'],
    { stdio: 'inherit' }
  );
  if (result.status !== 0) {
    console.warn('Не удалось распаковать rcedit. Сборка продолжит без правки свойств exe.');
    await rm(rceditDir, { recursive: true, force: true }).catch(() => undefined);
    return;
  }
  if (existsSync(rceditExe)) console.log('Готово: свойства и иконка приложения будут проставлены.');
}

await main();
