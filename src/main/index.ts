import { app, protocol, shell } from 'electron';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { GameController } from './gameController';
import { registerIpc } from './ipc';
import { initMediaLibrary, resolveMediaPath } from './media';
import { guessMimeFromExtension } from './pack';
import { createEditorWindow, getEditorWindow, installMenu, broadcast } from './windows';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'quizmedia',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true }
  }
]);

app.setAppUserModelId('ru.quizmaster.app');

// Игровой экран показывает видео и аудио сразу при открытии вопроса — без клика ведущего
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Позволяет тестам и «портативному» запуску хранить данные в своей папке
if (process.env.QM_USER_DATA) {
  app.setPath('userData', process.env.QM_USER_DATA);
}

// Обход ограничений Chromium-песочницы в урезанных/серверных окружениях Windows.
// Обычным пользователям не нужен и по умолчанию выключен.
if (process.env.QM_NO_SANDBOX === '1') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu');
}

const controller = new GameController();

async function serveMedia(request: Request): Promise<Response> {
  let assetId = '';
  try {
    const url = new URL(request.url);
    assetId = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  } catch {
    assetId = '';
  }
  if (!assetId) return new Response('Bad request', { status: 400 });

  const filePath = resolveMediaPath(assetId);
  if (!filePath) return new Response('Media not found', { status: 404 });

  let size = 0;
  try {
    const info = await stat(filePath);
    size = info.size;
  } catch {
    return new Response('Media not readable', { status: 404 });
  }

  const contentType = guessMimeFromExtension(filePath);
  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache'
  };

  const rangeHeader = request.headers.get('range');
  if (rangeHeader) {
    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const endRaw = match[2] ? Number(match[2]) : size - 1;
      const end = Math.min(endRaw, size - 1);
      if (Number.isFinite(start) && start <= end) {
        const stream = createReadStream(filePath, { start, end });
        return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
          status: 206,
          headers: {
            ...headers,
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Content-Length': String(end - start + 1)
          }
        });
      }
    }
  }

  const stream = createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    status: 200,
    headers: { ...headers, 'Content-Length': String(size) }
  });
}

function wireControllerToWindows(): void {
  controller.on('state', (state) => {
    broadcast('game:state', state);
  });
  controller.on('tick', (payload) => {
    broadcast('game:tick', payload);
  });
  controller.on('notice', (notice) => {
    broadcast('game:notice', notice);
  });
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = getEditorWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    protocol.handle('quizmedia', serveMedia);
    installMenu();
    await initMediaLibrary();
    wireControllerToWindows();
    registerIpc(controller);
    createEditorWindow();

    app.on('activate', () => {
      if (!getEditorWindow()) createEditorWindow();
    });
  });

  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http://') || url.startsWith('https://')) void shell.openExternal(url);
      return { action: 'deny' };
    });
    contents.on('will-navigate', (event, url) => {
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) return;
      if (url.startsWith('file://')) return;
      event.preventDefault();
    });
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}

export { controller };
