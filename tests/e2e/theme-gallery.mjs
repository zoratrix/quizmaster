/**
 * Визуальная галерея тем оформления QuizMaster.
 * Запуск: npm run build && node tests/e2e/theme-gallery.mjs
 *
 * Для каждой темы из каталога (src/shared/themes.ts) открывает игровое окно
 * с демо-паком и снимает заставку раунда и экран вопроса. Дополнительно
 * снимает окно «Настройки пака» с живым предпросмотром в редакторе.
 * Скриншоты: tests/e2e/artifacts/themes/. Возвращает код 1, если какая-то
 * тема не применилась к игровому экрану.
 *
 * Это инструмент визуальной проверки, в npm run e2e он не входит.
 */
import { _electron as electron } from 'playwright-core';
import AdmZip from 'adm-zip';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, rm } from 'node:fs/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const artifacts = path.join(root, 'tests/e2e/artifacts/themes');
const userData = path.join(root, 'tests/e2e/artifacts/theme-gallery-userdata');
const demoPack = path.join(root, 'packs', 'demo-space.quizpack');

/** Порядок совпадает с каталогом тем в редакторе. */
const THEMES = [
  'default',
  'blue',
  'pink',
  'pastel',
  'winter',
  'spring',
  'summer',
  'autumn',
  'cyberpunk',
  'retro',
  'win98',
  'halloween',
  'newyear',
  'valentine'
];

const TEAMS = [
  { id: 't1', name: 'Альфа' },
  { id: 't2', name: 'Бета' }
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findWindow(app, hashPart, timeout = 25000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const win of app.windows()) {
      if (win.url().includes(hashPart)) {
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
    console.warn(`  ! не удалось снять ${name}: ${error.message}`);
  });
}

