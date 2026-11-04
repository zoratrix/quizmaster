import { contextBridge, ipcRenderer } from 'electron';
import type {
  BackgroundMusicState,
  DemoPackInfo,
  DisplayInfo,
  DraftInfo,
  Notice,
  OpenPackResult,
  QuizApi,
  RecoveryInfo,
  SavePackResult,
  TickPayload
} from '../shared/api';
import type { GameMode, GameState, MediaAsset, MediaKind, QuizPack, Team } from '../shared/types';

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args) as Promise<T>;
}

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const api: QuizApi = {
  pack: {
    open: () => invoke<OpenPackResult | null>('pack:open'),
    openPath: (packPath: string) => invoke<OpenPackResult>('pack:openPath', packPath),
    save: (pack: QuizPack, path: string | null, saveAs: boolean) =>
      invoke<SavePackResult | null>('pack:save', pack, path, saveAs),
    addMedia: (kind: MediaKind) => invoke<MediaAsset | null>('pack:addMedia', kind),
    removeMedia: (assetId: string) => invoke<void>('pack:removeMedia', assetId),
    listDemos: () => invoke<DemoPackInfo[]>('pack:listDemos'),
    draftSave: (pack: QuizPack, path: string | null) =>
      invoke<{ savedAt: number }>('pack:draftSave', pack, path),
    draftLoad: () => invoke<DraftInfo | null>('pack:draftLoad'),
    draftClear: () => invoke<void>('pack:draftClear'),
    prepareGame: (payload: { pack: QuizPack; packPath: string | null }) =>
      invoke<void>('pack:prepareGame', payload)
  },
  game: {
    getState: () => invoke<GameState | null>('game:getState'),
    start: (payload: { teams: Team[]; mode: GameMode }) => invoke<void>('game:start', payload),
    addTeam: (name: string) => invoke<void>('game:addTeam', name),
    removeTeam: (teamId: string) => invoke<void>('game:removeTeam', teamId),
    renameTeam: (teamId: string, name: string) => invoke<void>('game:renameTeam', teamId, name),
    next: () => invoke<void>('game:next'),
    prev: () => invoke<void>('game:prev'),
    skip: () => invoke<void>('game:skip'),
    pause: () => invoke<void>('game:pause'),
    resume: () => invoke<void>('game:resume'),
    togglePause: () => invoke<void>('game:togglePause'),
    toggleTimer: () => invoke<void>('game:toggleTimer'),
    resetTimer: () => invoke<void>('game:resetTimer'),
    setRevealed: (value: boolean) => invoke<void>('game:setRevealed', value),
    endRound: () => invoke<void>('game:endRound'),
    nextRound: () => invoke<void>('game:nextRound'),
    finish: () => invoke<void>('game:finish'),
    setScore: (teamId: string, questionId: string, points: number) =>
      invoke<void>('game:setScore', teamId, questionId, points),
    addScore: (teamId: string, questionId: string, delta: number) =>
      invoke<void>('game:addScore', teamId, questionId, delta),
    abandon: () => invoke<void>('game:abandon'),
    recoveryInfo: () => invoke<RecoveryInfo | null>('game:recoveryInfo'),
    recover: () => invoke<void>('game:recover'),
    discardRecovery: () => invoke<void>('game:discardRecovery'),
    sessionCheck: () => invoke<unknown>('game:sessionCheck'),
    listDisplays: () => invoke<DisplayInfo[]>('game:listDisplays'),
    moveToDisplay: (displayId: number) => invoke<void>('game:moveToDisplay', displayId),
    setGameFullscreen: (value: boolean) => invoke<void>('game:setGameFullscreen', value),
    openGameWindow: () => invoke<void>('game:openGameWindow'),
    openHostWindow: () => invoke<void>('game:openHostWindow'),
    openEditorWindow: () => invoke<void>('game:openEditorWindow'),
    focusHost: () => invoke<void>('game:focusHost'),
    closeGameWindow: () => invoke<void>('game:closeGameWindow'),
    getMusicState: () => invoke<BackgroundMusicState>('game:getMusicState'),
    setMusicState: (patch: Partial<BackgroundMusicState>) =>
      invoke<BackgroundMusicState>('game:setMusicState', patch)
  },
  app: {
    version: () => invoke<string>('app:version'),
    openDataFolder: () => invoke<void>('app:openDataFolder'),
    ready: () => invoke<void>('app:ready')
  },
  onState: (callback: (state: GameState) => void) => subscribe<GameState>('game:state', callback),
  onTick: (callback: (payload: TickPayload) => void) => subscribe<TickPayload>('game:tick', callback),
  onNotice: (callback: (notice: Notice) => void) => subscribe<Notice>('game:notice', callback),
  onFullscreen: (callback: (value: boolean) => void) => subscribe<boolean>('window:fullscreen', callback),
  onMusicState: (callback: (state: BackgroundMusicState) => void) =>
    subscribe<BackgroundMusicState>('game:music', callback)
};

contextBridge.exposeInMainWorld('qm', api);
