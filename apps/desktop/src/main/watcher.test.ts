import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isUnchangedOnDisk, noteOwnWrite } from './watcher.js';

/**
 * The guard that stands between the editor's autosave and a document someone
 * else just edited.
 *
 * This exists because the editor lost real work: it held a document from
 * before an external edit and autosaved the whole thing back, silently
 * replacing the newer version on disk.
 */

let dir: string;
let path: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'raporgo-watch-'));
  path = join(dir, 'rapor.json');
  await writeFile(path, '{"v":1}');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('isUnchangedOnDisk', () => {
  it('is true right after the editor recorded its own write', async () => {
    await noteOwnWrite(path);
    expect(await isUnchangedOnDisk(path)).toBe(true);
  });

  it('turns false once something else writes the file', async () => {
    await noteOwnWrite(path);
    await writeFile(path, '{"v":2}');
    expect(await isUnchangedOnDisk(path)).toBe(false);
  });

  it('is true again after the editor takes note of the newer content', async () => {
    await noteOwnWrite(path);
    await writeFile(path, '{"v":2}');
    await noteOwnWrite(path);
    expect(await isUnchangedOnDisk(path)).toBe(true);
  });

  it('does not block a file it has no record of', async () => {
    // Saving a document nobody is watching must still work.
    expect(await isUnchangedOnDisk(join(dir, 'baska.json'))).toBe(true);
  });

  it('leaves the newer content on disk — the guard never writes', async () => {
    await noteOwnWrite(path);
    await writeFile(path, '{"v":2}');
    await isUnchangedOnDisk(path);
    expect(await readFile(path, 'utf8')).toBe('{"v":2}');
  });
});
