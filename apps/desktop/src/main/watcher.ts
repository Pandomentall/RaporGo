import { readFile } from 'node:fs/promises';
import { watch, type FSWatcher } from 'chokidar';

/**
 * Watches a document file for edits made outside the editor.
 *
 * The editor writes to the same file it watches, so every save would otherwise
 * bounce straight back as an "external change". The fix is to remember the
 * exact bytes we last put on disk and ignore any change that matches them.
 */

const lastKnownContent = new Map<string, string>();

/** Call after the editor itself writes, so the resulting event is ignored. */
export async function noteOwnWrite(path: string): Promise<void> {
  try {
    lastKnownContent.set(path, await readFile(path, 'utf8'));
  } catch {
    lastKnownContent.delete(path);
  }
}

/**
 * True when the file on disk still holds what the editor last saw.
 *
 * Autosave writes the whole document, so an editor holding a stale copy
 * silently destroys whatever landed on disk in the meantime — which is exactly
 * what happens when an LLM edits the report from a terminal. Every save checks
 * this first and refuses rather than clobbering.
 *
 * A path the watcher has no record of is treated as unchanged: the guard only
 * exists to catch a *known* divergence, and blocking saves on an untracked
 * file would break the ordinary case of saving a document nobody is watching.
 */
export async function isUnchangedOnDisk(path: string): Promise<boolean> {
  const known = lastKnownContent.get(path);
  if (known === undefined) return true;
  try {
    return (await readFile(path, 'utf8')) === known;
  } catch {
    // Gone or unreadable: let the write proceed and surface any real error.
    return true;
  }
}

/**
 * Watches the project's asset folders and reports any change, debounced. The
 * renderer answers by rebuilding the preview — nothing in the document
 * changed, so no history is touched.
 */
export function watchFolders(dirs: string[], onChange: () => void): () => void {
  let timer: NodeJS.Timeout | undefined;
  const watcher: FSWatcher = watch(dirs, { ignoreInitial: true, depth: 1 });
  const handle = (): void => {
    clearTimeout(timer);
    timer = setTimeout(onChange, 200);
  };
  watcher.on('add', handle).on('change', handle).on('unlink', handle);
  return () => {
    clearTimeout(timer);
    void watcher.close();
  };
}

export function watchDocument(path: string, onExternalChange: () => void | Promise<void>): () => void {
  void noteOwnWrite(path);

  let timer: NodeJS.Timeout | undefined;
  const watcher: FSWatcher = watch(path, { ignoreInitial: true });

  const handle = (): void => {
    // Editors and LLMs often write in bursts; settle before reacting.
    clearTimeout(timer);
    timer = setTimeout(() => {
      void (async () => {
        let content: string;
        try {
          content = await readFile(path, 'utf8');
        } catch {
          return; // File is mid-write or gone; the next event will cover it.
        }
        if (content === lastKnownContent.get(path)) return;
        lastKnownContent.set(path, content);
        await onExternalChange();
      })();
    }, 150);
  };

  watcher.on('change', handle);
  watcher.on('add', handle);

  return () => {
    clearTimeout(timer);
    void watcher.close();
    lastKnownContent.delete(path);
  };
}
