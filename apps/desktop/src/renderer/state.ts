import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OpenedDocument, RaporDocument, Segment } from '../shared/api.js';
import type { SegmentType } from '@raporgo/core/schema';

const AUTOSAVE_DELAY = 400;
/** Snapshots kept for undo. Documents are small; a hundred is plenty. */
const HISTORY_LIMIT = 100;
/** Edits with the same key inside this window fold into one undo step. */
const COALESCE_WINDOW = 800;

export type EditorState = {
  opened: OpenedDocument | null;
  selectedId: string | null;
  saving: boolean;
  /** Set briefly when the file changed underneath us, so the UI can say so. */
  externalUpdate: number | null;
  error: string | null;
  canUndo: boolean;
  canRedo: boolean;
  /** Bumped when a file under the project changed; the preview rebuilds, the document does not. */
  revision: number;
};

/** Sensible starting content for each segment the "add" menu offers. */
export const segmentTemplates: Record<SegmentType, () => Omit<Segment, 'id'>> = {
  cover: () => ({ type: 'cover' }),
  section: () => ({ type: 'section', title: 'Yeni bölüm' }),
  subheading: () => ({ type: 'subheading', text: 'Ara başlık' }),
  paragraph: () => ({ type: 'paragraph', text: 'Metin girin.' }),
  list: () => ({ type: 'list', items: ['Birinci madde'] }),
  keyValueTable: () => ({ type: 'keyValueTable', headers: ['Başlık', 'Değer'], rows: [['Anahtar', 'Değer']] }),
  table: () => ({
    type: 'table',
    columns: [{ label: 'Sütun 1' }, { label: 'Sütun 2' }],
    rows: [['', '']],
  }),
  steps: () => ({ type: 'steps', items: [{ title: 'Adım', desc: 'Açıklama' }] }),
  callout: () => ({ type: 'callout', variant: 'info', text: 'Dikkat çekilecek not.' }),
  chart: () => ({
    type: 'chart',
    chart: 'bar',
    scale: 'linear',
    title: 'Grafik başlığı',
    unit: '%',
    max: 100,
    data: [
      { label: 'Birinci', value: 72 },
      { label: 'İkinci', value: 45 },
    ],
  }),
  image: () => ({ type: 'image', src: '', caption: '' }),
  code: () => ({ type: 'code', content: '' }),
  signature: () => ({ type: 'signature', parties: [{ name: 'Taraf', title: '' }, { name: 'Taraf', title: '' }], date: true }),
  pageBreak: () => ({ type: 'pageBreak' }),
  spacer: () => ({ type: 'spacer', size: 'md' }),
};

/**
 * The stripe colour down the left edge of each row in the segment list, so a
 * long document is scannable by shape alone.
 *
 * Every value comes from the template's own palette (packages/templates
 * tokens) — the list and the page it describes stay one visual language.
 */
export const segmentColors: Record<SegmentType, string> = {
  cover: '#1b2a4a',
  section: '#1b2a4a',
  subheading: '#7b5ea7',
  paragraph: '#2e5090',
  list: '#4a7cc7',
  keyValueTable: '#1b2a4a',
  table: '#1b2a4a',
  steps: '#4a7cc7',
  callout: '#e67e22',
  chart: '#2e5090',
  image: '#1e8449',
  code: '#6b7c93',
  signature: '#1b2a4a',
  pageBreak: '#c3cbd8',
  spacer: '#c3cbd8',
};

