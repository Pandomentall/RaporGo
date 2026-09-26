import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n/index.js';
import { shortPath } from '../paths.js';
import type { AssetInfo, RaporDocument } from '../../shared/api.js';

type AssetManagerProps = {
  doc: RaporDocument;
  dir: string;
  onInsert: (src: string) => void;
  onClose: () => void;
};

/**
 * The project's image folder as a grid (mockup 2d).
 *
 * Which segment uses which file is derived from the document rather than
 * tracked separately — that is what makes "unused" trustworthy, and it is why
 * deleting is offered only for files no segment references.
 */
export function AssetManager({ doc, dir, onInsert, onClose }: AssetManagerProps): JSX.Element {
  const t = useT();
  const [assets, setAssets] = useState<AssetInfo[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = (): void => {
    window.raporgo
      .listAssets(dir)
      .then(setAssets)
      .catch((cause: Error) => setError(cause.message));
  };

  useEffect(refresh, [dir]);

  /** Segment ids referencing each asset, keyed by the src they use. */
  const usage = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const segment of doc.segments) {
      if (segment.type !== 'image' || !segment.src) continue;
      const key = segment.src.replace(/^\.\//, '');
      map.set(key, [...(map.get(key) ?? []), segment.id!]);
    }
    return map;
  }, [doc.segments]);

  const unused = (assets ?? []).filter((asset) => !usage.has(asset.src));
  const totalBytes = (assets ?? []).reduce((sum, asset) => sum + asset.bytes, 0);

  const removeUnused = (): void => {
    window.raporgo
      .deleteAssets(
        dir,
        unused.map((asset) => asset.src),
      )
      .then(() => {
        setConfirming(false);
        setSelected(null);
        refresh();
      })
      .catch((cause: Error) => setError(cause.message));
  };

  return (
    <div className="modal-scrim" onClick={onClose} role="presentation">
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <header className="modal__head">
          <span>
            {t('assets.title')} <span className="modal__head-alt">{t('assets.alt')}</span>
          </span>
          <span className="modal__head-path">{shortPath(dir)}/image_Assets</span>
        </header>

        <div className="modal__body">
          {error && <div className="banner banner--error">{error}</div>}

          {assets === null ? (
            <p className="hint">{t('assets.reading')}</p>
          ) : assets.length === 0 ? (
            <p className="hint">{t('assets.empty')}</p>
          ) : (
            <div className="asset-grid">
              {assets.map((asset) => {
                const users = usage.get(asset.src) ?? [];
                return (
                  <button
                    key={asset.src}
                    type="button"
                    className={`asset${selected === asset.src ? ' asset--selected' : ''}${
                      users.length === 0 ? ' asset--unused' : ''
                    }`}
                    onClick={() => setSelected(asset.src)}
                    onDoubleClick={() => onInsert(asset.src)}
                  >
                    <span className="asset__thumb">
                      <img src={fileUrl(asset.path)} alt="" loading="lazy" />
                    </span>
                    <span className="asset__name">{asset.name}</span>
                    <span className="asset__meta">
                      {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ''}
                      {formatBytes(asset.bytes)}
                    </span>
                    {users.length > 0 ? (
                      <span className="asset__use">↳ {users.join(', ')}</span>
                    ) : (
                      <span className="asset__unused">
                        <span className="asset__dot" />
                        {t('assets.unused')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            className="asset-drop"
            onClick={() => {
              void window.raporgo.addAsset(dir).then((src) => {
                if (src) {
                  refresh();
                  setSelected(src);
                }
              });
            }}
          >
            {t('assets.add')}
            <span className="asset-drop__hint">{t('assets.addHint')}</span>
          </button>
        </div>

        <footer className="modal__foot">
          {confirming ? (
            <>
              <span className="modal__note">{t('assets.confirm', { n: unused.length })}</span>
              <button type="button" className="button button--small" onClick={() => setConfirming(false)}>
                {t('assets.cancel')}
              </button>
              <button type="button" className="button button--small button--danger" onClick={removeUnused}>
                {t('assets.delete')}
              </button>
            </>
          ) : (
            <>
              <span className="modal__note">
                {t('assets.summary', { n: unused.length, size: formatBytes(totalBytes) })}
              </span>
              <button
                type="button"
                className="button button--small button--quiet-danger"
                disabled={unused.length === 0}
                onClick={() => setConfirming(true)}
              >
                {t('assets.deleteUnused')}
              </button>
              <button
                type="button"
                className="button button--small button--primary"
                disabled={!selected}
                onClick={() => selected && onInsert(selected)}
              >
                {t('assets.insert')}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

function fileUrl(path: string): string {
  return `file:///${path.replace(/\\/g, '/').replace(/^\/+/, '')}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
