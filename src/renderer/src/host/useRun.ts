import { useCallback } from 'react';
import { useToast } from '../components/Toasts';

export type RunAction = () => unknown | Promise<unknown>;

/** Достаёт человекочитаемый текст из ошибки IPC. */
export function commandErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const cleaned = raw
    .replace(/^Error invoking remote method '[^']*':\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim();
  return cleaned.length > 0 ? cleaned : 'Не удалось выполнить действие';
}

/**
 * Обёртка для команд window.qm: любые ошибки command-канала превращаются
 * в toast, чтобы ведущий не терял контекст посреди игры.
 */
export function useRun(): (action: RunAction) => Promise<boolean> {
  const toast = useToast();
  return useCallback(
    async (action: RunAction): Promise<boolean> => {
      try {
        await action();
        return true;
      } catch (error) {
        toast.error(commandErrorMessage(error));
        return false;
      }
    },
    [toast]
  );
}
