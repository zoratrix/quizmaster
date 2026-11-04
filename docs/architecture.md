# Архитектура QuizMaster и формат `.quizpack`

Документ для разработчика: как устроено приложение, какие слои за что отвечают, как хранятся
данные и как собирается установщик. Пользовательские инструкции — в
[README.md](../README.md) и [docs/user-guide.md](user-guide.md).

## 1. Назначение и ограничения

QuizMaster — локальное приложение Electron для проведения офлайн-квизов на Windows 10/11 x64.
Принципиальные ограничения, заложенные в архитектуру:

- нет сети, аккаунтов, облака и обязательной регистрации;
- все данные — локальные файлы (JSON, zip, медиафайлы);
- интернет нужен только для установки зависимостей и сборки установщика;
- три независимых окна: редактор, панель ведущего, игровой экран.

## 2. Слои

```
src/shared/    чистые типы и функции: types, factory, scoring, stats, format, api (контракт IPC)
src/main/      Electron main: окна, IPC, движок игры, формат пака, медиа, сохранения
src/preload/   contextBridge: window.qm (единственный канал renderer → main)
src/renderer/  React: оболочка + editor/ + host/ + game/
packs/         демонстрационные .quizpack (входят в установщик)
tests/         unit (tsc + node) и e2e (Playwright + Electron)
scripts/       сборка, dev-режим, генерация демо-паков и иконок
docs/          инструкции
```

| Слой | Файлы | Ответственность |
|---|---|---|
| shared | `src/shared/types.ts`, `factory.ts`, `scoring.ts`, `stats.ts`, `format.ts`, `api.ts` | модель данных, нормализация пака, подсчёт баллов и статистики, типизированный контракт IPC |
| main | `src/main/index.ts`, `windows.ts`, `ipc.ts`, `gameController.ts`, `pack.ts`, `media.ts`, `session.ts`, `paths.ts` | жизненный цикл окон, состояние игры, таймер, чтение/запись паков, медиатека, сохранения |
| preload | `src/preload/index.ts` | `window.qm`: типизированные команды и подписки через `contextBridge` |
| renderer | `src/renderer/src/**` | только отображение состояния и отправка команд |

Точка входа main — `src/main/index.ts`: регистрирует привилегированную схему `quizmedia://`,
создаёт `GameController`, поднимает IPC и открывает окно редактора.

## 3. Поток данных

```
renderer (React) --window.qm.<команда>()--> preload --ipcRenderer.invoke--> main/ipc.ts
                                                                             |
                                                                    GameController
                                                                             |
                broadcast('game:state' | 'game:tick' | 'game:notice') <------+
                                                                             |
                     editor / host / game  <---- window.qm.onState / onTick / onNotice
```

Правила:

1. Рендерер не хранит состояние игры: `useGameState` подписывается на `game:state` и один раз
   запрашивает `game:getState()` при монтировании.
2. Любое действие — команда из `window.qm` (`src/shared/api.ts` → `src/main/ipc.ts` →
   `src/preload/index.ts`).
3. После изменения `GameController` рассылает снимок состояния во все открытые окна
   (`windows.broadcast`).
4. Новую команду добавляют сразу в три места: `shared/api.ts`, `main/ipc.ts`,
   `preload/index.ts`. Контракт должен оставаться типизированным.

## 4. Почему main — единственный источник истины

- Таймер живёт в `GameController`: хранится абсолютное время окончания `timer.endsAt`
  и остаток `remainingMs`. Пауза сохраняет остаток, продолжение пересчитывает `endsAt`.
  Окно могут свернуть, перетащить на другой монитор или оно может зависнуть — отсчёт
  в рендерере от этого не должен зависеть.
- Окна не дублируют вычисления: места, суммы, статистика считаются из `GameState` общими
  функциями (`shared/scoring.ts`, `shared/stats.ts`).
- Автосохранение и восстановление выполняются в main, поэтому не зависят от того, открыта ли
  панель ведущего.
- Состояние восстанавливается после перезапуска приложения, а не после перезагрузки окна.

## 5. Окна и маршруты

Маршрут окна задаётся хэшем URL (`src/renderer/src/hooks/useHashRoute.ts`):

| Маршрут | Компонент | Файлы |
|---|---|---|
| `#/editor` | `EditorApp` | `src/renderer/src/editor/**`, `styles/editor.css` |
| `#/host` | `HostApp` | `src/renderer/src/host/**`, `styles/host.css` |
| `#/game` | `GameApp` | `src/renderer/src/game/**`, `styles/game.css` |

Жизненный цикл (`src/main/windows.ts`):

