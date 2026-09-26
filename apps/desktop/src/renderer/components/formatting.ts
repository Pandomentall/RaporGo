/**
 * Formatting for text selected in the preview, driven from the inspector.
 *
 * The selection lives in the preview document; the buttons live in the app
 * window. This object bridges them: it watches the preview's selection so the
 * panel knows when there is something to format, and applies commands to
 * that selection when asked. Everything goes through `execCommand`, which
 * edits the live DOM the blur handler then serialises back into markup — so
 * nothing here touches the document model.
 */

export type FormatAction =
  | { kind: 'bold' }
  | { kind: 'italic' }
  | { kind: 'code' }
  | { kind: 'color'; role: string | null; hex: string }
  | { kind: 'clear' };

export type Formatter = {
  /** True while a non-empty selection sits inside editable rich text. */
  hasSelection(): boolean;
  apply(action: FormatAction): void;
  /** Reports every change of `hasSelection()`; returns the unsubscribe. */
  onChange(listener: (has: boolean) => void): () => void;
};

export function createFormatter(document_: Document): Formatter {
  const view = document_.defaultView;
  const selection = (): Selection | null => view?.getSelection() ?? null;

  /** The rich editable the selection sits in, or null when there is nothing to format. */
  const editable = (): HTMLElement | null => {
    const sel = selection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const node = sel.anchorNode;
    const element = node instanceof Element ? node : node?.parentElement;
    const host = element?.closest<HTMLElement>('[data-edit][contenteditable="true"]') ?? null;
    return host && host.getAttribute('data-edit-kind') !== 'plain' ? host : null;
  };

  const listeners = new Set<(has: boolean) => void>();
  let last = false;
  document_.addEventListener('selectionchange', () => {
    const has = editable() !== null;
    if (has === last) return;
    last = has;
    listeners.forEach((listener) => listener(has));
  });

  /**
   * Colours the selection. A role is applied as its current hex (execCommand
   * only takes a colour), then the `<font>` elements it produced are stamped
   * with the role so the serialiser stores `[text]{role}` rather than the hex.
   */
  const colour = (host: HTMLElement, role: string | null, hex: string): void => {
    document_.execCommand('foreColor', false, hex);
    if (!role) return;
    host.querySelectorAll<HTMLElement>('font[color]').forEach((font) => {
      if (!font.dataset['color'] && font.getAttribute('color')?.toLowerCase() === hex.toLowerCase()) {
        font.dataset['color'] = role;
      }
    });
  };

  const clear = (host: HTMLElement): void => {
    const range = selection()?.getRangeAt(0);
    if (!range) return;
    host.querySelectorAll<HTMLElement>('font[color], span[data-color], span[style*="color"]').forEach((el) => {
      if (range.intersectsNode(el)) el.replaceWith(...Array.from(el.childNodes));
    });
  };

  const code = (): void => {
    const text = selection()?.toString() ?? '';
    if (!text) return;
    const escaped = text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
    document_.execCommand('insertHTML', false, `<code>${escaped}</code>`);
  };

  return {
    hasSelection: () => editable() !== null,
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    apply: (action) => {
      const host = editable();
      if (!host) return;
      switch (action.kind) {
        case 'bold':
          document_.execCommand('bold');
          break;
        case 'italic':
          document_.execCommand('italic');
          break;
        case 'code':
          code();
          break;
        case 'color':
          colour(host, action.role, action.hex);
          break;
        case 'clear':
          clear(host);
          break;
      }
    },
  };
}
