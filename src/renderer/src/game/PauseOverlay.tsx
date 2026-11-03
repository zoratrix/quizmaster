import { cx } from '../lib/cx';

/**
 * Оверлей паузы: полупрозрачный фон с blur, крупная надпись «ПАУЗА».
 * Экран вопроса остаётся видимым под оверлеем, медиа ставится на паузу
 * внутри MediaStage.
 */
export function PauseOverlay({ open }: { open: boolean }) {
  return (
    <div
      className={cx('game-pause', open && 'game-pause--open')}
      aria-hidden={!open}
      role="presentation"
    >
      <div className="game-pause__content">
        <div className="game-pause__bars" aria-hidden="true">
          <span />
          <span />
        </div>
        <div className="game-pause__title">Пауза</div>
        <div className="game-pause__hint">Игра приостановлена · скоро продолжим</div>
      </div>
    </div>
  );
}
