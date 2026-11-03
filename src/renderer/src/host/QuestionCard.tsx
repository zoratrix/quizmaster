import type { GameState, Question, Round } from '../../../shared/types';
import { formatBalls } from '../../../shared/format';
import { roundScore } from '../../../shared/scoring';
import { Button } from '../components/Button';
import { cx } from '../lib/cx';
import { modeLabel, questionTitle } from './helpers';

export interface QuestionCardProps {
  state: GameState;
  round: Round;
  /** Текущий вопрос; null в фазе round-intro. */
  question: Question | null;
  questionNumber: number;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
  onEndRound: () => void;
  /** Фаза повторного просмотра вопросов перед сдачей бланков */
  review?: boolean;
}

function roundTotalPoints(round: Round): number {
  return roundScore(round.questions.reduce((sum, question) => sum + Math.max(0, question.points), 0));
}

/**
 * Левая колонка панели: текст текущего вопроса, ответ для ведущего,
 * пояснение и навигация по вопросам раунда.
 */
export function QuestionCard({
  state,
  round,
  question,
  questionNumber,
  onPrev,
  onNext,
  onSkip,
  onEndRound,
  review = false
}: QuestionCardProps) {
  if (!question) {
    return (
      <section className="panel question-card question-card--intro">
        <div className="question-card__eyebrow">Заставка раунда</div>
        <h2 className="question-card__intro-title">{round.title}</h2>
        <div className="row row--wrap gap-6">
          <span className="badge badge--accent">{round.questions.length} вопросов</span>
          <span className="badge">{formatBalls(roundTotalPoints(round))}</span>
          <span className="badge">{modeLabel(state.mode)}</span>
        </div>
        {round.questions[0] ? (
          <div className="question-card__preview">
            <div className="question-card__preview-label small dim">Первый вопрос</div>
            <p className="muted">{questionTitle(round.questions[0])}</p>
            <div className="row row--wrap gap-6 question-card__preview-meta">
              <span className="badge">{formatBalls(round.questions[0].points)}</span>
              <span className="dim small">{round.questions[0].timeLimitSec} с</span>
            </div>
          </div>
        ) : null}
        <div className="grow" />
        <div className="question-card__hint small dim">
          Когда участники готовы, откройте первый вопрос. Ответы начнут приниматься сразу.
        </div>
        <div className="question-card__nav question-card__nav--stack">
          <Button variant="primary" size="lg" block onClick={onNext}>
            Начать раунд →
          </Button>
          <Button variant="ghost" block onClick={onEndRound}>
            Завершить раунд
          </Button>
        </div>
      </section>
    );
  }

  const skipped = state.skippedQuestionIds.includes(question.id);
  const isLastQuestion = questionNumber >= round.questions.length;

  return (
    <section className="panel question-card">
      <div className="question-card__head">
        <div className="row row--wrap gap-6">
          <span className="badge badge--accent">
            Вопрос {questionNumber}/{round.questions.length}
          </span>
          {skipped ? <span className="badge badge--bad">пропущен</span> : null}
        </div>
        <span className="badge badge--accent">{formatBalls(question.points)}</span>
      </div>

      <div className="question-card__text scroll">
        {question.text?.trim() ? question.text : <span className="dim">Текст вопроса не заполнен</span>}
      </div>

      <div className="question-card__meta small">
        <span className="dim">Лимит: {question.timeLimitSec} с</span>
        <span className="dim">Стоимость: {formatBalls(question.points)}</span>
      </div>

      <div className={cx('answer-block', state.revealed && 'answer-block--revealed')}>
        <div className="answer-block__head">
          <span className="answer-block__label">Ответ для ведущего</span>
          <span className={cx('badge', state.revealed ? 'badge--ok' : '')}>
            {state.revealed ? 'показан на экране' : 'скрыт на экране'}
          </span>
        </div>
        <div className="answer-block__text">
          {question.answer?.trim() ? question.answer : <span className="dim">Правильный ответ не заполнен</span>}
        </div>
        {question.explanation?.trim() ? (
          <div className="answer-block__explain small muted">
            <span className="dim">Пояснение: </span>
            {question.explanation}
          </div>
        ) : null}
      </div>

      <div className="question-card__nav">
        <Button variant="ghost" onClick={onPrev} title="Вернуться к предыдущему вопросу">
          ← Назад
        </Button>
        <Button variant="primary" className="question-card__next" onClick={onNext}>
          {review ? (isLastQuestion ? 'К сдаче бланков →' : 'Дальше →') : isLastQuestion ? 'Завершить раунд →' : 'Следующий →'}
        </Button>
        {review ? null : (
          <Button variant="ghost" onClick={onSkip} title="Отметить вопрос пропущенным">
            Пропустить
          </Button>
        )}
      </div>
      <Button variant="mid" block onClick={onEndRound} title="Завершить раунд и перейти к внесению результатов">
        Завершить раунд
      </Button>
    </section>
  );
}
