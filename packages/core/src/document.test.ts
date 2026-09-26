import { describe, expect, it } from 'vitest';
import {
  RaporError,
  generateId,
  getSegment,
  insertSegment,
  moveSegment,
  normalizeDocument,
  outline,
  parseDocument,
  plainText,
  removeSegment,
  sectionNumbers,
  slugify,
  updateSegment,
} from './document.js';
import type { RaporDocument } from './schema.js';

function doc(segments: unknown[]): RaporDocument {
  const parsed = parseDocument({
    meta: { title: 'Test' },
    segments,
  });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return parsed.doc;
}

describe('slugify', () => {
  it('transliterates Turkish characters', () => {
    expect(slugify('Uygulama Ne İşe Yarar?')).toBe('uygulama-ne-ise-yarar');
    expect(slugify('Çalışma süresi ölçülür')).toBe('calisma-suresi-olculur');
  });

  it('caps the number of words', () => {
    expect(slugify('bir iki uc dort bes alti')).toBe('bir-iki-uc-dort');
  });
});

describe('plainText', () => {
  it('strips inline markup', () => {
    expect(plainText('**kalin** ve *italik* ve `kod` ve [bag](https://x)')).toBe(
      'kalin ve italik ve kod ve bag',
    );
  });
});

describe('normalizeDocument', () => {
  it('generates readable ids from segment content', () => {
    const d = doc([{ type: 'section', title: 'Uygulama Ne İşe Yarar?' }]);
    expect(d.segments[0]!.id).toBe('section-uygulama-ne-ise-yarar');
  });

  it('de-duplicates colliding ids instead of dropping segments', () => {
    const d = doc([
      { type: 'paragraph', id: 'p', text: 'bir' },
      { type: 'paragraph', id: 'p', text: 'iki' },
    ]);
    expect(d.segments.map((s) => s.id)).toEqual(['p', 'p-2']);
    expect(d.segments).toHaveLength(2);
  });

  it('is idempotent', () => {
    const once = doc([{ type: 'paragraph', text: 'merhaba' }, { type: 'pageBreak' }]);
    expect(normalizeDocument(once)).toEqual(once);
  });
});

describe('generateId', () => {
  it('avoids ids already taken', () => {
    const segment = { type: 'paragraph', text: 'merhaba dunya' } as const;
    const taken = new Set(['paragraph-merhaba-dunya']);
    expect(generateId(segment, taken)).toBe('paragraph-merhaba-dunya-2');
  });
});

describe('parseDocument', () => {
  it('reports the path of every schema issue', () => {
    const result = parseDocument({ meta: {}, segments: [{ type: 'table' }] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const paths = result.issues.map((i) => i.path);
    expect(paths).toContain('meta.title');
    expect(paths).toContain('segments.0.columns');
  });

  it('applies defaults', () => {
    const d = doc([{ type: 'callout', text: 'dikkat' }]);
    expect(d.schemaVersion).toBe('1.0');
    expect(d.template).toBe('mavi-resmi');
    expect(d.meta.language).toBe('tr');
    expect(d.segments[0]).toMatchObject({ variant: 'info' });
  });
});

describe('segment operations', () => {
  const base = () =>
    doc([
      { type: 'cover', id: 'cover' },
      { type: 'section', id: 'b1', title: 'Birinci' },
      { type: 'paragraph', id: 'p1', text: 'metin' },
    ]);

  it('updates a segment by shallow merge', () => {
    const next = updateSegment(base(), 'p1', { text: 'yeni metin', align: 'center' });
    expect(getSegment(next, 'p1')).toMatchObject({ text: 'yeni metin', align: 'center' });
  });

  it('refuses to change a segment type in place', () => {
    expect(() => updateSegment(base(), 'p1', { type: 'code' })).toThrow(RaporError);
  });

  it('rejects a patch that breaks the schema', () => {
    expect(() => updateSegment(base(), 'p1', { text: 42 })).toThrow(RaporError);
  });

  it('inserts after a named segment and assigns an id', () => {
    const next = insertSegment(base(), { type: 'callout', text: 'not' }, { after: 'b1' });
    expect(next.segments.map((s) => s.id)).toEqual(['cover', 'b1', 'callout-not', 'p1']);
  });

  it('moves a segment without losing it', () => {
    const next = moveSegment(base(), 'p1', { before: 'b1' });
    expect(next.segments.map((s) => s.id)).toEqual(['cover', 'p1', 'b1']);
  });

  it('removes a segment', () => {
    expect(removeSegment(base(), 'b1').segments.map((s) => s.id)).toEqual(['cover', 'p1']);
  });

  it('names the known ids when a segment is missing', () => {
    try {
      getSegment(base(), 'yok');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(RaporError);
      expect((error as RaporError).code).toBe('SEGMENT_NOT_FOUND');
      expect((error as RaporError).details).toMatchObject({ known: ['cover', 'b1', 'p1'] });
    }
  });
});

describe('outline and section numbering', () => {
  const d = doc([
    { type: 'section', id: 'a', title: 'Birinci' },
    { type: 'paragraph', id: 'p', text: '**Uzun** bir paragraf metni burada yer alir ve kisaltilmasi gerekir cunku cok uzundur' },
    { type: 'section', id: 'b', title: 'Ikinci' },
    { type: 'section', id: 'c', title: 'Onuncu', number: 10 },
    { type: 'section', id: 'e', title: 'Sonraki' },
  ]);

  it('numbers sections sequentially and honours explicit numbers', () => {
    expect([...sectionNumbers(d)]).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 10],
      ['e', 11],
    ]);
  });

  it('summarises segments without markup and truncates long text', () => {
    const entry = outline(d)[1]!;
    expect(entry).toMatchObject({ index: 1, id: 'p', type: 'paragraph' });
    expect(entry.summary.startsWith('Uzun bir paragraf')).toBe(true);
    expect(entry.summary.length).toBeLessThanOrEqual(72);
    expect(entry.summary.endsWith('…')).toBe(true);
  });
});

describe('retired names', () => {
  it('leaves the template and a missing theme alone', () => {
    const d = normalizeDocument({ schemaVersion: '1.0', template: 'mavi-resmi', meta: { title: 'x', language: 'tr' }, segments: [] });
    expect(d.template).toBe('mavi-resmi');
    expect('theme' in d).toBe(false);
  });

  it('opens a document that still carries a retired textFile segment, without it', () => {
    const result = parseDocument({
      meta: { title: 'x' },
      segments: [{ type: 'paragraph', text: 'a' }, { type: 'textFile', src: 'text_Assets/not.md' }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.segments.map((segment) => segment.type)).toEqual(['paragraph']);
  });
});
