import type { GameState } from '../../../shared/types';
import { Button } from '../components/Button';
import { useRun } from './useRun';
import type { ScreenControls } from './useGameWindowControls';
import { TimerDisplay } from './TimerDisplay';
import { Standings } from './Standings';
import { progressPercent, roundProgress } from './helpers';

export interface HandInViewProps {
  state: GameState;
  screen: ScreenControls;
}

/**
 * Фаза сдачи бланков: 40 секунд, игровой экран показывает крупный таймер.
 * После окончания (или по кнопке) ведущий переходит к показу правильных ответов.
 */
export function HandInView({ state, screen }: HandInViewProps) {
  const run = useRun();
  const round = state.pack.rounds[state.roundIndex];
  const progress = round ? roundProgress(state.scores, round, state.teams) : { entered: 0, total: 0 };
  const percent = progressPercent(progress.entered, progress.total);
  const roundNumber = state.roundIndex + 1;

  return (
    <div className="host-root">
      <header className="host-topbar panel">
        <div className="host-topbar__identity">
          <h1 className="host-topbar__title truncate" title={state.pack.title}>
            {state.pack.title}
          </h1>
          <div className="host-topbar__badges">
            <span className="badge badge--accent">
              Раунд {roundNumber}/{state.pack.rounds.length}
            </span>
            <span className="badge">Сдача бланков</span>
            <span className="badge">{round?.title ?? 'Раунд'}</span>
            {state.paused ? <span className="badge badge--mid">Пауза</span> : null}
          </div>
        </div>

        <TimerDisplay state={state} />

        <div className="host-topbar__actions">
          <Button variant={state.paused ? 'primary' : 'ghost'} onClick={() => void run(() => window.qm.game.togglePause())}>
            {state.paused ? 'Продолжить' : 'Пауза'}
          </Button>
          <Button variant="ghost" onClick={screen.openGameWindow} title="Открыть или показать игровое окно">
            Игровой экран
          </Button>
          <Button variant="ghost" onClick={screen.toggleFullscreen} title="Переключить полноэкранный режим игрового окна">
            {screen.fullscreen ? 'Оконный режим' : 'Полный экран'}
          </Button>
        </div>
      </header>

      <div className="host-body host-handin">
        <section className="panel host-handin__card">
          <div className="panel__title">Сдача бланков</div>
          <h2 className="host-handin__headline">Соберите бланки с ответами</h2>
          <p className="host-handin__text muted">
            Участники сдают листы с ответами. На игровом экране идёт таймер на 40 секунд — после его
            окончания правильные ответы начнут показываться по одному.
          </p>
          <div className="host-handin__actions">
            <Button variant="primary" size="lg" onClick={() => void run(() => window.qm.game.next())}>
              Показать ответы
            </Button>
            <Button variant="ghost" onClick={() => void run(() => window.qm.game.toggleTimer())}>
              Пауза таймера
            </Button>
          </div>
          <div className="host-handin__hint small dim">
            Если бланки собраны раньше, нажмите «Показать ответы» — таймер не нужно ждать.
          </div>
        </section>

        <aside className="host-handin__side">
          <section className="panel panel--pad">
            <div className="panel__title">Внесение баллов</div>
            <div className="host-handin__progress">
              <span className="small muted">
                Внесено <b className="tabular">{progress.entered}</b> из <b className="tabular">{progress.total}</b> оценок
              </span>
              <div className="host-progress__bar" aria-hidden="true">
                <span style={{ width: `${percent}%` }} />
              </div>
            </div>
            <div className="small dim">
              Баллы можно вносить уже сейчас в таблице раунда после показа ответов либо на следующем шаге.
            </div>
          </section>
          <Standings state={state} />
        </aside>
      </div>
    </div>
  );
}
