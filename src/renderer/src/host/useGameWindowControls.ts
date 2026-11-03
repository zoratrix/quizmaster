import { useCallback, useEffect, useRef, useState } from 'react';
import type { DisplayInfo } from '../../../shared/api';
import { useRun } from './useRun';

/** Управление игровым окном и мониторами из панели ведущего. */
export interface ScreenControls {
  displays: DisplayInfo[];
  displayId: number | null;
  fullscreen: boolean;
  selectDisplay: (displayId: number) => void;
  toggleFullscreen: () => void;
  openGameWindow: () => void;
  closeGameWindow: () => void;
}

/**
 * Список мониторов запрашивается один раз при монтировании панели; выбранный
 * экран и полноэкранный режим запоминаются локально (main не присылает события
 * о состоянии игрового окна в host-окно). Начальное значение fullscreen = true
 * совпадает с настройкой windows.ts.
 */
export function useGameWindowControls(): ScreenControls {
  const run = useRun();
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [displayId, setDisplayId] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(true);
  const fullscreenRef = useRef(true);

  useEffect(() => {
    let alive = true;
    void window.qm.game
      .listDisplays()
      .then((list) => {
        if (!alive) return;
        setDisplays(list);
        setDisplayId((previous) => previous ?? list.find((item) => item.primary)?.id ?? list[0]?.id ?? null);
      })
      .catch(() => {
        // Список мониторов недоступен — блок покажет пустое состояние.
      });
    return () => {
      alive = false;
    };
  }, []);

  const selectDisplay = useCallback(
    (id: number) => {
      setDisplayId(id);
      void run(() => window.qm.game.moveToDisplay(id));
    },
    [run]
  );

  const toggleFullscreen = useCallback(() => {
    const next = !fullscreenRef.current;
    fullscreenRef.current = next;
    setFullscreen(next);
    void run(() => window.qm.game.setGameFullscreen(next));
  }, [run]);

  const openGameWindow = useCallback(() => {
    void run(async () => {
      await window.qm.game.openGameWindow();
      // Если экран выбрали до открытия окна, main ещё не знал о выборе — переносим окно сами.
      if (displayId !== null) await window.qm.game.moveToDisplay(displayId);
    });
  }, [run, displayId]);

  const closeGameWindow = useCallback(() => {
    void run(() => window.qm.game.closeGameWindow());
  }, [run]);

  return {
    displays,
    displayId,
    fullscreen,
    selectDisplay,
    toggleFullscreen,
    openGameWindow,
    closeGameWindow
  };
}
