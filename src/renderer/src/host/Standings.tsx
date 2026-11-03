import { useMemo } from 'react';
import type { GameState } from '../../../shared/types';
import { computeSummary } from '../../../shared/stats';
import { formatScore } from '../../../shared/scoring';
import { cx } from '../lib/cx';

export interface StandingsProps {
  state: GameState;
  title?: string;
}

/**
 * Живой общий счёт: места, названия, суммы. Лидер подсвечивается.
 * Обновляется сразу после любой правки баллов.
 */
export function Standings({ state, title = 'Общий счёт' }: StandingsProps) {
  const summary = useMemo(() => computeSummary(state), [state]);
  const leaderIds = useMemo(() => new Set(summary.winnerIds), [summary.winnerIds]);

  return (
    <section className="panel standings">
      <div className="standings__head">
        <span className="panel__title">{title}</span>
        {summary.winnerIds.length > 0 ? <span className="badge badge--accent">лидер</span> : null}
      </div>
      <div className="standings__list scroll">
        {summary.teams.map((team) => (
          <div
            key={team.teamId}
            className={cx('standings__row', leaderIds.has(team.teamId) && 'standings__row--leader')}
            title={`${team.name}: ${formatScore(team.total)} баллов, ${team.place} место`}
          >
            <span className={cx('standings__place', team.place === 1 && 'standings__place--top')}>{team.place}</span>
            <span className="standings__name truncate">{team.name}</span>
            <span className="standings__total mono">{formatScore(team.total)}</span>
          </div>
        ))}
        {summary.teams.length === 0 ? <div className="empty small">Участники ещё не добавлены</div> : null}
      </div>
      <div className="standings__foot small dim">Счёт пересчитывается после каждого изменения.</div>
    </section>
  );
}
