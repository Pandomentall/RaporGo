import { chromium, type Browser } from 'playwright';
import { RaporError, type RaporDocument } from '@raporgo/core';
import { PAGED_DONE_FLAG, buildHtml, type BuildHtmlOptions } from './html.js';

export type RenderPdfOptions = BuildHtmlOptions & {
  /** Reuse a browser across renders — the visual regression suite does this. */
  browser?: Browser;
  /** Milliseconds to allow Paged.js to lay the document out. */
  timeout?: number;
};

const DEFAULT_TIMEOUT = 60_000;

async function launch(): Promise<Browser> {
  try {
    return await chromium.launch();
  } catch (cause) {
    throw new RaporError(
      'Could not start Chromium. Run "pnpm exec playwright install chromium" once to download it.',
      'BROWSER_UNAVAILABLE',
      { cause: String(cause) },
    );
  }
}

/**
 * Renders a document to PDF through the same HTML the editor previews.
 *
 * Paged.js does the pagination, so Chromium is only asked to print pages that
 * are already laid out — `preferCSSPageSize` keeps it from paginating twice.
 */
export async function renderPdf(doc: RaporDocument, options: RenderPdfOptions): Promise<Buffer> {
  const html = await buildHtml(doc, options);
  const browser = options.browser ?? (await launch());
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: 'load', timeout: options.timeout ?? DEFAULT_TIMEOUT });
    await page.waitForFunction(`window.${PAGED_DONE_FLAG} === true`, undefined, {
      timeout: options.timeout ?? DEFAULT_TIMEOUT,
    });
    return await page.pdf({ printBackground: true, preferCSSPageSize: true });
  } finally {
    await page.close();
    if (!options.browser) await browser.close();
  }
}

/** Opens one browser for a batch of renders; callers must `close()` it. */
export async function openRenderer(): Promise<Browser> {
  return launch();
}
