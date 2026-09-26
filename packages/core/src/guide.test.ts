import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDocumentOrThrow } from './document.js';
import { llmGuide } from './guide.js';
import { readDocument, writeDocument } from './io.js';
import { segmentTypes } from './schema.js';

const options = { templates: [{ name: 'mavi-resmi', summary: 'corporate report' }], palettes: ['lacivert', 'kiremit'], languages: ['tr', 'en'] };

describe('llmGuide', () => {
  const guide = llmGuide(options);

  it('names every segment type, one line each', () => {
    for (const type of segmentTypes) {
      expect(guide.some((line) => line.startsWith(`  ${type}: `)), type).toBe(true);
    }
  });

  it('stays short enough to sit at the top of a file', () => {
    expect(guide.length).toBeLessThanOrEqual(40);
    expect(guide.every((line) => line.length <= 400)).toBe(true);
  });

  it('shows required and optional fields and inline enums', () => {
    expect(guide).toContain('  paragraph: text, align?=left|center|right, lead?:bool');
    expect(guide.find((line) => line.startsWith('  table: '))).toContain('columns[{label, width?');
    expect(guide.join('\n')).toContain('mavi-resmi (corporate report)');
    expect(guide.join('\n')).toContain('lacivert, kiremit');
  });
});

describe('the _llm block on disk', () => {
  it('is written first, and ignored when the file is read back', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'raporgo-guide-'));
    const path = join(dir, 'r.json');
    const doc = parseDocumentOrThrow({ meta: { title: 'x' }, segments: [{ type: 'paragraph', text: 'a' }] });
    await writeDocument(path, doc, { guide: llmGuide(options) });

    const text = await readFile(path, 'utf8');
    expect(text.startsWith('{\n  "_llm": [')).toBe(true);

    const loaded = await readDocument(path);
    expect('_llm' in loaded.doc).toBe(false);
    expect(loaded.doc.segments).toEqual(doc.segments);
  });
});
