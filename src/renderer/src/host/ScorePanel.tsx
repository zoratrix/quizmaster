import { useEffect, useRef, useState } from 'react';
import type { Question, Team } from '../../../shared/types';
import { formatScore, quickScore } from '../../../shared/scoring';
import { formatBalls } from '../../../shared/format';
import { Button } from '../components/Button';
import { useToast } from '../components/Toasts';
import { cx } from '../lib/cx';

export interface ScorePanelProps {
  team: Team;
  question: Question;
  questionNumber: number;
  roundTitle: string;
  value: number | undefined;
  onSet: (points: number) => void;
  onAdd: (delta: number) => void;
}

/** Подсказка, пока ни одна ячейка не выбрана. */
export function ScorePanelIdle() {
  return (
    <section className="panel score-panel score-panel--idle">
      <div className="score-panel__idle-title">Выберите ячейку в таблице</div>
      <div className="small dim">
        Кликните на баллы нужной команды в строке вопроса — здесь появятся кнопки быстрого ввода. Можно
        вводить дробные значения: 2,5.
      </div>
    </section>
  );
}

function parseDraft(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (normalized.length === 0) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Панель быстрого ввода баллов для выбранной ячейки.
 * Пять способов: «Верно», «Частично», «Неверно», произвольное число, +1/−1/сброс.
 */
export function ScorePanel({ team, question, questionNumber, roundTitle, value, onSet, onAdd }: ScorePanelProps) {
  const toast = useToast();
  const [draft, setDraft] = useState(() => (value === undefined ? '' : formatScore(value)));
  const inputRef = useRef<HTMLInputElement | null>(null);

  // При смене ячейки или изменении оценки синхронизируем поле и ставим фокус:
  // ведущий выбирает ячейку и сразу набирает число с клавиатуры.
  useEffect(() => {
    setDraft(value === undefined ? '' : formatScore(value));
  }, [team.id, question.id, value]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [team.id, question.id]);

  const submit = (): void => {
    const parsed = parseDraft(draft);
    if (parsed === null) {
      toast.error('Введите число, например 2,5');
      return;
    }
    if (parsed < 0) {
      toast.error('Баллы не могут быть отрицательными');
      return;
    }
    onSet(parsed);
  };

  const full = quickScore(question, 'full');
  const partial = quickScore(question, 'partial');

  return (
    <section className="panel score-panel">
      <div className="score-panel__head">
        <div className="score-panel__context">
          <span className="badge badge--accent">Вопрос {questionNumber}</span>
          <span className="score-panel__team truncate" title={team.name}>
            {team.name}
          </span>
          <span className="score-panel__round truncate dim small" title={roundTitle}>
            {roundTitle}
          </span>
        </div>
        <span className={cx('badge', value === undefined ? '' : value > 0 ? 'badge--ok' : 'badge--bad')}>
          {value === undefined ? 'не внесено' : `внесено: ${formatScore(value)}`}
        </span>
      </div>

      <div className="score-panel__quick">
        <Button variant="ok" onClick={() => onSet(full)} title={`Полный балл: ${formatBalls(question.points)}`}>
          Верно · {formatScore(full)}
        </Button>
        <Button variant="mid" onClick={() => onSet(partial)} title="Половина баллов за частичный ответ">
          Частично · {formatScore(partial)}
        </Button>
        <Button variant="bad" onClick={() => onSet(0)} title="Неверный ответ — 0 баллов">
          Неверно · 0
        </Button>
      </div>

      <div className="score-panel__custom">
        <input
          ref={inputRef}
          className="input score-panel__input"
          value={draft}
          inputMode="decimal"
          placeholder="Баллы, например 2,5"
          aria-label={`Баллы команды ${team.name} за вопрос ${questionNumber}`}
          onChange={(event) => {
            const next = event.target.value.replace(/[^\d.,]/g, '');
            setDraft(next);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
          }}
        />
        <Button variant="primary" onClick={submit}>
          Применить
        </Button>
        <Button onClick={() => onAdd(1)} title="Добавить один балл">
          +1
        </Button>
        <Button onClick={() => onAdd(-1)} title="Вычесть один балл">
          −1
        </Button>
        <Button variant="ghost" onClick={() => onSet(0)} title="Сбросить оценку в 0">
          Сброс
        </Button>
      </div>

      <div className="score-panel__meta small dim">
        За полный ответ — {formatBalls(question.points)} · лимит {question.timeLimitSec} с
      </div>
    </section>
  );
}
