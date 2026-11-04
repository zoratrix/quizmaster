import type { GameState, Question, QuizPack, Round, Team } from '../../src/shared/types';
import { SCHEMA_VERSION } from '../../src/shared/types';
import { computeSummary, plural } from '../../src/shared/stats';
import { test, eq, close } from './harness';

function makeQuestion(id: string, points: number): Question {
  return {
    id,
    text: `Вопрос ${id}`,
    answer: 'ответ',
    answerMedia: { image: null, audio: null, video: null },
    explanation: '',
    timeLimitSec: 60,
    points,
    media: { image: null, audio: null, video: null }
  };
}

function makePack(rounds: Array<{ title: string; questions: Question[] }>): QuizPack {
  return {
    schemaVersion: SCHEMA_VERSION,
    theme: 'default',
    id: 'pack_test',
    title: 'Тестовый пак',
    description: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: { defaultTimeLimitSec: 60, defaultPoints: 1, partialCreditRatio: 0.5, answerRevealSec: 15 },
    music: [],
    rounds: rounds.map((round, index): Round => ({
      id: `r${index}`,
      title: round.title,
      cover: null,
      questions: round.questions
    }))
  };
}

function makeState(pack: QuizPack, teams: Team[], scores: Record<string, Record<string, number>>): GameState {
  return {
    sessionId: 'game_test',
    phase: 'finished',
    mode: 'team',
    pack,
    packPath: null,
    teams,
    roundIndex: 0,
    questionIndex: 0,
    timer: { durationMs: 60000, remainingMs: 0, running: false, endsAt: null },
    paused: false,
    revealed: false,
    skippedQuestionIds: [],
    scores,
    startedAt: Date.now(),
    finishedAt: Date.now(),
    updatedAt: Date.now()
  };
}

const A: Team = { id: 'a', name: 'Альфа' };
const B: Team = { id: 'b', name: 'Бета' };
const C: Team = { id: 'c', name: 'Гамма' };

test('итоговые баллы и места считаются по вопросам и раундам', () => {
  const pack = makePack([
    { title: 'Раунд 1', questions: [makeQuestion('q1', 1), makeQuestion('q2', 2)] },
    { title: 'Раунд 2', questions: [makeQuestion('q3', 5)] }
  ]);
  const state = makeState(pack, [A, B], {
    a: { q1: 1, q2: 2, q3: 2.5 },
    b: { q1: 0, q2: 1, q3: 0 }
  });
  const summary = computeSummary(state);
  const alpha = summary.teams.find((t) => t.teamId === 'a')!;
  const beta = summary.teams.find((t) => t.teamId === 'b')!;

  close(alpha.total, 5.5, 'сумма Альфы');
  close(beta.total, 1, 'сумма Беты');
  eq(alpha.place, 1);
  eq(beta.place, 2);
  eq(alpha.byRound, [3, 2.5]);
  eq(summary.winnerIds, ['a']);
  eq(alpha.fullCount, 2);
  eq(alpha.partialCount, 1);
  eq(alpha.zeroCount, 0);
  eq(beta.partialCount, 1);
  eq(beta.zeroCount, 2);
});

test('стрик прерывается частичным ответом', () => {
  const pack = makePack([
    { title: 'Раунд', questions: [makeQuestion('q1', 1), makeQuestion('q2', 1), makeQuestion('q3', 1), makeQuestion('q4', 1)] }
  ]);
  const state = makeState(pack, [A], { a: { q1: 1, q2: 1, q3: 0.5, q4: 1 } });
  const summary = computeSummary(state);
  eq(summary.teams[0].longestStreak, 2);
});

test('пропущенные вопросы не участвуют в статистике', () => {
  const pack = makePack([{ title: 'Раунд', questions: [makeQuestion('q1', 1), makeQuestion('q2', 1)] }]);
  const state = makeState(pack, [A], { a: { q1: 1, q2: 0 } });
  state.skippedQuestionIds = ['q2'];
  const summary = computeSummary(state);
  eq(summary.questions.length, 1);
  eq(summary.teams[0].longestStreak, 1);
  eq(summary.teams[0].fullCount, 1);
});

