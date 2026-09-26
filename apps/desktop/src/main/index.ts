import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BrowserWindow, app, dialog, ipcMain, nativeTheme, shell } from 'electron';
import {
  IMAGE_FOLDER,
  parseDocumentOrThrow,
  readDocument,
  validateDocument,
  writeDocument,
  type RaporDocument,
} from '@raporgo/core';
import type { RecentEntry } from '../shared/api.js';
import { buildHtml } from '@raporgo/render/html';
import { reportGuide } from '@raporgo/templates';
import { copyIntoProject, deleteAssets, listAssets } from './assets.js';
import { mainStrings } from './i18n.js';
import { buildMenu } from './menu.js';
import { printPdf, readThumb, refreshThumb, thumbTime } from './pdf.js';
import { forgetRecent, listRecent, rememberRecent } from './recent.js';
import { readSettings, writeSettings } from './settings.js';
import { isUnchangedOnDisk, noteOwnWrite, watchDocument, watchFolders } from './watcher.js';

const isDev = !app.isPackaged;

// Automated runs point the app at a throwaway profile so they never touch
// the user's settings or recent list. Must happen before `ready`.
if (process.env['RAPORGO_USER_DATA']) app.setPath('userData', process.env['RAPORGO_USER_DATA']);
// Screenshot runs render at a fixed pixel ratio (2 for sharp product shots).
if (process.env['RAPORGO_SCALE']) app.commandLine.appendSwitch('force-device-scale-factor', process.env['RAPORGO_SCALE']);
let mainWindow: BrowserWindow | null = null;
let stopWatching: (() => void) | null = null;
/** The report on screen, or null on the home screen. */
let currentPath: string | null = null;

/** The window's own colour before the page paints, matching the editor ground. */
function groundColor(): string {
  return nativeTheme.shouldUseDarkColors ? '#12171f' : '#e9eef6';
}

/**
 * The theme setting drives Electron's own: the title bar, menus and native
 * dialogs follow, and so does `prefers-color-scheme` inside the page.
 */
async function applyTheme(): Promise<void> {
  nativeTheme.themeSource = (await readSettings()).theme;
  mainWindow?.setBackgroundColor(groundColor());
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: groundColor(),
    title: 'RaporGo',
    // The packaged exe carries its own icon; this one shows in development.
    ...(isDev ? { icon: fileURLToPath(new URL('../../build/icon-v2.png', import.meta.url)) } : {}),
    webPreferences: {
      preload: fileURLToPath(new URL('../preload/index.js', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void mainWindow.loadFile(fileURLToPath(new URL('../renderer/index.html', import.meta.url)));
  }

  // External links belong in the user's browser, never in the app shell.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
}

// --- Reports ----------------------------------------------------------------

/**
 * A report is one `.json` file. Images it uses sit in `image_Assets/` beside
 * it; nothing else about its folder matters to the app.
 */

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * The report behind a path. A folder means the `rapor.json` inside it — that
 * is what a project looked like for a while, and such paths still arrive
 * from old recent lists and shortcuts.
 */
async function reportPathOf(target: string): Promise<string> {
  return (await isDirectory(target)) ? join(target, 'rapor.json') : target;
}

/**
 * Opens a report and starts watching it.
 *
 * The watcher is what makes the hybrid workflow work: the user keeps the
 * editor open while an LLM rewrites part of the JSON, and the preview follows.
 */
async function open(target: string) {
  const loaded = await readDocument(await reportPathOf(target));
  stopWatching?.();
  const stopReport = watchDocument(loaded.path, async () => {
    const fresh = await readDocument(loaded.path);
    mainWindow?.webContents.send('doc:external-change', {
      doc: fresh.doc,
      path: fresh.path,
      dir: fresh.dir,
    });
  });
  // Images can change under the report too; the preview follows.
  const stopImages = watchFolders([join(loaded.dir, IMAGE_FOLDER)], () =>
    mainWindow?.webContents.send('assets:changed'),
  );
  stopWatching = () => {
    stopReport();
    stopImages();
  };
  await rememberRecent(loaded.path);
  app.addRecentDocument(loaded.path);
  currentPath = loaded.path;
  void updateMenu();
  return { doc: loaded.doc, path: loaded.path, dir: loaded.dir };
}

/** Where the last report was opened; the next file dialog starts there. */
async function lastFolder(): Promise<string> {
  const last = (await listRecent())[0];
  return last ? dirname(last.path) : app.getPath('documents');
}

ipcMain.handle('doc:new', async (_event, template?: string) => {
  const settings = await readSettings();
  const strings = mainStrings(settings.language);
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: strings.newReportTitle,
    defaultPath: join(await lastFolder(), `${strings.newReportName}.json`),
    filters: [{ name: strings.reportFilter, extensions: ['json'] }],
  });
  if (canceled || !filePath) return null;

  // The settings' "new report" defaults land here; a template picked on the
  // home screen wins over the default one.
  const doc = parseDocumentOrThrow({
    template: template ?? settings.defaults.template,
    theme: { preset: settings.defaults.preset },
    meta: {
      title: basename(filePath, extname(filePath)),
      language: settings.language,
      ...(settings.defaults.author ? { author: settings.defaults.author } : {}),
    },
    segments: [{ id: 'cover', type: 'cover' }],
  });
  await writeDocument(filePath, doc, { guide: reportGuide() });
  return open(filePath);
});

