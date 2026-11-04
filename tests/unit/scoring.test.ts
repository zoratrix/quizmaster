import { clampScore, isFullScore, isPartialScore, quickScore, roundScore, successRatio } from '../../src/shared/scoring';
import { test, eq, close } from './harness';
import type { Question } from '../../src/shared/types';

function question(points: number): Question {
  return {
    id: 'q1',
    text: 'Вопрос',
    answer: 'Ответ',
    answerImage: null,
    explanation: '',
    timeLimitSec: 60,
    points,
    media: { image: null, audio: null, video: null }
  };
}

test('roundScore убирает плавающую погрешность', () => {
  close(roundScore(0.1 + 0.2), 0.3);
  close(roundScore(2.5), 2.5);
  close(roundScore(1 / 3), 0.333);
});

test('clampScore не допускает отрицательных значений', () => {
  eq(clampScore(-5), 0);
  eq(clampScore(2.5), 2.5);
  eq(clampScore(Number.NaN), 0);
});

test('quickScore: верно / неверно / частично', () => {
  const q = question(5);
  eq(quickScore(q, 'full'), 5);
  eq(quickScore(q, 'zero'), 0);
  eq(quickScore(q, 'partial'), 2.5);
  eq(quickScore(question(1), 'partial'), 0.5);
});

test('полный и частичный ответ определяются по стоимости вопроса', () => {
  const q = question(4);
  eq(isFullScore(4, q), true);
  eq(isFullScore(3.9, q), false);
  eq(isPartialScore(2, q), true);
  eq(isPartialScore(0, q), false);
  eq(isPartialScore(4, q), false);
});

test('successRatio ограничен диапазоном 0..1', () => {
  close(successRatio(5, 10), 0.5);
  close(successRatio(20, 10), 1);
  close(successRatio(0, 10), 0);
  close(successRatio(5, 0), 0);
});
