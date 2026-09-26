import { existsSync, readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { escapeHtml, getTemplate, resolveColors, type Template } from '@raporgo/templates';
import { RaporError, resolveAsset, sectionNumbers, type RaporDocument } from '@raporgo/core';

const require = createRequire(import.meta.url);

/** Set on `window` once Paged.js has finished laying out the document. */
export const PAGED_DONE_FLAG = '__raporgoPaged';

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
};

export type BuildHtmlOptions = {
  /** Directory the document lives in; image paths resolve against it. */
  docDir: string;
  /**
   * `inline` embeds every image as a data URI, which makes the HTML portable
   * and lets it be loaded via `setContent` with no base URL. `url` emits
   * file:// URLs instead, which is cheaper when the page is served from disk.
   */
  assets?: 'inline' | 'url';
  /** Set to false to emit unpaginated HTML, e.g. for a quick content check. */
  paginate?: boolean;
};

let polyfillCache: string | undefined;

/**
 * pagedjs publishes no subpath exports, so the browser build has to be found
 * by walking up from its resolved entry point to the package root.
 */
function pagedPolyfillPath(): string {
  let dir = dirname(require.resolve('pagedjs'));
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = join(dir, 'dist', 'paged.polyfill.js');
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  throw new RaporError('Could not locate the Paged.js browser build', 'PAGEDJS_NOT_FOUND');
}

/** The Paged.js polyfill, inlined so the page needs no network and no server. */
function pagedPolyfill(): string {
  polyfillCache ??= readFileSync(pagedPolyfillPath(), 'utf8');
  return polyfillCache;
}

/**
 * Data URIs are cached by path and mtime.
 *
 * The editor rebuilds the preview on every pause in typing, and re-reading and
 * re-encoding every screenshot each time is by far the most expensive part of
 * a rebuild on a report that has any. The mtime in the key means an image
 * edited on disk still refreshes.
 */
const dataUriCache = new Map<string, string>();

async function inlineImage(absolutePath: string): Promise<string> {
  const mime = MIME_BY_EXT[extname(absolutePath).toLowerCase()];
  if (!mime) {
    throw new RaporError(`Unsupported image type: ${absolutePath}`, 'ASSET_UNSUPPORTED');
  }

  const info = await stat(absolutePath);
  const key = `${absolutePath}:${info.mtimeMs}:${info.size}`;
  const cached = dataUriCache.get(key);
  if (cached !== undefined) return cached;

  const bytes = await readFile(absolutePath);
  const uri = `data:${mime};base64,${bytes.toString('base64')}`;
  // One document's worth of images is the working set; drop the oldest beyond
  // that so a long editing session cannot grow without bound.
  if (dataUriCache.size >= 64) dataUriCache.delete(dataUriCache.keys().next().value!);
  dataUriCache.set(key, uri);
  return uri;
}

/**
 * Pre-resolves every image so `renderSegment` can stay synchronous.
 *
 * An image that cannot be read maps to null and renders as a placeholder
 * rather than throwing. A freshly added image segment has no file yet, and
 * that intermediate state must not take the editor's live preview down —
 * `validateDocument` is the gate that refuses to export it.
 */
async function buildAssetMap(
  doc: RaporDocument,
  options: BuildHtmlOptions,
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  for (const segment of doc.segments) {
    if (segment.type !== 'image' || map.has(segment.src)) continue;
    if (segment.src.trim() === '') {
      map.set(segment.src, null);
      continue;
    }
    try {
      const absolute = resolveAsset(options.docDir, segment.src);
      map.set(
        segment.src,
        options.assets === 'url' ? pathToFileURL(absolute).href : await inlineImage(absolute),
      );
    } catch {
      map.set(segment.src, null);
    }
  }
  return map;
}

function templateFor(doc: RaporDocument): Template {
  const template = getTemplate(doc.template);
  if (!template) {
    throw new RaporError(`Unknown template "${doc.template}"`, 'TEMPLATE_NOT_FOUND');
  }
  return template;
}

/**
 * Renders a document to a standalone HTML page.
 *
 * The same HTML is used for the PDF and for the editor preview — that is the
 * whole reason the pipeline has one renderer instead of two.
 */
export async function buildHtml(doc: RaporDocument, options: BuildHtmlOptions): Promise<string> {
  const template = templateFor(doc);
  const assetMap = await buildAssetMap(doc, options);

  const ctx = {
    doc,
    colors: resolveColors(doc.theme?.preset, doc.theme?.overrides),
    sectionNumbers: sectionNumbers(doc),
    assetUrl: (src: string) => assetMap.get(src) ?? null,
  };

  const body = doc.segments.map((segment) => template.renderSegment(segment, ctx)).join('\n');

  // The flag lets the PDF renderer and the editor preview wait for pagination
  // to settle instead of guessing with a timeout.
  const script =
    options.paginate === false
      ? ''
      : `<script>window.PagedConfig={auto:true,after:function(){window.${PAGED_DONE_FLAG}=true;}};</script>
<script>${pagedPolyfill()}</script>`;

  return `<!doctype html>
<html lang="${escapeHtml(doc.meta.language ?? 'tr')}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(doc.meta.title)}</title>
<style>
${template.stylesheet(ctx)}
</style>
</head>
<body>
${body}
${script}
</body>
</html>
`;
}
