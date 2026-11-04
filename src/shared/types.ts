// Общие типы приложения QuizMaster. Используются и в main-процессе, и в renderer.
// ВАЖНО: менять структуру аккуратно — от неё зависит формат .quizpack и сохранённые игры.

export const SCHEMA_VERSION = 2;
export const PACK_EXTENSION = '.quizpack';
export const DEFAULT_TIME_LIMIT_SEC = 60;
export const DEFAULT_POINTS = 1;
export const PARTIAL_CREDIT_RATIO = 0.5;
/** Сколько секунд повторно показывается каждый вопрос перед сдачей бланков */
export const REVIEW_PER_QUESTION_SEC = 15;
/** Сколько секунд даётся на сдачу бланков после просмотра вопросов */
export const HAND_IN_SEC = 40;

export type MediaKind = 'image' | 'audio' | 'video';

/** Оформление игрового экрана для пака */
export type ThemeId =
  | 'default'
  | 'blue'
  | 'pink'
  | 'pastel'
  | 'winter'
  | 'spring'
  | 'summer'
  | 'autumn'
  | 'cyberpunk'
  | 'retro'
  | 'win98'
  | 'halloween'
  | 'newyear'
  | 'valentine';

export interface MediaAsset {
  /** Стабильный идентификатор внутри пака (используется в URL quizmedia://) */
  id: string;
  kind: MediaKind;
  /** Имя файла с расширением, только для информации */
  fileName: string;
  mimeType: string;
  size: number;
  /** SHA-256 содержимого — проверка целостности пака */
  sha256: string;
}

export interface QuestionMedia {
  image: MediaAsset | null;
  audio: MediaAsset | null;
  video: MediaAsset | null;
}

export interface Question {
  id: string;
  text: string;
  /** Правильный ответ для ведущего */
  answer: string;
  /** Картинка-иллюстрация к ответу (постер, кадр); показывается вместе с ответом */
  answerImage: MediaAsset | null;
  /** Необязательное пояснение, показывается после раскрытия ответа */
  explanation: string;
  timeLimitSec: number;
  points: number;
  media: QuestionMedia;
}

export interface Round {
  id: string;
  title: string;
  /** Обложка раунда, показывается на заставке */
  cover: MediaAsset | null;
  questions: Question[];
}

export interface PackSettings {
  defaultTimeLimitSec: number;
  defaultPoints: number;
  /** Доля баллов за частичный ответ (0.5 = 50%) */
  partialCreditRatio: number;
}

export interface QuizPack {
  schemaVersion: number;
  /** Оформление игрового экрана для этого пака (редактор не меняется) */
  theme: ThemeId;
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  settings: PackSettings;
  /** Фоновая музыка пака: треки играют по кругу в паузах игры */
  music: MediaAsset[];
  rounds: Round[];
}

/** Служебный файл manifest.json внутри .quizpack */
export interface PackManifest {
  schemaVersion: number;
  createdAt: string;
  pack: QuizPack;
  media: Array<{ asset: MediaAsset; entry: string }>;
}

export interface Team {
  id: string;
  name: string;
}

export type GameMode = 'team' | 'individual';

export type GamePhase =
  | 'lobby'
  | 'round-intro'
  | 'question'
  /** Повторный показ всех вопросов раунда перед сдачей бланков */
  | 'round-review'
  /** Таймер на сдачу бланков (40 секунд) */
  | 'round-handin'
  /** Показ правильных ответов на все вопросы раунда */
  | 'round-answers'
  | 'round-summary'
  | 'finished';

export interface TimerState {
  durationMs: number;
  remainingMs: number;
  running: boolean;
  /** Абсолютное время окончания (мс), null если таймер не идёт */
  endsAt: number | null;
}

export interface GameState {
  sessionId: string;
  phase: GamePhase;
  mode: GameMode;
  pack: QuizPack;
  packPath: string | null;
  teams: Team[];
  roundIndex: number;
  /** Индекс вопроса внутри раунда; -1 в фазе round-intro */
  questionIndex: number;
  timer: TimerState;
  paused: boolean;
  /** Показан ли правильный ответ на игровом экране */
  revealed: boolean;
  /** Пропущенные вопросы — не считаются полностью отвеченными ни одной командой */
  skippedQuestionIds: string[];
  /** scores[teamId][questionId] = начисленные баллы */
  scores: Record<string, Record<string, number>>;
  startedAt: number | null;
  finishedAt: number | null;
  updatedAt: number;
}

export interface PersistedSession {
  schemaVersion: number;
  savedAt: number;
  state: GameState;
}

// ---------- Статистика ----------

export interface QuestionStat {
  questionId: string;
  roundIndex: number;
  questionIndex: number;
  roundTitle: string;
  questionText: string;
  fullPoints: number;
  /** Сколько команд вообще получили ответ (участники игры) */
  answeredTeams: number;
  fullCount: number;
  partialCount: number;
  zeroCount: number;
  /** Средняя доля набранных баллов от максимума, 0..1 */
  successRate: number;
}

export interface TeamSummary {
  teamId: string;
  name: string;
  total: number;
  place: number;
  byRound: number[];
  bestRoundIndex: number | null;
  bestRoundPoints: number;
  longestStreak: number;
  fullCount: number;
  partialCount: number;
  zeroCount: number;
}

export interface Award {
  id: string;
  title: string;
  description: string;
  teamIds: string[];
}

export interface GameSummary {
  teams: TeamSummary[];
  questions: QuestionStat[];
  easiest: QuestionStat[];
  hardest: QuestionStat[];
  awards: Award[];
  winnerIds: string[];
  totalQuestions: number;
  maxRoundGain: { roundIndex: number; points: number; teamIds: string[] } | null;
}
