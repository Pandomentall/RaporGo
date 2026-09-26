import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { RaporError, normalizeDocument, parseDocument } from './document.js';
import { SCHEMA_VERSION, type RaporDocument } from './schema.js';

/**
 * What sits around a report on disk. A project is the folder holding these;
 * the editor opens and remembers folders, never the JSON file by itself.
 */
/**
 * Images a report uses sit in this folder beside its JSON file, and are
 * referenced relative to it (`image_Assets/logo.png`).
 */
export const IMAGE_FOLDER = 'image_Assets';

export type LoadedDocument = {
  doc: RaporDocument;
  /** Absolute path of the document file. */
  path: string;
  /** Directory the document lives in; all asset paths resolve against it. */
  dir: string;
};

export async function readDocument(path: string): Promise<LoadedDocument> {
  const absolute = isAbsolute(path) ? path : resolve(process.cwd(), path);

  let text: string;
  try {
    text = await readFile(absolute, 'utf8');
  } catch (cause) {
    throw new RaporError(`Cannot read "${absolute}"`, 'FILE_NOT_READABLE', { cause: String(cause) });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (cause) {
    throw new RaporError(`"${absolute}" is not valid JSON: ${String(cause)}`, 'JSON_INVALID');
  }

  const result = parseDocument(raw);
  if (!result.ok) {
    throw new RaporError(`"${absolute}" does not match the RaporGo schema`, 'SCHEMA_INVALID', result.issues);
  }

  return { doc: result.doc, path: absolute, dir: dirname(absolute) };
}

export type WriteOptions = {
  /**
   * Lines written as `_llm` at the top of the file, for an LLM that gets the
   * bare file and nothing else. `llmGuide` builds them; the templates package
   * supplies the template list (`reportGuide`).
   */
  guide?: string[];
};

/**
 * Writes the document with stable key order and 2-space indentation, so that
 * edits made by the editor and by an LLM produce comparable diffs.
 */
export async function writeDocument(path: string, doc: RaporDocument, options: WriteOptions = {}): Promise<void> {
  const absolute = isAbsolute(path) ? path : resolve(process.cwd(), path);
  const normalized = normalizeDocument(doc);
  const ordered = {
    ...(options.guide ? { _llm: options.guide } : {}),
    schemaVersion: normalized.schemaVersion ?? SCHEMA_VERSION,
    template: normalized.template,
    meta: normalized.meta,
    ...(normalized.theme ? { theme: normalized.theme } : {}),
    segments: normalized.segments,
  };
  await writeFile(absolute, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8');
}

/** Resolves an `image.src` against the document directory. */
export function resolveAsset(docDir: string, src: string): string {
  if (/^data:/i.test(src)) {
    throw new RaporError(
      `Data URIs are not allowed in image.src — save the file under ${IMAGE_FOLDER}/ and reference it by path`,
      'ASSET_DATA_URI',
    );
  }
  return isAbsolute(src) ? src : resolve(docDir, src);
}
