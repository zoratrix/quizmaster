import { useMemo, useState } from 'react';
import type { GameState, QuestionStat } from '../../../shared/types';
import { totalQuestionCount } from '../../../shared/factory';
import { computeSummary, plural } from '../../../shared/stats';
import { formatScore } from '../../../shared/scoring';
import { formatBalls, formatPercent } from '../../../shared/format';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/Modal';
import { cx } from '../lib/cx';
import { useRun } from './useRun';
import type { ScreenControls } from './useGameWindowControls';

export interface ResultsViewProps {
  state: GameState;
  screen: ScreenControls;
}

interface QuestionStatBlockProps {
  title: string;
  stat: QuestionStat | undefined;
}

function QuestionStatBlock({ title, stat }: QuestionStatBlockProps) {
  return (
    <section className="panel stat-card">
      <div className="stat-card__label">{title}</div>
      {stat ? (
        <div className="stat-question">
          <div className="small dim">
            {stat.roundTitle} · вопрос {stat.questionIndex + 1} · {formatBalls(stat.fullPoints)}
          </div>
          <div className="stat-question__text">{stat.questionText}</div>
          <div className="stat-question__score">
            <span className="stat-question__percent mono">{formatPercent(stat.successRate)}</span>
            <span className="small muted">успешных ответов</span>
          </div>
          <div className="small dim">Команд с полным баллом: {stat.fullCount}</div>
        </div>
      ) : (
        <div className="muted small">Недостаточно данных — не было вопросов с баллами.</div>
      )}
    </section>
  );
}

/**
 * Финальный экран: итоговая таблица, статистика и награды из computeSummary,
 * запуск новой игры и сброс текущей.
 */
