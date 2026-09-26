import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { serializeInline } from '@raporgo/templates/inline';
import { useSettings, useT } from '../i18n/index.js';
import { createFormatter, type Formatter } from './formatting.js';
import type { RaporDocument } from '../../shared/api.js';

const REBUILD_DELAY = 300;

/** Set on the preview page's window once Paged.js has finished laying out. */
const PAGED_FLAG = '__raporgoPaged';
/** Give up waiting for pagination after this long and show the page anyway. */
const PAGINATION_TIMEOUT = 15_000;

/** Dispatched on `window` by the menu bar: zoom the preview in, out, or to fit. */
export const ZOOM_EVENT = 'raporgo:zoom';
export type ZoomRequest = 'in' | 'out' | 'fit';

/** Either a fixed scale or "fit the page to the panel width". */
type Zoom = number | 'fit';
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.1;
/** Breathing room either side of a fitted page. */
const FIT_MARGIN = 48;
const ZOOM_KEY = 'raporgo.zoom';

function readZoom(): Zoom {
  try {
    const stored = localStorage.getItem(ZOOM_KEY);
    if (stored === 'fit' || stored === null) return 'fit';
    const value = Number(stored);
    return Number.isFinite(value) ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)) : 'fit';
  } catch {
    return 'fit';
  }
}

function storeZoom(zoom: Zoom): void {
  try {
    localStorage.setItem(ZOOM_KEY, String(zoom));
  } catch {
    // The zoom simply will not survive a restart.
  }
}

/**
 * Scales the paginated document. CSS `zoom` rather than `transform`: the
 * scroll extents follow it, so the frame's own scrollbars stay right. Paged.js
 * has already laid the pages out by the time this runs, and zoom on the root
 * does not reflow them.
 */
function applyZoom(view: Window, container: HTMLElement | null, zoom: Zoom): number {
  const root = view.document.documentElement;
  let scale = zoom === 'fit' ? 1 : zoom;
  if (zoom === 'fit' && container) {
    root.style.zoom = '1';
    const page = view.document.querySelector<HTMLElement>('.pagedjs_page');
    if (page && page.offsetWidth > 0) {
      scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, (container.clientWidth - FIT_MARGIN) / page.offsetWidth));
    }
  }
  root.style.zoom = String(scale);
  return scale;
}

export type EditCommit = {
  segmentId: string;
  /** Path into the segment, e.g. `text`, `items.2.title`, `rows.0.1`. */
  path: string;
  kind: 'rich' | 'plain';
  value: string;
};

type PreviewProps = {
  doc: RaporDocument;
  dir: string;
  selectedId: string | null;
  /**
   * Hands over the formatter for the frame currently on screen, so the
   * inspector can format whatever text is selected in it. Null between frames.
   */
  onFormatter: (formatter: Formatter | null) => void;
  /** `null` when the click landed on the page itself rather than a segment. */
  onSelect: (id: string | null) => void;
  onCommit: (edit: EditCommit) => void;
  /**
   * Reports which page each segment landed on once Paged.js has settled. The
   * segment list uses it to draw real page boundaries — this is the only place
   * that knows them, because pagination happens here.
   */
  onPages: (pages: Map<string, number>) => void;
  /** Bumped when a project file changed on disk; forces a rebuild without touching the document. */
  revision: number;
  /** Fires when the user clicks text that cannot be edited in place: split across pages, or read from a file. */
  onLockedEdit: () => void;
};

/**
 * Styles injected into the preview document: editing affordances, plus a
 * gutter so pages read as sheets rather than one white field. None of this
 * reaches the PDF — it lives in the editor, not in the template.
 */
function editorCss(): string {
  // The page ground follows the editor theme; it lives in the app's
  // stylesheet as a token, and the frame is a separate document.
  const ground = getComputedStyle(document.documentElement).getPropertyValue('--preview-ground').trim() || '#cfd7e3';
  return `
body { background: ${ground}; padding: 28px 0 40px; }
.pagedjs_page { background: #fff; margin: 0 auto 24px; box-shadow: 0 1px 2px rgba(27,42,74,.08), 0 12px 32px rgba(27,42,74,.14); border-radius: 3px; }
[data-segment-id] { position: relative; }
[data-segment-id]:hover { outline: 1px dashed rgba(46,80,144,.45); outline-offset: 2px; }
[data-segment-id].rg-selected { outline: 2px solid #2e5090; outline-offset: 2px; }
[data-edit]:focus { outline: 2px solid #f0a500; outline-offset: 1px; background: rgba(240,165,0,.08); }
[data-edit] { cursor: text; }
`;
}

const EDITOR_STYLE_ID = 'raporgo-editor-css';

type Slot = 0 | 1;

