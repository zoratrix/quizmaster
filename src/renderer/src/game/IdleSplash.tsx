import { lobbyTitleSize } from './textFit';

export interface IdleSplashProps {
  title?: string;
  subtitle?: string;
}

/**
 * Спокойная заставка игрового экрана: состояние ещё не пришло из main-процесса
 * или игра не запущена.
 */
export function IdleSplash({ title = 'QuizMaster', subtitle = 'Ожидание игры' }: IdleSplashProps) {
  return (
    <section className="game-screen game-screen--idle">
      <div className="game-idle">
        <div className="game-idle__mark" aria-hidden="true">
          ?
        </div>
        <h1 className="game-idle__title" style={{ fontSize: lobbyTitleSize(title.length) }}>
          {title}
        </h1>
        <div className="game-idle__subtitle">{subtitle}</div>
        <div className="game-idle__waiting">
          <span className="game-idle__dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          Игровой экран готов
        </div>
      </div>
    </section>
  );
}