1. При старте создаётся окно редактора (1440×920, минимум 1080×700).
2. `pack:prepareGame` открывает панель ведущего (1360×900) и игровое окно.
3. Игровое окно занимает весь выбранный монитор и по умолчанию открывается в полноэкранном
   режиме. Монитор выбирается по `display.bounds`; если подключено два монитора, берётся
   не основной.
4. Повторный вызов открытия окна показывает и фокусирует существующее окно.
5. Выключенное окно можно открыть заново: команды `game:openGameWindow`,
   `game:openHostWindow`, `game:openEditorWindow`.

Безопасность рендерера: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false`.
Внутренние переходы ограничены `file://` и dev-сервером; внешние `http(s)`-ссылки открываются
в системном браузере (`setWindowOpenHandler`). Меню приложения ставится в
`installMenu()`; в режиме разработки меню стандартное (с DevTools).

Приложение захватывает единственный экземпляр (`app.requestSingleInstanceLock`): повторный
запуск фокусирует окно редактора.

## 6. Фазы игры

`GameState.phase` — конечный автомат в `GameController`:

```
lobby → round-intro → question → round-review → round-handin → round-answers → round-summary → finished
```

| Фаза | Смысл | Переходы |
|---|---|---|
| `lobby` | ввод участников, выбор режима | `game:start` → `round-intro` |
| `round-intro` | заставка раунда, `questionIndex = -1` | `next` → `question`; `endRound` → `round-summary` |
| `question` | вопрос и таймер | `next`/`skip` → следующий вопрос или `round-review`; `prev` → предыдущий вопрос (с первого — `round-intro`) |
| `round-review` | повторный показ вопросов раунда по 15 секунд | `next` → следующий вопрос обзора или `round-handin`; `prev` → предыдущий вопрос; `endRound` → `round-summary` |
| `round-handin` | 40 секунд на сдачу бланков | `next` → `round-answers`; `prev` → `round-review`; `endRound` → `round-summary` |
| `round-answers` | показ ответов по одному, таймер `settings.answerRevealSec` | `next` → следующий ответ (последний — `round-summary`); `prev` → предыдущий ответ; автопереход по таймеру; `endRound` → `round-summary` |
| `round-summary` | ведущий вносит результаты | `nextRound` → `round-intro` (после последнего раунда — `finished`); `finish` → `finished` |
| `finished` | итоги, сохранение игры удаляется | `abandon` → состояние очищается |

Ключевые правила:

- при открытии вопроса таймер запускается автоматически; по истечении времени вопрос
  не переключается — это делает ведущий;
- `skip` добавляет вопрос в `skippedQuestionIds`; статистика вопросов и награды такие вопросы
  пропускают;
- в фазе `round-answers` таймер — `answerRevealDurationMs` (`settings.answerRevealSec`,
  по умолчанию 15 с): по истечении main сам открывает следующий ответ, `next` ускоряет;
  `pause` останавливает таймер и медиа ответа;
- показ ответа (`setRevealed(true)`) останавливает таймер;
- `pause` останавливает таймер и медиа (медиа — на стороне рендерера), `resume` продолжает
  с сохранённого остатка;
- баллы хранятся как `scores[teamId][questionId]`, значения неотрицательные, округление
  до 3 знаков (`shared/scoring.ts`).

## 7. Формат `.quizpack`

`.quizpack` — обычный zip-архив. Внутри:

```
manifest.json
media/<assetId>.<ext>
...
```

`manifest.json` (`src/shared/types.ts`, `PackManifest`):

```json
{
  "schemaVersion": 2,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "pack": {
    "schemaVersion": 2,
    "id": "pack_…",
    "title": "Название квиза",
    "description": "",
    "createdAt": "…",
    "updatedAt": "…",
    "settings": {
      "defaultTimeLimitSec": 60,
      "defaultPoints": 1,
      "partialCreditRatio": 0.5,
      "answerRevealSec": 15
    },
    "music": [],
    "rounds": [
      {
        "id": "r_…",
        "title": "Раунд 1",
        "cover": null,
        "questions": [
          {
            "id": "q_…",
            "text": "Текст вопроса",
            "answer": "Правильный ответ",
            "answerMedia": { "image": null, "audio": null, "video": null },
            "explanation": "",
            "timeLimitSec": 60,
            "points": 1,
            "media": { "image": null, "audio": null, "video": null }
          }
        ]
      }
    ]
  },
  "media": [
    {
      "asset": {
        "id": "m_…",
        "kind": "image",
        "fileName": "picture.png",
        "mimeType": "image/png",
        "size": 12345,
        "sha256": "…"
      },
      "entry": "media/m_….png"
    }
  ]
}
```

Правила формата:

