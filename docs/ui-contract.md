# UI-контракт QuizMaster (для параллельной разработки)

Документ фиксирует общие правила интерфейса, чтобы редактор, панель ведущего и игровой экран
выглядели как одно приложение. Стек: Electron + React 18 + TypeScript + обычный CSS (без Tailwind).

## Структура окна

Одно окно = один экран, маршрут задаётся хэшем URL:

| Маршрут | Компонент | Файлы |
|---|---|---|
| `#/editor` | `EditorApp` | `src/renderer/src/editor/**`, `styles/editor.css` |
| `#/host` | `HostApp` | `src/renderer/src/host/**`, `styles/host.css` |
| `#/game` | `GameApp` | `src/renderer/src/game/**`, `styles/game.css` |

`App.tsx` подключает маршрут, `ToastProvider` уже обёрнут вокруг экрана.

## Доступ к состоянию

Main-процесс — единственный источник истины. Рендерер только читает состояние и отправляет команды.

```ts
import { useGameState, useTimerRemaining } from '../hooks/useGameState';

const state = useGameState();          // GameState | null, обновляется событиями из main
const remainingMs = useTimerRemaining(state); // плавный остаток времени
```

Команды — через `window.qm` (полный список и типы: `src/shared/api.ts`):

```ts
await window.qm.game.next();
await window.qm.game.pause();
await window.qm.game.setScore(teamId, questionId, 2.5);
window.qm.onState(cb) / onTick(cb) / onNotice(cb) // подписки, возвращают unsubscribe
```

Фазы игры (`state.phase`): `lobby` (ввод команд) → `round-intro` (заставка раунда) →
`question` (вопрос + таймер, все вопросы раунда) → `round-review` (повторный показ вопросов по 15 с) →
`round-handin` (40 с на сдачу бланков) → `round-answers` (правильные ответы на все вопросы раунда) →
`round-summary` (ведущий вносит результаты) → `finished` (итоги).

Текущий вопрос: `state.pack.rounds[state.roundIndex].questions[state.questionIndex]`
(в фазе `round-intro` `questionIndex === -1`).

Медиа: `mediaUrl(asset.id)` из `src/renderer/src/lib/media.ts` → URL для `<img>`/`<audio>`/`<video>`.

Тема пака: `state.pack.theme` (`ThemeId` из `src/shared/themes.ts`). Применяется только к игровому
экрану: элемент `.game-root` получает `data-theme=<id>`, стили тем — в `game.css`. Каталог —
`PACK_THEMES` (14 тем), порядок групп в редакторе — `THEME_GROUPS`: «Базовые» (Студия, Голубая,
Розовая, Пастель), «Сезоны» (Зима, Весна, Лето, Осень), «Стили» (Киберпанк, Ретро (XP), Windows 98),
«Праздники» (Хэллоуин, Новый год, День святого Валентина). Выбор темы — в «Настройках пака» редактора,
там же живой предпросмотр игрового экрана на реальных стилях игры. Редактор и панель ведущего
тему не применяют; старые паки нормализуются в «Студию» (`normalizeTheme`).

## Библиотека компонентов и утилит

```tsx
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Modal, ConfirmDialog } from '../components/Modal';
import { useToast } from '../components/Toasts';
import { Countdown } from '../components/Countdown';
import { cx } from '../lib/cx';
import { formatScore } from '../../shared/scoring';   // 2,5
import { formatClock, formatBalls } from '../../shared/format';
```

- `<Button variant="primary|ghost|danger|ok|mid|bad" size="sm|md|lg" block />`
- `<Field label hint><input className="input" /></Field>` — классы полей: `input`, `textarea`, `select`
- `<Modal open title onClose footer wide>` и `<ConfirmDialog open title message danger onConfirm onCancel>`
- `const toast = useToast(); toast.error('текст')` — уведомление внизу справа
- `<Countdown remainingMs durationMs size paused ended caption />` — крупный круговой таймер

Готовые классы из `styles/base.css`: `panel`, `panel--pad`, `card`, `table`, `table--compact`,
`badge`, `badge--ok/mid/bad/accent`, `divider`, `empty`, `empty__title`, `scroll`, `row`, `col`,
`grow`, `muted`, `dim`, `small`, `mono`, `tabular`, `truncate`, `gap-4..24`, `btn`, `btn--sm`.

Токены: `--bg`, `--surface`, `--border`, `--text`, `--text-muted`, `--text-dim`, `--accent`,
`--accent-2`, `--ok`, `--mid`, `--bad`, `--radius*`, `--shadow*`, `--font*`, `--ease`.

## Правила

1. Работать только в своих файлах; общие файлы (`App.tsx`, `base.css`, компоненты, `shared/**`,
   `main/**`) не менять. Нужна правка общего кода — сообщить ведущему агентству (Lead).
2. Никаких новых npm-зависимостей, внешних шрифтов, иконок из интернета, картинок с CDN.
   Приложение полностью офлайн: только текст/эмодзи/inline SVG.
3. Весь текст интерфейса — на русском, тон спокойный и профессиональный.
4. TypeScript strict, без `any` без необходимости; чинить только ошибки в своих файлах.
5. Проверка: `npx tsc -p tsconfig.json --noEmit` (запускается в песочнице). Ошибки в чужих
   файлах игнорировать, своих — быть 0. `npm run build` запускает Lead.
6. Дизайн: тёмная тема, крупные радиусы, стеклянные панели, аккуратная типографика.
   Не использовать стандартный вид HTML-форм — всё через классы выше.
7. Никаких «заглушек» вместо функционала: кнопки должны реально вызывать команды `window.qm`.
8. Не создавать `node_modules`, не запускать `npm install`, не менять `package.json`.
