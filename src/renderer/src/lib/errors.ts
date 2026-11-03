/** Превращает ошибку (в том числе ошибку IPC) в понятный пользователю текст. */
export function humanizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const cleaned = raw
    .replace(/^Error invoking remote method '[^']*':\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim();
  return cleaned.length > 0 ? cleaned : 'Не удалось выполнить действие';
}
