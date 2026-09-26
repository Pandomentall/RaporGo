import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BrowserWindow, app } from 'electron';
import { readDocument, type RaporDocument } from '@raporgo/core';
import { PAGED_DONE_FLAG, buildHtml } from '@raporgo/render/html';

/**
 * PDF export and home-screen thumbnails through Electron's own Chromium.
 *
 * The CLI prints with Playwright, which downloads a separate browser on first
 * use — something an installed app cannot count on. The editor already ships
 * a Chromium, so it prints with that: the same HTML, the same Paged.js pass,
 * a window the user never sees instead of a headless page.
 */

const TIMEOUT_MS = 60_000;
const POLL_MS = 100;

async function waitForPagination(window: BrowserWindow): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await window.webContents.executeJavaScript(`window.${PAGED_DONE_FLAG} === true`)) return;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error('The page layout did not finish in time');
}

/**
 * Lays the document out in a window of its own and hands it to `use`.
 * `offscreen` windows paint without being shown, which a screenshot needs;
 * printing does not.
 */
async function withPagedWindow<T>(
  doc: RaporDocument,
  docDir: string,
  offscreen: boolean,
  use: (window: BrowserWindow) => Promise<T>,
): Promise<T> {
  const html = await buildHtml(doc, { docDir });
  const scratch = await mkdtemp(join(tmpdir(), 'raporgo-page-'));
  const page = join(scratch, 'page.html');
  await writeFile(page, html, 'utf8');

  const window = new BrowserWindow({
    show: false,
    width: 1400,
    height: 1400,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      offscreen,
      // A hidden window is throttled by default; Paged.js needs its timers.
      backgroundThrottling: false,
    },
  });

  try {
    await window.loadFile(page);
    await waitForPagination(window);
    return await use(window);
  } finally {
    window.destroy();
    await rm(scratch, { recursive: true, force: true });
  }
}

/** `preferCSSPageSize` keeps the printer from paginating a second time, as in the CLI. */
export function printPdf(doc: RaporDocument, docDir: string): Promise<Buffer> {
  return withPagedWindow(doc, docDir, false, (window) =>
    window.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    }),
  );
}

// --- Thumbnails -------------------------------------------------------------

const THUMB_WIDTH = 360;

function thumbDir(): string {
  return join(app.getPath('userData'), 'thumbs');
}

function thumbPath(reportPath: string): string {
  return join(thumbDir(), `${createHash('sha1').update(reportPath.toLowerCase()).digest('hex')}.png`);
}

/** When the stored thumbnail was written, ms since epoch; 0 when there is none. */
export async function thumbTime(reportPath: string): Promise<number> {
  try {
    return (await stat(thumbPath(reportPath))).mtimeMs;
  } catch {
    return 0;
  }
}

/** The stored first-page picture of a report, as a data URL, or null. */
export async function readThumb(reportPath: string): Promise<string | null> {
  try {
    return `data:image/png;base64,${(await readFile(thumbPath(reportPath))).toString('base64')}`;
  } catch {
    return null;
  }
}

/** Renders the report's first page as it is on disk and stores it for the home screen. */
async function renderThumb(reportPath: string): Promise<void> {
  const { doc, dir } = await readDocument(reportPath);
  const png = await withPagedWindow(doc, dir, true, async (window) => {
    const rect = (await window.webContents.executeJavaScript(`(() => {
      document.body.style.margin = '0';
      const page = document.querySelector('.pagedjs_page');
      if (!page) return null;
      const r = page.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
    })()`)) as Electron.Rectangle | null;
    if (!rect || rect.width === 0) return null;
    // Let the offscreen frame paint the page before it is read back.
    await new Promise((resolve) => setTimeout(resolve, 150));
    const image = await window.webContents.capturePage(rect);
    return image.isEmpty() ? null : image.resize({ width: THUMB_WIDTH, quality: 'best' }).toPNG();
  });
  if (!png) return;
  await mkdir(thumbDir(), { recursive: true });
  await writeFile(thumbPath(reportPath), png);
}

/**
 * Queues a thumbnail refresh. One at a time: each spins up a window, and a
 * burst (open, close, open) should not become three at once. Failures are
 * swallowed — a missing thumbnail falls back to the template's drawing.
 */
let queue: Promise<void> = Promise.resolve();
const pending = new Set<string>();
export function refreshThumb(reportPath: string, onDone?: () => void): void {
  if (pending.has(reportPath)) return;
  pending.add(reportPath);
  queue = queue
    .then(() => renderThumb(reportPath))
    .then(() => onDone?.())
    .catch(() => undefined)
    .finally(() => pending.delete(reportPath));
}
