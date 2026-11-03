import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../../../shared/types';
import type { TickPayload } from '../../../shared/api';

/**
 * Подписка на состояние игры из main-процесса.
 * Main — единственный источник истины; окна только отображают состояние.
 */
export function useGameState(): GameState | null {
  const [state, setState] = useState<GameState | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const off = window.qm.onState((next) => {
      if (mounted.current) setState(next);
    });
    void window.qm.game.getState().then((initial) => {
      if (mounted.current && initial) setState(initial);
    });
    void window.qm.app.ready();
    return () => {
      mounted.current = false;
      off();
    };
  }, []);

  return state;
}

/** Тики таймера (для плавных анимаций и звуков). */
export function useTick(): TickPayload | null {
  const [tick, setTick] = useState<TickPayload | null>(null);
  useEffect(() => window.qm.onTick(setTick), []);
  return tick;
}

/**
 * Плавный остаток времени: пока таймер идёт, считаем локально от абсолютного
 * времени окончания; при паузе берём сохранённый остаток.
 */
export function useTimerRemaining(state: GameState | null): number {
  const [now, setNow] = useState(() => Date.now());
  const running = Boolean(state?.timer.running && state.timer.endsAt);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    setNow(Date.now());
    return () => window.clearInterval(id);
  }, [running, state?.timer.endsAt]);

  if (!state) return 0;
  if (state.timer.running && state.timer.endsAt) {
    return Math.max(0, state.timer.endsAt - now);
  }
  return Math.max(0, state.timer.remainingMs);
}
