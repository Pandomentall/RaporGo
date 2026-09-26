import { RaporError } from '@raporgo/core';

/**
 * Every command speaks two dialects: a readable one for people and `--json`
 * for machines. LLMs get the same structured errors the editor does, which is
 * what lets them correct themselves without a human in the loop.
 */

export type OutputMode = { json: boolean };

export function emit(mode: OutputMode, data: unknown, human: () => string): void {
  process.stdout.write(mode.json ? `${JSON.stringify(data, null, 2)}\n` : `${human()}\n`);
}

export function fail(mode: OutputMode, error: unknown): never {
  if (error instanceof RaporError) {
    if (mode.json) {
      process.stderr.write(
        `${JSON.stringify({ error: { code: error.code, message: error.message, details: error.details } }, null, 2)}\n`,
      );
    } else {
      process.stderr.write(`${error.code}: ${error.message}\n`);
      if (error.details !== undefined) {
        process.stderr.write(`${formatDetails(error.details)}\n`);
      }
    }
    process.exit(1);
  }

  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(mode.json ? `${JSON.stringify({ error: { code: 'UNEXPECTED', message } })}\n` : `${message}\n`);
  process.exit(1);
}

function formatDetails(details: unknown): string {
  if (Array.isArray(details)) {
    return details
      .map((item) =>
        item && typeof item === 'object' && 'path' in item && 'message' in item
          ? `  - ${String((item as { path: unknown }).path)}: ${String((item as { message: unknown }).message)}`
          : `  - ${JSON.stringify(item)}`,
      )
      .join('\n');
  }
  return `  ${JSON.stringify(details)}`;
}

/** Renders a fixed-width table without pulling in a dependency. */
export function table(rows: string[][]): string {
  if (rows.length === 0) return '';
  const widths = rows[0]!.map((_, column) => Math.max(...rows.map((row) => (row[column] ?? '').length)));
  return rows
    .map((row) => row.map((cell, index) => (index === row.length - 1 ? cell : cell.padEnd(widths[index]!))).join('  '))
    .join('\n');
}
