import { useEffect, useRef, useState } from 'react';
import type { RecoveryInfo } from '../../../shared/api';
import type { GameMode, GameState, Team } from '../../../shared/types';
import { totalQuestionCount } from '../../../shared/factory';
import { plural } from '../../../shared/stats';
import { Button } from '../components/Button';
import { cx } from '../lib/cx';
import { useRun } from './useRun';
import type { ScreenControls } from './useGameWindowControls';
import { RecoveryBanner } from './RecoveryBanner';
import { modeLabel } from './helpers';

export interface LobbyViewProps {
  state: GameState;
  screen: ScreenControls;
  recovery: RecoveryInfo | null;
  recoveryBusy: boolean;
  onRecover: () => void;
  onDiscardRecovery: () => void;
}

interface ToggleProps {
  checked: boolean;
  label: string;
  hint?: string;
  onChange: (checked: boolean) => void;
}

function SwitchRow({ checked, label, hint, onChange }: ToggleProps) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        className="switch__input"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch__track" aria-hidden="true">
        <span className="switch__thumb" />
      </span>
      <span className="switch__text">
        <span className="switch__label">{label}</span>
        {hint ? <span className="switch__hint small dim">{hint}</span> : null}
      </span>
    </label>
  );
}

/**
 * Лобби: состав участников, режим игры, запуск и управление экранами.
 * Список участников живёт в main-состоянии — все операции идут через команды.
 */
