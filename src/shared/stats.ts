import { flattenQuestions } from './factory';
import { roundScore, successRatio } from './scoring';
import type {
  Award,
  GameState,
  GameSummary,
  Question,
  QuestionStat,
  TeamSummary
} from './types';

const FULL_EPS = 0.0001;

function pointsOf(state: GameState, teamId: string, questionId: string): number {
  const value = state.scores?.[teamId]?.[questionId];
  return Number.isFinite(value) ? (value as number) : 0;
}

function isFullPoints(points: number, question: Question): boolean {
  return points > 0 && points >= question.points - FULL_EPS;
}

export function computeSummary(state: GameState): GameSummary {
  const ordered = flattenQuestions(state.pack);
  const teams = state.teams;

  const questions: QuestionStat[] = [];
  const questionByTeam: Map<string, Map<string, number>> = new Map(); // questionId -> teamId -> points

  for (const item of ordered) {
    const { question } = item;
    if (question.points <= 0) continue;
    const perTeam = new Map<string, number>();
    for (const team of teams) perTeam.set(team.id, pointsOf(state, team.id, question.id));
    questionByTeam.set(question.id, perTeam);

    if (state.skippedQuestionIds.includes(question.id)) continue;

    let fullCount = 0;
    let partialCount = 0;
    let zeroCount = 0;
    let ratioSum = 0;
    for (const team of teams) {
      const points = perTeam.get(team.id) ?? 0;
      if (isFullPoints(points, question)) fullCount += 1;
      else if (points > 0) partialCount += 1;
      else zeroCount += 1;
      ratioSum += successRatio(points, question.points);
    }
    questions.push({
      questionId: question.id,
      roundIndex: item.roundIndex,
      questionIndex: item.questionIndex,
      roundTitle: state.pack.rounds[item.roundIndex]?.title ?? '',
      questionText: question.text || 'Вопрос без текста',
      fullPoints: question.points,
      answeredTeams: teams.length,
      fullCount,
      partialCount,
      zeroCount,
      successRate: teams.length > 0 ? ratioSum / teams.length : 0
    });
  }

  const roundTitles = state.pack.rounds.map((r) => r.title);
  const teamSummaries: TeamSummary[] = teams.map((team) => {
    const byRound: number[] = state.pack.rounds.map(() => 0);
    let fullCount = 0;
    let partialCount = 0;
    let zeroCount = 0;
    let longestStreak = 0;
    let streak = 0;

    for (const item of ordered) {
      const { question, roundIndex } = item;
      const points = pointsOf(state, team.id, question.id);
      if (question.points > 0) byRound[roundIndex] = roundScore(byRound[roundIndex] + points);
      if (state.skippedQuestionIds.includes(question.id)) continue;
      if (isFullPoints(points, question)) {
        fullCount += 1;
        streak += 1;
        if (streak > longestStreak) longestStreak = streak;
      } else {
        if (points > 0) partialCount += 1;
        else zeroCount += 1;
        streak = 0;
      }
    }

    const total = roundScore(byRound.reduce((a, b) => a + b, 0));
    let bestRoundIndex: number | null = null;
    let bestRoundPoints = 0;
    byRound.forEach((value, index) => {
      if (value > bestRoundPoints) {
        bestRoundPoints = roundScore(value);
        bestRoundIndex = index;
      }
    });

    return {
      teamId: team.id,
      name: team.name,
      total,
      place: 0,
      byRound,
      bestRoundIndex,
      bestRoundPoints,
      longestStreak,
      fullCount,
      partialCount,
      zeroCount
    };
  });

  teamSummaries.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'ru'));
  teamSummaries.forEach((team, index) => {
    team.place = index > 0 && team.total === teamSummaries[index - 1].total ? teamSummaries[index - 1].place : index + 1;
  });

  const maxTotal = teamSummaries.length > 0 ? teamSummaries[0].total : 0;
  const winnerIds = teamSummaries.filter((t) => t.total === maxTotal && maxTotal > 0).map((t) => t.teamId);

  const sortedByFull = [...questions].sort((a, b) => b.fullCount - a.fullCount || b.successRate - a.successRate);
  const easiest = sortedByFull.length > 0 && sortedByFull[0].fullCount > 0 ? [sortedByFull[0]] : [];
  const sortedByHard = [...questions].sort((a, b) => a.fullCount - b.fullCount || a.successRate - b.successRate);
  const hardest = sortedByHard.length > 0 ? [sortedByHard[0]] : [];

  // Лучший прирост за раунд
  let bestGainPoints = 0;
  let bestGainRound = -1;
  for (const team of teamSummaries) {
    for (let roundIndex = 0; roundIndex < team.byRound.length; roundIndex += 1) {
      const points = team.byRound[roundIndex];
      if (points > bestGainPoints) {
        bestGainPoints = points;
        bestGainRound = roundIndex;
      }
    }
  }
  const maxRoundGain: GameSummary['maxRoundGain'] =
    bestGainPoints > 0 && bestGainRound >= 0
      ? {
          roundIndex: bestGainRound,
          points: bestGainPoints,
          teamIds: teamSummaries
            .filter((team) => team.byRound[bestGainRound] === bestGainPoints)
            .map((team) => team.teamId)
        }
      : null;

  const awards: Award[] = [];

  // «Единственные знатоки» — вопросы, где полный балл только у одной команды
  const uniqueKnowers = new Map<string, number>();
  for (const stat of questions) {
    if (stat.fullCount !== 1) continue;
    const perTeam = questionByTeam.get(stat.questionId);
    if (!perTeam) continue;
    for (const [teamId, points] of perTeam) {
      const question = ordered.find((o) => o.question.id === stat.questionId)?.question;
      if (question && isFullPoints(points, question)) {
        uniqueKnowers.set(teamId, (uniqueKnowers.get(teamId) ?? 0) + 1);
      }
    }
  }
  if (uniqueKnowers.size > 0) {
    const max = Math.max(...uniqueKnowers.values());
    const teamIds = [...uniqueKnowers.entries()].filter(([, n]) => n === max).map(([id]) => id);
    awards.push({
      id: 'unique-knowers',
      title: 'Единственные знатоки',
      description: `Единственный полностью правильный ответ в ${max} ${plural(max, 'вопросе', 'вопросах', 'вопросах')}`,
      teamIds
    });
  }

  // «Без ошибок» — все вопросы раунда с полным баллом
  state.pack.rounds.forEach((round, roundIndex) => {
    const roundQuestions = round.questions.filter(
      (q) => q.points > 0 && !state.skippedQuestionIds.includes(q.id)
    );
    if (roundQuestions.length === 0) return;
    const flawless = teams
      .filter((team) =>
        roundQuestions.every((q) => isFullPoints(pointsOf(state, team.id, q.id), q))
      )
      .map((team) => team.id);
    if (flawless.length > 0) {
      awards.push({
        id: `flawless-${roundIndex}`,
        title: 'Без ошибок',
        description: `${roundTitles[roundIndex] ?? `Раунд ${roundIndex + 1}`}: все ответы полностью верные`,
        teamIds: flawless
      });
    }
  });

  // «Серия побед» — самый длинный стрик
  const maxStreak = teamSummaries.reduce((max, team) => Math.max(max, team.longestStreak), 0);
  if (maxStreak > 0) {
    awards.push({
      id: 'streak',
      title: 'Серия побед',
      description: `${maxStreak} ${plural(maxStreak, 'полный ответ подряд', 'полных ответа подряд', 'полных ответов подряд')}`,
      teamIds: teamSummaries.filter((t) => t.longestStreak === maxStreak).map((t) => t.teamId)
    });
  }

  // «Рывок» — максимальный прирост за раунд
  if (maxRoundGain) {
    const best = maxRoundGain;
    awards.push({
      id: 'rush',
      title: 'Рывок',
      description: `${roundTitles[best.roundIndex] ?? `Раунд ${best.roundIndex + 1}`}: ${best.points} ${plural(best.points, 'балл', 'балла', 'баллов')} за раунд`,
      teamIds: best.teamIds
    });
  }

  return {
    teams: teamSummaries,
    questions,
    easiest,
    hardest,
    awards,
    winnerIds,
    totalQuestions: questions.length,
    maxRoundGain
  };
}

export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}
