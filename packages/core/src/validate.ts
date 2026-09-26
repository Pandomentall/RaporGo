import { stat } from 'node:fs/promises';
import { relative } from 'node:path';
import { IMAGE_FOLDER, resolveAsset } from './io.js';
import type { RaporDocument } from './schema.js';

export type Diagnostic = {
  level: 'error' | 'warning';
  code: string;
  /** Segment id when the problem is local to one segment. */
  segmentId?: string;
  message: string;
};

export type ValidationReport = {
  ok: boolean;
  errors: Diagnostic[];
  warnings: Diagnostic[];
};

/**
 * Checks one `image.src`.
 *
 * An empty path is its own diagnostic rather than a missing-file one: it is
 * what a freshly added image segment looks like before a file is chosen, and
 * "" resolves to the document directory, which very much exists — so without
 * the explicit check an unfinished image would validate clean and then render
 * as garbage.
 */
async function checkImage(src: string, id: string, docDir: string): Promise<Diagnostic[]> {
  if (src.trim() === '') {
    return [
      {
        level: 'error',
        code: 'ASSET_EMPTY',
        segmentId: id,
        message: `Image "${id}" has no file yet; pick one or remove the segment`,
      },
    ];
  }

  if (/^data:/i.test(src)) {
    return [
      {
        level: 'error',
        code: 'ASSET_DATA_URI',
        segmentId: id,
        message: `Image "${id}" uses a data URI; save it under ${IMAGE_FOLDER}/ and reference the path instead`,
      },
    ];
  }

  const where = relative(process.cwd(), docDir) || '.';
  try {
    const info = await stat(resolveAsset(docDir, src));
    if (info.isFile()) return [];
    return [
      {
        level: 'error',
        code: 'ASSET_NOT_A_FILE',
        segmentId: id,
        message: `Image path is a directory, not a file: ${src} (resolved against ${where})`,
      },
    ];
  } catch {
    return [
      {
        level: 'error',
        code: 'ASSET_MISSING',
        segmentId: id,
        message: `Image file not found: ${src} (resolved against ${where})`,
      },
    ];
  }
}

/**
 * A CSS length or percentage, or `auto`.
 *
 * A bare number is the mistake worth catching: `width: "100"` is not valid CSS,
 * so the browser drops the declaration silently and the image renders at some
 * other size that happens to look plausible.
 */
const CSS_LENGTH = /^(?:auto|\d+(?:\.\d+)?(?:%|px|pt|mm|cm|in|em|rem|vw|vh))$/;

/**
 * Checks the things a JSON schema cannot: that referenced images exist, that
 * table rows match their columns, that ids are unique. Runs after schema
 * parsing, so `doc` is already structurally valid.
 */
export async function validateDocument(doc: RaporDocument, docDir: string): Promise<ValidationReport> {
  const diagnostics: Diagnostic[] = [];
  const seen = new Set<string>();

  for (const segment of doc.segments) {
    const id = segment.id!;

    if (seen.has(id)) {
      diagnostics.push({
        level: 'error',
        code: 'DUPLICATE_ID',
        segmentId: id,
        message: `Segment id "${id}" is used more than once`,
      });
    }
    seen.add(id);

    if (segment.type === 'table') {
      segment.columns.forEach((column, columnIndex) => {
        if (column.width !== undefined && !CSS_LENGTH.test(column.width.trim())) {
          diagnostics.push({
            level: 'warning',
            code: 'CSS_WIDTH_INVALID',
            segmentId: id,
            message: `Column ${columnIndex} width "${column.width}" is not a CSS length; it is being ignored.`,
          });
        }
      });

      const expected = segment.columns.length;
      segment.rows.forEach((row, rowIndex) => {
        if (row.length !== expected) {
          diagnostics.push({
            level: 'error',
            code: 'TABLE_ROW_ARITY',
            segmentId: id,
            message: `Row ${rowIndex} has ${row.length} cells but the table declares ${expected} columns`,
          });
        }
      });
    }

    if (segment.type === 'image') {
      diagnostics.push(...(await checkImage(segment.src, id, docDir)));
      if (segment.width !== undefined && !CSS_LENGTH.test(segment.width.trim())) {
        diagnostics.push({
          level: 'warning',
          code: 'CSS_WIDTH_INVALID',
          segmentId: id,
          message: `width "${segment.width}" is not a CSS length; did you mean "${segment.width}%"? It is being ignored.`,
        });
      }
    }
  }

  const coverCount = doc.segments.filter((s) => s.type === 'cover').length;
  if (coverCount > 1) {
    diagnostics.push({
      level: 'warning',
      code: 'MULTIPLE_COVERS',
      message: `Document has ${coverCount} cover segments; only the first usually makes sense`,
    });
  }
  if (doc.segments.length === 0) {
    diagnostics.push({ level: 'warning', code: 'EMPTY_DOCUMENT', message: 'Document has no segments' });
  }

  const errors = diagnostics.filter((d) => d.level === 'error');
  const warnings = diagnostics.filter((d) => d.level === 'warning');
  return { ok: errors.length === 0, errors, warnings };
}