export function LobbyView({
  state,
  screen,
  recovery,
  recoveryBusy,
  onRecover,
  onDiscardRecovery
}: LobbyViewProps) {
  const run = useRun();
  const [mode, setMode] = useState<GameMode>(state.mode);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const skipBlurRef = useRef(false);

  // Режим в state меняется только через game.start; держим локальный выбор синхронным.
  useEffect(() => {
    setMode(state.mode);
  }, [state.mode]);

  const teams = state.teams;
  const hasTeams = teams.length > 0;
  const isTeamMode = mode === 'team';
  const teamsWord = plural(teams.length, 'команда', 'команды', 'команд');
  const peopleWord = plural(teams.length, 'участник', 'участника', 'участников');

  const addTeam = (): void => {
    const clean = newName.trim();
    if (!clean) return;
    setNewName('');
    void run(() => window.qm.game.addTeam(clean));
  };

  const startGame = (): void => {
    if (!hasTeams) return;
    void run(() => window.qm.game.start({ teams, mode }));
  };

  const beginRename = (team: Team): void => {
    skipBlurRef.current = false;
    setEditingId(team.id);
    setDraftName(team.name);
  };

  const finishRename = (team: Team): void => {
    if (skipBlurRef.current) {
      skipBlurRef.current = false;
      return;
    }
    const clean = draftName.trim();
    setEditingId(null);
    if (!clean || clean === team.name) return;
    void run(() => window.qm.game.renameTeam(team.id, clean));
  };

  const removeTeam = (team: Team): void => {
    void run(() => window.qm.game.removeTeam(team.id));
  };

  return (
    <div className="host-root host-root--lobby">
      <header className="host-lobby-head">
        <div className="host-lobby-head__main">
          <h1 className="host-lobby-title">{state.pack.title}</h1>
          <p className="host-lobby-description muted">
            {state.pack.description?.trim()
              ? state.pack.description
              : 'Описание пака не заполнено. Всё готово к запуску — добавьте участников.'}
          </p>
          <div className="host-lobby-badges">
            <span className="badge badge--accent">
              {state.pack.rounds.length} {plural(state.pack.rounds.length, 'раунд', 'раунда', 'раундов')}
            </span>
            <span className="badge">
              {totalQuestionCount(state.pack)}{' '}
              {plural(totalQuestionCount(state.pack), 'вопрос', 'вопроса', 'вопросов')}
            </span>
            <span className="badge">{modeLabel(mode)}</span>
          </div>
        </div>
      </header>

      {recovery ? (
        <RecoveryBanner
          info={recovery}
          busy={recoveryBusy}
          onRecover={onRecover}
          onDiscard={onDiscardRecovery}
        />
      ) : null}

      <div className="lobby-body">
        <section className="panel lobby-teams">
          <div className="lobby-teams__head">
            <div>
              <div className="panel__title">{isTeamMode ? 'Команды' : 'Участники'}</div>
              <div className="small muted">
                {hasTeams
                  ? `${teams.length} ${isTeamMode ? teamsWord : peopleWord} в игре`
                  : 'Пока никого нет'}
              </div>
            </div>
            <div className="mode-switch" role="group" aria-label="Режим игры">
              <button
                type="button"
                className={cx('mode-switch__btn', isTeamMode && 'is-active')}
                onClick={() => setMode('team')}
                aria-pressed={isTeamMode}
              >
                Команды
              </button>
              <button
                type="button"
                className={cx('mode-switch__btn', !isTeamMode && 'is-active')}
                onClick={() => setMode('individual')}
                aria-pressed={!isTeamMode}
              >
                Индивидуальные участники
              </button>
            </div>
          </div>

          <form
            className="team-add"
            onSubmit={(event) => {
              event.preventDefault();
              addTeam();
            }}
          >
            <input
              className="input team-add__input"
              value={newName}
              maxLength={60}
              placeholder={isTeamMode ? 'Название команды' : 'Имя участника'}
              aria-label={isTeamMode ? 'Название новой команды' : 'Имя нового участника'}
              onChange={(event) => setNewName(event.target.value)}
              autoFocus
            />
            <Button type="submit" variant="primary" disabled={newName.trim().length === 0}>
              Добавить
            </Button>
          </form>

          <div className="lobby-team-list scroll">
            {teams.length === 0 ? (
              <div className="lobby-teams-empty">
                <div className="empty__title">Список пуст</div>
                <div className="small">
                  Введите название {isTeamMode ? 'команды' : 'участника'} и нажмите «Добавить» или Enter. Название
                  можно изменить прямо в списке.
                </div>
              </div>
            ) : (
              teams.map((team, index) => (
                <div key={team.id} className={cx('team-row', editingId === team.id && 'is-editing')}>
                  <span className="team-row__index mono">{index + 1}</span>
                  {editingId === team.id ? (
                    <input
                      className="input team-row__input"
                      value={draftName}
                      maxLength={60}
                      autoFocus
                      aria-label={`Имя команды ${index + 1}`}
                      onChange={(event) => setDraftName(event.target.value)}
                      onBlur={() => finishRename(team)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          event.currentTarget.blur();
                        } else if (event.key === 'Escape') {
                          skipBlurRef.current = true;
                          setEditingId(null);
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="team-row__name truncate"
                      title="Переименовать"
                      onClick={() => beginRename(team)}
                    >
                      {team.name}
                    </button>
                  )}
                  <button
                    type="button"
                    className="team-row__remove"
                    aria-label={`Удалить ${team.name}`}
                    title="Удалить"
                    onClick={() => removeTeam(team)}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="lobby-start">
            <Button variant="primary" size="lg" block disabled={!hasTeams} onClick={startGame}>
              Начать игру
            </Button>
            <div className="small dim lobby-start__hint">
              {hasTeams
                ? `Стартует раунд 1 из ${state.pack.rounds.length}. Проверьте, что игровое окно открыто на нужном экране.`
                : 'Добавьте хотя бы одного участника, чтобы запустить игру.'}
            </div>
          </div>
        </section>

        <aside className="lobby-side scroll">
          <section className="panel lobby-screens">
            <div className="panel__title">Экраны</div>
            <p className="small dim">
              Выберите монитор для игрового окна. Управление применяется к открытому игровому окну.
            </p>
            <div className="display-list scroll">
              {screen.displays.length === 0 ? (
                <div className="small dim">Мониторы не найдены.</div>
              ) : (
                screen.displays.map((display) => {
                  const active = display.id === screen.displayId;
                  return (
                    <button
                      key={display.id}
                      type="button"
                      className={cx('display-row', active && 'is-active')}
                      onClick={() => screen.selectDisplay(display.id)}
                      aria-pressed={active}
                    >
                      <span className="display-row__radio" aria-hidden="true" />
                      <span className="display-row__body">
                        <span className="display-row__label truncate">{display.label}</span>
                        <span className="display-row__size small dim">
                          {display.width}×{display.height}
                          {display.primary ? ' · основной' : ''}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            <div className="lobby-screens__actions">
              <Button variant="primary" onClick={screen.openGameWindow}>
                Открыть игровое окно
              </Button>
              <Button variant="ghost" onClick={screen.closeGameWindow}>
                Закрыть игровое окно
              </Button>
            </div>
            <div className="divider" />
            <SwitchRow
              checked={screen.fullscreen}
              label="Полный экран"
              hint="Игровое окно разворачивается на весь выбранный монитор."
              onChange={() => screen.toggleFullscreen()}
            />
          </section>

          <section className="panel lobby-note">
            <div className="panel__title">Как это работает</div>
            <ul className="lobby-note__list small muted">
              <li>Игровой экран показывает вопросы участникам, панель ведущего — вам.</li>
              <li>Ответ всегда виден в панели — его можно вывести на экран одной кнопкой.</li>
              <li>Баллы вносятся в таблицу раунда и сохраняются автоматически.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
