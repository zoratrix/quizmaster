/**
 * Адаптивные размеры надписей игрового экрана.
 *
 * Текст читается с большого расстояния (проектор), поэтому кегль подбирается
 * по длине текста: короткие надписи — огромные, длинные — заметно меньше,
 * но не мельче комфортного минимума. Возвращаем CSS-функцию clamp(), чтобы
 * размер дополнительно масштабировался под размер окна.
 */

interface SizeStep {
  /** Максимальная длина текста в символах, для которой подходит размер */
  upTo: number;
  size: string;
}

function pick(steps: readonly SizeStep[], length: number): string {
  for (const step of steps) {
    if (length <= step.upTo) return step.size;
  }
  return steps[steps.length - 1].size;
}

const QUESTION_TEXT: readonly SizeStep[] = [
  { upTo: 30, size: 'clamp(60px, 7.4vw, 148px)' },
  { upTo: 60, size: 'clamp(48px, 5.8vw, 108px)' },
  { upTo: 100, size: 'clamp(40px, 4.6vw, 84px)' },
  { upTo: 160, size: 'clamp(32px, 3.8vw, 68px)' },
  { upTo: 240, size: 'clamp(28px, 3.1vw, 54px)' },
  { upTo: Number.POSITIVE_INFINITY, size: 'clamp(23px, 2.5vw, 44px)' }
];

const QUESTION_TEXT_WITH_MEDIA: readonly SizeStep[] = [
  { upTo: 30, size: 'clamp(40px, 4.2vw, 78px)' },
  { upTo: 60, size: 'clamp(35px, 3.6vw, 66px)' },
  { upTo: 100, size: 'clamp(30px, 3vw, 56px)' },
  { upTo: 160, size: 'clamp(25px, 2.5vw, 46px)' },
  { upTo: 240, size: 'clamp(21px, 2.1vw, 38px)' },
  { upTo: Number.POSITIVE_INFINITY, size: 'clamp(18px, 1.8vw, 32px)' }
];

const ANSWER_TEXT: readonly SizeStep[] = [
  { upTo: 16, size: 'clamp(40px, 5vw, 92px)' },
  { upTo: 40, size: 'clamp(32px, 4vw, 72px)' },
  { upTo: 80, size: 'clamp(26px, 3.2vw, 56px)' },
  { upTo: 140, size: 'clamp(22px, 2.6vw, 44px)' },
  { upTo: Number.POSITIVE_INFINITY, size: 'clamp(18px, 2.1vw, 34px)' }
];

const ROUND_TITLE: readonly SizeStep[] = [
  { upTo: 18, size: 'clamp(40px, 5.4vw, 104px)' },
  { upTo: 40, size: 'clamp(32px, 4.2vw, 78px)' },
  { upTo: 70, size: 'clamp(26px, 3.3vw, 60px)' },
  { upTo: Number.POSITIVE_INFINITY, size: 'clamp(22px, 2.6vw, 46px)' }
];

const LOBBY_TITLE: readonly SizeStep[] = [
  { upTo: 18, size: 'clamp(56px, 8.4vw, 168px)' },
  { upTo: 36, size: 'clamp(44px, 6.6vw, 124px)' },
  { upTo: 64, size: 'clamp(34px, 5vw, 92px)' },
  { upTo: Number.POSITIVE_INFINITY, size: 'clamp(26px, 3.8vw, 68px)' }
];

/**
 * Список правильных ответов раунда: чем больше вопросов, тем мельче строка,
 * иначе весь список не помещается на экран проектора.
 */
const ANSWERS_ROW: readonly SizeStep[] = [
  { upTo: 3, size: 'clamp(30px, 2.9vw, 48px)' },
  { upTo: 5, size: 'clamp(25px, 2.4vw, 40px)' },
  { upTo: 7, size: 'clamp(22px, 2vw, 34px)' },
  { upTo: 9, size: 'clamp(19px, 1.7vw, 29px)' },
  { upTo: 12, size: 'clamp(16px, 1.45vw, 25px)' },
  { upTo: Number.POSITIVE_INFINITY, size: 'clamp(14px, 1.2vw, 20px)' }
];

const WINNER_TEXT: readonly SizeStep[] = [
  { upTo: 16, size: 'clamp(56px, 6.6vw, 128px)' },
  { upTo: 34, size: 'clamp(42px, 5.2vw, 98px)' },
  { upTo: 60, size: 'clamp(32px, 4vw, 76px)' },
  { upTo: Number.POSITIVE_INFINITY, size: 'clamp(26px, 3.2vw, 58px)' }
];

/** Текст вопроса; с медиа-блоком кегль меньше, чтобы всё поместилось в кадр. */
export function questionTextSize(length: number, hasMedia: boolean): string {
  return pick(hasMedia ? QUESTION_TEXT_WITH_MEDIA : QUESTION_TEXT, Math.max(0, length));
}

/** Текст правильного ответа на панели раскрытия. */
export function answerTextSize(length: number): string {
  return pick(ANSWER_TEXT, Math.max(0, length));
}

/** Название раунда на заставке. */
export function roundTitleSize(length: number): string {
  return pick(ROUND_TITLE, Math.max(0, length));
}

/** Заголовок пака в лобби. */
export function lobbyTitleSize(length: number): string {
  return pick(LOBBY_TITLE, Math.max(0, length));
}

/** Имя победителя (или нескольких победителей) на итоговом экране. */
export function winnerTextSize(length: number): string {
  return pick(WINNER_TEXT, Math.max(0, length));
}

/** Базовый кегль строки в списке правильных ответов: зависит от числа вопросов. */
export function answersTextSize(count: number): string {
  return pick(ANSWERS_ROW, Math.max(1, count));
}