function nextId(doc: RaporDocument, type: SegmentType): string {
  const taken = new Set(doc.segments.map((segment) => segment.id));
  for (let n = 1; ; n += 1) {
    const candidate = n === 1 ? type : `${type}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** What one edit produces: the next document and, optionally, a new selection. */
type Mutation = { doc: RaporDocument; selectedId?: string | null };

function insertAfter(doc: RaporDocument, segment: Segment, afterId: string | null): RaporDocument {
  const at = afterId ? doc.segments.findIndex((s) => s.id === afterId) + 1 : doc.segments.length;
  const segments = [...doc.segments];
  segments.splice(at, 0, segment);
  return { ...doc, segments };
}

/** `error` value for a save refused because the file changed on disk; the app translates it. */
export const STALE_SAVE = 'stale-save';

export function useEditor() {
  const [state, setState] = useState<EditorState>({
    opened: null,
    selectedId: null,
    saving: false,
    externalUpdate: null,
    error: null,
    canUndo: false,
    canRedo: false,
    revision: 0,
  });

  // Guards the autosave effect so applying an external change does not write
  // the same bytes straight back to disk.
  const skipNextSave = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** The write the autosave timer is holding back, until it fires. */
  const pendingSave = useRef<{ path: string; doc: RaporDocument } | null>(null);

  /**
   * Writes a held-back autosave now. Leaving a report (home, or opening
   * another) must not drop the last half-second of edits with the timer.
   */
  const flushSave = useCallback(async (): Promise<void> => {
    const pending = pendingSave.current;
    if (!pending) return;
    clearTimeout(saveTimer.current);
    pendingSave.current = null;
    await window.raporgo.save(pending.path, pending.doc).catch(() => undefined);
  }, []);

  // --- History --------------------------------------------------------------

  /**
   * Undo is a stack of whole documents. The current document is mirrored in a
   * ref so an edit can read it synchronously — two edits in the same tick then
   * chain instead of both starting from the rendered state.
   */
  const docRef = useRef<RaporDocument | null>(null);
  const past = useRef<RaporDocument[]>([]);
  const future = useRef<RaporDocument[]>([]);
  const lastEdit = useRef<{ key: string; at: number } | null>(null);

  const resetHistory = (doc: RaporDocument | null): void => {
    docRef.current = doc;
    past.current = [];
    future.current = [];
    lastEdit.current = null;
  };

  /**
   * Applies an edit. `coalesceKey` names what is being edited (one field of
   * one segment); a run of edits with the same key inside the window becomes a
   * single undo step, so typing a sentence undoes as a sentence.
   */
  const mutate = useCallback((edit: (doc: RaporDocument) => Mutation, coalesceKey?: string) => {
    const previous = docRef.current;
    if (!previous) return;
    const result = edit(previous);
    if (result.doc === previous && result.selectedId === undefined) return;

    if (result.doc !== previous) {
      const now = Date.now();
      const folds =
        coalesceKey !== undefined &&
        lastEdit.current?.key === coalesceKey &&
        now - lastEdit.current.at < COALESCE_WINDOW;
      if (!folds) {
        past.current.push(previous);
        if (past.current.length > HISTORY_LIMIT) past.current.shift();
      }
      future.current = [];
      lastEdit.current = coalesceKey === undefined ? null : { key: coalesceKey, at: now };
      docRef.current = result.doc;
    }

    setState((current) =>
      current.opened
        ? {
            ...current,
            opened: { ...current.opened, doc: result.doc },
            selectedId: result.selectedId === undefined ? current.selectedId : result.selectedId,
            error: null,
            canUndo: past.current.length > 0,
            canRedo: false,
          }
        : current,
    );
  }, []);

  /** Puts `doc` on screen without touching the stacks — undo and redo share it. */
  const restore = useCallback((doc: RaporDocument) => {
    docRef.current = doc;
    lastEdit.current = null;
    setState((current) => {
      if (!current.opened) return current;
      const stillThere = current.selectedId && doc.segments.some((s) => s.id === current.selectedId);
      return {
        ...current,
        opened: { ...current.opened, doc },
        selectedId: stillThere ? current.selectedId : (doc.segments[0]?.id ?? null),
        error: null,
        canUndo: past.current.length > 0,
        canRedo: future.current.length > 0,
      };
    });
  }, []);

  const undo = useCallback(() => {
    const previous = past.current.pop();
    if (!previous || !docRef.current) return;
    future.current.push(docRef.current);
    restore(previous);
  }, [restore]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next || !docRef.current) return;
    past.current.push(docRef.current);
    restore(next);
  }, [restore]);

  // --- File lifecycle -------------------------------------------------------

  const load = useCallback((opened: OpenedDocument | null, external = false) => {
    if (!opened) return;
    if (!external && pendingSave.current && pendingSave.current.path !== opened.path) void flushSave();
    // Opening a file must not immediately write it back — neither on first
    // load nor when the change came from disk in the first place.
    skipNextSave.current = true;
    // What an LLM wrote over the file is not something to undo into.
    resetHistory(opened.doc);
    setState((current) => ({
      ...current,
      opened,
      selectedId:
        external && current.selectedId && opened.doc.segments.some((s) => s.id === current.selectedId)
          ? current.selectedId
          : (opened.doc.segments[0]?.id ?? null),
      externalUpdate: external ? Date.now() : null,
      error: null,
      canUndo: false,
      canRedo: false,
    }));
  }, [flushSave]);

  useEffect(() => window.raporgo.onExternalChange((payload) => load(payload, true)), [load]);
  useEffect(
    () => window.raporgo.onAssetsChange(() => setState((current) => ({ ...current, revision: current.revision + 1 }))),
    [],
  );

  const openDocument = useCallback(async () => load(await window.raporgo.openDocument()), [load]);
  const newDocument = useCallback(
    async (template?: string) => load(await window.raporgo.newDocument(template)),
    [load],
  );
  const openPath = useCallback(async (path: string) => load(await window.raporgo.openPath(path)), [load]);

  /** Back to the home screen, with the last edits on disk first. */
  const closeDocument = useCallback(async () => {
    await flushSave();
    await window.raporgo.closeDocument();
    resetHistory(null);
    setState((current) => ({
      ...current,
      opened: null,
      selectedId: null,
      saving: false,
      externalUpdate: null,
      error: null,
      canUndo: false,
      canRedo: false,
    }));
  }, [flushSave]);

  // --- Autosave -------------------------------------------------------------

  const opened = state.opened;

  useEffect(() => {
    if (!opened) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    clearTimeout(saveTimer.current);
    setState((current) => ({ ...current, saving: true }));
    pendingSave.current = { path: opened.path, doc: opened.doc };
    saveTimer.current = setTimeout(() => {
      pendingSave.current = null;
      window.raporgo
        .save(opened.path, opened.doc)
        .then((result) =>
          setState((current) => ({
            ...current,
            saving: false,
            error: result.saved
              ? null
              : STALE_SAVE,
          })),
        )
        .catch((error: Error) =>
          setState((current) => ({ ...current, saving: false, error: error.message })),
        );
    }, AUTOSAVE_DELAY);

    return () => clearTimeout(saveTimer.current);
  }, [opened]);

  // --- Editing --------------------------------------------------------------

  const actions = useMemo(
    () => ({
      select: (id: string | null) => setState((current) => ({ ...current, selectedId: id })),

      undo,
      redo,

      patchSegment: (id: string, patch: Record<string, unknown>) =>
        mutate(
          (doc) => ({
            doc: {
              ...doc,
              segments: doc.segments.map((segment) =>
                segment.id === id ? ({ ...segment, ...patch } as Segment) : segment,
              ),
            },
          }),
          `segment:${id}:${Object.keys(patch).join(',')}`,
        ),

      patchMeta: (patch: Record<string, unknown>) =>
        mutate((doc) => ({ doc: { ...doc, meta: { ...doc.meta, ...patch } } }), `meta:${Object.keys(patch).join(',')}`),

      /** Template and palette move together — the picker applies one choice. */
      setTemplate: (template: string, preset: string) =>
        mutate((doc) => ({ doc: { ...doc, template, theme: { ...doc.theme, preset } } })),

      addSegment: (type: SegmentType, afterId: string | null) =>
        mutate((doc) => {
          const segment = { ...segmentTemplates[type](), id: nextId(doc, type) } as Segment;
          return { doc: insertAfter(doc, segment, afterId), selectedId: segment.id! };
        }),

      /**
       * Adds an image segment with its file already chosen — the asset manager
       * knows the src, so there is no reason to pass through the empty state
       * that `addSegment('image')` would create.
       */
      addImageSegment: (src: string, afterId: string | null) =>
        mutate((doc) => {
          const segment = { type: 'image', src, id: nextId(doc, 'image') } as Segment;
          return { doc: insertAfter(doc, segment, afterId), selectedId: segment.id! };
        }),

      removeSegment: (id: string) =>
        mutate((doc) => {
          const index = doc.segments.findIndex((s) => s.id === id);
          if (index === -1) return { doc };
          const segments = doc.segments.filter((s) => s.id !== id);
          return {
            doc: { ...doc, segments },
            selectedId: segments[Math.min(index, segments.length - 1)]?.id ?? null,
          };
        }),

      /**
       * Drops `id` into the gap before position `gap` in the *current* order.
       * The list hands over a gap index rather than a neighbour id because a
       * drop can land at either end, where there is no neighbour on one side.
       */
      moveSegmentToGap: (id: string, gap: number) =>
        mutate((doc) => {
          const index = doc.segments.findIndex((s) => s.id === id);
          if (index === -1) return { doc };
          const segments = [...doc.segments];
          const [moved] = segments.splice(index, 1);
          // Removing the item shifts every later gap down by one.
          segments.splice(gap > index ? gap - 1 : gap, 0, moved!);
          return { doc: { ...doc, segments } };
        }),

      duplicateSegment: (id: string) =>
        mutate((doc) => {
          const index = doc.segments.findIndex((s) => s.id === id);
          if (index === -1) return { doc };
          const copy = {
            ...structuredClone(doc.segments[index]!),
            id: nextId(doc, doc.segments[index]!.type),
          } as Segment;
          const segments = [...doc.segments];
          segments.splice(index + 1, 0, copy);
          return { doc: { ...doc, segments }, selectedId: copy.id! };
        }),
    }),
    [mutate, undo, redo],
  );

  return { state, actions, openDocument, newDocument, openPath, closeDocument };
}
