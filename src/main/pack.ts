import AdmZip from 'adm-zip';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { MediaAsset, MediaKind, PackManifest, QuizPack } from '../shared/types';
import { collectMedia, normalizePack } from '../shared/factory';
import { SCHEMA_VERSION } from '../shared/types';

const MANIFEST_ENTRY = 'manifest.json';
const MEDIA_PREFIX = 'media/';

export interface ReadPackResult {
  pack: QuizPack;
  path: string;
  issues: string[];
  /** Распакованные в библиотеку медиафайлы: assetId -> путь на диске */
  mediaFiles: Array<{ assetId: string; filePath: string }>;
  mediaCount: number;
}

export interface MediaEntry {
  asset: MediaAsset;
  /** Путь внутри zip */
  entry: string;
}

export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function extensionFor(fileName: string, mimeType: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext) return ext;
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'audio/mpeg': '.mp3',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'audio/x-wav': '.wav',
    'video/mp4': '.mp4',
    'video/webm': '.webm'
  };
  return map[mimeType] ?? '.bin';
}

export function assetEntry(asset: MediaAsset): string {
  const ext = extensionFor(asset.fileName, asset.mimeType);
  return `${MEDIA_PREFIX}${asset.id}${ext}`;
}

/**
 * Упаковывает пак в .quizpack (zip): manifest.json + media/*.
 * mediaPaths: assetId -> абсолютный путь к локальному файлу.
 */
export async function writePackFile(
  targetPath: string,
  pack: QuizPack,
  mediaPaths: Map<string, string>
): Promise<{ issues: string[] }> {
  const zip = new AdmZip();
  const issues: string[] = [];
  const media: MediaEntry[] = [];

  for (const asset of collectMedia(pack)) {
    const filePath = mediaPaths.get(asset.id);
    if (!filePath || !existsSync(filePath)) {
      issues.push(`Не найден файл медиа «${asset.fileName}» — он не будет добавлен в пак.`);
      continue;
    }
    const buffer = await readFile(filePath);
    const entry = assetEntry(asset);
    zip.addFile(entry, buffer);
    media.push({
      asset: {
        ...asset,
        size: buffer.byteLength,
        sha256: sha256(buffer)
      },
      entry
    });
  }

  const cleanPack: QuizPack = {
    ...pack,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString()
  };

  const manifest: PackManifest = {
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    pack: cleanPack,
    media
  };

  zip.addFile(MANIFEST_ENTRY, Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, zip.toBuffer());
  return { issues };
}

/**
 * Читает .quizpack, проверяет целостность и складывает медиа в библиотеку.
 * Возвращает нормализованный пак и список проблем (пустой = пак в порядке).
 */
export async function readPackFile(packPath: string, mediaDir: string): Promise<ReadPackResult> {
  if (!existsSync(packPath)) {
    throw new Error('Файл пака не найден. Возможно, он был перемещён или удалён.');
  }
  let zip: AdmZip;
  try {
    zip = new AdmZip(packPath);
  } catch {
    throw new Error('Файл повреждён или это не игровой пак QuizMaster (.quizpack).');
  }
  const manifestEntry = zip.getEntry(MANIFEST_ENTRY);
  if (!manifestEntry) {
    throw new Error('Повреждённый пак: внутри архива нет описания игры (manifest.json).');
  }
  let manifest: PackManifest;
  try {
    manifest = JSON.parse(zip.readAsText(manifestEntry)) as PackManifest;
  } catch {
    throw new Error('Повреждённый пак: не удалось прочитать описание игры');
  }
  if (!manifest?.pack) {
    throw new Error('Повреждённый пак: пустое описание игры');
  }

  const issues: string[] = [];
  if (manifest.schemaVersion > SCHEMA_VERSION) {
    issues.push('Пак создан в более новой версии QuizMaster — часть данных может не отображаться.');
  }

  await mkdir(mediaDir, { recursive: true });
  const mediaFiles: Array<{ assetId: string; filePath: string }> = [];

  for (const item of manifest.media ?? []) {
    const asset = item?.asset;
    if (!asset?.id) continue;
    const entry = zip.getEntry(item.entry ?? assetEntry(asset));
    if (!entry) {
      issues.push(`В паке отсутствует файл медиа «${asset.fileName}».`);
      continue;
    }
    const buffer = entry.getData();
    if (asset.sha256 && sha256(buffer) !== asset.sha256) {
      issues.push(`Файл медиа «${asset.fileName}» повреждён (не совпала контрольная сумма).`);
      continue;
    }
    const target = path.join(mediaDir, `${asset.id}${extensionFor(asset.fileName, asset.mimeType)}`);
    await writeFile(target, buffer);
    mediaFiles.push({ assetId: asset.id, filePath: target });
  }

  const pack = normalizePack(manifest.pack);
  for (const asset of collectMedia(pack)) {
    const found = mediaFiles.some((item) => item.assetId === asset.id);
    if (!found) {
      const known = (manifest.media ?? []).some((item) => item?.asset?.id === asset.id);
      if (!known) {
        issues.push(`Медиа «${asset.fileName}» не найдено в паке — вопрос будет показан без него.`);
      }
    }
  }

  return { pack, path: packPath, issues, mediaFiles, mediaCount: mediaFiles.length };
}

/** Только метаданные пака (для списка демо-паков), без распаковки медиа. */
export async function readPackMeta(
  packPath: string
): Promise<{ title: string; description: string; rounds: number; questions: number }> {
  let zip: AdmZip;
  try {
    zip = new AdmZip(packPath);
  } catch {
    throw new Error('Файл повреждён или это не игровой пак QuizMaster (.quizpack).');
  }
  const entry = zip.getEntry(MANIFEST_ENTRY);
  if (!entry) throw new Error('В архиве нет описания игры (manifest.json).');
  const manifest = JSON.parse(zip.readAsText(entry)) as PackManifest;
  const pack = normalizePack(manifest.pack);
  return {
    title: pack.title,
    description: pack.description,
    rounds: pack.rounds.length,
    questions: pack.rounds.reduce((sum, round) => sum + round.questions.length, 0)
  };
}

export function guessKindFromMime(mime: string): MediaKind | null {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return null;
}

export function guessMimeFromExtension(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska'
  };
  return map[ext] ?? 'application/octet-stream';
}
