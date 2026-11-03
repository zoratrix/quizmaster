import { useEffect, useState } from 'react';
import { Countdown } from '../components/Countdown';
import type { GameState } from '../../../shared/types';
import { plural } from '../../../shared/stats';

/** Крупный обратный отсчёт: основной элемент экрана сдачи бланков. */
function computeHandInTimerSize(): number {
  const base = Math.min(window.innerWidth, window.innerHeight);
  return Math.round(Math.max(190, Math.min(400, base * 0.38)));
}

/**
 * Сдача бланков: 40 секунд, крупная надпись «СДАЙТЕ БЛАНКИ» и обратный отсчёт.
 * Никаких вопросов и ответов — экран должен читаться одним взглядом.
 * Таймер и медиа ведёт main-процесс, пауза приходит в state.paused.
 */
export function RoundHandInView({ state, remainingMs }: { state: GameState; remainingMs: number }) {
  const [timerSize, setTimerSize] = useState(computeHandInTimerSize);

  useEffect(() => {
    const onResize = (): void => setTimerSize(computeHandInTimerSize());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const round = state.pack.rounds[state.roundIndex];
  const roundNumber = state.roundIndex + 1;
  const totalRounds = state.pack.rounds.length;
  const roundTitle = round?.title.trim() || `Раунд ${roundNumber}`;
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const ended = remainingMs <= 0;
  const caption = state.paused
    ? 'Пауза'
    : ended
      ? 'Время вышло'
      : `Осталось ${seconds} ${plural(seconds, 'секунда', 'секунды', 'секунд')}`;

  return (
    <section className="game-screen game-screen--handin" aria-label="Сдача бланков">
      <div className="game-handin">
        <div className="game-handin__halo" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="game-handin__kicker">
          {state.pack.title.trim() || 'QuizMaster'} · {roundTitle} · Раунд {roundNumber} из {totalRounds}
        </div>

        <h1 className="game-handin__title">СДАЙТЕ БЛАНКИ</h1>

        <div className="game-handin__countdown">
          <Countdown
            remainingMs={remainingMs}
            durationMs={state.timer.durationMs}
            size={timerSize}
            paused={state.paused}
            ended={ended}
            caption="секунд"
          />
        </div>

        <p className="game-handin__caption">{caption}</p>
      </div>
    </section>
  );
}
