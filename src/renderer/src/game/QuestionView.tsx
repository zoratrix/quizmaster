import { useEffect, useState } from 'react';
import { Countdown } from '../components/Countdown';
import type { GameState, Question, Round } from '../../../shared/types';
import { formatBalls } from '../../../shared/format';
import { cx } from '../lib/cx';
import { MediaStage } from './MediaStage';
import { questionTextSize } from './textFit';

export interface QuestionViewProps {
  state: GameState;
  round: Round;
  question: Question;
  remainingMs: number;
  ended: boolean;
}

/** Крупный таймер для проектора: размер зависит от размера окна. */
function computeTimerSize(): number {
  const base = Math.min(window.innerWidth, window.innerHeight);
  return Math.round(Math.max(128, Math.min(268, base * 0.2)));
}

/**
 * Экран вопроса: название раунда, счётчик вопросов, стоимость, текст вопроса,
 * медиа-зона и таймер. Правильный ответ на этом экране не раскрывается:
 * для него есть отдельная фаза round-answers.
 */
export function QuestionView({ state, round, question, remainingMs, ended }: QuestionViewProps) {
  const [timerSize, setTimerSize] = useState(computeTimerSize);

  useEffect(() => {
    const onResize = (): void => setTimerSize(computeTimerSize());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const questionText = question.text.trim();
  const hasMedia = Boolean(question.media.video || question.media.image || question.media.audio);
  const number = state.questionIndex + 1;
  const total = round.questions.length;
  const roundTitle = round.title.trim() || `Раунд ${state.roundIndex + 1}`;

  return (
    <section
      className={cx('game-screen', 'game-screen--question', hasMedia && 'game-screen--media')}
      aria-label={`Вопрос ${number} из ${total}`}
    >
      <header className="game-topbar">
        <div className="game-topbar__meta">
          <span className="game-round-label">{roundTitle}</span>
          <span className="game-counter tabular">
            Вопрос {number} из {total}
          </span>
          <span className="game-points">
            <span className="game-points__star" aria-hidden="true">
              ★
            </span>
            <span className="tabular">{formatBalls(question.points)}</span>
          </span>
        </div>

        <div className="game-timer">
          <Countdown
            remainingMs={remainingMs}
            durationMs={state.timer.durationMs}
            size={timerSize}
            paused={state.paused}
            ended={ended}
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
