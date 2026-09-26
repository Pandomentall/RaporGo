import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { app } from 'electron';

/**
 * The recently opened report files, kept in the app's user-data folder.
 *
 * The list is re-read on every request rather than cached: it is tiny, and
 * a second window or a crash mid-write then cannot leave two copies arguing.
 */

const LIMIT = 12;

export type RecentRecord = {
  /** Absolute path of the report `.json`. */
  path: string;
  /** When the editor last opened it, ms since epoch. */
  openedAt: number;
};

function storePath(): string {
  return join(app.getPath('userData'), 'recent.json');
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/**
 * Older lists hold bare strings, and for a while those were project folders.
 * A folder entry means the `rapor.json` inside it.
 */
async function read(): Promise<RecentRecord[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(storePath(), 'utf8'));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const records: RecentRecord[] = [];
  for (const item of parsed) {
    const record =
      typeof item === 'string'
        ? { path: item, openedAt: 0 }
        : item && typeof item === 'object' && typeof (item as RecentRecord).path === 'string'
          ? { path: (item as RecentRecord).path, openedAt: Number((item as RecentRecord).openedAt) || 0 }
          : null;
    if (!record) continue;
    if (await isDirectory(record.path)) record.path = join(record.path, 'rapor.json');
    if (!records.some((existing) => existing.path === record.path)) records.push(record);
  }
  return records;
}

async function write(records: RecentRecord[]): Promise<void> {
  const target = storePath();
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(records, null, 2));
}

/** The list as the home screen should show it: newest first, files that are gone dropped. */
export async function listRecent(): Promise<RecentRecord[]> {
  const stored = await read();
  const checks = await Promise.all(stored.map((record) => isFile(record.path)));
  const alive = stored.filter((_, index) => checks[index]);
  if (alive.length !== stored.length) await write(alive);
  return alive;
}

export async function rememberRecent(path: string): Promise<void> {
  const stored = await read();
  await write([{ path, openedAt: Date.now() }, ...stored.filter((record) => record.path !== path)].slice(0, LIMIT));
}

export async function forgetRecent(path: string): Promise<void> {
  const stored = await read();
  await write(stored.filter((record) => record.path !== path));
}
