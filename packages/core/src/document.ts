import { DocumentSchema, SegmentSchema, type RaporDocument, type Segment, type SegmentType } from './schema.js';

/** Thrown for every expected failure so the CLI can render one consistent error shape. */
export class RaporError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'RaporError';
  }
}

const TR_MAP: Record<string, string> = {
  ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i', ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u',
};

/** Turkish-aware slug used for generated segment ids, so ids stay readable. */
export function slugify(input: string, maxWords = 4): string {
  const ascii = [...input].map((ch) => TR_MAP[ch] ?? ch).join('');
  const words = ascii
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, maxWords);
  return words.join('-');
}

/** The text a segment is best identified by, used for ids and for `raporgo outline`. */
export function segmentLabel(segment: Segment): string {
  switch (segment.type) {
    case 'cover':
      return segment.title ?? 'cover';
    case 'section':
    case 'subheading':
      return segment.type === 'section' ? segment.title : segment.text;
    case 'paragraph':
      return segment.text;
    case 'callout':
      return segment.title ?? segment.text;
    case 'image':
      return segment.caption ?? segment.src;
    case 'chart':
      return segment.title ?? segment.caption ?? segment.chart;
    case 'steps':
      return segment.items[0]?.title ?? 'steps';
    case 'table':
      return segment.columns.map((c) => c.label).join(' ');
    case 'keyValueTable':
      return segment.rows[0]?.[0] ?? 'key-value';
    case 'list':
      return segment.items[0] ?? 'list';
    case 'code':
      return segment.language ?? 'code';
    case 'signature':
      return segment.parties.map((party) => party.name).join(', ') || 'signature';
    default:
      return segment.type;
  }
}

