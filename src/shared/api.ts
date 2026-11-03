import type { GamePhase, GameState, MediaAsset, MediaKind, QuizPack, Team } from './types';

export interface OpenPackResult {
  pack: QuizPack;
  path: string;
  /** Проблемы целостности (повреждённые/отсутствующие медиа) */
  issues: string[];
  mediaCount: number;
}

export interface SavePackResult {
  path: string;
  savedAt: number;
  issues: string[];
}

export interface DemoPackInfo {
  path: string;
  fileName: string;
  title: string;
  description: string;
  rounds: number;
  questions: number;
}

export interface DraftInfo {
  path: string | null;
  pack: QuizPack;
  savedAt: number;
}

export interface DisplayInfo {
  id: number;
  label: string;
  primary: boolean;
  width: number;
  height: number;
}

export interface RecoveryInfo {
  available: boolean;
  title: string;
  description: string;
  phase: GamePhase;
  teams: string[];
  savedAt: number;
  roundNumber: number;
  questionNumber: number;
  totalQuestions: number;
  packPath: string | null;
}

export interface TickPayload {
  remainingMs: number;
  running: boolean;
  paused: boolean;
  /** Время вышло */
  ended: boolean;
}

export interface Notice {
  kind: 'error' | 'info' | 'success';
  message: string;
}

export interface PrepareGamePayload {
  pack: QuizPack;
  packPath: string | null;
}

export interface QuizApi {
  pack: {
    open(): Promise<OpenPackResult | null>;
    openPath(path: string): Promise<OpenPackResult>;
    save(pack: QuizPack, path: string | null, saveAs: boolean): Promise<SavePackResult | null>;
    /** Копирование выбранного файла в библиотеку медиа и регистрация ассета */
    addMedia(kind: MediaKind): Promise<MediaAsset | null>;
    removeMedia(assetId: string): Promise<void>;
    listDemos(): Promise<DemoPackInfo[]>;
    draftSave(pack: QuizPack, path: string | null): Promise<{ savedAt: number }>;
    draftLoad(): Promise<DraftInfo | null>;
    draftClear(): Promise<void>;
    /** Открыть окна игры для указанного пака */
    prepareGame(payload: PrepareGamePayload): Promise<void>;
  };
  game: {
    getState(): Promise<GameState | null>;
    start(payload: { teams: Team[]; mode: 'team' | 'individual' }): Promise<void>;
    addTeam(name: string): Promise<void>;
    removeTeam(teamId: string): Promise<void>;
    renameTeam(teamId: string, name: string): Promise<void>;
    next(): Promise<void>;
    prev(): Promise<void>;
    skip(): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    togglePause(): Promise<void>;
    toggleTimer(): Promise<void>;
    resetTimer(): Promise<void>;
    setRevealed(value: boolean): Promise<void>;
    endRound(): Promise<void>;
    nextRound(): Promise<void>;
    finish(): Promise<void>;
    setScore(teamId: string, questionId: string, points: number): Promise<void>;
    addScore(teamId: string, questionId: string, delta: number): Promise<void>;
    abandon(): Promise<void>;
    recoveryInfo(): Promise<RecoveryInfo | null>;
    recover(): Promise<void>;
    discardRecovery(): Promise<void>;
    sessionCheck(): Promise<unknown>;
    listDisplays(): Promise<DisplayInfo[]>;
    moveToDisplay(displayId: number): Promise<void>;
    setGameFullscreen(value: boolean): Promise<void>;
    openGameWindow(): Promise<void>;
    openHostWindow(): Promise<void>;
    openEditorWindow(): Promise<void>;
    focusHost(): Promise<void>;
    closeGameWindow(): Promise<void>;
  };
  app: {
    version(): Promise<string>;
    openDataFolder(): Promise<void>;
    ready(): Promise<void>;
  };
  onState(callback: (state: GameState) => void): () => void;
  onTick(callback: (payload: TickPayload) => void): () => void;
  onNotice(callback: (notice: Notice) => void): () => void;
  onFullscreen(callback: (value: boolean) => void): () => void;
}
