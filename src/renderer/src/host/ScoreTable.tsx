import { useEffect, useRef } from 'react';
import type { GameState, Round, Team } from '../../../shared/types';
import { formatScore } from '../../../shared/scoring';
import { formatBalls } from '../../../shared/format';
import { cx } from '../lib/cx';
import { questionTitle, roundTeamTotal, scoreAt, type CellRef } from './helpers';

export interface ScoreTableProps {
  round: Round;
  teams: Team[];
  state: GameState;
  /** Вопрос, который идёт прямо сейчас (подсветка строки); null в остальных фазах. */
  currentQuestionId: string | null;
  selected: CellRef | null;
  onSelect: (cell: CellRef) => void;
}

function cellTone(value: number | undefined, points: number): string {
  if (value === undefined) return 'empty';
  if (value <= 0) return 'zero';
  if (value >= points - 0.0001) return 'full';
  return 'partial';
}

/**
 * Таблица баллов раунда: строки — вопросы, столбцы — команды.
 * Клик по ячейке выбирает её; выбранная ячейка подсвечивается.
 */
export function ScoreTable({ round, teams, state, currentQuestionId, selected, onSelect }: ScoreTableProps) {
  const currentRowRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    currentRowRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [currentQuestionId, round.id]);

  if (round.questions.length === 0) {
    return (
      <div className="panel score-board">
        <div className="empty">
          <div className="empty__title">В раунде нет вопросов</div>
          <div className="small">Добавьте вопросы в редакторе и запустите игру заново.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel score-board">
      <div className="score-board__scroll scroll">
        <table className="score-table">
          <thead>
            <tr>
              <th className="score-table__qcol" scope="col">
                Вопрос
              </th>
              {teams.map((team) => (
                <th key={team.id} className="score-table__team" scope="col" title={team.name}>
                  <span className="truncate">{team.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {round.questions.map((question, questionIndex) => {
              const isCurrent = question.id === currentQuestionId;
              const skipped = state.skippedQuestionIds.includes(question.id);
              return (
                <tr
                  key={question.id}
                  ref={isCurrent ? currentRowRef : undefined}
                  className={cx('score-row', isCurrent && 'is-current', skipped && 'is-skipped')}
                >
                  <td className="score-table__qcol">
                    <div className="score-table__q">
                      <span className="score-table__qnum mono">{questionIndex + 1}</span>
                      <span className="score-table__qtext truncate" title={questionTitle(question)}>
                        {questionTitle(question)}
                      </span>
                      <span className="badge score-table__points">{formatBalls(question.points)}</span>
                      {skipped ? <span className="badge badge--bad">пропущен</span> : null}
                    </div>
                  </td>
                  {teams.map((team) => {
                    const value = scoreAt(state.scores, team.id, question.id);
                    const isSelected =
                      selected !== null && selected.teamId === team.id && selected.questionId === question.id;
                    return (
                      <td key={team.id} className="score-table__cell">
                        <button
                          type="button"
                          className={cx(
                            'score-cell',
                            `score-cell--${cellTone(value, question.points)}`,
                            isSelected && 'is-selected'
                          )}
                          onClick={() => onSelect({ teamId: team.id, questionId: question.id })}
                          title={`${team.name} · вопрос ${questionIndex + 1}: ${
                            value === undefined ? 'оценка не внесена' : `${formatScore(value)} из ${formatBalls(question.points)}`
                          }`}
                          aria-label={`Баллы команды ${team.name} за вопрос ${questionIndex + 1}`}
                          aria-pressed={isSelected}
                        >
                          {value === undefined ? '—' : formatScore(value)}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="score-table__qcol">
                <span className="score-table__total-label">Итого за раунд</span>
              </td>
              {teams.map((team) => (
                <td key={team.id} className="score-table__cell">
                  <span className="score-table__total mono" title={`${team.name}: итог раунда`}>
                    {formatScore(roundTeamTotal(state.scores, round, team.id))}
                  </span>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
