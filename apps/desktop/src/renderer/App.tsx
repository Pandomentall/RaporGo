import type { CSSProperties, JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { setSegmentPath } from '@raporgo/core/document';
import { Inspector } from './components/Inspector.js';
import { Preview, type EditCommit } from './components/Preview.js';
import { SegmentList } from './components/SegmentList.js';
import { SettingsModal } from './components/SettingsModal.js';
import { Splitter, usePanelWidth } from './components/Splitter.js';
import { AssetManager } from './components/AssetManager.js';
import { TemplatePicker } from './components/TemplatePicker.js';
import type { Formatter } from './components/formatting.js';
import { Toasts, useToasts } from './components/Toasts.js';
import { Home } from './components/Home.js';
import { ZOOM_EVENT, type ZoomRequest } from './components/Preview.js';
import { useT } from './i18n/index.js';
import { shortPath } from './paths.js';
import type { MenuCommand, RecentEntry } from '../shared/api.js';
import { STALE_SAVE, useEditor } from './state.js';

/** Electron wraps an error thrown in the main process; the wrapper says nothing a person needs. */
function ipcMessage(error: Error): string {
  return error.message.replace(/^Error invoking remote method '[^']+': (?:\w*Error: )?/, '');
}

/** True while the keyboard belongs to a text field, so Delete means "delete a character". */
function typingInto(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

/** A gear with eight even teeth — Lucide's `settings` geometry (ISC licence). */
export function GearIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** The gear. Sits outside the project's own controls: it is about the app, not the report. */
function SettingsButton({ onClick, title }: { onClick: () => void; title: string }): JSX.Element {
  return (
    <button type="button" className="button button--small gear" title={title} aria-label={title} onClick={onClick}>
      <GearIcon />
    </button>
  );
}

export function App(): JSX.Element {
  const t = useT();
  const { state, actions, openDocument, newDocument, openPath, closeDocument } = useEditor();
  const { opened, selectedId } = state;
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [pages, setPages] = useState<Map<string, number>>(new Map());
  const [picking, setPicking] = useState(false);
  const [managingAssets, setManagingAssets] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leftWidth, setLeftWidth] = usePanelWidth('left', 264, 220, 400);
  const [rightWidth, setRightWidth] = usePanelWidth('right', 360, 300, 560);
  const { toasts, push, dismiss } = useToasts();

  // Formatting from the panel acts on text selected in the preview. The
  // formatter belongs to whichever frame is on screen; `hasSelection` just
  // tells the panel whether its buttons have anything to act on.
  const formatter = useRef<Formatter | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const stopWatchingSelection = useRef<(() => void) | null>(null);
  const takeFormatter = useCallback((next: Formatter | null) => {
    stopWatchingSelection.current?.();
    formatter.current = next;
    setHasSelection(next?.hasSelection() ?? false);
    stopWatchingSelection.current = next ? next.onChange(setHasSelection) : null;
  }, []);

  // The home screen's cards: reloaded whenever a report opens or closes, and
  // when the main process says a thumbnail landed.
  const refreshRecent = useCallback(() => {
    void window.raporgo.recentFiles().then(setRecent);
  }, []);
  useEffect(refreshRecent, [opened?.path, refreshRecent]);
  useEffect(() => window.raporgo.onRecentChange(refreshRecent), [refreshRecent]);

  // Opened with a project (command line, "Open with", or the reopen-last
  // setting) — skip the welcome screen.
  useEffect(() => {
    void window.raporgo.startupPath().then((path) => {
      if (path) void openPath(path);
    });
  }, [openPath]);

  // Tell the user when the file moved under them — that is the LLM at work.
  useEffect(() => {
    if (state.externalUpdate) push(t('toast.externalUpdate'));
  }, [state.externalUpdate, push, t]);

  // The dialogs reject when the chosen folder is not a project (or already is
  // one); the message is the thing to show, not an unhandled rejection.
  const createProject = useCallback(
    (template?: string) => {
      newDocument(template).catch((error: Error) => push(ipcMessage(error), 'error'));
    },
    [newDocument, push],
  );
  const openProject = useCallback(() => {
    openDocument().catch((error: Error) => push(ipcMessage(error), 'error'));
  }, [openDocument, push]);

  const openFrom = useCallback(
    (path: string) => {
      openPath(path).catch((error: Error) => {
        push(t('toast.openFailed', { message: ipcMessage(error) }), 'error', ipcMessage(error));
        // A project that cannot be opened has no business in the recent list.
        void window.raporgo.forgetRecent(path).then(refreshRecent);
      });
    },
    [openPath, push, t, refreshRecent],
  );

  const forgetFile = useCallback(
    (path: string) => void window.raporgo.forgetRecent(path).then(refreshRecent),
    [refreshRecent],
  );

  const goHome = useCallback(() => {
    void closeDocument();
  }, [closeDocument]);

  // The window title names the document, the way every editor does.
  useEffect(() => {
    document.title = opened ? `${opened.doc.meta.title} — RaporGo` : 'RaporGo';
  }, [opened?.doc.meta.title, opened]);

  const commitInlineEdit = useCallback(
    (edit: EditCommit) => {
      if (!opened) return;
      try {
        const next = setSegmentPath(opened.doc, edit.segmentId, edit.path, edit.value);
        actions.patchSegment(edit.segmentId, next.segments.find((s) => s.id === edit.segmentId)!);
      } catch (error) {
        push(error instanceof Error ? error.message : String(error), 'error');
      }
    },
    [opened, actions, push],
  );

  const exportPdf = useCallback(() => {
    if (!opened) return;
    push(t('toast.pdfPreparing'));
    window.raporgo
      .exportPdf(opened.doc, opened.dir)
      .then((path) => path && push(t('toast.pdfSaved', { path: shortPath(path) }), 'success', path))
      .catch((error: Error) => push(ipcMessage(error), 'error'));
  }, [opened, push, t]);

  // Keyboard shortcuts. The preview iframe owns its own keyboard, so nothing
  // here fires while the user is typing into the page itself.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const mod = event.ctrlKey || event.metaKey;
      const typing = typingInto(event.target);

      if (mod && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        openProject();
      } else if (mod && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        createProject();
      } else if (mod && event.key === ',') {
        event.preventDefault();
        setSettingsOpen(true);
      } else if (!opened) {
        return;
      } else if (mod && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        exportPdf();
      } else if (mod && !typing && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) actions.redo();
        else actions.undo();
      } else if (mod && !typing && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        actions.redo();
      } else if (mod && !typing && event.key.toLowerCase() === 'd' && selectedId) {
        event.preventDefault();
        actions.duplicateSegment(selectedId);
      } else if (!mod && !typing && (event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault();
        actions.removeSegment(selectedId);
      } else if (!mod && !typing && event.key === 'Escape' && selectedId) {
        actions.select(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opened, selectedId, actions, exportPdf, openProject, createProject]);

  // The menu bar sends the same actions as the shortcuts. Undo and redo go
  // to a focused text field first, where they mean "undo my typing".
  useEffect(() => {
    const zoom = (request: ZoomRequest): void => {
      window.dispatchEvent(new CustomEvent<ZoomRequest>(ZOOM_EVENT, { detail: request }));
    };
    const run = (command: MenuCommand): void => {
      const typing = typingInto(document.activeElement);
      switch (command) {
        case 'new':
          return createProject();
        case 'open':
          return openProject();
        case 'settings':
          return setSettingsOpen(true);
        case 'export':
          return exportPdf();
        case 'home':
          return goHome();
        case 'undo':
          if (typing) document.execCommand('undo');
          else actions.undo();
          return;
        case 'redo':
          if (typing) document.execCommand('redo');
          else actions.redo();
          return;
        case 'zoomIn':
          return zoom('in');
        case 'zoomOut':
          return zoom('out');
        case 'zoomFit':
          return zoom('fit');
      }
    };
    const stopCommands = window.raporgo.onMenuCommand(run);
    const stopOpen = window.raporgo.onMenuOpenPath(openFrom);
    return () => {
      stopCommands();
      stopOpen();
    };
  }, [actions, createProject, openProject, exportPdf, goHome, openFrom]);

  const settings = settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />;

  if (!opened) {
    return (
      <>
        <Home recent={recent} onNew={createProject} onOpen={openProject} onOpenPath={openFrom} onForget={forgetFile} />
        {settings}
        <Toasts toasts={toasts} error={null} onDismiss={dismiss} />
      </>
    );
  }

  const selected = opened.doc.segments.find((segment) => segment.id === selectedId) ?? null;

  return (
    <div className="app">
      <header className="toolbar">
        <button
          type="button"
          className="button button--small home-button"
          title={t('toolbar.home')}
          aria-label={t('toolbar.home')}
          onClick={goHome}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2.5 7.2 8 2.5l5.5 4.7V13a.5.5 0 0 1-.5.5H9.5V10h-3v3.5H3a.5.5 0 0 1-.5-.5z" />
          </svg>
        </button>
        <span className="toolbar__title">{opened.doc.meta.title}</span>
        <span className="toolbar__path" title={opened.path}>
          {shortPath(opened.path)}
        </span>
        <span className="toolbar__group">
          <button
            type="button"
            className="button button--small button--quiet"
            title={t('toolbar.undo')}
            disabled={!state.canUndo}
            onClick={actions.undo}
          >
            ↶
          </button>
          <button
            type="button"
            className="button button--small button--quiet"
            title={t('toolbar.redo')}
            disabled={!state.canRedo}
            onClick={actions.redo}
          >
            ↷
          </button>
        </span>
        <span className="toolbar__spacer" />
        <span className={`toolbar__state${state.saving ? ' toolbar__state--busy' : ''}`}>
          {state.saving ? t('toolbar.saving') : t('toolbar.saved')}
        </span>
        <button type="button" className="button button--small" title="Ctrl+O" onClick={openProject}>
          {t('toolbar.open')}
        </button>
        <button type="button" className="button button--small" title="Ctrl+N" onClick={() => createProject()}>
          {t('toolbar.new')}
        </button>
        <button type="button" className="button button--small" onClick={() => setPicking(true)}>
          {t('toolbar.template')}
        </button>
        <button type="button" className="button button--small" onClick={() => setManagingAssets(true)}>
          {t('toolbar.images')}
        </button>
        <button type="button" className="button button--small button--primary" title="Ctrl+E" onClick={exportPdf}>
          {t('toolbar.export')}
        </button>
        <span className="toolbar__divider" />
        <SettingsButton title={t('toolbar.settings')} onClick={() => setSettingsOpen(true)} />
      </header>

      {picking && (
        <TemplatePicker
          doc={opened.doc}
          onClose={() => setPicking(false)}
          onApply={(template, preset) => {
            actions.setTemplate(template, preset);
            setPicking(false);
            push(t('toast.templateApplied'));
          }}
        />
      )}

      {managingAssets && (
        <AssetManager
          doc={opened.doc}
          dir={opened.dir}
          onClose={() => setManagingAssets(false)}
          onInsert={(src) => {
            actions.addImageSegment(src, selectedId);
            setManagingAssets(false);
            push(t('toast.imageAdded', { src }), 'success');
          }}
        />
      )}

      {settings}

      <main
        className="workspace"
        style={{ '--left-width': `${leftWidth}px`, '--right-width': `${rightWidth}px` } as CSSProperties}
      >
        <SegmentList
          doc={opened.doc}
          selectedId={selectedId}
          pages={pages}
          onSelect={actions.select}
          onAdd={actions.addSegment}
          onRemove={actions.removeSegment}
          onDuplicate={actions.duplicateSegment}
          onMoveToGap={actions.moveSegmentToGap}
        />
        <Splitter side="left" width={leftWidth} onResize={setLeftWidth} />
        <Preview
          doc={opened.doc}
          dir={opened.dir}
          selectedId={selectedId}
          onFormatter={takeFormatter}
          onSelect={actions.select}
          onCommit={commitInlineEdit}
          onPages={setPages}
          revision={state.revision}
          onLockedEdit={() => push(t('toast.lockedSplit'))}
        />
        <Splitter side="right" width={rightWidth} onResize={setRightWidth} />
        <Inspector
          doc={opened.doc}
          dir={opened.dir}
          segment={selected}
          formatting={{ enabled: hasSelection, apply: (action) => formatter.current?.apply(action) }}
          onPatch={actions.patchSegment}
          onPatchMeta={actions.patchMeta}
        />
      </main>

      <Toasts toasts={toasts} error={state.error === STALE_SAVE ? t('toast.staleSave') : state.error} onDismiss={dismiss} />
    </div>
  );
}
