import type { GameState, Question, QuizPack, Round, Team } from '../../../shared/types';
import { roundScore } from '../../../shared/scoring';

/** Ссылка на ячейку таблицы баллов: команда × вопрос. */
export interface CellRef {
  teamId: string;
  questionId: string;
}

/** Найденный вопрос пака с координатами. */
export interface LocatedQuestion {
  roundIndex: number;
  questionIndex: number;
  question: Question;
}

/** Баллы команды за вопрос или undefined, если оценка ещё не внесена. */
export function scoreAt(
  scores: GameState['scores'],
  teamId: string,
  questionId: string
): number | undefined {
  const row = scores?.[teamId];
  if (!row) return undefined;
  const value = row[questionId];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Сумма баллов команды за раунд (невнесённые оценки считаются нулём). */
export function roundTeamTotal(scores: GameState['scores'], round: Round, teamId: string): number {
  let total = 0;
  for (const question of round.questions) {
    const value = scoreAt(scores, teamId, question.id);
    if (value !== undefined) total += value;
  }
  return roundScore(total);
}

/** Сколько оценок раунда уже внесено (из общего числа ячеек). */
export function roundProgress(
  scores: GameState['scores'],
  round: Round,
  teams: Team[]
): { entered: number; total: number } {
  let entered = 0;
  for (const team of teams) {
    for (const question of round.questions) {
      if (scoreAt(scores, team.id, question.id) !== undefined) entered += 1;
    }
  }
  return { entered, total: teams.length * round.questions.length };
}

/** Ищет вопрос по id во всём паке. */
export function findQuestion(pack: QuizPack, questionId: string): LocatedQuestion | null {
  for (let roundIndex = 0; roundIndex < pack.rounds.length; roundIndex += 1) {
    const questions = pack.rounds[roundIndex].questions;
    const questionIndex = questions.findIndex((question) => question.id === questionId);
    if (questionIndex >= 0) {
      return { roundIndex, questionIndex, question: questions[questionIndex] };
    }
  }
  return null;
}

/** Короткий текст вопроса для таблицы. */
export function questionTitle(question: Question | null | undefined): string {
  const text = question?.text?.trim();
  return text && text.length > 0 ? text : 'Без текста вопроса';
}

export function modeLabel(mode: GameState['mode']): string {
  return mode === 'individual' ? 'Индивидуальные участники' : 'Команды';
}

export function shortModeLabel(mode: GameState['mode']): string {
  return mode === 'individual' ? 'Участники' : 'Команды';
}

/** Проценты для прогресс-бара (0..100). */
export function progressPercent(entered: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((entered / total) * 100);
}
