/**
 * Path helpers for the renderer, which has no `node:path`. Everything here is
 * for display only — the main process owns every path that touches disk.
 */

function parts(path: string): string[] {
  return path.replace(/\\/g, '/').split('/').filter(Boolean);
}

/** Keeps the tail of a long path, which is the part that identifies it. */
export function shortPath(path: string, keep = 2): string {
  return parts(path).slice(-keep).join('/');
}

/** `C:/x/y/rapor.json` → `rapor`. */
export function fileStem(path: string): string {
  const last = parts(path).at(-1) ?? path;
  return last.replace(/\.[^.]+$/, '');
}

/** `C:/x/y/rapor.json` → `C:/x/y`. */
export function parentDir(path: string): string {
  return parts(path).slice(0, -1).join('/');
}
