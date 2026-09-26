import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { MenuCommand, OpenedDocument, RaporgoApi, Settings } from '../shared/api.js';

/**
 * The renderer gets exactly these calls and nothing else — no `fs`, no `path`,
 * no module loading. Everything that touches disk happens in the main process.
 */
const api: RaporgoApi = {
  newDocument: (template) => ipcRenderer.invoke('doc:new', template),
  openDocument: () => ipcRenderer.invoke('doc:open'),
  openPath: (path) => ipcRenderer.invoke('doc:open-path', path),
  save: (path, doc) => ipcRenderer.invoke('doc:save', path, doc),
  buildPreview: (doc, dir) => ipcRenderer.invoke('preview:build', doc, dir),
  validate: (doc, dir) => ipcRenderer.invoke('doc:validate', doc, dir),
  exportPdf: (doc, dir) => ipcRenderer.invoke('export:pdf', doc, dir),
  addAsset: (dir) => ipcRenderer.invoke('assets:add', dir),
  listAssets: (dir) => ipcRenderer.invoke('assets:list', dir),
  deleteAssets: (dir, sources) => ipcRenderer.invoke('assets:delete', dir, sources),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
  onAssetsChange: (handler) => {
    const listener = (): void => handler();
    ipcRenderer.on('assets:changed', listener);
    return () => ipcRenderer.removeListener('assets:changed', listener);
  },
  recentFiles: () => ipcRenderer.invoke('recent:list'),
  onRecentChange: (handler) => {
    const listener = (): void => handler();
    ipcRenderer.on('recent:changed', listener);
    return () => ipcRenderer.removeListener('recent:changed', listener);
  },
  closeDocument: () => ipcRenderer.invoke('doc:close'),
  revealFile: (path) => ipcRenderer.invoke('file:reveal', path),
  appVersion: () => ipcRenderer.invoke('app:version'),
  onMenuCommand: (handler) => {
    const listener = (_event: unknown, command: MenuCommand): void => handler(command);
    ipcRenderer.on('menu:command', listener);
    return () => ipcRenderer.removeListener('menu:command', listener);
  },
  onMenuOpenPath: (handler) => {
    const listener = (_event: unknown, path: string): void => handler(path);
    ipcRenderer.on('menu:open-path', listener);
    return () => ipcRenderer.removeListener('menu:open-path', listener);
  },
  onSettingsChange: (handler) => {
    const listener = (_event: unknown, settings: Settings): void => handler(settings);
    ipcRenderer.on('settings:changed', listener);
    return () => ipcRenderer.removeListener('settings:changed', listener);
  },
  forgetRecent: (path) => ipcRenderer.invoke('recent:forget', path),
  startupPath: () => ipcRenderer.invoke('startup:path'),
  pathForFile: (file) => webUtils.getPathForFile(file),
  onExternalChange: (handler) => {
    const listener = (_event: unknown, payload: OpenedDocument): void => handler(payload);
    ipcRenderer.on('doc:external-change', listener);
    return () => ipcRenderer.removeListener('doc:external-change', listener);
  },
};

contextBridge.exposeInMainWorld('raporgo', api);
