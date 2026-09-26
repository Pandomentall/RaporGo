import type { JSX, PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useState } from 'react';
import { useT } from '../i18n/index.js';

type Side = 'left' | 'right';

/**
 * A panel width the user can drag, remembered across launches.
 *
 * Reading the stored value is guarded: `localStorage` can be empty or throw
 * (private mode, cleared site data), and the editor must open either way.
 */
export function usePanelWidth(
  key: string,
  initial: number,
  min: number,
  max: number,
): [number, (width: number) => void] {
  const storageKey = `raporgo.panel.${key}`;
  const clamp = (value: number): number => Math.round(Math.min(max, Math.max(min, value)));

  const [width, setWidthState] = useState<number>(() => {
    try {
      const stored = Number(localStorage.getItem(storageKey));
      return Number.isFinite(stored) && stored > 0 ? clamp(stored) : initial;
    } catch {
      return initial;
    }
  });

  const setWidth = useCallback(
    (value: number) => {
      const next = clamp(value);
      setWidthState(next);
      try {
        localStorage.setItem(storageKey, String(next));
      } catch {
        // Nothing to do — the width simply will not survive a restart.
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storageKey, min, max],
  );

  return [width, setWidth];
}

/**
 * The grab strip between a side panel and the preview. It lives in the grid
 * gap, so it costs no layout space; the panel it resizes is named by `side`.
 */
export function Splitter({
  side,
  width,
  onResize,
}: {
  side: Side;
  width: number;
  onResize: (width: number) => void;
}): JSX.Element {
  const t = useT();
  const [dragging, setDragging] = useState(false);

  const start = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const origin = event.clientX;
    const from = width;
    setDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const move = (moveEvent: PointerEvent): void => {
      const delta = moveEvent.clientX - origin;
      onResize(side === 'left' ? from + delta : from - delta);
    };
    const stop = (): void => {
      setDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  };

  return (
    <div
      className={`splitter${dragging ? ' splitter--active' : ''}`}
      role="separator"
      aria-orientation="vertical"
      title={t('splitter.title')}
      onPointerDown={start}
    >
      <span className="splitter__grip" />
    </div>
  );
}
