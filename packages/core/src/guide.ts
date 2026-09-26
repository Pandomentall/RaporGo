import { IMAGE_FOLDER } from './io.js';
import { toJsonSchema } from './schema.js';

/**
 * The `_llm` block written at the top of every report file.
 *
 * A user hands the bare `.json` to an LLM tool (Claude Code, Codex, Gemini
 * CLI) with nothing else — no docs, no RaporGo CLI. These lines are what lets
 * the model edit the report correctly on the first read. They are terse on
 * purpose: they sit in the file, and every line costs the reader.
 *
 * The segment lines are derived from the published JSON Schema, so adding a
 * field or a segment type updates the guide with no one remembering to.
 */

export type GuideTemplate = { name: string; summary: string };

export type GuideOptions = {
  templates: GuideTemplate[];
  palettes: string[];
  /** BCP 47 tags the templates have words for ("Page", "Figure"…). */
  languages: string[];
};

type JsonSchema = {
  type?: string;
  const?: unknown;
  enum?: unknown[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  default?: unknown;
  additionalProperties?: unknown;
};

/** Fields every segment has; the guide states them once instead of on every line. */
const SHARED_FIELDS = new Set(['id', 'note', 'type']);

/** Enums longer than this are too long to inline. */
const ENUM_INLINE_LIMIT = 12;

function isOptional(parent: JsonSchema, key: string, field: JsonSchema): boolean {
  return !(parent.required ?? []).includes(key) || field.default !== undefined;
}

/** `label, width?, align?=left|center|right` — the fields of an object, one level deep. */
function fields(schema: JsonSchema, skip: Set<string> = new Set()): string {
  return Object.entries(schema.properties ?? {})
    .filter(([key]) => !skip.has(key))
    .map(([key, field]) => `${key}${isOptional(schema, key, field) ? '?' : ''}${shape(field)}`)
    .join(', ');
}

/** How a field's value looks, appended to its name: nothing for plain strings. */
function shape(field: JsonSchema): string {
  const variants = field.anyOf ?? field.oneOf;
  if (variants) {
    const described = variants.map(shape).filter(Boolean);
    return described[0] ?? '';
  }
  if (field.enum && field.enum.length <= ENUM_INLINE_LIMIT) return `=${field.enum.join('|')}`;
  if (field.type === 'array' && !field.items) return '[]';
  if (field.type === 'array' && field.items) {
    const items = field.items;
    if (items.type === 'object') return `[{${fields(items)}}]`;
    if (items.type === 'array') return '[[...]]';
    if (items.type === 'number') return '[number]';
    return '[]';
  }
  if (field.type === 'object' && field.additionalProperties) return '{name: value}';
  if (field.type === 'object') return `{${fields(field)}}`;
  if (field.type === 'number' || field.type === 'integer') return ':number';
  if (field.type === 'boolean') return ':bool';
  return '';
}

function segmentLines(schema: JsonSchema): string[] {
  const union = schema.properties?.['segments']?.items;
  const variants = union?.oneOf ?? union?.anyOf ?? [];
  return variants.map((variant) => {
    const type = String(variant.properties?.['type']?.const);
    const rest = fields(variant, SHARED_FIELDS);
    return `  ${type}: ${rest || '(no fields)'}`;
  });
}

export function llmGuide(options: GuideOptions): string[] {
  const schema = toJsonSchema() as JsonSchema;
  const meta = schema.properties?.['meta'];
  const theme = schema.properties?.['theme'];

  return [
    'RaporGo report: the RaporGo app turns this JSON into a PDF. Edit it as plain JSON.',
    'If the app has this file open it reloads on save and flags any error, so keep the JSON valid.',
    'This _llm block is rewritten on every save; read it, do not edit it.',
    `Top level: template, meta{${meta ? fields(meta) : ''}}, theme{${theme ? fields(theme) : ''}}, segments[].`,
    'Segments print top to bottom. Keep existing ids (the editor tracks them); new segments may omit id. note? is never printed.',
    'Text fields take inline markup: **bold** *italic* `code` [label](url) [text]{color}, color = primary|accent|danger|success|info|note|muted or #hex.',
    `Images: src is a path relative to this file, e.g. ${IMAGE_FOLDER}/chart.png. No data URIs.`,
    `Templates: ${options.templates.map((t) => `${t.name} (${t.summary})`).join(', ')}.`,
    `theme.preset: ${options.palettes.join(', ')}.`,
    `meta.language: ${options.languages.join(', ')} (hyphenation and template words like "Page 3").`,
    'Segment types (? = optional, a|b = allowed values):',
    ...segmentLines(schema),
  ];
}
