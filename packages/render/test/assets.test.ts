import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseDocumentOrThrow, validateDocument, type RaporDocument } from '@raporgo/core';
import { buildHtml } from '../src/html.js';

/**
 * A freshly added image segment has no file yet. That intermediate state used
 * to throw out of `buildHtml` and take the editor's whole live preview with
 * it, so these tests pin the division of labour: rendering is best-effort and
 * shows a placeholder, validation is what refuses to let it be exported.
 */

let dir: string;

function docWith(src: string): RaporDocument {
  return parseDocumentOrThrow({
    meta: { title: 'Test' },
    segments: [{ id: 'gorsel', type: 'image', src }],
  });
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'raporgo-assets-'));
  // A one-pixel PNG, so there is something real to resolve against.
  await writeFile(
    join(dir, 'var.png'),
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    ),
  );
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('buildHtml with an unresolvable image', () => {
  it('renders a placeholder instead of throwing when no file is chosen', async () => {
    const html = await buildHtml(docWith(''), { docDir: dir, paginate: false });
    expect(html).toContain('<div class="rg-figure__missing">Görsel seçilmedi</div>');
    expect(html).not.toContain('<img');
  });

  it('names the missing file in the placeholder', async () => {
    const html = await buildHtml(docWith('assets/yok.png'), { docDir: dir, paginate: false });
    expect(html).toContain('Görsel bulunamadı: assets/yok.png');
  });

  it('still embeds an image that does resolve', async () => {
    const html = await buildHtml(docWith('var.png'), { docDir: dir, paginate: false });
    expect(html).toContain('<img src="data:image/png;base64,');
    // The class name also lives in the stylesheet, so look for the markup.
    expect(html).not.toContain('<div class="rg-figure__missing">');
  });
});

describe('validateDocument is the gate rendering is not', () => {
  it('rejects an image with no file, which resolves to the document directory', async () => {
    const report = await validateDocument(docWith(''), dir);
    expect(report.ok).toBe(false);
    expect(report.errors[0]).toMatchObject({ code: 'ASSET_EMPTY', segmentId: 'gorsel' });
  });

  it('rejects a path that points at a directory rather than a file', async () => {
    const report = await validateDocument(docWith('.'), dir);
    expect(report.ok).toBe(false);
    expect(report.errors[0]).toMatchObject({ code: 'ASSET_NOT_A_FILE' });
  });

  it('rejects a missing file', async () => {
    const report = await validateDocument(docWith('assets/yok.png'), dir);
    expect(report.errors[0]).toMatchObject({ code: 'ASSET_MISSING' });
  });

  it('rejects a data URI', async () => {
    const report = await validateDocument(docWith('data:image/png;base64,AAAA'), dir);
    expect(report.errors[0]).toMatchObject({ code: 'ASSET_DATA_URI' });
  });

  it('accepts a real file', async () => {
    const report = await validateDocument(docWith('var.png'), dir);
    expect(report.ok).toBe(true);
  });

  it('warns about a width the browser will silently drop', async () => {
    const doc = parseDocumentOrThrow({
      meta: { title: 'Test' },
      // "100" is not CSS: the declaration is dropped and the image renders at
      // some other size that happens to look plausible.
      segments: [{ id: 'gorsel', type: 'image', src: 'var.png', width: '100' }],
    });
    const report = await validateDocument(doc, dir);
    expect(report.ok).toBe(true); // A warning, not an error — it still renders.
    expect(report.warnings[0]).toMatchObject({ code: 'CSS_WIDTH_INVALID', segmentId: 'gorsel' });
  });

  it('accepts the CSS widths that do work', async () => {
    for (const width of ['100%', '420pt', '12.5rem', 'auto']) {
      const doc = parseDocumentOrThrow({
        meta: { title: 'Test' },
        segments: [{ id: 'gorsel', type: 'image', src: 'var.png', width }],
      });
      const report = await validateDocument(doc, dir);
      expect(report.warnings, width).toEqual([]);
    }
  });
});
