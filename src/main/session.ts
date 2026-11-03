import { existsSync } from 'node:fs';
import { readFile, rename, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { GameState, PersistedSession } from '../shared/types';
import { SCHEMA_VERSION } from '../shared/types';
import { ensureDir, sessionsDir } from './paths';

function sessionFile(): string {
  return path.join(ensureDir(sessionsDir()), 'current.json');
}

export async function writeSession(state: GameState): Promise<void> {
  const payload: PersistedSession = { schemaVersion: SCHEMA_VERSION, savedAt: Date.now(), state };
  const target = sessionFile();
  const temp = `${target}.tmp`;
  try {
    await writeFile(temp, JSON.stringify(payload), 'utf8');
    await rename(temp, target);
  } catch (error) {
    // Не ломаем игру из-за ошибки записи — просто сообщаем в консоль
    console.error('[session] не удалось сохранить состояние игры:', error);
  }
}

export async function readSession(): Promise<PersistedSession | null> {
  const target = sessionFile();
  if (!existsSync(target)) return null;
  try {
    const raw = await readFile(target, 'utf8');
    const parsed = JSON.parse(raw) as PersistedSession;
    if (!parsed?.state?.pack || !Array.isArray(parsed.state.teams)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const target = sessionFile();
  try {
    if (existsSync(target)) await unlink(target);
  } catch {
    // ignore
  }
  try {
    if (existsSync(`${target}.tmp`)) await unlink(`${target}.tmp`);
  } catch {
    // ignore
  }
}
