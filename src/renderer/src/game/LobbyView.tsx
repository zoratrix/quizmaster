import type { GameState } from '../../../shared/types';
import { lobbyTitleSize } from './textFit';

/**
 * Лобби: пак, команды и ожидание старта. Никаких элементов управления
 * ведущего на проекторе — только спокойная пульсирующая заставка.
 */
export function LobbyView({ state }: { state: GameState }) {
  const title = state.pack.title.trim() || 'QuizMaster';
  const description = state.pack.description.trim();

  return (
    <section className="game-screen game-screen--lobby">
      <div className="game-lobby">
        <div className="game-lobby__halo" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="game-lobby__brand">QuizMaster</div>
        <h1 className="game-lobby__title" style={{ fontSize: lobbyTitleSize(title.length) }}>
          {title}
        </h1>
        {description ? <p className="game-lobby__desc">{description}</p> : null}

        {state.teams.length > 0 ? (
          <div className="game-lobby__teams">
            {state.teams.map((team, index) => (
              <span
                className="game-chip"
                key={team.id}
                style={{ animationDelay: `${Math.min(index, 12) * 70}ms` }}
              >
                {team.name}
              </span>
            ))}
          </div>
        ) : (
          <div className="game-lobby__empty">Команды ещё не добавлены</div>
        )}

        <div className="game-lobby__waiting">
          <span className="game-lobby__pulse" aria-hidden="true" />
          Ожидание начала игры
        </div>
      </div>
    </section>
  );
}
