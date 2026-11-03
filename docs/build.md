# Техническая сборка и разработка QuizMaster

Документ для разработчика: как собрать проект, запустить режим разработки, прогнать проверки
и упаковать установщик. Пользовательские инструкции — в
[docs/BUILD_GUIDE.md](BUILD_GUIDE.md), устройство приложения — в
[docs/architecture.md](architecture.md).

## 1. Требования

| Что | Значение |
|---|---|
| ОС | Windows 10/11 x64 |
| Node.js | LTS 20 или новее (проект проверен на Node.js 24) |
| npm | поставляется вместе с Node.js |
| Интернет | на время `npm install` и первой сборки установщика |
| Свободное место | около 2 ГБ (зависимости, кэш сборки, установщик) |
| Графическая сессия Windows | нужна для e2e-теста (запускается настоящий Electron) |

Зависимости ставятся командой `INSTALL.bat` или `npm install`. Кэши остаются внутри проекта:

- `.cache/npm` — задаётся в `.npmrc`;
- `.cache/electron` и `.cache/electron-builder` — задаются переменными окружения
  в `INSTALL.bat` и `BUILD.bat`.

## 2. Структура проекта

```
src/shared/      типы, фабрики, баллы, статистика, форматирование, контракт IPC
src/main/        Electron main: окна, IPC, движок игры, паки, медиа, сохранения
src/preload/     contextBridge → window.qm
src/renderer/    React: App, editor/, host/, game/, components/, hooks/, styles/
packs/           демо-паки .quizpack
build/           icon.ico для установщика
scripts/         build-app.mjs, dev.mjs, make-demo-packs.mjs, make-icon.ps1
tests/unit/      юнит-тесты (scoring, stats) и мини-раннер
tests/e2e/       run.mjs + smoke.mjs, ui-flow.mjs, pack-integrity.mjs (Playwright + Electron)
docs/            инструкции
```

Служебные каталоги (не коммитятся, пересобираются): `node_modules`, `dist`, `release`,
`.cache`, `.test-build`, `tests/e2e/artifacts`, `*.log`.

## 3. Скрипты `package.json`

| Команда | Что делает |
|---|---|
| `npm run dev` | esbuild для main/preload + Vite dev-сервер + Electron; следит за изменениями |
| `npm run build` | очищает `dist` и собирает `dist/main`, `dist/preload`, `dist/renderer` |
| `npm start` | `npm run build && electron .` — запуск собранного приложения без `.bat`-обёртки |
| `npm run dist` | `npm run build && electron-builder --win nsis` — установщик в `release` |
| `npm run typecheck` | `tsc -p tsconfig.json --noEmit` |
| `npm test` | компилирует тесты (`tsconfig.test.json`) в `.test-build` и запускает `run.js` |
| `npm run e2e` | `tests/e2e/run.mjs`: последовательно запускает `smoke.mjs`, `ui-flow.mjs`, `pack-integrity.mjs` |

Пользовательские скрипты: `INSTALL.bat` (зависимости), `START.bat` (`npm run build` + запуск
Electron), `START-DEV.bat` (`npm run dev`), `BUILD.bat` (`npm run build` + `npm run dist`).

Примечание: `BUILD.bat` вызывает `npm run build`, а затем `npm run dist`, который сам
начинает с `npm run build`. Сборка приложения выполняется дважды; это осознанный запас
надёжности, но время сборки увеличивается.

## 4. Режим разработки

```
START-DEV.bat
```

или

```
npm run dev
```

Что происходит (`scripts/dev.mjs`):

1. esbuild собирает `src/main/index.ts` → `dist/main/index.js` и
   `src/preload/index.ts` → `dist/preload/index.js` (CJS, `node20`, `electron` — external).
2. Vite поднимает dev-сервер на порту `5273` (`strictPort: true`) и отдаёт рендерер с HMR.
3. Electron запускается с `QM_DEV_SERVER_URL=<адрес Vite>`; окна загружают `#/editor`,
   `#/host`, `#/game` с dev-сервера.
4. Изменения в `src/main`, `src/preload`, `src/shared` собираются заново и перезапускают
   Electron.
5. В dev-режиме открываются DevTools, а меню приложения остаётся стандартным
   (в `windows.ts` `installMenu()` в dev ничего не меняет).

Остановка — закрыть окно приложения или Ctrl+C в консоли. Порт `5273` должен быть свободен.

## 5. Сборка приложения

```
npm run build
```

`scripts/build-app.mjs` удаляет `dist`, затем:

