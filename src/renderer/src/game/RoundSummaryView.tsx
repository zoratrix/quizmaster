import type { GameState } from '../../../shared/types';

/**
 * Итоги раунда: ведущий вносит результаты вручную, участникам нужно подождать.
 * Баллы на проекторе не показываем — только названия команд.
 */
export function RoundSummaryView({ state }: { state: GameState }) {
  const round = state.pack.rounds[state.roundIndex];
  const roundNumber = state.roundIndex + 1;
  const totalRounds = state.pack.rounds.length;
  const isLast = roundNumber >= totalRounds;

  return (
    <section className="game-screen game-screen--round-summary">
      <div className="game-summary">
        <div className="game-summary__kicker">
          {round && round.title.trim() ? round.title.trim() : `Раунд ${roundNumber}`} · Раунд {roundNumber} из{' '}
          {totalRounds}
        </div>

        <h1 className="game-summary__title">Раунд завершён</h1>

        <div className="game-summary__status">
          <span className="game-summary__dot" aria-hidden="true" />
          {isLast ? 'Финальный раунд · ждём ведущего' : 'Ждём ведущего'}
        </div>

        <p className="game-summary__hint">
          Ведущий вносит результаты раунда. Пожалуйста, подождите — игра продолжится через минуту.
        </p>

        {state.teams.length > 0 ? (
          <div className="game-summary__teams">
            {state.teams.map((team, index) => (
              <span
                className="game-chip game-chip--muted"
                key={team.id}
                style={{ animationDelay: `${Math.min(index, 12) * 60}ms` }}
              >
                {team.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
