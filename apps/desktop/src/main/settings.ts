import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { app } from 'electron';
import { languageFromLocale, withDefaults, type Settings } from '../shared/settings.js';

/**
 * Settings live in one JSON file in the user-data folder, re-read on each
 * request like the recent list: tiny, and no cache to fall out of step.
 */

function storePath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

export async function readSettings(): Promise<Settings> {
  try {
    return withDefaults(JSON.parse(await readFile(storePath(), 'utf8')));
  } catch {
    // First launch: speak the system's language if RaporGo can.
    return withDefaults({ language: languageFromLocale(app.getLocale()) });
  }
}

export async function writeSettings(next: Settings): Promise<Settings> {
  const settings = withDefaults(next);
  const target = storePath();
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(settings, null, 2));
  return settings;
}
