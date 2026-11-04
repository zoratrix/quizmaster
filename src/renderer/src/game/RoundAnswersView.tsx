import { useEffect, useState } from 'react';
import { Countdown } from '../components/Countdown';
import type { GameState } from '../../../shared/types';
import { MediaStage } from './MediaStage';

function computeAnswerTimerSize(): number {
  const base = Math.min(window.innerWidth, window.innerHeight);
  return Math.round(Math.max(104, Math.min(190, base * 0.15)));
}

/**
 * Правильные ответы показываются по одному: вопрос → ответ → медиа к ответу
 * (картинка, музыка или видео). Main-процесс ведёт таймер и сам переключает
 * на следующий ответ, ведущий может ускорить кнопкой «Дальше».
 */
export function RoundAnswersView({ state, remainingMs }: { state: GameState; remainingMs: number }) {
  const [timerSize, setTimerSize] = useState(computeAnswerTimerSize);

  useEffect(() => {
    const onResize = (): void => setTimerSize(computeAnswerTimerSize());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const round = state.pack.rounds[state.roundIndex];
  const questions = round?.questions ?? [];
  const total = questions.length;
  const index = Math.min(Math.max(state.questionIndex, 0), Math.max(0, total - 1));
  const question = questions[index];
  const roundNumber = state.roundIndex + 1;
  const roundTitle = round?.title.trim() || `Раунд ${roundNumber}`;
  const ended = remainingMs <= 0;

  return (
    <section className="game-screen game-screen--round-answers" aria-label="Правильные ответы раунда">
      <header className="game-answers__head">
        <div className="game-answers__kicker">
          {state.pack.title.trim() || 'QuizMaster'} · Раунд {roundNumber} из {state.pack.rounds.length}
        </div>
        <h1 className="game-answers__title">Правильные ответы</h1>
        <div className="game-answers__meta">
          {roundTitle} · ответ {index + 1} из {total}
        </div>
      </header>

      <div className="game-answers__timer">
        <Countdown
          remainingMs={remainingMs}
          durationMs={state.timer.durationMs}
          size={timerSize}
          paused={state.paused}
          ended={ended && !state.paused}
          caption="сек"
        />
      </div>

      {!question ? (
        <div className="game-answers__empty">В этом раунде нет вопросов</div>
      ) : (
        <div className="game-answer-single" key={question.id}>
          <div className="game-answer-single__question">{question.text.trim() || 'Вопрос без текста'}</div>
          <div className="game-answer-single__answer">
            <span className="game-answer-single__label">Ответ</span>
            <span className="game-answer-single__value">{question.answer.trim() || '—'}</span>
          </div>
          {question.explanation.trim() ? (
            <div className="game-answer-single__explanation">{question.explanation.trim()}</div>
          ) : null}
          <MediaStage
            key={`${question.id}-answer`}
            media={question.answerMedia}
            paused={state.paused}
            alt={question.answer.trim() || 'Иллюстрация к ответу'}
          />
        </div>
      )}
    </section>
  );
}
