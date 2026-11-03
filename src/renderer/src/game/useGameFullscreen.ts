import { useEffect, useRef } from 'react';

/**
 * F11 — переключение полноэкранного режима игрового окна.
 * Нужно для проектора: ведущий может выйти из полноэкранного режима,
 * чтобы добраться до панели задач, и вернуться обратно.
 *
 * Esc намеренно не обрабатывается: окно не должно закрываться по Esc.
 */
export function useGameFullscreen(): void {
  const fullscreen = useRef(true);

  useEffect(() => {
    return window.qm.onFullscreen((value) => {
      fullscreen.current = value;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'F11') return;
      event.preventDefault();
      const next = !fullscreen.current;
      fullscreen.current = next;
      void window.qm.game.setGameFullscreen(next).catch(() => {
        /* основное окно могло закрыться — ничего страшного */
      });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
