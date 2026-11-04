import type { GameState } from '../../../shared/types';
import { formatClock } from '../../../shared/format';
import { useTimerRemaining } from '../hooks/useGameState';
import { cx } from '../lib/cx';

export interface TimerDisplayProps {
  state: GameState;
}

/**
 * Крупный таймер ведущего. Живёт в отдельном компоненте, чтобы плавное
 * обновление остатка (10 раз в секунду) не перерисовывало всю панель.
 */
export function TimerDisplay({ state }: TimerDisplayProps) {
  const remaining = useTimerRemaining(state);
  const duration = Math.max(1, state.timer.durationMs);
  const ratio = Math.max(0, Math.min(1, remaining / duration));
  const ended =
    (state.phase === 'question' ||
      state.phase === 'round-review' ||
      state.phase === 'round-handin' ||
      state.phase === 'round-answers') &&
    remaining <= 0;
  const tone = state.paused ? 'paused' : ended || ratio <= 0.12 ? 'bad' : ratio <= 0.4 ? 'mid' : 'ok';

  let caption = 'таймер';
  if (state.paused) caption = 'пауза';
  else if (ended) caption = 'время вышло';
  else if (state.phase === 'question') caption = 'осталось';
  else if (state.phase === 'round-review') caption = 'на проверку';
  else if (state.phase === 'round-handin') caption = 'на сдачу бланков';
  else if (state.phase === 'round-answers') caption = 'показ ответа';
  else if (state.phase === 'round-intro') caption = 'до первого вопроса';

  return (
    <div className={cx('host-timer', `host-timer--${tone}`)} title="Остаток времени на вопрос">
      <span className="host-timer__value mono">{formatClock(remaining)}</span>
      <span className="host-timer__caption">{caption}</span>
    </div>
  );
}
