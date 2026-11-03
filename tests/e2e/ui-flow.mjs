/**
 * e2e-тест интерфейса (клики мышью, как у живого ведущего).
 * Запуск: node tests/e2e/ui-flow.mjs
 * Проверяет: лобби → команды → старт → таблица баллов мышью → пауза → ответ →
 * медиа на игровом экране → завершение раундов → итоги → сброс игры.
 */
import { _electron as electron } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, rm } from 'node:fs/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const artifacts = path.join(root, 'tests/e2e/artifacts');
const userData = path.join(artifacts, 'userdata-ui');
const demoPack = path.join(root, 'packs', 'demo-space.quizpack');

let failures = 0;
let app = null;

function check(name, condition, details = '') {
  if (condition) {
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${name} ${details}`);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function findWindow(hash, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const win of app.windows()) {
      if (win.url().includes(hash)) {
        await win.waitForLoadState('domcontentloaded').catch(() => undefined);
        await win.waitForFunction(() => Boolean(window.qm), null, { timeout: 15000 }).catch(() => undefined);
        return win;
      }
    }
    await sleep(150);
  }
  throw new Error(`Не дождались окна ${hash}`);
}

async function shot(win, name) {
  await win.screenshot({ path: path.join(artifacts, name) }).catch(() => undefined);
}

async function state(win) {
  return win.evaluate(() => window.qm.game.getState());
}

async function click(win, name, scope = null) {
  const locator = (scope ?? win).getByRole('button', { name });
  await locator.first().click({ timeout: 8000 });
  await sleep(250);
}

async function main() {
  await rm(userData, { recursive: true, force: true });
  await mkdir(artifacts, { recursive: true });
  console.log('\nQuizMaster — e2e интерфейса ведущего\n');

  const watchdog = setTimeout(() => {
    console.error('\nТЕСТ ЗАВИС (лимит 240 с)');
    process.exit(2);
  }, 240000);
  watchdog.unref?.();

  app = await electron.launch({
    args: ['.', '--no-sandbox', '--disable-gpu'],
    cwd: root,
    env: { ...process.env, QM_USER_DATA: userData, QM_E2E: '1' }
  });
  const editor = await app.firstWindow();
  await editor.waitForFunction(() => Boolean(window.qm), null, { timeout: 20000 });

  await editor.evaluate(async (demoPath) => {
    const opened = await window.qm.pack.openPath(demoPath);
    await window.qm.pack.prepareGame({ pack: opened.pack, packPath: opened.path });
  }, demoPack);

  const host = await findWindow('#/host');
  const game = await findWindow('#/game');
  await sleep(600);

  // ---------- Лобби: команды мышью ----------
  const teamInput = host.getByPlaceholder('Название команды');
  await teamInput.fill('Альфа');
  await teamInput.press('Enter');
  await teamInput.fill('Бета');
  await teamInput.press('Enter');
  await sleep(300);
  let s = await host.evaluate(() => window.qm.game.getState());
  check('Команды добавлены через интерфейс', s?.teams.length === 2, JSON.stringify(s?.teams));

  await click(host, 'Начать игру');
  await sleep(500);
  s = await state(host);
  check('Старт игры кнопкой', s?.phase === 'round-intro', String(s?.phase));
  await shot(host, '11-ui-round-intro.png');
  await shot(game, '12-ui-game-round-intro.png');

  // ---------- Вопрос и баллы мышью ----------
  await click(host, 'Начать раунд');
  await sleep(400);
  s = await state(host);
  check('Вопрос открыт кнопкой «Начать раунд»', s?.phase === 'question' && s?.questionIndex === 0, String(s?.phase));
  const q1 = s.pack.rounds[0].questions[0];
  const t1 = s.teams[0];
  const t2 = s.teams[1];

  await host
    .getByRole('button', { name: `Баллы команды ${t1.name} за вопрос 1` })
    .first()
    .click();
  await sleep(250);
  await click(host, 'Верно');
  s = await state(host);
  check('Кнопка «Верно» ставит полный балл', s?.scores?.[t1.id]?.[q1.id] === q1.points, JSON.stringify(s?.scores));

  await host
    .getByRole('button', { name: `Баллы команды ${t2.name} за вопрос 1` })
    .first()
    .click();
  await sleep(200);
  await click(host, 'Частично');
  s = await state(host);
  check('Кнопка «Частично» ставит половину', s?.scores?.[t2.id]?.[q1.id] === q1.points / 2, JSON.stringify(s?.scores?.[t2.id]));

  const panel = host.locator('.score-panel');
  const numberInput = panel.locator('.score-panel__input').first();
  if ((await numberInput.count()) > 0) {
    await numberInput.fill('0.75');
    await numberInput.press('Enter');
    await sleep(300);
    s = await state(host);
    check('Произвольное дробное значение из поля', s?.scores?.[t2.id]?.[q1.id] === 0.75, JSON.stringify(s?.scores?.[t2.id]));
  } else {
    check('Произвольное дробное значение из поля', false, 'не найдено поле ввода');
  }
  await shot(host, '13-ui-host-score.png');

  // ---------- Пауза кнопкой ----------
  await click(host, 'Пауза');
  s = await state(host);
  check('Пауза кнопкой', s?.paused === true && s?.timer.running === false);
  await click(host, 'Продолжить');
  s = await state(host);
  check('Продолжение кнопкой', s?.paused === false);

  // ---------- Медиа на игровом экране ----------
  await click(host, 'Следующий');
  await sleep(400);
  await click(host, 'Следующий');
  await sleep(900);
  s = await state(host);
  check('Открыт вопрос с изображением', s?.questionIndex === 2, String(s?.questionIndex));
  const imageInfo = await game.evaluate(() => {
    const img = document.querySelector('.game-media__image');
    return img ? { width: img.naturalWidth, src: img.getAttribute('src') } : null;
  });
  check('Изображение загрузилось через quizmedia://', Boolean(imageInfo && imageInfo.width > 0), JSON.stringify(imageInfo));
  await shot(game, '15-ui-game-image.png');

  // ---------- Новый сценарий раунда: повторный показ → сдача бланков → ответы ----------
  await click(host, 'Завершить раунд →');
  await sleep(500);
  let current = await state(host);
  check('После вопросов начался повторный показ', current?.phase === 'round-review', String(current?.phase));
  await shot(game, '16-ui-game-review.png');

  const seenPhases = new Set();
  let guardPhases = 0;
  while (current?.phase !== 'round-summary' && guardPhases < 15) {
    seenPhases.add(current.phase);
    if (current.phase === 'round-handin') await shot(game, '17-ui-game-handin.png');
    if (current.phase === 'round-answers') {
      const answersText = await game.evaluate(() => document.body.innerText);
      check('Игровой экран показывает правильные ответы раунда', answersText.includes('Юпитер'), answersText.slice(0, 100));
      await shot(game, '18-ui-game-answers.png');
    }
    await host.evaluate(() => window.qm.game.next());
    await sleep(280);
    current = await state(host);
    guardPhases += 1;
  }
  check('Была фаза сдачи бланков', seenPhases.has('round-handin'));
  check('Была фаза показа ответов', seenPhases.has('round-answers'));
  check('Дошли до внесения баллов', current?.phase === 'round-summary', String(current?.phase));
  await shot(host, '19-ui-host-round-summary.png');

  await click(host, 'Следующий раунд');
  await sleep(500);
  s = await state(host);
  check('Начался раунд 2', s?.phase === 'round-intro' && s?.roundIndex === 1, `${s?.phase}/${s?.roundIndex}`);

  await click(host, 'Начать раунд');
  await sleep(1200);
  const audioInfo = await game.evaluate(() => {
    const audio = document.querySelector('.game-audio__el');
    return audio
      ? { src: audio.getAttribute('src'), paused: audio.paused, duration: audio.duration, readyState: audio.readyState }
      : null;
  });
  check('Аудио-плеер создан и файл загружен', Boolean(audioInfo && audioInfo.readyState >= 1), JSON.stringify(audioInfo));
  await shot(game, '17-ui-game-audio.png');

  // ---------- Итоги ----------
  await click(host, 'Завершить раунд');
  await sleep(400);
  const endModal = host.locator('.modal');
  if ((await endModal.count()) > 0) {
    await endModal.getByRole('button', { name: 'Завершить раунд' }).first().click();
    await sleep(500);
  }
  await click(host, 'Показать итоги');
  await sleep(700);
  s = await state(host);
  check('Финальная фаза по кнопке', s?.phase === 'finished', String(s?.phase));
  const gameFinished = await game.evaluate(() => document.querySelector('.game-screen--results, .game-results') !== null);
  check('Игровой экран показал итоги', gameFinished);
  await shot(host, '18-ui-host-results.png');
  await shot(game, '19-ui-game-results.png');

  // ---------- Сброс игры ----------
  await click(host, 'Сбросить игру');
  await sleep(300);
  const confirmModal = host.locator('.modal');
  if ((await confirmModal.count()) > 0) {
    await confirmModal.getByRole('button', { name: 'Сбросить игру' }).first().click();
    await sleep(700);
  }
  s = await state(host);
  check('Сброс игры вернул пустое состояние', s === null);
  const lobbyText = await host.evaluate(() => document.body.innerText);
  check('Показан экран «Игра не запущена»', lobbyText.includes('Игра не запущена') || lobbyText.includes('редактор'));
  await shot(host, '20-ui-host-reset.png');

  await app.close();
  clearTimeout(watchdog);
  console.log(`\nИтог: ${failures === 0 ? 'ВСЁ ОК' : `ОШИБОК: ${failures}`}`);
  if (failures > 0) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error('\nТЕСТ УПАЛ:', error);
  process.exitCode = 1;
  await app?.close().catch(() => undefined);
  setTimeout(() => process.exit(1), 400);
});
