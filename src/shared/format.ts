import { roundScore } from './scoring';

/** 01:05 из миллисекунд, округление вверх до целой секунды */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} с`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatPoints(value: number): string {
  const rounded = roundScore(value);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
}

export function formatPercent(ratio: number): string {
  return `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
}

export function formatPlace(place: number): string {
  const abs = place % 100;
  const last = place % 10;
  let suffix = 'место';
  if (abs < 11 || abs > 14) {
    if (last === 1) suffix = 'место';
    else if (last >= 2 && last <= 4) suffix = 'место';
  }
  return `${place} ${suffix}`;
}

/** «2 балла», «5 баллов» */
export function formatBalls(n: number): string {
  const value = roundScore(n);
  const abs = Math.abs(value) % 100;
  const last = abs % 10;
  let word = 'баллов';
  if (!(abs > 10 && abs < 20)) {
    if (last === 1) word = 'балл';
    else if (last >= 2 && last <= 4) word = 'балла';
  }
  return `${String(value).replace('.', ',')} ${word}`;
}

export function formatDateTime(iso: string | number): string {
  const date = typeof iso === 'number' ? new Date(iso) : new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function stripExtension(name: string): string {
  const index = name.lastIndexOf('.');
  return index > 0 ? name.slice(0, index) : name;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 КБ';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, index);
  const rounded = value >= 10 || index === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${String(rounded).replace('.', ',')} ${units[index]}`;
}
