import { llmGuide } from '@raporgo/core';
import { documentLanguages } from './base/labels.js';
import { templateCatalog } from './catalog.js';
import { palettes } from './tokens.js';

/**
 * The `_llm` block for a report file. Lives here rather than in core because
 * only this package knows the templates and palettes; kept out of
 * `catalog.ts` so the editor's renderer can import the catalog without
 * pulling in core's file-system code.
 */
export function reportGuide(): string[] {
  return llmGuide({
    templates: templateCatalog.filter((info) => info.status === 'ready'),
    palettes: Object.keys(palettes),
    languages: documentLanguages.map((language) => language.code),
  });
}
