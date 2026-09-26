import type { JSX } from 'react';
import { useCallback, useRef, useState } from 'react';

export type ToastKind = 'info' | 'success' | 'error';

export type Toast = {
  id: number;
  kind: ToastKind;
  text: string;
  /** Full text behind an abbreviated one — a path, say — shown on hover. */
  title?: string;
};

const LIFETIME = 4000;

/**
 * Short-lived notices, stacked bottom-right over the preview.
 *
 * A notice says what just happened and gets out of the way; nothing here
 * needs answering. Errors from the editor state are shown separately and
 * stay until the state clears them.
 */
export function useToasts(): {
  toasts: Toast[];
  push: (text: string, kind?: ToastKind, title?: string) => void;
  dismiss: (id: number) => void;
} {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (text: string, kind: ToastKind = 'info', title?: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), title ? { id, kind, text, title } : { id, kind, text }]);
      setTimeout(() => dismiss(id), LIFETIME);
    },
    [dismiss],
  );

  return { toasts, push, dismiss };
}

export function Toasts({
  toasts,
  error,
  onDismiss,
}: {
  toasts: Toast[];
  /** A standing error from the editor state; it has no timer. */
  error: string | null;
  onDismiss: (id: number) => void;
}): JSX.Element | null {
  if (toasts.length === 0 && !error) return null;
  return (
    <div className="toasts" aria-live="polite">
      {error && (
        <div className="toast toast--error toast--sticky" role="alert">
          {error}
        </div>
      )}
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className={`toast toast--${toast.kind}`}
          title={toast.title ?? toast.text}
          onClick={() => onDismiss(toast.id)}
        >
          {toast.text}
        </button>
      ))}
    </div>
  );
}
