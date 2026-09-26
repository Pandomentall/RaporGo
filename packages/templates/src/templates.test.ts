import { describe, expect, it } from 'vitest';
import { parseDocumentOrThrow, sectionNumbers, segmentTypes } from '@raporgo/core';
import { templateCatalog } from './catalog.js';
import { getTemplate, templateNames } from './index.js';
import { labelsFor } from './base/labels.js';
import { resolveColors } from './tokens.js';
import type { RenderContext } from './types.js';

/**
 * Every template renders every segment type. The markup is shared, so what
 * this really checks is that each stylesheet builds, embeds its fonts and
 * names the page — and that the catalog and the registry agree.
 */

const everySegment = parseDocumentOrThrow({
  meta: { title: 'Tüm segmentler', subtitle: 'alt', eyebrow: 'ÜST', author: 'Yazar', date: '2026' },
  segments: [
    { type: 'cover' },
    { type: 'paragraph', text: 'Giriş **kalın** [renk]{danger}', lead: true },
    { type: 'section', title: 'Birinci' },
    { type: 'subheading', text: 'Ara' },
    { type: 'paragraph', text: 'Metin' },
    { type: 'list', items: ['a', 'b'] },
    { type: 'list', items: ['a', 'b'], ordered: true },
    { type: 'keyValueTable', headers: ['K', 'V'], rows: [['a', 'b']] },
    { type: 'table', columns: [{ label: 'A' }, { label: 'B', mono: true }], rows: [['1', '2']] },
    { type: 'steps', items: [{ title: 'Adım', desc: 'Açıklama' }] },
    { type: 'callout', variant: 'warning', title: 'Dikkat', text: 'Metin' },
    { type: 'chart', chart: 'column', title: 'Grafik', data: [{ label: 'x', value: 1 }] },
    { type: 'image', src: '', caption: 'Görsel' },
    { type: 'code', content: 'x => y' },
    { type: 'signature', parties: [{ name: 'A', title: 'Taraf' }, { name: 'B' }], date: true },
    { type: 'spacer', size: 'md' },
    { type: 'pageBreak' },
  ],
});

function contextFor(): RenderContext {
  return {
    doc: everySegment,
    colors: resolveColors(),
    sectionNumbers: sectionNumbers(everySegment),
    assetUrl: () => null,
  };
}

describe('template registry', () => {
  it('offers every ready catalog entry and nothing the catalog does not know', () => {
    const ready = templateCatalog.filter((info) => info.status === 'ready').map((info) => info.name);
    expect([...templateNames()].sort()).toEqual([...ready].sort());
  });

  it('covers every segment type in the fixture', () => {
    const used = new Set(everySegment.segments.map((segment) => segment.type));
    expect([...segmentTypes].filter((type) => !used.has(type))).toEqual([]);
  });
});

describe('document language', () => {
  const inLanguage = (language: string) => ({ ...everySegment, meta: { ...everySegment.meta, language } });

  it('prints the template words in the document language, falling back by primary tag and then to English', () => {
    expect(labelsFor(inLanguage('de')).page).toEqual(['Seite ', '']);
    expect(labelsFor(inLanguage('pt-BR')).clause[0]).toBe('CLÁUSULA ');
    expect(labelsFor(inLanguage('zh-CN')).page).toEqual(['第 ', ' 页']);
    expect(labelsFor(inLanguage('xx')).figure).toBe('Figure');
  });

  it('reaches the stylesheets', () => {
    const ctx = { ...contextFor(), doc: inLanguage('de') };
    expect(getTemplate('mavi-resmi')!.stylesheet(ctx)).toContain('"Seite " counter(page)');
    const zh = { ...contextFor(), doc: inLanguage('zh-CN') };
    expect(getTemplate('sozlesme')!.stylesheet(zh)).toContain('"第 " counter(page) " 页" " / " counter(pages)');
  });
});

describe.each(templateNames())('template %s', (name) => {
  const template = getTemplate(name)!;
  const ctx = contextFor();

  it('builds a stylesheet with embedded fonts and page rules', () => {
    const css = template.stylesheet(ctx);
    expect(css).toContain('@font-face');
    expect(css).toContain('@page');
    expect(css).toContain('--rg-primary:');
    // Every template styles the segments the shared markup emits.
    for (const cls of ['.rg-cover', '.rg-section', '.rg-paragraph', '.rg-table', '.rg-callout', '.rg-chart', '.rg-signature']) {
      expect(css, `${name} lacks ${cls}`).toContain(cls);
    }
  });

  it('renders every segment without throwing and keeps the editor hooks', () => {
    const html = everySegment.segments.map((segment) => template.renderSegment(segment, ctx)).join('');
    expect(html).toContain('data-segment-type="cover"');
    expect(html).toContain('data-edit="text"');
    expect(html).toContain('rg-signature__line');
    expect(html).toContain('rg-signatures');
  });
});