ipcMain.handle('doc:open', async () => {
  const strings = mainStrings((await readSettings()).language);
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: strings.openReportTitle,
    defaultPath: await lastFolder(),
    properties: ['openFile'],
    filters: [{ name: strings.reportFilter, extensions: ['json'] }],
  });
  if (canceled || filePaths.length === 0) return null;
  return open(filePaths[0]!);
});

ipcMain.handle('doc:open-path', async (_event, path: string) => open(path));

/** Back to the home screen: nothing is open, so nothing is watched. */
ipcMain.handle('doc:close', () => {
  stopWatching?.();
  stopWatching = null;
  // What was just edited is what the home screen should picture.
  if (currentPath) refreshThumb(currentPath, notifyRecent);
  currentPath = null;
  void updateMenu();
});

/**
 * Saves only if the file still holds what the editor last read.
 *
 * The renderer autosaves the whole document, so a stale copy would overwrite
 * anything written to the file in between. On a mismatch the save is refused
 * and the fresh document is pushed back to the renderer, which reloads instead
 * of destroying the newer version.
 */
ipcMain.handle('doc:save', async (_event, path: string, doc: RaporDocument) => {
  if (!(await isUnchangedOnDisk(path))) {
    const fresh = await readDocument(path);
    mainWindow?.webContents.send('doc:external-change', {
      doc: fresh.doc,
      path: fresh.path,
      dir: fresh.dir,
    });
    await noteOwnWrite(path);
    return { saved: false, reason: 'stale' as const };
  }

  await writeDocument(path, doc, { guide: reportGuide() });
  await noteOwnWrite(path);
  return { saved: true };
});

ipcMain.handle('preview:build', async (_event, doc: RaporDocument, dir: string) =>
  buildHtml(doc, { docDir: dir }),
);

ipcMain.handle('doc:validate', async (_event, doc: RaporDocument, dir: string) =>
  validateDocument(doc, dir),
);

/** A title becomes a file name: no separators, no characters Windows refuses. */
function fileNameFor(title: string): string {
  const cleaned = title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || 'rapor';
}