export function ResultsView({ state, screen }: ResultsViewProps) {
  const run = useRun();
  const [confirmReset, setConfirmReset] = useState(false);
  const summary = useMemo(() => computeSummary(state), [state]);
  const rounds = state.pack.rounds;
  const teamNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const team of state.teams) map.set(team.id, team.name);
    return map;
  }, [state.teams]);

  const winnerIds = useMemo(() => new Set(summary.winnerIds), [summary.winnerIds]);
  const winners = summary.winnerIds.map((teamId) => ({
    id: teamId,
    name: teamNames.get(teamId) ?? 'Команда'
  }));
  const bestTotal = summary.teams.reduce((max, team) => Math.max(max, team.total), 0);
  const streaks = summary.teams
    .filter((team) => team.longestStreak > 0)
    .sort((a, b) => b.longestStreak - a.longestStreak || b.total - a.total);

  const resetGame = (): void => {
    setConfirmReset(false);
    void run(() => window.qm.game.abandon());
  };

  return (
    <div className="host-root">
      <header className="host-topbar panel">
        <div className="host-topbar__identity">
          <h1 className="host-topbar__title truncate" title={state.pack.title}>
            Итоги игры · {state.pack.title}
          </h1>
          <div className="host-topbar__badges">
            <span className="badge badge--ok">Игра завершена</span>
            <span className="badge">
              {rounds.length} {plural(rounds.length, 'раунд', 'раунда', 'раундов')}
            </span>
            <span className="badge">
              {totalQuestionCount(state.pack)}{' '}
              {plural(totalQuestionCount(state.pack), 'вопрос', 'вопроса', 'вопросов')}
            </span>
            <span className="badge">
              {state.teams.length} {plural(state.teams.length, 'участник', 'участника', 'участников')}
            </span>
          </div>
        </div>

        <div className="grow" />

        <div className="host-topbar__actions">
          <Button variant="primary" onClick={() => void run(() => window.qm.game.openEditorWindow())}>
            Новая игра
          </Button>
          <Button variant="ghost" onClick={screen.openGameWindow}>
            Игровой экран
          </Button>
          <Button variant="danger" onClick={() => setConfirmReset(true)}>
            Сбросить игру
          </Button>
        </div>
      </header>

      <div className="host-body results-body">
        <section className="panel results-table-panel">
          <div className="results-table-panel__head">
            <div>
              <div className="panel__title">Итоговая таблица</div>
              <div className="small muted">
                {summary.teams.length > 0
                  ? `Лучший результат: ${formatBalls(bestTotal)} · ${summary.teams.length} ${plural(
                      summary.teams.length,
                      'команда',
                      'команды',
                      'команд'
                    )}`
                  : 'Участники не добавлены'}
              </div>
            </div>
          </div>
          <div className="results-table-panel__scroll scroll">
            <table className="table results-table">
              <thead>
                <tr>
                  <th className="results-table__place">Место</th>
                  <th>Команда</th>
                  {rounds.map((round, index) => (
                    <th key={round.id} className="results-table__round tabular" title={round.title}>
                      Р{index + 1}
                    </th>
                  ))}
                  <th className="results-table__total">Итого</th>
                </tr>
              </thead>
              <tbody>
                {summary.teams.map((team) => (
                  <tr key={team.teamId} className={cx(winnerIds.has(team.teamId) && 'is-winner')}>
                    <td className="results-table__place">
                      <span className={cx('results-place', team.place === 1 && team.total > 0 && 'is-top')}>
                        {team.place}
                      </span>
                    </td>
                    <td>
                      <span className="results-table__team truncate" title={team.name}>
                        {team.name}
                      </span>
                      <div className="results-table__team-stats">
                        верных {team.fullCount} · частичных {team.partialCount} · без балла {team.zeroCount}
                        {team.bestRoundIndex !== null && team.bestRoundPoints > 0
                          ? ` · лучший раунд: Р${team.bestRoundIndex + 1} (${formatScore(team.bestRoundPoints)})`
                          : ''}
                      </div>
                    </td>
                    {team.byRound.map((points, index) => (
                      <td key={index} className="mono results-table__round">
                        {formatScore(points)}
                      </td>
                    ))}
                    <td className="mono results-table__total results-table__sum">{formatScore(team.total)}</td>
                  </tr>
                ))}
                {summary.teams.length === 0 ? (
                  <tr>
                    <td colSpan={rounds.length + 3}>
                      <div className="empty small">Участники не добавлены</div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="results-side scroll">
          <section className="panel stat-card winner-card">
            <div className="stat-card__label">Победитель</div>
            {winners.length > 0 ? (
              <>
                <div className="winner-card__trophy" aria-hidden="true">
                  🏆
                </div>
                <div className="winner-card__names">
                  {winners.map((winner) => (
                    <span key={winner.id} className="winner-card__name">
                      {winner.name}
                    </span>
                  ))}
                </div>
                <div className="small muted">
                  {formatBalls(bestTotal)} · {winners.length > 1 ? 'ничья по сумме баллов' : 'лучший результат'}
                </div>
              </>
            ) : (
              <div className="muted small">Победитель не определён: все команды без баллов.</div>
            )}
          </section>

          <QuestionStatBlock title="Самый лёгкий вопрос" stat={summary.easiest[0]} />
          <QuestionStatBlock title="Самый сложный вопрос" stat={summary.hardest[0]} />

          <section className="panel stat-card">
            <div className="stat-card__label">Награды</div>
            {summary.awards.length > 0 ? (
              <div className="awards">
                {summary.awards.map((award) => (
                  <div key={award.id} className="award">
                    <div className="award__title">{award.title}</div>
                    <div className="small dim award__description">{award.description}</div>
                    <div className="award__teams">
                      {award.teamIds.map((teamId) => (
                        <span key={teamId} className="badge badge--accent">
                          {teamNames.get(teamId) ?? 'Команда'}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted small">Награды не присвоены.</div>
            )}
          </section>

          <section className="panel stat-card">
            <div className="stat-card__label">Серии</div>
            {streaks.length > 0 ? (
              <div className="streaks">
                {streaks.map((team) => (
                  <div key={team.teamId} className="streak-row">
                    <span className="streak-row__name truncate" title={team.name}>
                      {team.name}
                    </span>
                    <span className="badge badge--ok">{team.longestStreak} подряд</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted small">Серий полных ответов не было.</div>
            )}
            <div className="small dim streaks__hint">Серия — полные ответы подряд без ошибок.</div>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Сбросить игру?"
        message="Все результаты будут потеряны. Игра закроется, и вы сможете запустить новую из редактора."
        confirmLabel="Сбросить игру"
        danger
        onConfirm={resetGame}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
