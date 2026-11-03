import type { Question } from './types';

/** Округление баллов до 3 знаков, чтобы не ловить 0.30000000000000004 */
export function roundScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1000) / 1000;
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return roundScore(Math.max(0, value));
}

export function isFullScore(points: number, question: Question): boolean {
  return points > 0 && points >= question.points - 0.0001;
}

export function isPartialScore(points: number, question: Question): boolean {
  return points > 0 && !isFullScore(points, question);
}

export type QuickVerdict = 'full' | 'zero' | 'partial';

export function quickScore(question: Question, verdict: QuickVerdict): number {
  if (verdict === 'full') return roundScore(question.points);
  if (verdict === 'zero') return 0;
  return roundScore(question.points * 0.5);
}

/** Текстовое представление баллов: 2, 2.5, 0.75 */
export function formatScore(value: number): string {
  const rounded = roundScore(value);
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded).replace('.', ',');
}

/** Процент успеха вопроса, 0..1 */
export function successRatio(points: number, maxPoints: number): number {
  if (maxPoints <= 0) return 0;
  return Math.min(1, Math.max(0, points / maxPoints));
}
