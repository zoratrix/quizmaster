import { useMemo } from 'react';
import type { GameState, TeamSummary } from '../../../shared/types';
import { computeSummary, plural } from '../../../shared/stats';
import { formatScore } from '../../../shared/scoring';
import { cx } from '../lib/cx';
import { winnerTextSize } from './textFit';

/** Порядок подиума: второе место слева, первое в центре, третье справа. */
function podiumOrder(teams: TeamSummary[]): TeamSummary[] {
  if (teams.length >= 3) return [teams[1], teams[0], teams[2]];
  if (teams.length === 2) return [teams[1], teams[0]];
  return teams;
}

/**
 * Финальный экран: победитель, подиум, полная таблица баллов и награды.
 * Заголовок и таблица рассчитаны на чтение с большого расстояния.
 */
export function ResultsView({ state }: { state: GameState }) {
  const summary = useMemo(() => computeSummary(state), [state]);

  const teams = summary.teams;
  const winners = teams.filter((team) => summary.winnerIds.includes(team.teamId));
  const hasWinner = winners.length > 0;
  // Ничья — это несколько первых мест (в том числе все команды с равным счётом, включая 0).
  const allEqual = teams.length > 1 && teams.every((team) => team.total === teams[0].total);
  const isTie = hasWinner ? winners.length > 1 : allEqual;
  const tieTeams = isTie ? (hasWinner ? winners : teams) : [];
  const winnerLabel = isTie
    ? 'Ничья'
    : hasWinner
      ? winners.length === 1
        ? 'Победитель'
        : 'Победители'
      : 'Игра завершена';
  // Имён может быть много (ничья) — оставляем заголовок читаемым с проектора.
  const winnerHeading = isTie
    ? `${tieTeams
        .slice(0, 2)
        .map((team) => team.name)
        .join(' · ')}${tieTeams.length > 2 ? ` и ещё ${tieTeams.length - 2}` : ''}`
    : !hasWinner
      ? 'Победителей нет'
      : winners.length <= 3
        ? winners.map((team) => team.name).join(' · ')
        : `${winners
            .slice(0, 2)
            .map((team) => team.name)
            .join(' · ')} и ещё ${winners.length - 2}`;
  const podium = podiumOrder(teams.slice(0, 3));

  const nameById = new Map(teams.map((team) => [team.teamId, team.name]));
  const totalQuestions = summary.totalQuestions;

  return (
    <section className="game-screen game-screen--results">
      <div className="game-results">
        <div className="game-results__hero">
          <div className="game-results__eyebrow">
            {state.pack.title.trim() || 'QuizMaster'} · {totalQuestions}{' '}
            {plural(totalQuestions, 'вопрос', 'вопроса', 'вопросов')} ·{' '}
            {teams.length} {plural(teams.length, 'команда', 'команды', 'команд')}
          </div>

          <div className="game-results__label">{winnerLabel}</div>

          <h1 className="game-results__winner" style={{ fontSize: winnerTextSize(winnerHeading.length) }}>
            {winnerHeading}
          </h1>

          <div className="game-results__congrats">
            {isTie ? 'Все молодцы!' : hasWinner ? 'Поздравляем с победой!' : 'Спасибо за игру!'}
          </div>

          <div className="game-podium" aria-label="Подиум">
            {podium.map((team) => (
              <div className={cx('game-podium__item', `game-podium__item--p${team.place}`)} key={team.teamId}>
                <div className="game-podium__team">
                  <div className="game-podium__name">{team.name}</div>
                  <div className="game-podium__score tabular">{formatScore(team.total)}</div>
                </div>
                <div className="game-podium__block">
                  <div className="game-podium__place tabular">{team.place}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="game-results__board">
          <div className="game-results__board-head">
            <h2 className="game-results__board-title">Итоговая таблица</h2>
            <span className="game-results__board-meta">
              {teams.length} {plural(teams.length, 'команда', 'команды', 'команд')}
            </span>
          </div>

          <div className="game-results__table-wrap scroll">
            <table className="game-results-table">
              <thead>
                <tr>
                  <th className="game-results-table__place">Место</th>
                  <th>Команда</th>
                  <th className="game-results-table__score">Баллы</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team, index) => (
                  <tr
                    key={team.teamId}
                    className={cx(summary.winnerIds.includes(team.teamId) && 'is-winner')}
                    style={{ animationDelay: `${Math.min(index, 16) * 45}ms` }}
                  >
                    <td className="game-results-table__place tabular">{team.place}</td>
                    <td className="game-results-table__name">{team.name}</td>
                    <td className="game-results-table__score tabular">{formatScore(team.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {summary.awards.length > 0 ? (
            <div className="game-awards">
              <div className="game-awards__head">Награды</div>
              <div className="game-awards__list">
                {summary.awards.map((award) => {
                  const names = award.teamIds
                    .map((teamId) => nameById.get(teamId))
                    .filter((name): name is string => Boolean(name))
                    .join(' · ');
                  return (
                    <div className="game-award" key={award.id}>
                      <div className="game-award__medal" aria-hidden="true">
                        ★
                      </div>
                      <div className="game-award__body">
                        <div className="game-award__head">
                          <span className="game-award__title">{award.title}</span>
                          {names ? <span className="game-award__teams">{names}</span> : null}
                        </div>
                        <div className="game-award__desc">{award.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
