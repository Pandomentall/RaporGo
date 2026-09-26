import { akademik } from './akademik/index.js';
import { bulten } from './bulten/index.js';
import { maviResmi } from './mavi-resmi/index.js';
import { sadeTeknik } from './sade-teknik/index.js';
import { sozlesme } from './sozlesme/index.js';
import { sunumRaporu } from './sunum-raporu/index.js';
import type { Template } from './types.js';

export * from './tokens.js';
export * from './catalog.js';
export * from './guide.js';
export * from './chart/index.js';
export * from './inline.js';
export * from './fonts.js';
export type { Template, RenderContext } from './types.js';

const registry = new Map<string, Template>(
  [maviResmi, sozlesme, sadeTeknik, sunumRaporu, akademik, bulten].map((template) => [template.name, template]),
);

export const defaultTemplateName = maviResmi.name;

export function getTemplate(name: string): Template | undefined {
  return registry.get(name);
}

export function templateNames(): string[] {
  return [...registry.keys()];
}

export { maviResmi, sozlesme, sadeTeknik, sunumRaporu, akademik, bulten };