- `SCHEMA_VERSION = 2` (`shared/types.ts`). Менять структуру пака можно только вместе
  с обновлением `SCHEMA_VERSION` и `normalizePack`, чтобы старые паки открывались.
- Необязательные поля: `pack.music` (плейлист), `round.cover` (обложка раунда),
  `question.answerMedia` (картинка/аудио/видео ответа) и `settings.answerRevealSec`
  (секунды на показ одного ответа, по умолчанию 15). У паков `schemaVersion: 1`
  `normalizePack` заполняет их пустыми значениями (`[]`, `null`, 15), поэтому старые паки
  открываются без замечаний; старое поле картинки ответа переносится в `answerMedia.image`.
- Медиа внутри архива лежит по пути `media/<assetId><расширение>`; расширение определяется
  по имени файла или MIME (`pack.ts`, `extensionFor`).
- Для каждого медиафайла считается SHA-256. При открытии пака контрольная сумма каждого файла
  сверяется с манифестом.
- `manifest.schemaVersion` больше текущего — пак всё равно открывается, но пользователь
  получает предупреждение «Пак создан в более новой версии QuizMaster…».

Чтение (`readPackFile`):

1. Проверить наличие файла и `manifest.json`; ошибки возвращаются как исключения с текстом
   «Повреждённый пак: …».
2. Прочитать манифест, распаковать медиа в `%APPDATA%\quizmaster\media`.
3. Сверить SHA-256 каждого файла.
4. Нормализовать пак (`normalizePack`) — восстановить недостающие поля.
5. Вернуть пак, путь и список замечаний `issues` (отсутствующие и повреждённые медиа).
   Замечания показываются пользователю, а не блокируют открытие.

Запись (`writePackFile`):

1. Собрать все медиа пака (`collectMedia`), найти их файлы в медиатеке.
2. Добавить в zip `media/*` и пересчитать для них `size` и `sha256`.
3. Записать `manifest.json` с обновлённым `updatedAt`.
4. Если файл медиа не найден в медиатеке, пак сохраняется с замечанием, а файл не попадает
   в архив.

## 8. Медиатека и протокол `quizmedia://`

- Файлы медиа хранятся в `%APPDATA%\quizmaster\media` (`src/main/paths.ts`,
  `mediaLibraryDir`).
- При старте `initMediaLibrary` читает папку и заполняет реестр `assetId → путь`.
- Идентификатор ассета вычисляется от содержимого: `m_<первые 16 символов SHA-256>`.
  Одинаковые файлы переиспользуют один ассет, пак не раздувается.
- Окна получают медиа по URL `quizmedia://asset/<assetId>` (`lib/media.ts`).
- Main обрабатывает протокол в `index.ts` (`serveMedia`): отдаёт файл с MIME по расширению,
  поддерживает Range-запросы (`206 Partial Content`), поэтому видео можно перематывать.
- Схема зарегистрирована как привилегированная (`standard`, `secure`, `stream`,
  `supportFetchAPI`, `corsEnabled`).
- При открытии пака его медиа распаковывается в библиотеку и регистрируется, поэтому пак
  можно открыть на другом компьютере — медиа приедет внутри архива.
- `collectMedia` собирает все медиа пака, включая `pack.music`, `round.cover` и
  `question.answerMedia` (картинка/аудио/видео ответа): они встраиваются в `.quizpack`
  и проверяются по SHA-256 так же, как медиа вопросов.
- Медиа ответа выводится на экране ответов (`game/RoundAnswersView.tsx` через `MediaStage`):
  видео приоритетнее картинки, аудио играет отдельным плеером.
- Фоновая музыка пака — обычные медиа-ассеты: игровое окно проигрывает их по кругу в паузах
  игры (лобби, заставки раундов, сдача бланков, итоги раунда, финал), а во время вопросов
  музыка молчит. При запуске пака громкость сбрасывается на 25%; громкость, пауза и mute
  хранятся в main (`ipc.ts`, `game:getMusicState` / `setMusicState`, событие `game:music`).
  Встроенный звук фанфар — статический ассет рендерера `src/renderer/src/assets/fanfare.mp3`,
  в пак он не входит.

## 9. Автосохранение и восстановление

### Черновик редактора

- `EditorApp` через 900 мс после изменения вызывает `pack:draftSave`.
- Файл: `%APPDATA%\quizmaster\drafts\draft.json` (пак и путь к файлу пака).
- При старте редактор вызывает `pack:draftLoad`; если черновик есть, загружает его и показывает
  полосу «Восстановлен несохранённый черновик».
- Успешное сохранение пака (`pack:save`) очищает черновик (`pack:draftClear`).

### Сохранение игры

- `GameController.persist()` вызывается после каждого изменения состояния и дополнительно
  раз в 3 секунды, пока идёт таймер.