/** `2026-09-11-2213` — sortable, and no characters a file name refuses. */
function dateStamp(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

ipcMain.handle('export:pdf', async (_event, doc: RaporDocument, dir: string) => {
  const settings = await readSettings();
  const stem = settings.pdf.name === 'title-date' ? `${fileNameFor(doc.meta.title)} ${dateStamp()}` : fileNameFor(doc.meta.title);
  const proposed = join(dir, `${stem}.pdf`);

  let filePath: string | undefined = proposed;
  if (settings.pdf.where === 'ask') {
    const picked = await dialog.showSaveDialog({
      title: mainStrings(settings.language).exportTitle,
      defaultPath: proposed,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (picked.canceled || !picked.filePath) return null;
    filePath = picked.filePath;
  }

  await writeFile(filePath, await printPdf(doc, dir));
  return filePath;
});

ipcMain.handle('assets:add', async (_event, dir: string) => {
  const strings = mainStrings((await readSettings()).language);
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: strings.addImageTitle,
    properties: ['openFile'],
    filters: [{ name: strings.imageFilter, extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'] }],
  });
  if (canceled || filePaths.length === 0) return null;

  return copyIntoProject(dir, IMAGE_FOLDER, filePaths[0]!);
});

ipcMain.handle('assets:list', async (_event, dir: string) => listAssets(dir));

ipcMain.handle('assets:delete', async (_event, dir: string, sources: string[]) =>
  deleteAssets(dir, sources),
);

// --- Home screen ------------------------------------------------------------

function notifyRecent(): void {
  mainWindow?.webContents.send('recent:changed');
}

/**
 * One home-screen card. The file is read loosely — a report that no longer
 * parses still gets a card, so the user can see it and remove it.
 */
async function describeRecent(path: string, openedAt: number): Promise<RecentEntry> {
  let title = basename(path, extname(path));
  let template = 'mavi-resmi';
  let modifiedAt = 0;
  try {
    modifiedAt = (await stat(path)).mtimeMs;
    const raw = JSON.parse(await readFile(path, 'utf8')) as { template?: unknown; meta?: { title?: unknown } };
    if (typeof raw.meta?.title === 'string' && raw.meta.title.trim()) title = raw.meta.title;
    if (typeof raw.template === 'string') template = raw.template;
  } catch {
    // Keep the file-name title.
  }
  // A thumbnail older than the file (edited since, perhaps by an LLM while
  // the app was closed) is redrawn in the background; the card updates when
  // it lands.
  if ((await thumbTime(path)) < modifiedAt) refreshThumb(path, notifyRecent);
  return { path, title, template, openedAt, modifiedAt, thumb: await readThumb(path) };
}

ipcMain.handle('recent:list', async () =>
  Promise.all((await listRecent()).map((record) => describeRecent(record.path, record.openedAt))),
);
ipcMain.handle('recent:forget', async (_event, path: string) => {
  await forgetRecent(path);
  void updateMenu();
});
ipcMain.handle('file:reveal', (_event, path: string) => shell.showItemInFolder(path));
ipcMain.handle('app:version', () => app.getVersion());

// --- Settings and the menu --------------------------------------------------

async function updateMenu(): Promise<void> {
  if (!mainWindow) return;
  buildMenu(
    mainWindow,
    {
      settings: await readSettings(),
      hasDocument: currentPath !== null,
      recent: (await listRecent()).map((record) => record.path),
      isDev,
    },
    {
      send: (command) => mainWindow?.webContents.send('menu:command', command),
      openRecent: (path) => mainWindow?.webContents.send('menu:open-path', path),
      setTheme: (theme) => {
        void (async () => {
          const stored = await writeSettings({ ...(await readSettings()), theme });
          await applyTheme();
          mainWindow?.webContents.send('settings:changed', stored);
          await updateMenu();
        })();
      },
    },
  );
}

ipcMain.handle('settings:get', () => readSettings());
ipcMain.handle('settings:set', async (_event, settings) => {
  const stored = await writeSettings(settings);
  await applyTheme();
  await updateMenu();
  return stored;
});

/**
 * The report named on a command line — the app's own, or a second launch's
 * ("Open with" while RaporGo is already running). Development runs put the
 * app's own directory in argv; that is skipped.
 */
async function pathFromArgs(argv: string[]): Promise<string | null> {
  const own = resolve(app.getAppPath());
  for (const arg of argv.slice(1)) {
    if (arg.startsWith('-')) continue;
    const absolute = resolve(arg);
    if (absolute === own) continue;
    if (absolute.toLowerCase().endsWith('.json')) return absolute;
    if (await isDirectory(absolute)) return join(absolute, 'rapor.json');
  }
  return null;
}

/**
 * A report passed on the command line is handed to the renderer once it
 * mounts, instead of showing the home screen.
 */
async function startupPath(): Promise<string | null> {
  const fromArgs = await pathFromArgs(process.argv);
  if (fromArgs) return fromArgs;
  // Nothing asked for: the "reopen last report" setting decides.
  if ((await readSettings()).openLastOnStart) return (await listRecent())[0]?.path ?? null;
  return null;
}
ipcMain.handle('startup:path', () => startupPath());

// One window, one watcher: a second launch hands its file to the first and quits.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    void pathFromArgs(argv).then((path) => path && mainWindow?.webContents.send('menu:open-path', path));
  });
}

void app.whenReady().then(async () => {
  await applyTheme();
  createWindow();
  await updateMenu();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopWatching?.();
  if (process.platform !== 'darwin') app.quit();
});
