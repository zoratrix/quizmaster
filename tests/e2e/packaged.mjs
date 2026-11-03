/**
 * Проверка собранной (упакованной) версии: release\win-unpacked\QuizMaster.exe.
 * Запуск: node tests/e2e/packaged.mjs
 * Требуется предварительная сборка установщика: BUILD.bat или npm run dist.
 */
import { _electron as electron } from 'playwright-core';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const artifacts = path.join(root, 'tests/e2e/artifacts');
const userData = path.join(artifacts, 'userdata-packaged');
const exePath = path.join(root, 'release', 'win-unpacked', 'QuizMaster.exe');

let failures = 0;
let app = null;

function check(name, condition, details = '') {
  if (condition) console.log(`  ✓ ${name}`);
  else {
    failures += 1;
    console.error(`  ✗ ${name} ${details}`);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  if (!existsSync(exePath)) {
    console.error(`Не найден ${exePath}. Сначала соберите установщик: BUILD.bat`);
    process.exitCode = 2;
    return;
  }
  await rm(userData, { recursive: true, force: true });
  await mkdir(artifacts, { recursive: true });
  console.log('\nQuizMaster — проверка собранной версии\n');

  app = await electron.launch({
    executablePath: exePath,
    args: ['--no-sandbox', '--disable-gpu'],
    cwd: root,
    env: { ...process.env, QM_USER_DATA: userData }
  });
  const editor = await app.firstWindow();
  await editor.waitForFunction(() => Boolean(window.qm), null, { timeout: 30000 });

  check('Упакованное приложение запускается', (await editor.locator('.editor-root').count()) === 1);
  const expectedVersion = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const version = await editor.evaluate(() => window.qm.app.version());
  check(`Версия приложения ${expectedVersion}`, version === expectedVersion, version);

  const demos = await editor.evaluate(() => window.qm.pack.listDemos());
  check('Демо-паки доступны из resources', demos.length === 2, JSON.stringify(demos.map((d) => d.fileName)));
  const spaceDemo = demos.find((demo) => demo.fileName === 'demo-space.quizpack');
  check('Демо-пак прочитан корректно', Boolean(spaceDemo && spaceDemo.questions === 5), JSON.stringify(spaceDemo));

  const opened = await editor.evaluate(async (packPath) => {
    const result = await window.qm.pack.openPath(packPath);
    await window.qm.pack.prepareGame({ pack: result.pack, packPath: result.path });
    return { issues: result.issues, rounds: result.pack.rounds.length };
  }, spaceDemo.path);
  check('Пак открывается в собранной версии', opened.rounds === 2 && opened.issues.length === 0, JSON.stringify(opened));

  let host = null;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline && !host) {
    host = app.windows().find((win) => win.url().includes('#/host')) ?? null;
    if (!host) await sleep(200);
  }
  check('Окно ведущего открылось', Boolean(host));
  if (host) {
    await host.waitForFunction(() => Boolean(window.qm), null, { timeout: 15000 });
    await host.evaluate(() => window.qm.game.start({
      teams: [
        { id: 'p1', name: 'Проверка 1' },
        { id: 'p2', name: 'Проверка 2' }
      ],
      mode: 'team'
    }));
    await sleep(400);
    const state = await host.evaluate(() => window.qm.game.getState());
    check('Игра стартует в собранной версии', state?.phase === 'round-intro', String(state?.phase));
    await host.screenshot({ path: path.join(artifacts, '21-packaged-host.png') }).catch(() => undefined);
    const gameWindow = app.windows().find((win) => win.url().includes('#/game'));
    if (gameWindow) {
      await gameWindow.screenshot({ path: path.join(artifacts, '22-packaged-game.png') }).catch(() => undefined);
    }
    check('Игровое окно открылось', Boolean(gameWindow));
  }

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