- Фазы `lobby` и `finished` не сохраняются.
- Файл: `%APPDATA%\quizmaster\sessions\current.json` (схема `PersistedSession`). Запись идёт
  во временный файл и затем переименовывается, чтобы не оставить повреждённый JSON.
- `game:recoveryInfo` читает сохранение и возвращает описание (пак, фаза, команды, номер
  раунда и вопроса, время), но только если фаза не `lobby` и не `finished`.
- `game:recover` при необходимости перечитывает пак по сохранённому пути (медиа на месте),
  затем `GameController.restore`: таймер замирает с сохранённым остатком, игра ставится
  на паузу.
- `game:discardRecovery` и `game:abandon` удаляют сохранение; `finish` также очищает его.

## 10. Сборка и упаковка

| Шаг | Файл/команда | Результат |
|---|---|---|
| сборка main/preload | `scripts/build-app.mjs` (esbuild) | `dist/main/index.js`, `dist/preload/index.js` |
| сборка рендерера | `scripts/build-app.mjs` (Vite, `vite.config.ts`) | `dist/renderer/**` |
| упаковка установщика | `electron-builder --win nsis` (`electron-builder.yml`) | `release\QuizMaster-1.3.1-Setup.exe` |

`electron-builder.yml`:

- `appId: ru.quizmaster.app`, `productName: QuizMaster`;
- файлы приложения: `dist/main`, `dist/preload`, `dist/renderer`, `package.json`;
- `asar: true`;
- демо-паки попадают в `resources/packs` (`extraResources`);
- цель — NSIS, только x64, установка для текущего пользователя (`perMachine: false`),
  можно выбрать папку, создаются ярлыки на рабочем столе и в меню «Пуск»;
- `artifactName: QuizMaster-${version}-Setup.${ext}`;
- `deleteAppDataOnUninstall: false` — данные в `%APPDATA%\quizmaster` остаются после удаления.

Кэши сборки хранятся внутри проекта: `.cache/npm` (`.npmrc`), `.cache/electron`,
`.cache/electron-builder` (переменные окружения в `INSTALL.bat` и `BUILD.bat`).

## 11. Каталоги и переменные

| Путь | Назначение |
|---|---|
| `%APPDATA%\quizmaster` | каталог данных (`app.getPath('userData')`) |
| `%APPDATA%\quizmaster\media` | медиатека |
| `%APPDATA%\quizmaster\drafts` | черновик редактора |
| `%APPDATA%\quizmaster\sessions` | сохранение незавершённой игры |
| `packs\` в папке проекта | демо-паки для запуска из папки проекта |
| `resources\packs` рядом с установленным приложением | демо-паки установленной версии |
| `dist\` | собранное приложение |
| `release\` | установщик |

Переменные окружения:

| Переменная | Назначение |
|---|---|
| `QM_USER_DATA` | подменить каталог данных (используется тестами и портативным запуском) |
| `QM_DEV_SERVER_URL` | адрес dev-сервера Vite; включает режим разработки в `windows.ts` |

## 12. Тестирование

1. `npm run typecheck` — типы TypeScript.
2. `npm test` — юнит-тесты подсчёта баллов и статистики (tsc → `.test-build`, запуск node).
3. `npm run build` — сборка main/preload/renderer.
4. `npm run e2e` — все e2e-проверки на реальном Electron (`tests/e2e/run.mjs` запускает
   `smoke.mjs`, `ui-flow.mjs`, `pack-integrity.mjs`): окна, таймер, пауза, баллы,
   восстановление после сбоя, финал, клики интерфейса, повреждённые паки. Скриншоты
   сохраняются в `tests/e2e/artifacts/`.

Отдельный сценарий можно запустить напрямую, например `node tests/e2e/smoke.mjs`.
Дымовой e2e-тест использует демо-пак `packs/demo-space.quizpack` (2 раунда, 5 вопросов,
медиа) и подменяет каталог данных через `QM_USER_DATA`, чтобы не трогать данные пользователя.

## 13. Правила расширения

1. Новая команда интерфейса: `src/shared/api.ts` → `src/main/ipc.ts` → `src/preload/index.ts`.
2. Не создавать второй слой состояния (Redux, Zustand, «сервисы»): хватает `useGameState`.
3. Не добавлять микросервисы, базы данных, облако и авторизацию.
4. Не менять формат `.quizpack` без `SCHEMA_VERSION` и `normalizePack`.
5. Не оставлять заглушек: кнопка либо работает, либо отсутствует.
6. Внутри проекта только относительные пути; интернет — только на этапе установки зависимостей.
7. После изменений UI смотреть скриншоты e2e-теста: интерфейс должен читаться с проектора.
