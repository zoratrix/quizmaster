import { useEffect, useState } from 'react';
import { Countdown } from '../components/Countdown';
import type { GameState, Question, Round } from '../../../shared/types';
import { cx } from '../lib/cx';
import { MediaStage } from './MediaStage';
import { questionTextSize } from './textFit';

export interface RoundReviewViewProps {
  state: GameState;
  round: Round;
  question: Question;
  remainingMs: number;
}

/** Небольшой таймер повторного просмотра: заметен с проектора, но не спорит с вопросом. */
function computeReviewTimerSize(): number {
  const base = Math.min(window.innerWidth, window.innerHeight);
  return Math.round(Math.max(86, Math.min(148, base * 0.11)));
}

/**
 * Повторный просмотр вопросов перед сдачей бланков: тот же вопрос с медиа,
 * но без стоимости и без ответа — только подпись «ПРОВЕРКА ОТВЕТОВ»
 * и короткий таймер на 15 секунд. Переключается автоматически из main-процесса.
 */
export function RoundReviewView({ state, round, question, remainingMs }: RoundReviewViewProps) {
  const [timerSize, setTimerSize] = useState(computeReviewTimerSize);

  useEffect(() => {
    const onResize = (): void => setTimerSize(computeReviewTimerSize());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const questionText = question.text.trim();
  const hasMedia = Boolean(question.media.video || question.media.image || question.media.audio);
  const ended = remainingMs <= 0;
  const number = state.questionIndex + 1;
  const total = round.questions.length;
  const roundTitle = round.title.trim() || `Раунд ${state.roundIndex + 1}`;

  return (
    <section
      className={cx(
        'game-screen',
        'game-screen--question',
        'game-screen--review',
        hasMedia && 'game-screen--media'
      )}
      aria-label={`Проверка ответов: вопрос ${number} из ${total}`}
    >
      <header className="game-topbar">
        <div className="game-topbar__meta">
          <span className="game-round-label">{roundTitle}</span>
          <span className="game-review-badge">ПРОВЕРКА ОТВЕТОВ</span>
          <span className="game-counter tabular">
            Вопрос {number} из {total}
          </span>
        </div>

        <div className="game-timer game-timer--compact">
          <Countdown
            remainingMs={remainingMs}
            durationMs={state.timer.durationMs}
            size={timerSize}
            paused={state.paused}
            ended={ended}
            caption="сек"
          />
          {ended && !state.paused ? <div className="game-timer__ended">Время вышло</div> : null}
        </div>
      </header>

      <div className="game-question">
        <p
          className="game-question__text"
          style={{ fontSize: questionTextSize(questionText.length, hasMedia) }}
        >
          {questionText || 'Вопрос без текста'}
        </p>

        <MediaStage key={question.id} media={question.media} paused={state.paused} />
      </div>
    </section>
  );
}