/**
 * The paginated preview — the same HTML that becomes the PDF.
 *
 * Rendering is double-buffered across two iframes. Replacing `srcDoc` reloads
 * a document from scratch: the page blanks, ~260 KB of data-URI font CSS is
 * re-parsed and Paged.js re-paginates, which read as a flash on every
 * keystroke. So the new build is loaded into the *hidden* frame and only
 * swapped in once it has finished paginating — the visible page never goes
 * empty, and the reading position carries across.
 *
 * Elements the template marked with `data-edit` are made directly editable,
 * except when Paged.js has split their segment across a page boundary: the
 * content then exists as two fragments and reading either one back would lose
 * half the text. Those fall back to the inspector panel.
 */
export function Preview({
  doc,
  dir,
  selectedId,
  onFormatter,
  onSelect,
  onCommit,
  onPages,
  revision,
  onLockedEdit,
}: PreviewProps): JSX.Element {
  const t = useT();
  const { theme, settings } = useSettings();
  const frames = [useRef<HTMLIFrameElement>(null), useRef<HTMLIFrameElement>(null)] as const;
  const [slots, setSlots] = useState<[string, string]>(['', '']);
  const [active, setActive] = useState<Slot>(0);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<Zoom>(readZoom);
  /** What "fit" currently resolves to, so +/- can step from it. */
  const [effectiveZoom, setEffectiveZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // A theme switch recolours the ground around the pages without a rebuild.
  useEffect(() => {
    for (const frame of frames) {
      const style = frame.current?.contentDocument?.getElementById(EDITOR_STYLE_ID);
      if (style) style.textContent = editorCss();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- frames are stable refs
  }, [theme]);
  const zoomRef = useRef<Zoom>(zoom);
  zoomRef.current = zoom;

  const editingRef = useRef(false);
  /** One formatter per frame; the inspector only ever sees the visible one's. */
  const formatters = useRef<[Formatter | null, Formatter | null]>([null, null]);
  /** The HTML currently on screen, so an identical rebuild can be skipped. */
  const shownRef = useRef('');
  const activeRef = useRef<Slot>(0);
  activeRef.current = active;

  // Rebuild on document change, but never while the user is typing into the
  // preview — that would blow away the caret mid-word.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (editingRef.current) return;
      setBuilding(true);
      window.raporgo
        .buildPreview(doc, dir)
        .then((next) => {
          setBuildError(null);
          // A rebuild that renders identically needs no swap at all.
          if (next === shownRef.current) return;
          const target = (1 - activeRef.current) as Slot;
          setSlots((current) => {
            const copy: [string, string] = [...current];
            copy[target] = next;
            return copy;
          });
        })
        // Keep the last good page on screen and say what went wrong, rather
        // than blanking the preview on an unhandled rejection.
        .catch((error: Error) => setBuildError(error.message))
        .finally(() => setBuilding(false));
    }, REBUILD_DELAY);
    return () => clearTimeout(timer);
  }, [doc, dir, revision]);

  const attach = useCallback(
    (slot: Slot): void => {
      const view = frames[slot].current?.contentWindow;
      const document_ = frames[slot].current?.contentDocument;
      if (!view || !document_) return;

      const style = document_.createElement('style');
      style.id = EDITOR_STYLE_ID;
      style.textContent = editorCss();
      document_.head.append(style);
      formatters.current[slot] = createFormatter(document_);

      // One walk over the paginated DOM answers two questions: how many
      // fragments each segment was split into, and which page it starts on.
      const occurrences = new Map<string, number>();
      const pages = new Map<string, number>();
      document_.querySelectorAll('.pagedjs_page').forEach((pageEl, pageIndex) => {
        pageEl.querySelectorAll('[data-segment-id]').forEach((el) => {
          const id = el.getAttribute('data-segment-id')!;
          occurrences.set(id, (occurrences.get(id) ?? 0) + 1);
          if (!pages.has(id)) pages.set(id, pageIndex + 1);
        });
      });
      onPages(pages);

      document_.addEventListener('click', (event) => {
        if ((event.target as HTMLElement).closest('.rg-fmt')) return;
        const target = (event.target as HTMLElement).closest('[data-segment-id]');
        onSelect(target ? target.getAttribute('data-segment-id')! : null);
      });

      // Keys pressed while the page has focus never reach the app window, so
      // Escape is answered here too; editable text keeps it for cancelling.
      document_.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !(event.target as HTMLElement).isContentEditable) onSelect(null);
      });

      document_.querySelectorAll<HTMLElement>('[data-edit]').forEach((el) => {
        const segmentId = el.closest('[data-segment-id]')?.getAttribute('data-segment-id');
        if (!segmentId) return;
        if ((occurrences.get(segmentId) ?? 0) > 1) {
          el.addEventListener('click', () => onLockedEdit());
          return;
        }

        el.contentEditable = 'true';
        el.spellcheck = false;

        el.addEventListener('focus', () => {
          editingRef.current = true;
        });

        el.addEventListener('blur', () => {
          editingRef.current = false;
          const kind = (el.getAttribute('data-edit-kind') as 'rich' | 'plain') ?? 'rich';
          const value = kind === 'plain' ? (el.innerText ?? '') : serializeInline(el.innerHTML);
          onCommit({ segmentId, path: el.getAttribute('data-edit')!, kind, value });
        });

        // Enter commits rather than inserting a stray <div>; Escape cancels.
        el.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' && !event.shiftKey && el.getAttribute('data-edit-kind') !== 'plain') {
            event.preventDefault();
            el.blur();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            editingRef.current = false;
            el.blur();
          }
        });
      });
    },
    [frames, onCommit, onPages, onSelect, onLockedEdit],
  );

  /**
   * A frame finished loading. It is the hidden one, so nothing is shown until
   * its pagination settles — then the reading position is carried over and the
   * two frames trade places in a single paint.
   */
  const handleLoad = useCallback(
    (slot: Slot): void => {
      const view = frames[slot].current?.contentWindow;
      if (!view || !slots[slot]) return;

      const deadline = Date.now() + PAGINATION_TIMEOUT;
      const swapWhenReady = (): void => {
        const paginated = (view as unknown as Record<string, unknown>)[PAGED_FLAG] === true;
        if (!paginated && Date.now() < deadline) {
          view.requestAnimationFrame(swapWhenReady);
          return;
        }

        attach(slot);
        setEffectiveZoom(applyZoom(view, containerRef.current, zoomRef.current));
        // Carry the reading position over before the swap, so the page does
        // not appear to jump when the frames trade places.
        const outgoing = frames[activeRef.current].current?.contentWindow;
        view.scrollTo(0, outgoing?.scrollY ?? 0);

        shownRef.current = slots[slot];
        onFormatter(formatters.current[slot]);
        if (slot !== activeRef.current) setActive(slot);
      };
      swapWhenReady();
    },
    [attach, frames, slots, onFormatter],
  );

  // Re-apply on a zoom change, and keep a fitted page fitted as the panel
  // is dragged wider or narrower.
  useEffect(() => {
    storeZoom(zoom);
    const view = frames[active].current?.contentWindow;
    if (view) setEffectiveZoom(applyZoom(view, containerRef.current, zoom));
    if (zoom !== 'fit' || !containerRef.current) return;
    const observer = new ResizeObserver(() => {
      const current = frames[activeRef.current].current?.contentWindow;
      if (current) setEffectiveZoom(applyZoom(current, containerRef.current, 'fit'));
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [frames, active, zoom]);

  const stepZoom = (direction: 1 | -1): void => {
    const base = zoom === 'fit' ? effectiveZoom : zoom;
    const next = Math.round((base + direction * ZOOM_STEP) * 10) / 10;
    setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next)));
  };
  const stepZoomRef = useRef(stepZoom);
  stepZoomRef.current = stepZoom;
  useEffect(() => {
    const onZoom = (event: Event): void => {
      const request = (event as CustomEvent<ZoomRequest>).detail;
      if (request === 'fit') setZoom('fit');
      else stepZoomRef.current(request === 'in' ? 1 : -1);
    };
    window.addEventListener(ZOOM_EVENT, onZoom);
    return () => window.removeEventListener(ZOOM_EVENT, onZoom);
  }, []);

  // Highlight and reveal whatever the segment list has selected.
  useEffect(() => {
    const document_ = frames[active].current?.contentDocument;
    if (document_) applySelection(document_, selectedId);
  }, [frames, active, selectedId, slots]);

  return (
    <div className="preview" ref={containerRef}>
      <div className="preview__zoom">
        <button type="button" title={t('preview.zoomOut')} disabled={effectiveZoom <= ZOOM_MIN} onClick={() => stepZoom(-1)}>
          −
        </button>
        <span className="preview__zoom-value">
          {new Intl.NumberFormat(settings.language, { style: 'percent' }).format(effectiveZoom)}
        </span>
        <button type="button" title={t('preview.zoomIn')} disabled={effectiveZoom >= ZOOM_MAX} onClick={() => stepZoom(1)}>
          +
        </button>
        <button
          type="button"
          className={zoom === 'fit' ? 'preview__zoom-fit preview__zoom-fit--on' : 'preview__zoom-fit'}
          title={t('preview.fitTitle')}
          onClick={() => setZoom('fit')}
        >
          {t('preview.fit')}
        </button>
      </div>
      {building && <div className="preview__status">{t('preview.rebuilding')}</div>}
      {buildError && <div className="preview__error">{t('preview.failed', { message: buildError })}</div>}
      {([0, 1] as const).map((slot) => (
        <iframe
          key={slot}
          ref={frames[slot]}
          className={`preview__frame${slot === active ? ' preview__frame--active' : ''}`}
          title={t('preview.title')}
          srcDoc={slots[slot]}
          onLoad={() => handleLoad(slot)}
          sandbox="allow-same-origin allow-scripts"
        />
      ))}
    </div>
  );
}

function applySelection(document_: Document, selectedId: string | null): void {
  document_.querySelectorAll('.rg-selected').forEach((el) => el.classList.remove('rg-selected'));
  if (!selectedId) return;
  const target = document_.querySelector(`[data-segment-id="${CSS.escape(selectedId)}"]`);
  target?.classList.add('rg-selected');
  target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