async function main() {
  await rm(userData, { recursive: true, force: true });
  await mkdir(artifacts, { recursive: true });
  console.log('\nQuizMaster — галерея тем оформления\n');

  const app = await electron.launch({
    args: ['.', '--no-sandbox', '--disable-gpu'],
    cwd: root,
    env: { ...process.env, QM_USER_DATA: userData, QM_E2E: '1' }
  });

  try {
    const editor = await app.firstWindow();
    await editor.waitForLoadState('domcontentloaded');
    await editor.waitForFunction(() => Boolean(window.qm), null, { timeout: 20000 });

    const opened = await editor.evaluate(async (packPath) => {
      const result = await window.qm.pack.openPath(packPath);
      return result.pack;
    }, demoPack);
    console.log(`Демо-пак: «${opened.title}» (${opened.rounds.length} раунда)\n`);

    // Первый prepareGame создаёт окна ведущего и игры.
    await editor.evaluate(async (pack) => {
      await window.qm.pack.prepareGame({ pack, packPath: null });
    }, opened);

    const host = await findWindow(app, '#/host');
    const game = await findWindow(app, '#/game');

    const problems = [];
    for (const theme of THEMES) {
      await editor.evaluate(
        async ({ pack, themeId }) => {
          await window.qm.pack.prepareGame({ pack: { ...pack, theme: themeId }, packPath: null });
        },
        { pack: opened, themeId: theme }
      );
      await sleep(700);

      const applied = await game.evaluate(() => document.querySelector('.game-root')?.getAttribute('data-theme'));
      if (applied !== theme) problems.push(`${theme}: на игровом экране data-theme=${applied}`);
      await screenshot(game, `${theme}-01-lobby.png`);

      await host.evaluate(async (teams) => window.qm.game.start({ teams, mode: 'team' }), TEAMS);
      await sleep(450);
      await screenshot(game, `${theme}-02-round-intro.png`);

      await host.evaluate(() => window.qm.game.next());
      await sleep(550);
      await screenshot(game, `${theme}-03-question.png`);

      // Третий вопрос демо-пака — с картинкой: проверяем медиа-зону в теме.
      await host.evaluate(() => window.qm.game.next());
      await sleep(250);
      await host.evaluate(() => window.qm.game.next());
      await sleep(650);
      await screenshot(game, `${theme}-04-question-image.png`);

      await host.evaluate(async () => {
        const state = await window.qm.game.getState();
        const question = state.pack.rounds[0].questions[0];
        if (!question) return;
        await window.qm.game.setScore('t1', question.id, question.points);
        await window.qm.game.setScore('t2', question.id, question.points / 2);
        await window.qm.game.finish();
      });
      await sleep(650);
      await screenshot(game, `${theme}-05-results.png`);

      console.log(`  ✓ ${theme}`);
    }

    // Тема должна сохраняться в .quizpack и читаться обратно.
    const savedPath = path.join(artifacts, 'theme-persistence.quizpack');
    const saved = await editor.evaluate(
      async ({ pack, target }) => {
        const result = await window.qm.pack.save({ ...pack, theme: 'valentine' }, target, false);
        if (!result) return null;
        const reopened = await window.qm.pack.openPath(result.path);
        return { theme: reopened.pack.theme, issues: result.issues };
      },
      { pack: opened, target: savedPath }
    );
    const savedTheme = saved?.theme;
    const manifestTheme = JSON.parse(new AdmZip(savedPath).readAsText('manifest.json')).pack.theme;
    if (savedTheme !== 'valentine' || manifestTheme !== 'valentine') {
      problems.push(`сохранение темы: open=${savedTheme}, manifest=${manifestTheme}`);
    } else {
      console.log('  ✓ Тема сохраняется в .quizpack и читается обратно');
    }

    // Ничья на итогах: «Ничья» и «Все молодцы!» вместо «нет победителя».
    await editor.evaluate(async (pack) => {
      await window.qm.pack.prepareGame({ pack: { ...pack, theme: 'default' }, packPath: null });
    }, opened);
    await sleep(500);
    await host.evaluate(async (teams) => window.qm.game.start({ teams, mode: 'team' }), TEAMS);
    await sleep(300);
    await host.evaluate(async () => {
      const state = await window.qm.game.getState();
      const question = state.pack.rounds[0].questions[0];
      for (const team of state.teams) {
        await window.qm.game.setScore(team.id, question.id, question.points);
      }
      await window.qm.game.finish();
    });
    await sleep(650);
    await screenshot(game, 'tie-06-results.png');
    const tieText = await game.evaluate(() => document.body.innerText);
    const tieTextLower = tieText.toLocaleLowerCase('ru');
    if (!tieTextLower.includes('ничья') || !tieText.includes('Все молодцы')) {
      problems.push(`ничья на итогах: не найден нужный текст (${tieText.slice(0, 160)})`);
    } else {
      console.log('  ✓ Ничья: «Ничья» + «Все молодцы!»');
    }

    // Живой предпросмотр в редакторе: окно настроек пака с разными темами.
    await editor.bringToFront();
    await editor.getByRole('button', { name: /Настройки пака/ }).click();
    await sleep(400);
    await editor.evaluate(() => {
      const body = document.querySelector('.modal__body');
      const picker = document.querySelector('.theme-picker');
      if (body && picker) body.scrollTop = picker.offsetTop - 12;
    });
    await sleep(250);
    await screenshot(editor, 'editor-settings-default.png');

    for (const [label, name] of [
      ['Пастель', 'editor-settings-pastel.png'],
      ['Ретро (XP)', 'editor-settings-retro.png'],
      ['Windows 98', 'editor-settings-win98.png'],
      ['Киберпанк', 'editor-settings-cyberpunk.png'],
      ['День святого Валентина', 'editor-settings-valentine.png']
    ]) {
      await editor.evaluate((text) => {
        const card = [...document.querySelectorAll('.theme-card')].find((item) => item.textContent?.includes(text));
        card?.click();
      }, label);
      await sleep(350);
      await screenshot(editor, name);
    }

    console.log(`\nСкриншоты: ${artifacts}`);
    if (problems.length > 0) {
      console.error('\nПроблемы:');
      for (const problem of problems) console.error(` - ${problem}`);
      process.exitCode = 1;
    } else {
      console.log('Все темы применились к игровому экрану.');
    }
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error('\nГалерея тем упала:', error);
  process.exit(1);
});
