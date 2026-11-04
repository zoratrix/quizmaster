import type { GameState } from '../../../shared/types';
import { plural } from '../../../shared/stats';
import { mediaUrl } from '../lib/media';
import { answersTextSize } from './textFit';

/**
 * Правильные ответы сразу на весь раунд: список вопросов с номерами и ответами.
 * Кегль подстраивается под количество вопросов, пояснение — мелким шрифтом.
 * Кнопок нет: экран только для чтения с проектора.
 */
export function RoundAnswersView({ state }: { state: GameState }) {
  const round = state.pack.rounds[state.roundIndex];
  const questions = round?.questions ?? [];
  const roundNumber = state.roundIndex + 1;
  const totalRounds = state.pack.rounds.length;
  const roundTitle = round?.title.trim() || `Раунд ${roundNumber}`;

  return (
    <section className="game-screen game-screen--round-answers" aria-label="Правильные ответы раунда">
      <header className="game-answers__head">
        <div className="game-answers__kicker">
          {state.pack.title.trim() || 'QuizMaster'} · Раунд {roundNumber} из {totalRounds}
        </div>
        <h1 className="game-answers__title">Правильные ответы</h1>
        <div className="game-answers__meta">
          {roundTitle} · {questions.length} {plural(questions.length, 'вопрос', 'вопроса', 'вопросов')}
        </div>
      </header>

      {questions.length === 0 ? (
        <div className="game-answers__empty">В этом раунде нет вопросов</div>
      ) : (
        <ol className="game-answers__list" style={{ fontSize: answersTextSize(questions.length) }}>
          {questions.map((question, index) => {
            const text = question.text.trim();
            const answer = question.answer.trim();
            const explanation = question.explanation.trim();
            return (
              <li
                className="game-answer-row"
                key={question.id}
                style={{ animationDelay: `${Math.min(index, 14) * 55}ms` }}
              >
                <span className="game-answer-row__number tabular">{index + 1}</span>
                <div className="game-answer-row__body">
                  <p className="game-answer-row__question">{text || 'Вопрос без текста'}</p>
                  <div className="game-answer-row__answer">{answer || '—'}</div>
                  {explanation ? <p className="game-answer-row__explanation">{explanation}</p> : null}
                </div>
                {question.answerImage ? (
                  <img
                    className="game-answer-row__image"
                    src={mediaUrl(question.answerImage.id)}
                    alt={answer}
                    draggable={false}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