test('самый лёгкий и самый сложный вопросы определяются по числу полных ответов', () => {
  const pack = makePack([
    { title: 'Раунд', questions: [makeQuestion('q1', 1), makeQuestion('q2', 1), makeQuestion('q3', 1)] }
  ]);
  const state = makeState(pack, [A, B, C], {
    a: { q1: 1, q2: 0, q3: 1 },
    b: { q1: 1, q2: 1, q3: 1 },
    c: { q1: 1, q2: 0, q3: 1 }
  });
  const summary = computeSummary(state);
  eq(summary.easiest[0].questionId, 'q1');
  eq(summary.hardest[0].questionId, 'q2');
  close(summary.easiest[0].successRate, 1);
  close(summary.hardest[0].successRate, 1 / 3);
});

test('награда «Единственные знатоки» достаётся единственной команде с полным баллом', () => {
  const pack = makePack([
    { title: 'Раунд', questions: [makeQuestion('q1', 1), makeQuestion('q2', 1)] }
  ]);
  const state = makeState(pack, [A, B], {
    a: { q1: 1, q2: 1 },
    b: { q1: 0, q2: 1 }
  });
  const summary = computeSummary(state);
  const award = summary.awards.find((item) => item.id === 'unique-knowers');
  eq(Boolean(award), true);
  eq(award?.teamIds, ['a']);
});

test('награда «Без ошибок» выдаётся за полностью верный раунд', () => {
  const pack = makePack([{ title: 'Раунд 1', questions: [makeQuestion('q1', 1), makeQuestion('q2', 2)] }]);
  const state = makeState(pack, [A, B], {
    a: { q1: 1, q2: 2 },
    b: { q1: 1, q2: 1 }
  });
  const summary = computeSummary(state);
  const award = summary.awards.find((item) => item.id === 'flawless-0');
  eq(award?.teamIds, ['a']);
});

test('награда «Рывок» — лучший раунд по приросту баллов', () => {
  const pack = makePack([
    { title: 'Раунд 1', questions: [makeQuestion('q1', 1)] },
    { title: 'Раунд 2', questions: [makeQuestion('q2', 5)] }
  ]);
  const state = makeState(pack, [A, B], {
    a: { q1: 1, q2: 5 },
    b: { q1: 1, q2: 0 }
  });
  const summary = computeSummary(state);
  const award = summary.awards.find((item) => item.id === 'rush');
  eq(award?.teamIds, ['a']);
  eq(award?.description.includes('2'), true);
});

test('равные суммы делят место', () => {
  const pack = makePack([{ title: 'Раунд', questions: [makeQuestion('q1', 2)] }]);
  const state = makeState(pack, [A, B], { a: { q1: 2 }, b: { q1: 2 } });
  const summary = computeSummary(state);
  eq(summary.teams.map((t) => t.place), [1, 1]);
  eq(summary.winnerIds.sort(), ['a', 'b']);
});

test('пустая игра не падает и не выдаёт победителя', () => {
  const pack = makePack([{ title: 'Раунд', questions: [makeQuestion('q1', 1)] }]);
  const state = makeState(pack, [], {});
  const summary = computeSummary(state);
  eq(summary.teams.length, 0);
  eq(summary.winnerIds.length, 0);
  eq(summary.questions[0].zeroCount, 0);
});

test('русские склонения для наград', () => {
  eq(plural(1, 'вопрос', 'вопроса', 'вопросов'), 'вопрос');
  eq(plural(3, 'вопрос', 'вопроса', 'вопросов'), 'вопроса');
  eq(plural(5, 'вопрос', 'вопроса', 'вопросов'), 'вопросов');
  eq(plural(11, 'вопрос', 'вопроса', 'вопросов'), 'вопросов');
  eq(plural(21, 'вопрос', 'вопроса', 'вопросов'), 'вопрос');
});
