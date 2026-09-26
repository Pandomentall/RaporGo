import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  type InsertPosition,
  RaporError,
  getSegment,
  insertSegment,
  moveSegment,
  outline,
  parseDocumentOrThrow,
  readDocument,
  removeSegment,
  replaceSegment,
  segmentTypes,
  toJsonSchema,
  updateSegment,
  validateDocument,
  writeDocument as writeRaw,
  type RaporDocument,
} from '@raporgo/core';
import { reportGuide, templateNames } from '@raporgo/templates';
import { buildHtml, renderPdf } from '@raporgo/render';
import { emit, table, type OutputMode } from './output.js';

/** Every write carries the `_llm` guide, so the file explains itself to the next reader. */
function writeDocument(path: string, doc: RaporDocument): Promise<void> {
  return writeRaw(path, doc, { guide: reportGuide() });
}

export type Flags = Record<string, string | boolean | undefined>;

function requireArg(value: string | undefined, name: string): string {
  if (!value) throw new RaporError(`Missing required argument: ${name}`, 'ARG_MISSING');
  return value;
}

function parseJsonFlag(flags: Flags, name = 'data'): unknown {
  const raw = flags[name];
  if (typeof raw !== 'string') {
    throw new RaporError(`--${name} must be given a JSON value`, 'ARG_MISSING');
  }
  try {
    return JSON.parse(raw);
  } catch (cause) {
    throw new RaporError(`--${name} is not valid JSON: ${String(cause)}`, 'JSON_INVALID');
  }
}

/** `--after`, `--before` and `--index` all describe where a segment goes. */
function positionFrom(flags: Flags): InsertPosition {
  if (typeof flags['after'] === 'string') return { after: flags['after'] };
  if (typeof flags['before'] === 'string') return { before: flags['before'] };
  if (typeof flags['index'] === 'string') return { index: Number(flags['index']) };
  return {};
}

