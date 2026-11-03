import { useEffect, useState } from 'react';
import { cx } from '../lib/cx';

/**
 * Единственный «служебный» элемент экрана — скрытая подсказка про F11.
 * Появляется при движении мыши и гаснет через пару секунд, чтобы не мешать
 * зрителям и не превращаться в управляющую кнопку.
 */
export function GameHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const onMouseMove = (): void => {
      setVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setVisible(false), 2600);
    };

    window.addEventListener('mousemove', onMouseMove);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className={cx('game-hint', visible && 'game-hint--visible')} aria-hidden="true">
      <kbd className="game-hint__key">F11</kbd>
      <span>полный экран</span>
    </div>
  );
}
