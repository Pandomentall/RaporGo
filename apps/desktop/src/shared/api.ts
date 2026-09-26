import type { RaporDocument, Segment, ValidationReport } from '@raporgo/core';
import type { AssetInfo } from '../main/assets.js';
import type { Settings } from './settings.js';

/** What `preload` exposes on `window.raporgo`. Both sides import this type. */
export type OpenedDocument = {
  doc: RaporDocument;
  path: string;
  dir: string;
};

/** What a menu click asks the renderer to do; the same actions as its shortcuts. */
export type MenuCommand =
  | 'new'
  | 'open'
  | 'export'
  | 'home'
  | 'settings'
  | 'undo'
  | 'redo'
  | 'zoomIn'
  | 'zoomOut'
  | 'zoomFit';

/** One card on the home screen. */
export type RecentEntry = {
  /** Absolute path of the report file. */
  path: string;
  /** `meta.title`, or the file name when the file cannot be read. */
  title: string;
  template: string;
  /** When the editor last opened it, ms since epoch (0 if unknown). */
  openedAt: number;
  /** Last modification on disk, ms since epoch. */
  modifiedAt: number;
  /** The first page as a PNG data URL, once one has been rendered. */
  thumb: string | null;
};

export type RaporgoApi = {
  /** Asks where to save a new report file, optionally starting from a template. */
  newDocument(template?: string): Promise<OpenedDocument | null>;
  /** Asks for a report `.json` file. */
  openDocument(): Promise<OpenedDocument | null>;
  /** Opens a report file (a legacy project folder opens its `rapor.json`). */
  openPath(path: string): Promise<OpenedDocument>;
  /**
   * Writes the document, unless the file changed on disk since it was read —
   * then it is refused and the newer version arrives via `onExternalChange`.
   */
  save(path: string, doc: RaporDocument): Promise<{ saved: boolean; reason?: 'stale' }>;
  buildPreview(doc: RaporDocument, dir: string): Promise<string>;
  validate(doc: RaporDocument, dir: string): Promise<ValidationReport>;
  /** Renders to PDF, next to the report or wherever the user picks. */
  exportPdf(doc: RaporDocument, dir: string): Promise<string | null>;
  /** Copies an image the user picked into the image folder beside the report and returns the relative path. */
  addAsset(dir: string): Promise<string | null>;
  /** Everything in the image folder beside the report, with sizes and dimensions. */
  listAssets(dir: string): Promise<AssetInfo[]>;
  /** Deletes assets by document-relative path; returns the ones actually removed. */
  deleteAssets(dir: string, sources: string[]): Promise<string[]>;
  /** Fires when a file in the image folder beside the report changes. */
  onAssetsChange(handler: () => void): () => void;
  getSettings(): Promise<Settings>;
  /** Replaces the stored settings; the main process is the store. */
  setSettings(settings: Settings): Promise<Settings>;
  /** Recently opened report files, newest first; ones that no longer exist are dropped. */
  recentFiles(): Promise<RecentEntry[]>;
  /** Fires when a thumbnail or the recent list changed, so the home screen can refresh. */
  onRecentChange(handler: () => void): () => void;
  /** Leaves the open report: its watcher stops and its thumbnail is refreshed. */
  closeDocument(): Promise<void>;
  /** Shows a file in Explorer. */
  revealFile(path: string): Promise<void>;
  appVersion(): Promise<string>;
  /** Menu clicks, delivered as commands. */
  onMenuCommand(handler: (command: MenuCommand) => void): () => void;
  /** A file picked from the menu's recent list. */
  onMenuOpenPath(handler: (path: string) => void): () => void;
  /** Settings changed outside the renderer, e.g. the theme from the View menu. */
  onSettingsChange(handler: (settings: Settings) => void): () => void;
  /** Removes one entry, e.g. after it failed to open. */
  forgetRecent(path: string): Promise<void>;
  /** A document path passed on the command line, if any. */
  startupPath(): Promise<string | null>;
  /** The on-disk path behind a `File` dropped onto the window; the renderer sees no paths otherwise. */
  pathForFile(file: File): string;
  /** Fires when the file changes on disk from outside the editor — e.g. an LLM edited it. */
  onExternalChange(handler: (payload: OpenedDocument) => void): () => void;
};

export type { AssetInfo, RaporDocument, Segment, Settings, ValidationReport };
