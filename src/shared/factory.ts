import {
  DEFAULT_POINTS,
  DEFAULT_TIME_LIMIT_SEC,
  PARTIAL_CREDIT_RATIO,
  SCHEMA_VERSION,
  type Question,
  type QuestionMedia,
  type QuizPack,
  type Round,
  type Team
} from './types';
import { DEFAULT_THEME, normalizeTheme } from './themes';

export function newId(prefix = 'id'): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}_${uuid.replace(/-/g, '').slice(0, 16)}`;
}

export function emptyMedia(): QuestionMedia {
  return { image: null, audio: null, video: null };
}

export function createQuestion(settings?: QuizPack['settings']): Question {
  return {
    id: newId('q'),
    text: '',
    answer: '',
    explanation: '',
    timeLimitSec: settings?.defaultTimeLimitSec ?? DEFAULT_TIME_LIMIT_SEC,
    points: settings?.defaultPoints ?? DEFAULT_POINTS,
    media: emptyMedia()
  };
}

export function createRound(index: number, settings?: QuizPack['settings']): Round {
  return {
    id: newId('r'),
    title: `Раунд ${index + 1}`,
    questions: [createQuestion(settings)]
  };
}

export function createEmptyPack(): QuizPack {
  const now = new Date().toISOString();
  const settings = {
    defaultTimeLimitSec: DEFAULT_TIME_LIMIT_SEC,
    defaultPoints: DEFAULT_POINTS,
    partialCreditRatio: PARTIAL_CREDIT_RATIO
  };
  return {
    schemaVersion: SCHEMA_VERSION,
    theme: DEFAULT_THEME,
    id: newId('pack'),
    title: 'Новый квиз',
    description: '',
    createdAt: now,
    updatedAt: now,
    settings,
    rounds: [createRound(0, settings)]
  };
}

/** Нормализует пак, прочитанный из файла: чинит отсутствующие/битые поля. */
export function normalizePack(raw: any): QuizPack {
  const pack: QuizPack = {
    schemaVersion: Number(raw?.schemaVersion) || SCHEMA_VERSION,
    theme: normalizeTheme(raw?.theme),
    id: typeof raw?.id === 'string' && raw.id ? raw.id : newId('pack'),
    title: typeof raw?.title === 'string' ? raw.title : 'Без названия',
    description: typeof raw?.description === 'string' ? raw.description : '',
    createdAt: typeof raw?.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    settings: {
      defaultTimeLimitSec: num(raw?.settings?.defaultTimeLimitSec, DEFAULT_TIME_LIMIT_SEC),
      defaultPoints: num(raw?.settings?.defaultPoints, DEFAULT_POINTS),
      partialCreditRatio: num(raw?.settings?.partialCreditRatio, PARTIAL_CREDIT_RATIO)
    },
    rounds: Array.isArray(raw?.rounds) ? raw.rounds.map(normalizeRound) : []
  };
  if (pack.rounds.length === 0) pack.rounds = [createRound(0, pack.settings)];
  return pack;
}

function normalizeRound(raw: any, i: number): Round {
  return {
    id: typeof raw?.id === 'string' && raw.id ? raw.id : newId('r'),
    title: typeof raw?.title === 'string' && raw.title ? raw.title : `Раунд ${i + 1}`,
    questions: Array.isArray(raw?.questions) ? raw.questions.map(normalizeQuestion) : []
  };
}

function normalizeQuestion(raw: any): Question {
  const media = raw?.media ?? {};
  return {
    id: typeof raw?.id === 'string' && raw.id ? raw.id : newId('q'),
    text: typeof raw?.text === 'string' ? raw.text : '',
    answer: typeof raw?.answer === 'string' ? raw.answer : '',
    explanation: typeof raw?.explanation === 'string' ? raw.explanation : '',
    timeLimitSec: Math.max(1, num(raw?.timeLimitSec, DEFAULT_TIME_LIMIT_SEC)),
    points: Math.max(0, num(raw?.points, DEFAULT_POINTS)),
    media: {
      image: normalizeAsset(media.image, 'image'),
      audio: normalizeAsset(media.audio, 'audio'),
      video: normalizeAsset(media.video, 'video')
    }
  };
}

function normalizeAsset(raw: any, kind: MediaKindLike) {
  if (!raw || typeof raw.id !== 'string' || !raw.id) return null;
  return {
    id: raw.id,
    kind: (raw.kind as MediaKindLike) ?? kind,
    fileName: typeof raw.fileName === 'string' ? raw.fileName : raw.id,
    mimeType: typeof raw.mimeType === 'string' ? raw.mimeType : 'application/octet-stream',
    size: num(raw.size, 0),
    sha256: typeof raw.sha256 === 'string' ? raw.sha256 : ''
  };
}

type MediaKindLike = 'image' | 'audio' | 'video';

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function createTeam(name: string): Team {
  return { id: newId('team'), name };
}

/** Все вопросы пака в порядке прохождения */
export function flattenQuestions(pack: QuizPack): Array<{ roundIndex: number; questionIndex: number; question: Question }> {
  const out: Array<{ roundIndex: number; questionIndex: number; question: Question }> = [];
  pack.rounds.forEach((round, roundIndex) => {
    round.questions.forEach((question, questionIndex) => {
      out.push({ roundIndex, questionIndex, question });
    });
  });
  return out;
}

export function totalQuestionCount(pack: QuizPack): number {
  return pack.rounds.reduce((sum, r) => sum + r.questions.length, 0);
}

export function currentRound(pack: QuizPack, roundIndex: number): Round | null {
  return pack.rounds[roundIndex] ?? null;
}

export function currentQuestion(pack: QuizPack, roundIndex: number, questionIndex: number): Question | null {
  return pack.rounds[roundIndex]?.questions[questionIndex] ?? null;
}

/** Уникальные медиа-ассеты пака */
export function collectMedia(pack: QuizPack): MediaAssetLike[] {
  const map = new Map<string, MediaAssetLike>();
  for (const round of pack.rounds) {
    for (const q of round.questions) {
      for (const asset of [q.media.image, q.media.audio, q.media.video]) {
        if (asset) map.set(asset.id, asset);
      }
    }
  }
  return [...map.values()];
}

type MediaAssetLike = NonNullable<Question['media']['image']>;