1. esbuild собирает main и preload (bundle, `platform: node`, `target: node20`, `format: cjs`,
   `electron` external);
2. Vite собирает рендерер в `dist/renderer` (`base: './'`, `target: chrome128`,
   точка входа `src/renderer/index.html`).

Результат: `dist/main/index.js`, `dist/preload/index.js`, `dist/renderer/**`. Именно эти файлы
попадают в установщик (см. `electron-builder.yml`).

## 6. Сборка установщика

```
BUILD.bat
```

или

```
npm run dist
```

`npm run dist` сначала выполняет `npm run build`, затем `electron-builder --win nsis`
с конфигурацией `electron-builder.yml`:

- target — NSIS, только x64;
- `files`: `dist/main`, `dist/preload`, `dist/renderer`, `package.json`;
- `asar: true`;
- `extraResources`: `packs` → `resources/packs` (демо-паки внутри установленной версии);
- `artifactName: QuizMaster-${version}-Setup.${ext}` → `release\QuizMaster-1.2.0-Setup.exe`;
- установка для текущего пользователя без вопросов (oneClick), ярлыки, языки ru/en,
  без цифровой подписи (SmartScreen может предупредить);
- рядом создаётся `release\QuizMaster-1.2.0-portable.zip` (`scripts/make-portable.ps1`) —
  версия без установки, на случай если установщик блокируется;
- данные в `%APPDATA%\quizmaster` при удалении не удаляются.

Первая сборка скачивает инструменты electron-builder (нужен интернет, 5–10 минут).
Если сборка падает — см. [docs/troubleshooting.md](troubleshooting.md).

## 7. Проверки перед изменениями и после

| Шаг | Команда | Что проверяет |
|---|---|---|
| 1 | `npm run typecheck` | типы во всём `src` и `tests/unit` |
| 2 | `npm test` | подсчёт баллов и статистику |
| 3 | `npm run build` | сборку main/preload/renderer |
| 4 | `npm run e2e` | реальный запуск: окна, таймер, пауза, баллы, восстановление, финал |
| 5 | `node tests/e2e/packaged.mjs` | собранная версия из `release\win-unpacked` (нужна после `npm run dist`): запуск, демо-паки, окна |

### Юнит-тесты

`npm test` компилирует `src/shared/**` и `tests/unit/**` по `tsconfig.test.json` в `.test-build`
и запускает `.test-build/tests/unit/run.js`. Раннер — `tests/unit/harness.ts`, тесты:
`scoring.test.ts`, `stats.test.ts`.

### E2E-тесты

```
npm run e2e
```

`tests/e2e/run.mjs` по очереди запускает три сценария (каждый — отдельный Electron
с собственным каталогом данных). Отдельно запускается проверка уже собранной версии
`node tests/e2e/packaged.mjs` (нужен `release\win-unpacked` после `npm run dist`).

| Файл | Что проверяет |
|---|---|
| `smoke.mjs` | полный сценарий: окна, лобби, старт, вопрос, таймер, пауза, показ ответа, полный/дробный/скорректированный балл, имитация сбоя и восстановление, раунды, финал, распаковка медиа |
| `ui-flow.mjs` | клики мышью, как у живого ведущего: лобби → команды → старт → таблица баллов → пауза → ответ → медиа на игровом экране → завершение раундов → итоги → сброс игры |
| `pack-integrity.mjs` | пак с повреждённым медиафайлом и полностью испорченный файл `.quizpack` |
| `packaged.mjs` | уже собранная версия из `release\win-unpacked`: запуск, версия, демо-паки из resources, окна игры |

Можно запускать сценарии по отдельности, например `node tests/e2e/smoke.mjs`.

Что делает `smoke.mjs`:

- запускает Electron через `playwright-core` с аргументами `--no-sandbox --disable-gpu`
  и подменённым каталогом данных `QM_USER_DATA=tests/e2e/artifacts/userdata`;
- открывает демо-пак `packs/demo-space.quizpack` и запускает игру
  (`pack.openPath` → `pack.prepareGame`);
- проверяет окна `#/host` и `#/game`, старт игры, фазу заставки, открытие вопроса,
  уменьшение таймера, паузу, показ ответа, полный/дробный/скорректированный балл;
- имитирует сбой (закрывает приложение), проверяет баннер восстановления и восстановление
  на том же вопросе с баллами;
- проходит раунды до финала и проверяет, что сохранение игры удалено, а медиа распаковано;
- сохраняет скриншоты в `tests/e2e/artifacts/` (01-editor-start.png … 10-game-results.png).

