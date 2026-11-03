import { useCallback } from 'react';
import { useRun } from './useRun';
import type { CellRef } from './helpers';

export type ScoreCommand = (cell: CellRef, action: 'set' | 'add', value: number) => void;

/**
 * Применение баллов к выбранной ячейке через команды main-процесса.
 * Все ошибки (например, состояние игры уже сброшено) уходят в toast.
 */
export function useScoreCommands(): ScoreCommand {
  const run = useRun();
  return useCallback(
    (cell: CellRef, action: 'set' | 'add', value: number) => {
      void run(() =>
        action === 'set'
          ? window.qm.game.setScore(cell.teamId, cell.questionId, value)
          : window.qm.game.addScore(cell.teamId, cell.questionId, value)
      );
    },
    [run]
  );
}
