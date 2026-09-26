import { chromium, type Browser } from 'playwright';
import type { RaporDocument } from '@raporgo/core';
import { PAGED_DONE_FLAG, buildHtml, type BuildHtmlOptions } from './html.js';

/** One segment's box on the page it landed on, in PDF points. */
export type LayoutBox = {
  page: number;
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MeasureOptions = BuildHtmlOptions & { browser?: Browser; timeout?: number };

const PX_TO_PT = 0.75;

/**
 * Measures where every segment ends up after pagination.
 *
 * This is what the fidelity test asserts against: comparing geometry catches
 * the drift a template inevitably accumulates, and unlike a pixel diff it says
 * *which* segment moved and by how much.
 */
export async function measureLayout(doc: RaporDocument, options: MeasureOptions): Promise<LayoutBox[]> {
  const html = await buildHtml(doc, options);
  const browser = options.browser ?? (await chromium.launch());
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: 'load', timeout: options.timeout ?? 60_000 });
    await page.waitForFunction(`window.${PAGED_DONE_FLAG} === true`, undefined, {
      timeout: options.timeout ?? 60_000,
    });

    const boxes = await page.evaluate((pxToPt) => {
      const result: LayoutBox[] = [];
      const pages = document.querySelectorAll('.pagedjs_page');

      pages.forEach((pageEl, pageIndex) => {
        const sheet = pageEl.querySelector('.pagedjs_sheet') ?? pageEl;
        const origin = sheet.getBoundingClientRect();

        pageEl.querySelectorAll('[data-segment-id]').forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return;
          result.push({
            page: pageIndex + 1,
            id: el.getAttribute('data-segment-id') ?? '',
            type: el.getAttribute('data-segment-type') ?? '',
            x: Math.round((rect.left - origin.left) * pxToPt * 100) / 100,
            y: Math.round((rect.top - origin.top) * pxToPt * 100) / 100,
            width: Math.round(rect.width * pxToPt * 100) / 100,
            height: Math.round(rect.height * pxToPt * 100) / 100,
          });
        });
      });

      return result;
    }, PX_TO_PT);

    return boxes;
  } finally {
    await page.close();
    if (!options.browser) await browser.close();
  }
}
