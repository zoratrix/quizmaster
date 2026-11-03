import { dialog, BrowserWindow } from 'electron';
import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { MediaAsset, MediaKind } from '../shared/types';
import { guessKindFromMime, guessMimeFromExtension, sha256 } from './pack';
import { ensureDir, mediaLibraryDir } from './paths';

const registry = new Map<string, string>();

const FILTERS: Record<MediaKind, Electron.FileFilter[]> = {
  image: [{ name: 'Изображения', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
  audio: [{ name: 'Аудио', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'] }],
  video: [{ name: 'Видео', extensions: ['mp4', 'webm', 'mov', 'mkv', 'm4v'] }]
};

export async function initMediaLibrary(): Promise<void> {
  ensureDir(mediaLibraryDir());
  const files = await readdir(mediaLibraryDir()).catch(() => [] as string[]);
  for (const file of files) {
    const dot = file.indexOf('.');
    if (dot <= 0) continue;
    registry.set(file.slice(0, dot), path.join(mediaLibraryDir(), file));
  }
}

export function registerMediaAsset(assetId: string, filePath: string): void {
  registry.set(assetId, filePath);
}

export function resolveMediaPath(assetId: string): string | null {
  return registry.get(assetId) ?? null;
}

export function mediaPathsMap(): Map<string, string> {
  return new Map(registry);
}

export function hasMedia(assetId: string): boolean {
  return registry.has(assetId);
}

/** Выбор файла через диалог, копирование в библиотеку и регистрация ассета. */
export async function importMedia(kind: MediaKind, parent: BrowserWindow | null): Promise<MediaAsset | null> {
  const result = await dialog.showOpenDialog(parent ?? undefined!, {
    title:
      kind === 'image'
        ? 'Выберите изображение'
        : kind === 'audio'
          ? 'Выберите аудиофайл'
          : 'Выберите видеофайл',
    properties: ['openFile'],
    filters: FILTERS[kind]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return importMediaFromPath(result.filePaths[0], kind);
}

export async function importMediaFromPath(sourcePath: string, kindHint: MediaKind): Promise<MediaAsset> {
  const buffer = await readFile(sourcePath);
  const hash = sha256(buffer);
  // Одинаковые файлы переиспользуют один ассет — пак не раздувается
  const assetId = `m_${hash.slice(0, 16)}`;
  const fileName = path.basename(sourcePath);
  const ext = path.extname(fileName).toLowerCase() || '.bin';
  const target = path.join(ensureDir(mediaLibraryDir()), `${assetId}${ext}`);
  if (!existsSync(target)) {
    await writeFile(target, buffer);
  }
  registry.set(assetId, target);
  const mimeType = guessMimeFromExtension(fileName);
  return {
    id: assetId,
    kind: guessKindFromMime(mimeType) ?? kindHint,
    fileName,
    mimeType,
    size: buffer.byteLength,
    sha256: hash
  };
}

/** Удаляет файл из библиотеки. Вызывать только если ассет больше не используется в пакете. */
export async function removeMedia(assetId: string): Promise<void> {
  const filePath = registry.get(assetId);
  if (!filePath) return;
  registry.delete(assetId);
  const base = mediaLibraryDir().toLowerCase();
  if (filePath.toLowerCase().startsWith(base)) {
    await unlink(filePath).catch(() => undefined);
  }
}
