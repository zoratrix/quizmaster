/**
 * Дымовой e2e-тест QuizMaster на реальном Electron.
 * Запуск: node tests/e2e/smoke.mjs
 * Проверяет: запуск приложения, окна редактора/ведущего/игры, таймер, паузу,
 * начисление баллов, завершение раунда и игры, восстановление прерванной игры.
 * Скриншоты сохраняются в tests/e2e/artifacts.
 */
import { _electron as electron } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const artifacts = path.join(root, 'tests/e2e/artifacts');
const userData = path.join(artifacts, 'userdata');
const demoPack = path.join(root, 'packs', 'demo-space.quizpack');

const report = [];
let failures = 0;

function check(name, condition, details = '') {
  if (condition) {
    report.push(`  ✓ ${name}`);
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    report.push(`  ✗ ${name} ${details}`);
    console.error(`  ✗ ${name} ${details}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function launch() {
  const app = await electron.launch({
    args: ['.', '--no-sandbox', '--disable-gpu'],
    cwd: root,
    env: { ...process.env, QM_USER_DATA: userData, QM_E2E: '1' }
  });
  const editor = await app.firstWindow();
  await editor.waitForLoadState('domcontentloaded');
  await editor.waitForFunction(() => Boolean(window.qm), null, { timeout: 20000 });
  return { app, editor };
}

async function findWindow(app, hashPart, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const win of app.windows()) {
      const url = win.url();
      if (url.includes(hashPart)) {
        await win.waitForLoadState('domcontentloaded').catch(() => undefined);
        await win.waitForFunction(() => Boolean(window.qm), null, { timeout: 15000 }).catch(() => undefined);
        return win;
      }
    }
    await sleep(200);
  }
  throw new Error(`Не дождались окна ${hashPart}. Открыты: ${app.windows().map((w) => w.url()).join(', ')}`);
}

async function screenshot(win, name) {
  await win.screenshot({ path: path.join(artifacts, name) }).catch((error) => {
    console.warn(`  ! не удалось сделать скриншот ${name}: ${error.message}`);
  });
}

async function main() {
  await rm(userData, { recursive: true, force: true });
  await mkdir(artifacts, { recursive: true });
  console.log('\nQuizMaster — дымовой e2e-тест\n');

  // Страховка от зависания: тест не должен висеть дольше 4 минут
  const watchdog = setTimeout(() => {
    console.error('\nТЕСТ ЗАВИС (превышен лимит 240 с)');
    process.exit(2);
  }, 240000);
  watchdog.unref?.();

  // ---------- 1. Запуск и редактор ----------
  let { app, editor } = await launch();
  check('Окно редактора открылось', (await editor.locator('.editor-root').count()) === 1);
  await screenshot(editor, '01-editor-start.png');

  // ---------- 2. Демо-пак и запуск игры ----------
  const prep = await editor.evaluate(async (demoPath) => {
    const opened = await window.qm.pack.openPath(demoPath);
    await window.qm.pack.prepareGame({ pack: opened.pack, packPath: opened.path });
    return {
      title: opened.pack.title,
      rounds: opened.pack.rounds.length,
      questions: opened.pack.rounds.reduce((sum, round) => sum + round.questions.length, 0),
      issues: opened.issues
    };
  }, demoPack);
  check('Демо-пак прочитан', prep.title.length > 0 && prep.rounds === 2 && prep.questions === 5, JSON.stringify(prep));
  check('Пак без ошибок целостности', prep.issues.length === 0, prep.issues.join('; '));

  const host = await findWindow(app, '#/host');
  const game = await findWindow(app, '#/game');
  check('Окно ведущего открылось', Boolean(host));
  check('Игровое окно открылось', Boolean(game));
  await sleep(700);
  await screenshot(host, '02-host-lobby.png');
  await screenshot(game, '03-game-lobby.png');

  // ---------- 3. Старт игры и вопрос ----------
  await host.evaluate(async () => {
    await window.qm.game.start({
      teams: [
        { id: 't1', name: 'Альфа' },
        { id: 't2', name: 'Бета' }
      ],
      mode: 'team'
    });
  });
  await sleep(400);
  let state = await host.evaluate(() => window.qm.game.getState());
  check('Фаза заставки раунда', state?.phase === 'round-intro', `phase=${state?.phase}`);

  await host.evaluate(() => window.qm.game.next());
  await sleep(300);
  state = await host.evaluate(() => window.qm.game.getState());
  check('Открылся вопрос 1', state?.phase === 'question' && state?.questionIndex === 0);
  check('Таймер запущен', state?.timer.running === true, JSON.stringify(state?.timer));
  const firstRemaining = state.timer.remainingMs;
  await sleep(1200);
  state = await host.evaluate(() => window.qm.game.getState());
  check('Таймер уменьшается', state.timer.remainingMs < firstRemaining, `${firstRemaining} → ${state.timer.remainingMs}`);

  // ---------- 4. Пауза ----------
  await host.evaluate(() => window.qm.game.pause());
  await sleep(500);
  const pausedState = await host.evaluate(() => window.qm.game.getState());
  check('Пауза остановила таймер', pausedState.paused === true && pausedState.timer.running === false);
  const pausedRemaining = pausedState.timer.remainingMs;
  await sleep(800);
  const stillPaused = await host.evaluate(() => window.qm.game.getState());
  check('Остаток времени не меняется на паузе', Math.abs(stillPaused.timer.remainingMs - pausedRemaining) < 5);
  await screenshot(game, '04-game-paused.png');
  await host.evaluate(() => window.qm.game.resume());
  await sleep(300);

  // ---------- 5. Показ ответа ----------
  await host.evaluate(() => window.qm.game.setRevealed(true));
  await sleep(400);
  state = await host.evaluate(() => window.qm.game.getState());
  check('Ответ раскрыт', state.revealed === true);
  await screenshot(game, '05-game-revealed.png');

  // ---------- 6. Баллы: полный, частичный, дробный, корректировка ----------
  const questionIds = await host.evaluate(async () => {
    const s = await window.qm.game.getState();
    return s.pack.rounds.flatMap((round) => round.questions.map((q) => ({ id: q.id, points: q.points })));
  });
  const q1 = questionIds[0];
  await host.evaluate(
    async ({ qid, team, points }) => window.qm.game.setScore(team, qid, points),
    { qid: q1.id, team: 't1', points: q1.points }
  );
  await host.evaluate(
    async ({ qid, team, points }) => window.qm.game.setScore(team, qid, points),
    { qid: q1.id, team: 't2', points: 0.5 }
  );
  await host.evaluate(
    async ({ qid, team }) => window.qm.game.addScore(team, qid, 10),
    { qid: questionIds[1].id, team: 't2' }
  );
  state = await host.evaluate(() => window.qm.game.getState());
  check('Полный балл записан', state.scores.t1[q1.id] === q1.points, String(state.scores.t1[q1.id]));
  check('Дробный балл записан', state.scores.t2[q1.id] === 0.5, String(state.scores.t2[q1.id]));
  check('Корректировка вверх работает', state.scores.t2[questionIds[1].id] === 10);
  await host.evaluate(
    async ({ qid }) => window.qm.game.setScore('t2', qid, 0),
    { qid: questionIds[1].id }
  );
  state = await host.evaluate(() => window.qm.game.getState());
  check('Обнуление работает', state.scores.t2[questionIds[1].id] === 0);
  await screenshot(host, '06-host-question.png');

  // ---------- 7. Восстановление после «сбоя» ----------
  await host.evaluate(() => window.qm.game.next());
  await sleep(600);
  const beforeCrash = await host.evaluate(() => window.qm.game.getState());
  check('Переход ко второму вопросу', beforeCrash.questionIndex === 1, String(beforeCrash.questionIndex));
  await app.close();
  await sleep(500);

  ({ app, editor } = await launch());
  await editor.evaluate(() => window.qm.game.openHostWindow());
  const host2 = await findWindow(app, '#/host');
  await sleep(600);
  const recovery = await host2.evaluate(() => window.qm.game.recoveryInfo());
  check('Найдена незавершённая игра', Boolean(recovery?.available), JSON.stringify(recovery));
  check('В сохранении тот же вопрос', recovery?.questionNumber === 2, String(recovery?.questionNumber));
  await screenshot(host2, '07-host-recovery.png');

  await host2.evaluate(() => window.qm.game.recover());
  await sleep(800);
  const recovered = await host2.evaluate(() => window.qm.game.getState());
  check('Игра восстановлена на том же вопросе', recovered?.questionIndex === 1, String(recovered?.questionIndex));
  check('Восстановленная игра на паузе', recovered?.paused === true);
  check('Баллы сохранились', recovered?.scores?.t1?.[q1.id] === q1.points);
  const game2 = await findWindow(app, '#/game');
  await screenshot(game2, '08-game-recovered.png');
  await host2.evaluate(() => window.qm.game.resume());

  // ---------- 8. Новый сценарий раунда: повторный показ, сдача бланков, ответы ----------
  const roundSizes = await host2.evaluate(async () => {
    const s = await window.qm.game.getState();
    return s.pack.rounds.map((round) => round.questions.length);
  });
  let guard = 0;
  const seen = new Set();
  let reviewDuration = 0;
  let handInDuration = 0;
  while (guard < 80) {
    const current = await host2.evaluate(() => window.qm.game.getState());
    if (current.phase === 'finished') break;
    seen.add(current.phase);
    if (current.phase === 'round-review') reviewDuration = current.timer.durationMs;
    if (current.phase === 'round-handin') handInDuration = current.timer.durationMs;
    if (current.phase === 'round-summary') {
      await host2.evaluate(() => window.qm.game.nextRound());
    } else {
      await host2.evaluate(() => window.qm.game.next());
    }
    guard += 1;
    await sleep(250);
  }
  check('Повторный показ вопросов был', seen.has('round-review'));
  check('Таймер повторного показа — 15 секунд', reviewDuration === 15000, String(reviewDuration));
  check(
    'Сдача бланков была с таймером 40 секунд',
    seen.has('round-handin') && handInDuration === 40000,
    `${seen.has('round-handin')} / ${handInDuration}`
  );
  check('Ответы на все вопросы раунда были показаны', seen.has('round-answers'));
  state = await host2.evaluate(() => window.qm.game.getState());
  check('Игра дошла до финала', state?.phase === 'finished', `phase=${state?.phase}, шагов ${guard}`);
  check('Все раунды пройдены', roundSizes.length === 2);
  await sleep(700);
  await screenshot(host2, '09-host-results.png');
  await screenshot(game2, '10-game-results.png');

  const sessionFiles = await readdir(path.join(userData, 'sessions')).catch(() => []);
  check('После финала сохранение игры убрано', !sessionFiles.includes('current.json'), sessionFiles.join(','));

  // ---------- 9. Данные приложения ----------
  const mediaDir = await readdir(path.join(userData, 'media')).catch(() => []);
  check('Медиа из пака распаковано', mediaDir.length >= 2, mediaDir.join(','));

  await app.close();
  await sleep(300);

  console.log(`\nИтог: ${failures === 0 ? 'ВСЁ ОК' : `ОШИБОК: ${failures}`}`);
  console.log(`Скриншоты: ${artifacts}`);
  if (failures > 0) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error('\nТЕСТ УПАЛ:', error);
  process.exitCode = 1;
  // Не оставляем висящий Electron
  setTimeout(() => process.exit(1), 500);
});
