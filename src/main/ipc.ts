import { app, BrowserWindow, dialog, ipcMain, screen, shell } from 'electron';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  DemoPackInfo,
  DisplayInfo,
  DraftInfo,
  OpenPackResult,
  RecoveryInfo,
  SavePackResult
} from '../shared/api';
import { totalQuestionCount } from '../shared/factory';
import type { GameMode, MediaKind, PersistedSession, QuizPack, Team } from '../shared/types';
import type { GameController } from './gameController';
import { importMedia, mediaPathsMap, registerMediaAsset, removeMedia } from './media';
import { readPackFile, readPackMeta, writePackFile } from './pack';
import { draftsDir, ensureDir, mediaLibraryDir } from './paths';
import { clearSession, readSession } from './session';
import {
  createEditorWindow,
  createGameWindow,
  createHostWindow,
  focusWindow,
  getGameWindow,
  moveGameToDisplay,
  setGameFullscreen
} from './windows';

const PACK_FILTER = [{ name: 'Игровой пак QuizMaster', extensions: ['quizpack'] }];

function ownerOf(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

function sanitizeFileName(title: string): string {
  return (title || 'quiz').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 80) || 'quiz';
}

function packsDirForDemos(): string {
  return app.isPackaged ? path.join(process.resourcesPath, 'packs') : path.join(app.getAppPath(), 'packs');
}

async function openPackByPath(packPath: string): Promise<OpenPackResult> {
  const loaded = await readPackFile(packPath, mediaLibraryDir());
  for (const item of loaded.mediaFiles) registerMediaAsset(item.assetId, item.filePath);
  return {
    pack: loaded.pack,
    path: loaded.path,
    issues: loaded.issues,
    mediaCount: loaded.mediaCount
  };
}

function askOpenPack(parent: BrowserWindow | null): Promise<Electron.OpenDialogReturnValue> {
  const options: Electron.OpenDialogOptions = {
    title: 'Открыть игровой пак',
    properties: ['openFile'],
    filters: PACK_FILTER,
    defaultPath: packsDirForDemos()
  };
  return parent ? dialog.showOpenDialog(parent, options) : dialog.showOpenDialog(options);
}

function askSavePack(parent: BrowserWindow | null, title: string): Promise<Electron.SaveDialogReturnValue> {
  const options: Electron.SaveDialogOptions = {
    title: 'Сохранить игровой пак',
    defaultPath: path.join(app.getPath('documents'), `${sanitizeFileName(title)}.quizpack`),
    filters: PACK_FILTER
  };
  return parent ? dialog.showSaveDialog(parent, options) : dialog.showSaveDialog(options);
}

