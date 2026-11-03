import { BrowserWindow, Menu, screen, app } from 'electron';
import path from 'node:path';

const DEV_URL = process.env.QM_DEV_SERVER_URL;
const isDev = Boolean(DEV_URL);

let editorWindow: BrowserWindow | null = null;
let hostWindow: BrowserWindow | null = null;
let gameWindow: BrowserWindow | null = null;
let gameFullscreen = true;
let gameDisplayId: number | null = null;

function preloadPath(): string {
  return path.join(__dirname, '../preload/index.js');
}

function loadRoute(win: BrowserWindow, route: string): void {
  if (DEV_URL) {
    void win.loadURL(`${DEV_URL}#/${route}`);
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: `/${route}` });
  }
}

const BASE_WEB_PREFERENCES = {
  preload: preloadPath(),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false,
  webSecurity: true
};

function baseOptions(): Electron.BrowserWindowConstructorOptions {
  return {
    backgroundColor: '#0f1220',
    show: false,
    autoHideMenuBar: true,
    webPreferences: BASE_WEB_PREFERENCES
  };
}

export function getEditorWindow(): BrowserWindow | null {
  return editorWindow && !editorWindow.isDestroyed() ? editorWindow : null;
}

export function getHostWindow(): BrowserWindow | null {
  return hostWindow && !hostWindow.isDestroyed() ? hostWindow : null;
}

export function getGameWindow(): BrowserWindow | null {
  return gameWindow && !gameWindow.isDestroyed() ? gameWindow : null;
}

export function createEditorWindow(): BrowserWindow {
  const existing = getEditorWindow();
  if (existing) {
    existing.focus();
    return existing;
  }
  const win = new BrowserWindow({
    ...baseOptions(),
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    title: 'QuizMaster — редактор',
    icon: path.join(__dirname, '../renderer/icon.png')
  });
  win.once('ready-to-show', () => {
    win.show();
    if (isDev) win.webContents.openDevTools({ mode: 'detach' });
  });
  win.on('closed', () => {
    editorWindow = null;
  });
  editorWindow = win;
  loadRoute(win, 'editor');
  return win;
}

export function createHostWindow(): BrowserWindow {
  const existing = getHostWindow();
  if (existing) {
    existing.show();
    existing.focus();
    return existing;
  }
  const win = new BrowserWindow({
    ...baseOptions(),
    width: 1360,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    title: 'QuizMaster — панель ведущего',
    icon: path.join(__dirname, '../renderer/icon.png')
  });
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    hostWindow = null;
  });
  hostWindow = win;
  loadRoute(win, 'host');
  return win;
}

function pickDisplay(displayId: number | null): Electron.Display {
  const displays = screen.getAllDisplays();
  if (displayId !== null) {
    const found = displays.find((d) => d.id === displayId);
    if (found) return found;
  }
  if (gameDisplayId !== null) {
    const found = displays.find((d) => d.id === gameDisplayId);
    if (found) return found;
  }
  const primary = screen.getPrimaryDisplay();
  const secondary = displays.find((d) => d.id !== primary.id);
  return secondary ?? primary;
}

export function createGameWindow(displayId: number | null = gameDisplayId): BrowserWindow {
  const existing = getGameWindow();
  if (existing) {
    existing.show();
    existing.focus();
    return existing;
  }
  const display = pickDisplay(displayId);
  gameDisplayId = display.id;
  const win = new BrowserWindow({
    ...baseOptions(),
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    fullscreen: gameFullscreen,
    title: 'QuizMaster — игровой экран',
    icon: path.join(__dirname, '../renderer/icon.png')
  });
  win.once('ready-to-show', () => {
    win.show();
    if (gameFullscreen) win.setFullScreen(true);
  });
  win.on('closed', () => {
    gameWindow = null;
  });
  win.on('enter-full-screen', () => sendWindowState(win, true));
  win.on('leave-full-screen', () => sendWindowState(win, false));
  gameWindow = win;
  loadRoute(win, 'game');
  return win;
}

function sendWindowState(win: BrowserWindow, fullscreen: boolean): void {
  if (!win.isDestroyed()) win.webContents.send('window:fullscreen', fullscreen);
}

export function closeGameWindow(): void {
  getGameWindow()?.close();
}

export function setGameFullscreen(value: boolean): void {
  gameFullscreen = value;
  const win = getGameWindow();
  if (!win) return;
  win.setFullScreen(value);
}

export function moveGameToDisplay(displayId: number): void {
  const win = getGameWindow();
  const displays = screen.getAllDisplays();
  const display = displays.find((d) => d.id === displayId);
  if (!win || !display) return;
  gameDisplayId = display.id;
  const wasFullscreen = win.isFullScreen();
  if (wasFullscreen) win.setFullScreen(false);
  win.setBounds(display.bounds);
  if (gameFullscreen) win.setFullScreen(true);
  win.focus();
}

export function broadcast(channel: string, payload: unknown): void {
  for (const win of [editorWindow, hostWindow, gameWindow]) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

export function focusWindow(target: 'editor' | 'host' | 'game'): void {
  const win = target === 'editor' ? getEditorWindow() : target === 'host' ? getHostWindow() : getGameWindow();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
}

export function installMenu(): void {
  if (isDev) return; // в разработке оставляем стандартное меню с DevTools
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Файл',
        submenu: [{ role: 'quit', label: 'Выход' }]
      },
      {
        label: 'Вид',
        submenu: [
          { role: 'reload', label: 'Обновить' },
          { role: 'toggleDevTools', label: 'Инструменты разработчика' },
          { type: 'separator' },
          { role: 'togglefullscreen', label: 'Полный экран' }
        ]
      },
      {
        label: 'Справка',
        submenu: [
          {
            label: 'Открыть папку данных',
            click: () => {
              void import('electron').then(({ shell }) => shell.openPath(app.getPath('userData')));
            }
          },
          { label: `Версия ${app.getVersion()}`, enabled: false }
        ]
      }
    ])
  );
}
