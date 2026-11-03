import { useMemo, useState } from 'react';
import type { GameState, Team } from '../../../shared/types';
import { formatScore } from '../../../shared/scoring';
import { Button } from '../components/Button';
import { cx } from '../lib/cx';
import { useRun } from './useRun';
import { useScoreCommands } from './useScoreCommands';
import type { ScreenControls } from './useGameWindowControls';
import { ScoreTable } from './ScoreTable';
import { ScorePanel, ScorePanelIdle } from './ScorePanel';
import { Standings } from './Standings';
import {
  findQuestion,
  modeLabel,
  progressPercent,
  roundProgress,
  roundTeamTotal,
  scoreAt,
  type CellRef
} from './helpers';

export interface RoundSummaryViewProps {
  state: GameState;
  screen: ScreenControls;
}

/**
 * Итоги раунда: та же таблица баллов (редактируемая), результаты по командам
 * и переход к следующему раунду или к итогам игры.
 */
export function RoundSummaryView({ state, screen }: RoundSummaryViewProps) {
  const run = useRun();
  const score = useScoreCommands();
  const [selected, setSelected] = useState<CellRef | null>(null);

  const rounds = state.pack.rounds;
  const round = rounds[state.roundIndex];
  const isLastRound = state.roundIndex >= rounds.length - 1;
  const progress = roundProgress(state.scores, round, state.teams);
  const percent = progressPercent(progress.entered, progress.total);

  const totals = useMemo(() => {
    const sorted = state.teams
      .map((team) => ({ team, total: roundTeamTotal(state.scores, round, team.id) }))
      .sort((a, b) => b.total - a.total || a.team.name.localeCompare(b.team.name, 'ru'));
    const rows: Array<{ team: Team; total: number; place: number }> = [];
    sorted.forEach((row, index) => {
      const previous = rows[index - 1];
      const place = previous && previous.total === row.total ? previous.place : index + 1;
      rows.push({ ...row, place });
    });
    return rows;
  }, [state.scores, state.teams, round]);

  const located = selected ? findQuestion(state.pack, selected.questionId) : null;
  const selectedTeam = selected ? state.teams.find((team) => team.id === selected.teamId) ?? null : null;
  const selectedQuestion = located?.question ?? null;
  const selectedValue =
    selected && selectedQuestion ? scoreAt(state.scores, selected.teamId, selectedQuestion.id) : undefined;
  const selectedRoundTitle = located ? rounds[located.roundIndex]?.title ?? '' : '';

  const applyScore = (action: 'set' | 'add', value: number): void => {
    if (!selected) return;
    score(selected, action, value);
  };

  return (
    <div className="host-root">
      <header className="host-topbar panel">
        <div className="host-topbar__identity">
          <h1 className="host-topbar__title truncate" title={state.pack.title}>
            Раунд завершён — внесите результаты
          </h1>
          <div className="host-topbar__badges">
            <span className="badge truncate" title={state.pack.title}>
              {state.pack.title}
            </span>
            <span className="badge badge--accent">
              Раунд {state.roundIndex + 1}/{rounds.length}
            </span>
            <span className="badge badge--ok">Раунд завершён</span>
            <span className="badge">{modeLabel(state.mode)}</span>
          </div>
        </div>

        <div className="grow" />

        <div className="host-topbar__actions">
          <Button variant="ghost" onClick={screen.openGameWindow} title="Открыть игровое окно">
            Игровой экран
          </Button>
          <Button
            variant="ghost"
            onClick={screen.toggleFullscreen}
            title="Переключить полноэкранный режим игрового окна"
          >
            {screen.fullscreen ? 'Оконный режим' : 'Полный экран'}
          </Button>
        </div>
      </header>

      <div className="host-body">
        <aside className="host-left">
          <section className="panel summary-card">
            <div className="panel__title">Итоги раунда</div>
            <div className="summary-card__round truncate" title={round.title}>
              {round.title}
            </div>
            <div className="summary-card__meta small muted">
              {round.questions.length} вопросов · внесено {progress.entered} из {progress.total} оценок
            </div>
            <div className="host-progress__bar summary-card__bar" aria-hidden="true">
              <span style={{ width: `${percent}%` }} />
            </div>

            <div className="summary-card__list scroll">
              {totals.length === 0 ? (
                <div className="empty small">Участники не добавлены</div>
              ) : (
                totals.map((row) => (
                  <div
                    key={row.team.id}
                    className={cx(
                      'summary-row',
                      row.place === 1 && row.total > 0 && 'summary-row--leader'
                    )}
                  >
                    <span className="summary-row__place">{row.place}</span>
                    <span className="summary-row__name truncate" title={row.team.name}>
                      {row.team.name}
                    </span>
                    <span className="summary-row__points mono">{formatScore(row.total)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="divider" />

            <div className="summary-card__actions">
              {isLastRound ? (
                <Button
                  variant="primary"
                  size="lg"
                  block
                  onClick={() => void run(() => window.qm.game.finish())}
                >
                  Показать итоги
                </Button>
              ) : (
                <>
                  <Button
                    variant="primary"
                    size="lg"
                    block
                    onClick={() => void run(() => window.qm.game.nextRound())}
                  >
                    Следующий раунд
                  </Button>
                  <Button variant="ghost" block onClick={() => void run(() => window.qm.game.finish())}>
                    Итоги игры
                  </Button>
                </>
              )}
            </div>
            <div className="small dim summary-card__hint">
              {isLastRound
                ? 'Это последний раунд — итоги уже можно показать участникам.'
                : 'Проверьте баллы: таблицу можно править прямо здесь.'}
            </div>
          </section>
        </aside>

        <main className="host-center">
          <div className="host-rounds">
            <span className="host-rounds__label small dim">Раунд</span>
            <span className="host-rounds__name truncate muted">{round.title}</span>
            <div className="grow" />
            <span className="badge badge--ok">все вопросы пройдены</span>
          </div>

          <ScoreTable
            round={round}
            teams={state.teams}
            state={state}
            currentQuestionId={null}
            selected={selected}
            onSelect={setSelected}
          />

          <div className="host-progress">
            <span className="small muted">
              Внесено <b className="tabular">{progress.entered}</b> из{' '}
              <b className="tabular">{progress.total}</b> оценок
            </span>
            <div className="host-progress__bar" aria-hidden="true">
              <span style={{ width: `${percent}%` }} />
            </div>
            {progress.entered < progress.total ? (
              <span className="badge badge--mid">есть невнесённые оценки</span>
            ) : (
              <span className="badge badge--ok">все оценки внесены</span>
            )}
          </div>

          {selectedTeam && selectedQuestion && located ? (
            <ScorePanel
              team={selectedTeam}
              question={selectedQuestion}
              questionNumber={located.questionIndex + 1}
              roundTitle={selectedRoundTitle}
              value={selectedValue}
              onSet={(value) => applyScore('set', value)}
              onAdd={(delta) => applyScore('add', delta)}
            />
          ) : (
            <ScorePanelIdle />
          )}
        </main>

        <aside className="host-right">
          <Standings state={state} title="Общий счёт" />
        </aside>
      </div>
    </div>
  );
}