export function registerIpc(controller: GameController): void {
  // ---------- Паки ----------

  ipcMain.handle('pack:open', async (event): Promise<OpenPackResult | null> => {
    const result = await askOpenPack(ownerOf(event));
    if (result.canceled || result.filePaths.length === 0) return null;
    return openPackByPath(result.filePaths[0]);
  });

  ipcMain.handle('pack:openPath', async (_event, packPath: string): Promise<OpenPackResult> => {
    return openPackByPath(packPath);
  });

  ipcMain.handle(
    'pack:save',
    async (event, pack: QuizPack, packPath: string | null, saveAs: boolean): Promise<SavePackResult | null> => {
      let target = packPath;
      if (!target || saveAs) {
        const result = await askSavePack(ownerOf(event), pack.title);
        if (result.canceled || !result.filePath) return null;
        target = result.filePath.toLowerCase().endsWith('.quizpack') ? result.filePath : `${result.filePath}.quizpack`;
      }
      const { issues } = await writePackFile(target, pack, mediaPathsMap());
      return { path: target, savedAt: Date.now(), issues };
    }
  );

  ipcMain.handle('pack:addMedia', async (event, kind: MediaKind) => importMedia(kind, ownerOf(event)));
  ipcMain.handle('pack:removeMedia', async (_event, assetId: string) => removeMedia(assetId));

  ipcMain.handle('pack:listDemos', async (): Promise<DemoPackInfo[]> => {
    const dir = packsDirForDemos();
    if (!existsSync(dir)) return [];
    const files = await readdir(dir);
    const result: DemoPackInfo[] = [];
    for (const file of files) {
      if (!file.toLowerCase().endsWith('.quizpack')) continue;
      const fullPath = path.join(dir, file);
      try {
        const meta = await readPackMeta(fullPath);
        result.push({
          path: fullPath,
          fileName: file,
          title: meta.title,
          description: meta.description,
          rounds: meta.rounds,
          questions: meta.questions
        });
      } catch {
        // битый демо-пак пропускаем
      }
    }
    return result;
  });

  ipcMain.handle('pack:prepareGame', async (_event, payload: { pack: QuizPack; packPath: string | null }) => {
    controller.prepare(payload.pack, payload.packPath);
    createHostWindow();
    createGameWindow();
  });

  // ---------- Черновик редактора ----------

  ipcMain.handle('pack:draftSave', async (_event, pack: QuizPack, packPath: string | null) => {
    const dir = ensureDir(draftsDir());
    const payload = { schemaVersion: pack.schemaVersion, savedAt: Date.now(), pack, path: packPath };
    await writeFile(path.join(dir, 'draft.json'), JSON.stringify(payload), 'utf8');
    return { savedAt: payload.savedAt };
  });

  ipcMain.handle('pack:draftLoad', async (): Promise<DraftInfo | null> => {
    const file = path.join(draftsDir(), 'draft.json');
    if (!existsSync(file)) return null;
    try {
      const raw = JSON.parse(await readFile(file, 'utf8'));
      if (!raw?.pack) return null;
      return { pack: raw.pack, path: raw.path ?? null, savedAt: raw.savedAt ?? Date.now() };
    } catch {
      return null;
    }
  });

  ipcMain.handle('pack:draftClear', async () => {
    await unlink(path.join(draftsDir(), 'draft.json')).catch(() => undefined);
  });

  // ---------- Игровые команды ----------

  ipcMain.handle('game:getState', () => controller.state);
  ipcMain.handle('game:start', (_event, payload: { teams: Team[]; mode: GameMode }) => controller.start(payload));
  ipcMain.handle('game:addTeam', (_event, name: string) => controller.addTeam(name));
  ipcMain.handle('game:renameTeam', (_event, teamId: string, name: string) => controller.renameTeam(teamId, name));
  ipcMain.handle('game:removeTeam', (_event, teamId: string) => controller.removeTeam(teamId));
  ipcMain.handle('game:next', () => controller.next());
  ipcMain.handle('game:prev', () => controller.prev());
  ipcMain.handle('game:skip', () => controller.skip());
  ipcMain.handle('game:pause', () => controller.pause());
  ipcMain.handle('game:resume', () => controller.resume());
  ipcMain.handle('game:togglePause', () => controller.togglePause());
  ipcMain.handle('game:toggleTimer', () => controller.toggleTimer());
  ipcMain.handle('game:resetTimer', () => controller.resetTimer());
  ipcMain.handle('game:setRevealed', (_event, value: boolean) => controller.setRevealed(value));
  ipcMain.handle('game:endRound', () => controller.endRound());
  ipcMain.handle('game:nextRound', () => controller.nextRound());
  ipcMain.handle('game:finish', () => controller.finish());
  ipcMain.handle('game:setScore', (_event, teamId: string, questionId: string, points: number) =>
    controller.setScore(teamId, questionId, points)
  );
  ipcMain.handle('game:addScore', (_event, teamId: string, questionId: string, delta: number) =>
    controller.addScore(teamId, questionId, delta)
  );
  ipcMain.handle('game:abandon', async () => {
    controller.abandon();
    await clearSession();
  });

  ipcMain.handle('game:sessionCheck', async (): Promise<PersistedSession | null> => readSession());

  ipcMain.handle('game:recoveryInfo', async (): Promise<RecoveryInfo | null> => {
    const session = await readSession();
    if (!session) return null;
    const state = session.state;
    if (state.phase === 'lobby' || state.phase === 'finished') return null;
    return {
      available: true,
      title: state.pack.title,
      description: state.pack.description ?? '',
      phase: state.phase,
      teams: state.teams.map((team) => team.name),
      savedAt: session.savedAt,
      roundNumber: state.roundIndex + 1,
      questionNumber: state.questionIndex + 1,
      totalQuestions: totalQuestionCount(state.pack),
      packPath: state.packPath
    };
  });

  ipcMain.handle('game:recover', async () => {
    const session = await readSession();
    if (!session) throw new Error('Сохранённая игра не найдена');
    const state = session.state;
    if (state.packPath && existsSync(state.packPath)) {
      try {
        const loaded = await readPackFile(state.packPath, mediaLibraryDir());
        for (const item of loaded.mediaFiles) registerMediaAsset(item.assetId, item.filePath);
        state.pack = loaded.pack;
      } catch (error) {
        console.warn('[recover] не удалось перечитать пак, используем сохранённую копию:', error);
      }
    }
    controller.restore(state);
    createHostWindow();
    createGameWindow();
  });

  ipcMain.handle('game:discardRecovery', async () => {
    await clearSession();
  });

  // ---------- Окна и мониторы ----------

  ipcMain.handle('game:listDisplays', (): DisplayInfo[] => {
    const primary = screen.getPrimaryDisplay();
    return screen.getAllDisplays().map((display, index) => ({
      id: display.id,
      label: `Экран ${index + 1}${display.id === primary.id ? ' (основной)' : ''} · ${display.size.width}×${display.size.height}`,
      primary: display.id === primary.id,
      width: display.size.width,
      height: display.size.height
    }));
  });

  ipcMain.handle('game:moveToDisplay', (_event, displayId: number) => moveGameToDisplay(displayId));
  ipcMain.handle('game:setGameFullscreen', (_event, value: boolean) => setGameFullscreen(value));
  ipcMain.handle('game:openGameWindow', () => {
    createGameWindow();
  });
  ipcMain.handle('game:openHostWindow', () => {
    createHostWindow();
  });
  ipcMain.handle('game:openEditorWindow', () => {
    createEditorWindow();
  });
  ipcMain.handle('game:focusHost', () => focusWindow('host'));
  ipcMain.handle('game:closeGameWindow', () => {
    getGameWindow()?.close();
  });

  // ---------- Приложение ----------

  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:openDataFolder', async () => {
    await shell.openPath(app.getPath('userData'));
  });
  ipcMain.handle('app:ready', () => {
    controller.emitTick();
  });
}

export async function ensureDirs(): Promise<void> {
  await mkdir(mediaLibraryDir(), { recursive: true });
  await mkdir(draftsDir(), { recursive: true });
}