export async function cmdNew(args: string[], flags: Flags, mode: OutputMode): Promise<void> {
  const path = requireArg(args[0], '<file>');
  const title = typeof flags['title'] === 'string' ? flags['title'] : 'Yeni Rapor';

  const doc = parseDocumentOrThrow({
    template: typeof flags['template'] === 'string' ? flags['template'] : undefined,
    meta: {
      title,
      ...(typeof flags['subtitle'] === 'string' ? { subtitle: flags['subtitle'] } : {}),
      ...(typeof flags['eyebrow'] === 'string' ? { eyebrow: flags['eyebrow'] } : {}),
      ...(typeof flags['date'] === 'string' ? { date: flags['date'] } : {}),
    },
    segments: [{ id: 'cover', type: 'cover' }],
  });

  const absolute = resolve(process.cwd(), path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeDocument(absolute, doc);

  emit(mode, { path: absolute, template: doc.template }, () => `Created ${absolute}`);
}

export async function cmdOutline(args: string[], _flags: Flags, mode: OutputMode): Promise<void> {
  const { doc } = await readDocument(requireArg(args[0], '<file>'));
  const entries = outline(doc);
  emit(mode, { title: doc.meta.title, template: doc.template, segments: entries }, () =>
    table([
      ['#', 'ID', 'TYPE', 'SUMMARY'],
      ...entries.map((entry) => [String(entry.index), entry.id, entry.type, entry.summary]),
    ]),
  );
}

export async function cmdGet(args: string[], _flags: Flags, mode: OutputMode): Promise<void> {
  const { doc } = await readDocument(requireArg(args[0], '<file>'));
  const segment = getSegment(doc, requireArg(args[1], '<segmentId>'));
  emit(mode, segment, () => JSON.stringify(segment, null, 2));
}

export async function cmdSet(args: string[], flags: Flags, mode: OutputMode): Promise<void> {
  const { doc, path } = await readDocument(requireArg(args[0], '<file>'));
  const id = requireArg(args[1], '<segmentId>');

  const next =
    flags['replace'] === true
      ? replaceSegment(doc, id, parseJsonFlag(flags))
      : updateSegment(doc, id, parseJsonFlag(flags) as Record<string, unknown>);

  await writeDocument(path, next);
  emit(mode, getSegment(next, id), () => `Updated ${id}`);
}

export async function cmdInsert(args: string[], flags: Flags, mode: OutputMode): Promise<void> {
  const { doc, path } = await readDocument(requireArg(args[0], '<file>'));
  const next = insertSegment(doc, parseJsonFlag(flags), positionFrom(flags));
  await writeDocument(path, next);

  const added = next.segments.find((segment) => !doc.segments.some((old) => old.id === segment.id))!;
  emit(mode, added, () => `Inserted ${added.id}`);
}

export async function cmdMove(args: string[], flags: Flags, mode: OutputMode): Promise<void> {
  const { doc, path } = await readDocument(requireArg(args[0], '<file>'));
  const id = requireArg(args[1], '<segmentId>');
  const next = moveSegment(doc, id, positionFrom(flags));
  await writeDocument(path, next);
  emit(mode, { id, order: next.segments.map((segment) => segment.id) }, () => `Moved ${id}`);
}

export async function cmdRemove(args: string[], _flags: Flags, mode: OutputMode): Promise<void> {
  const { doc, path } = await readDocument(requireArg(args[0], '<file>'));
  const id = requireArg(args[1], '<segmentId>');
  await writeDocument(path, removeSegment(doc, id));
  emit(mode, { removed: id }, () => `Removed ${id}`);
}

/**
 * Edits `meta`. Segment commands cannot reach the title, the date or the
 * running header, so without this an LLM can build a whole report and still be
 * unable to correct the words printed on every page.
 */
export async function cmdMeta(args: string[], flags: Flags, mode: OutputMode): Promise<void> {
  const { doc, path } = await readDocument(requireArg(args[0], '<file>'));

  if (flags['data'] === undefined) {
    emit(mode, doc.meta, () => JSON.stringify(doc.meta, null, 2));
    return;
  }

  const patch = parseJsonFlag(flags) as Record<string, unknown>;
  const next = parseDocumentOrThrow({ ...doc, meta: { ...doc.meta, ...patch } });
  await writeDocument(path, next);
  emit(mode, next.meta, () => JSON.stringify(next.meta, null, 2));
}

/** Switches the template and/or the palette preset. */
export async function cmdTheme(args: string[], flags: Flags, mode: OutputMode): Promise<void> {
  const { doc, path } = await readDocument(requireArg(args[0], '<file>'));
  const template = typeof flags['template'] === 'string' ? flags['template'] : doc.template;
  const preset = typeof flags['preset'] === 'string' ? flags['preset'] : doc.theme?.preset;

  if (template === doc.template && preset === doc.theme?.preset) {
    emit(mode, { template, theme: doc.theme }, () => `${template} · ${preset ?? 'lacivert'}`);
    return;
  }

  const next = parseDocumentOrThrow({
    ...doc,
    template,
    theme: { ...doc.theme, ...(preset === undefined ? {} : { preset }) },
  });
  await writeDocument(path, next);
  emit(mode, { template: next.template, theme: next.theme }, () => `${next.template} · ${next.theme?.preset}`);
}

export async function cmdValidate(args: string[], _flags: Flags, mode: OutputMode): Promise<void> {
  const { doc, dir } = await readDocument(requireArg(args[0], '<file>'));
  const report = await validateDocument(doc, dir);

  emit(mode, report, () => {
    const lines = [...report.errors, ...report.warnings].map(
      (item) => `${item.level === 'error' ? 'error' : 'warn '} ${item.code}${item.segmentId ? ` [${item.segmentId}]` : ''}: ${item.message}`,
    );
    return lines.length ? lines.join('\n') : 'OK';
  });

  if (!report.ok) process.exitCode = 1;
}

export async function cmdRender(args: string[], flags: Flags, mode: OutputMode): Promise<void> {
  const { doc, dir } = await readDocument(requireArg(args[0], '<file>'));

  const report = await validateDocument(doc, dir);
  if (!report.ok) {
    throw new RaporError('Document has errors; fix them before rendering', 'VALIDATION_FAILED', report.errors);
  }

  const htmlOnly = typeof flags['html'] === 'string';
  const out = resolve(
    process.cwd(),
    htmlOnly ? (flags['html'] as string) : typeof flags['out'] === 'string' ? flags['out'] : 'rapor.pdf',
  );
  await mkdir(dirname(out), { recursive: true });

  if (htmlOnly) {
    await writeFile(out, await buildHtml(doc, { docDir: dir }), 'utf8');
  } else {
    await writeFile(out, await renderPdf(doc, { docDir: dir }));
  }

  emit(mode, { out, segments: doc.segments.length }, () => `Wrote ${out}`);
}

export function cmdSchema(_args: string[], _flags: Flags, mode: OutputMode): void {
  const jsonSchema = toJsonSchema();
  emit(mode, jsonSchema, () => JSON.stringify(jsonSchema, null, 2));
}

export function cmdTemplates(_args: string[], _flags: Flags, mode: OutputMode): void {
  const names = templateNames();
  emit(mode, { templates: names }, () => names.join('\n'));
}

export function cmdSegments(_args: string[], _flags: Flags, mode: OutputMode): void {
  emit(mode, { types: segmentTypes }, () => segmentTypes.join('\n'));
}
