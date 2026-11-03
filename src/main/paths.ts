import { app } from 'electron';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

/** Все служебные папки приложения живут в стандартном каталоге данных пользователя Windows. */
export function userDataDir(): string {
  return app.getPath('userData');
}

export function mediaLibraryDir(): string {
  return path.join(userDataDir(), 'media');
}

export function sessionsDir(): string {
  return path.join(userDataDir(), 'sessions');
}

export function draftsDir(): string {
  return path.join(userDataDir(), 'drafts');
}

export function ensureDir(dir: string): string {
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Папка с демонстрационными паками: в установленной версии — resources/packs, в разработке — ./packs */
export function demoPacksDir(resourcesPath: string): string {
  const packaged = path.join(resourcesPath, 'packs');
  return packaged;
}