/** Strips inline markup so outlines and generated ids read cleanly. */
export function plainText(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\{[^}]*\}/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function uniqueId(base: string, taken: Set<string>): string {
  const seed = base || 'segment';
  if (!taken.has(seed)) return seed;
  for (let n = 2; ; n += 1) {
    const candidate = `${seed}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Generates an id that does not collide with anything already in the document. */
export function generateId(segment: Segment, taken: Set<string>): string {
  const slug = slugify(plainText(segmentLabel(segment)));
  const base = slug ? `${segment.type}-${slug}` : segment.type;
  return uniqueId(base, taken);
}

/**
 * Fills in missing ids and de-duplicates colliding ones. Every write path runs
 * this, so a document on disk always has stable addressable segments even
 * when an LLM produced it without thinking about ids.
 */
export function normalizeDocument(input: RaporDocument): RaporDocument {
  // The guide block is written by `writeDocument`, never part of the document itself.
  const { _llm: _guide, ...doc } = input;
  const taken = new Set<string>();
  const segments = doc.segments.map((segment) => {
    if (segment.id && !taken.has(segment.id)) {
      taken.add(segment.id);
      return segment;
    }
    const id = segment.id ? uniqueId(segment.id, taken) : generateId(segment, taken);
    taken.add(id);
    return { ...segment, id };
  });
  return { ...doc, segments };
}

export type ParseIssue = { path: string; message: string };

export type ParseResult =
  | { ok: true; doc: RaporDocument }
  | { ok: false; issues: ParseIssue[] };

/** Parses unknown JSON into a normalized document, collecting every schema issue. */
/**
 * Segment types that existed once and were retired. A document that still
 * carries one opens without it instead of failing to open at all.
 */
const RETIRED_SEGMENT_TYPES = new Set(['textFile']);

function dropRetiredSegments(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { segments?: unknown }).segments)) return raw;
  const doc = raw as { segments: unknown[] };
  const segments = doc.segments.filter(
    (segment) => !(segment && typeof segment === 'object' && RETIRED_SEGMENT_TYPES.has(String((segment as { type?: unknown }).type))),
  );
  return segments.length === doc.segments.length ? raw : { ...doc, segments };
}

export function parseDocument(raw: unknown): ParseResult {
  const result = DocumentSchema.safeParse(dropRetiredSegments(raw));
  if (!result.success) {
    return {
      ok: false,
      issues: result.error.issues.map((issue) => ({
        path: issue.path.length ? issue.path.join('.') : '(root)',
        message: issue.message,
      })),
    };
  }
  return { ok: true, doc: normalizeDocument(result.data) };
}

/** Like `parseDocument` but throws — for call sites that already handle RaporError. */
export function parseDocumentOrThrow(raw: unknown): RaporDocument {
  const result = parseDocument(raw);
  if (!result.ok) {
    throw new RaporError('Document does not match the RaporGo schema', 'SCHEMA_INVALID', result.issues);
  }
  return result.doc;
}

export function parseSegment(raw: unknown): Segment {
  const result = SegmentSchema.safeParse(raw);
  if (!result.success) {
    throw new RaporError('Segment does not match the RaporGo schema', 'SEGMENT_INVALID', {
      issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return result.data;
}

// --- Segment operations -----------------------------------------------------

export function segmentIndex(doc: RaporDocument, id: string): number {
  const index = doc.segments.findIndex((s) => s.id === id);
  if (index === -1) {
    throw new RaporError(`No segment with id "${id}"`, 'SEGMENT_NOT_FOUND', {
      known: doc.segments.map((s) => s.id),
    });
  }
  return index;
}

export function getSegment(doc: RaporDocument, id: string): Segment {
  return doc.segments[segmentIndex(doc, id)]!;
}

/** Shallow-merges `patch` into the segment; `type` cannot be changed this way. */
export function updateSegment(doc: RaporDocument, id: string, patch: Record<string, unknown>): RaporDocument {
  const index = segmentIndex(doc, id);
  const current = doc.segments[index]!;
  if ('type' in patch && patch['type'] !== current.type) {
    throw new RaporError(
      `Cannot change segment type from "${current.type}" to "${String(patch['type'])}". Remove and insert instead.`,
      'SEGMENT_TYPE_CHANGE',
    );
  }
  const merged = parseSegment({ ...current, ...patch, id, type: current.type });
  const segments = [...doc.segments];
  segments[index] = merged;
  return { ...doc, segments };
}

/** Replaces a segment wholesale, keeping its id. */
export function replaceSegment(doc: RaporDocument, id: string, raw: unknown): RaporDocument {
  const index = segmentIndex(doc, id);
  const next = parseSegment({ ...(raw as object), id });
  const segments = [...doc.segments];
  segments[index] = next;
  return { ...doc, segments };
}

export type InsertPosition = { after?: string; before?: string; index?: number };

export function insertSegment(doc: RaporDocument, raw: unknown, position: InsertPosition = {}): RaporDocument {
  const segment = parseSegment(raw);
  const taken = new Set(doc.segments.map((s) => s.id!).filter(Boolean));
  const withId: Segment = segment.id && !taken.has(segment.id)
    ? segment
    : { ...segment, id: generateId(segment, taken) };

  let at = doc.segments.length;
  if (position.after !== undefined) at = segmentIndex(doc, position.after) + 1;
  else if (position.before !== undefined) at = segmentIndex(doc, position.before);
  else if (position.index !== undefined) at = Math.max(0, Math.min(position.index, doc.segments.length));

  const segments = [...doc.segments];
  segments.splice(at, 0, withId);
  return { ...doc, segments };
}

export function removeSegment(doc: RaporDocument, id: string): RaporDocument {
  const index = segmentIndex(doc, id);
  const segments = [...doc.segments];
  segments.splice(index, 1);
  return { ...doc, segments };
}

export function moveSegment(doc: RaporDocument, id: string, position: InsertPosition): RaporDocument {
  const segment = getSegment(doc, id);
  const without = removeSegment(doc, id);
  return insertSegment(without, segment, position);
}

// --- Outline ----------------------------------------------------------------

export type OutlineEntry = {
  index: number;
  id: string;
  type: SegmentType;
  summary: string;
  /** Section number as it will be rendered, for `section` segments only. */
  number?: number;
};

/**
 * A compact map of the document. An LLM reads this first and then `get`s only
 * the segments it intends to touch, instead of loading a whole long report.
 */
export function outline(doc: RaporDocument, summaryLength = 72): OutlineEntry[] {
  let autoNumber = 0;
  return doc.segments.map((segment, index) => {
    // A bare cover inherits its text from meta, so label it with the document
    // title rather than the useless word "cover".
    const label =
      segment.type === 'cover' && !segment.title ? doc.meta.title : segmentLabel(segment);
    const summary = plainText(label).replace(/\s+/g, ' ');
    const entry: OutlineEntry = {
      index,
      id: segment.id!,
      type: segment.type,
      summary: summary.length > summaryLength ? `${summary.slice(0, summaryLength - 1)}…` : summary,
    };
    if (segment.type === 'section') {
      autoNumber = segment.number ?? autoNumber + 1;
      entry.number = autoNumber;
    }
    return entry;
  });
}

/** Resolves the badge number for every section, honouring explicit overrides. */
export function sectionNumbers(doc: RaporDocument): Map<string, number> {
  const numbers = new Map<string, number>();
  let running = 0;
  for (const segment of doc.segments) {
    if (segment.type !== 'section') continue;
    running = segment.number ?? running + 1;
    numbers.set(segment.id!, running);
  }
  return numbers;
}

/**
 * Sets a value at a dotted path inside a segment, e.g. `text`,
 * `items.2.title`, `rows.0.1`.
 *
 * The template stamps these paths onto the rendered HTML, so the editor can
 * commit an in-place edit without knowing which segment type it is looking at.
 * The result is re-parsed, so an edit that breaks the schema is rejected here
 * rather than at render time.
 */
export function setSegmentPath(doc: RaporDocument, id: string, path: string, value: unknown): RaporDocument {
  const index = segmentIndex(doc, id);
  const keys = path.split('.').filter(Boolean);
  if (keys.length === 0) {
    throw new RaporError('An edit path cannot be empty', 'PATH_INVALID');
  }

  const assign = (node: unknown, depth: number): unknown => {
    const key = keys[depth]!;
    const last = depth === keys.length - 1;

    if (Array.isArray(node)) {
      const at = Number(key);
      if (!Number.isInteger(at) || at < 0 || at >= node.length) {
        throw new RaporError(`Index ${key} is out of range in "${path}"`, 'PATH_INVALID');
      }
      const copy = [...node];
      copy[at] = last ? value : assign(copy[at], depth + 1);
      return copy;
    }

    if (node && typeof node === 'object') {
      const copy = { ...(node as Record<string, unknown>) };
      copy[key] = last ? value : assign(copy[key], depth + 1);
      return copy;
    }

    throw new RaporError(`Cannot follow "${path}" inside segment "${id}"`, 'PATH_INVALID');
  };

  const segments = [...doc.segments];
  segments[index] = parseSegment(assign(doc.segments[index], 0));
  return { ...doc, segments };
}