Требуется графическая сессия Windows: в headless-окружении тест не запустится. Тест
использует отдельный каталог данных и не трогает `%APPDATA%\quizmaster` пользователя.
После изменений UI скриншоты нужно просмотреть: интерфейс должен читаться с проектора.

## 8. Демо-паки и иконки

| Что | Команда | Результат |
|---|---|---|
| демо-паки | `node scripts/make-demo-packs.mjs` | пересобирает `packs/demo-quick.quizpack` и `packs/demo-space.quizpack` (изображения и звук генерируются программно, офлайн) |
| иконки | `powershell -ExecutionPolicy Bypass -File scripts\make-icon.ps1` | `src/renderer/public/icon.png` и `build/icon.ico` |

Демо-паки входят в установщик через `extraResources`, поэтому после изменения
`make-demo-packs.mjs` пересоберите установщик.

## 9. Как добавить команду или событие интерфейса

1. Тип и метод — в `src/shared/api.ts` (интерфейс `QuizApi`).
2. Обработчик — в `src/main/ipc.ts` (`ipcMain.handle('game:…')`), логика — в
   `GameController` (`src/main/gameController.ts`).
3. Проброс в рендерер — в `src/preload/index.ts` (объект `api`).
4. Подписка на события — там же (`subscribe`); рассылка из main — через
   `windows.broadcast`, например `controller.on('state')` в `src/main/index.ts`.
5. Для команд, меняющих ход игры, прогоните `npm test` и `npm run e2e`.

## 10. Соглашения

- TypeScript strict; `npm run typecheck` должен быть чистым.
- Тексты интерфейса — на русском, тон спокойный и деловой.
- Общие компоненты — `src/renderer/src/components`, токены — `styles/base.css`;
  стили экранов — в своих CSS-файлах (`editor.css`, `host.css`, `game.css`).
- Не создавать новый слой состояния: `useGameState` и `GameState` достаточно.
- Не добавлять runtime-зависимости без необходимости (сейчас: `adm-zip`, `react`,
  `react-dom`).
- Не менять формат `.quizpack` без `SCHEMA_VERSION` и `normalizePack`
  (`src/shared/types.ts`, `src/shared/factory.ts`).
- Внутри проекта только относительные пути; никаких сетевых запросов во время игры.
- Не оставлять заглушек вместо функций: кнопка либо работает, либо её нет.
- Не добавлять абсолютные пути и файлы с локальными настройками.

## 11. Известные технические нюансы

| Нюанс | Пояснение |
|---|---|
| e2e требует собранного приложения | перед запуском выполните `npm run build`: тесты поднимают Electron с `dist/`; дополнительные скрипты не нужны |
| `BUILD.bat` собирает приложение дважды | `npm run build`, затем `npm run dist`, который снова начинает с `npm run build` |
| `START.bat` собирает приложение при каждом запуске | это гарантирует актуальность `dist`; ручной `npm start` делает то же самое |
| dev-режим не ставит русское меню | `installMenu()` в dev-режиме оставляет стандартное меню с DevTools |
| `QM_E2E` и `QM_DEV` | выставляются скриптами, но в коде не читаются; фактически используются `QM_USER_DATA` и `QM_DEV_SERVER_URL` |
| `quizmedia://` | файлы медиа отдаются только из медиатеки; путь берётся из реестра `src/main/media.ts` |
| сборка не проверяет типы | `npm run build` и `npm run dist` запускают esbuild и Vite без `tsc`; типы проверяются отдельно командой `npm run typecheck` |
| лимиты | 40 участников максимум; время вопроса 5–3600 с; баллы 0–1000; округление баллов до 3 знаков |

## 12. Чек-лист перед передачей проекта

1. `npm run typecheck` — без ошибок.
2. `npm test` — все юнит-тесты проходят.
3. `npm run build` — собирается.
4. `npm run e2e` — «ВСЁ ОК» по всем трём сценариям, скриншоты просмотрены.
5. `BUILD.bat` — созданы `release\QuizMaster-1.2.0-Setup.exe` и `release\QuizMaster-1.2.0-portable.zip`.
6. `node tests/e2e/packaged.mjs` — «ВСЁ ОК» (собранная версия запускается).
7. Установщик проверен на обычной машине: приложение ставится, редактор открывается, демо-пак запускается.
7. `CONTEXT.md` и `CHANGELOG.md` обновлены; `TODO.md` отражает оставшиеся задачи.
8. В документации нет ссылок на несуществующие файлы и команды.
