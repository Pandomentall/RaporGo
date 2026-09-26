import type { DragEvent, JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { templateCatalog } from '@raporgo/templates/catalog';
import { templateText, useSettings } from '../i18n/index.js';
import { parentDir, shortPath } from '../paths.js';
import type { RecentEntry } from '../../shared/api.js';
import { SettingsForm } from './SettingsModal.js';
import { TemplateThumb } from './TemplatePicker.js';

type HomeProps = {
  recent: RecentEntry[];
  onNew: (template?: string) => void;
  onOpen: () => void;
  onOpenPath: (path: string) => void;
  onForget: (path: string) => void;
};

type View = 'home' | 'prefs';
type Sort = 'opened' | 'name';
type Layout = 'grid' | 'list';

const LAYOUT_KEY = 'raporgo.home.layout';

function readLayout(): Layout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

/** "3 hours ago" in the app's language, from the largest unit that is at least one. */
function relativeTime(ms: number, locale: string): string {
  if (!ms) return '—';
  const seconds = Math.round((ms - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(0, 'minute');
}

const fileName = (path: string): string => shortPath(path, 1);

/**
 * The home screen, laid out the way Photoshop's is: a rail on the left with
 * the two ways in and the app's own pages, and on the right a row of
 * templates to start from and the recent files as pictures of their first
 * page. A report file dragged from Explorer opens too — the app often sits
 * next to the folder an LLM is writing into.
 */
export function Home({ recent, onNew, onOpen, onOpenPath, onForget }: HomeProps): JSX.Element {
  const { settings, t } = useSettings();
  const [view, setView] = useState<View>('home');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('opened');
  const [layout, setLayoutState] = useState<Layout>(readLayout);
  const [hovering, setHovering] = useState(false);
  const [version, setVersion] = useState('');

  useEffect(() => {
    void window.raporgo.appVersion().then(setVersion);
  }, []);

  const setLayout = (next: Layout): void => {
    setLayoutState(next);
    try {
      localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      // Remembered for this session only.
    }
  };

  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(settings.language);
    const matches = recent.filter(
      (entry) =>
        !needle ||
        entry.title.toLocaleLowerCase(settings.language).includes(needle) ||
        entry.path.toLocaleLowerCase(settings.language).includes(needle),
    );
    return sort === 'name'
      ? [...matches].sort((a, b) => a.title.localeCompare(b.title, settings.language))
      : [...matches].sort((a, b) => b.openedAt - a.openedAt);
  }, [recent, query, sort, settings.language]);

  const dragOver = (event: DragEvent): void => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    if (!hovering) setHovering(true);
  };

  const drop = (event: DragEvent): void => {
    event.preventDefault();
    setHovering(false);
    const file = Array.from(event.dataTransfer.files).find((candidate) => candidate.name.toLowerCase().endsWith('.json'));
    if (file) onOpenPath(window.raporgo.pathForFile(file));
  };

  const templates = templateCatalog.filter((info) => info.status === 'ready');

  return (
    <div
      className={`home${hovering ? ' home--hovering' : ''}`}
      onDragOver={dragOver}
      onDragLeave={() => setHovering(false)}
      onDrop={drop}
    >
      <aside className="home__rail">
        <div className="home__brand">
          <span className="home__mark" aria-hidden="true">
            {/* assets/brand/logo-mark.svg; page and line colours follow the theme. */}
            <svg viewBox="0 0 64 64">
              <path fill="var(--mark-page)" d="M13 6h26l12 12v37a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3Z" />
              <path fill="#f0a500" d="M39 6v10a2 2 0 0 0 2 2h10L39 6Z" />
              <path fill="var(--mark-lines)" d="M18 26h25a3 3 0 0 1 0 6H18a3 3 0 0 1 0-6Zm0 10h20a3 3 0 0 1 0 6H18a3 3 0 0 1 0-6Zm0 10h14a3 3 0 0 1 0 6H18a3 3 0 0 1 0-6Z" />
              <path fill="#f0a500" d="M4 26h14v6H4a3 3 0 0 1 0-6Zm3 10h11v6H7a3 3 0 0 1 0-6Zm5 10h6v6h-6a3 3 0 0 1 0-6Z" />
            </svg>
          </span>
          <strong>{t('app.name')}</strong>
        </div>

        <button type="button" className="button button--primary home__cta" title="Ctrl+N" onClick={() => onNew()}>
          {t('home.new')}
        </button>
        <button type="button" className="button home__cta" title="Ctrl+O" onClick={onOpen}>
          {t('home.open')}
        </button>

        <nav className="home__nav">
          <button
            type="button"
            className={`home__nav-item${view === 'home' ? ' home__nav-item--on' : ''}`}
            onClick={() => setView('home')}
          >
            {t('home.navHome')}
          </button>
          <button
            type="button"
            className={`home__nav-item${view === 'prefs' ? ' home__nav-item--on' : ''}`}
            onClick={() => setView('prefs')}
          >
            {t('home.navPrefs')}
          </button>
        </nav>

        <span className="home__version">{version && t('home.version', { version })}</span>
      </aside>

      <main className="home__main">
        {view === 'prefs' ? (
          <div className="home__prefs">
            <h1 className="home__title">{t('home.navPrefs')}</h1>
            <p className="home__lead">{t('home.prefsHint')}</p>
            <div className="home__prefs-body">
              <SettingsForm />
            </div>
          </div>
        ) : (
          <>
            <header className="home__head">
              <h1 className="home__title">{t('home.greeting')}</h1>
              <p className="home__lead">{t('app.pitch')}</p>
            </header>

            <section className="home__section">
              <h2 className="home__section-title">{t('home.quickStart')}</h2>
              <div className="home__starters">
                {templates.map((info) => (
                  <button
                    key={info.name}
                    type="button"
                    className="starter"
                    title={templateText(t, info).description}
                    onClick={() => onNew(info.name)}
                  >
                    <span className="starter__thumb">
                      <TemplateThumb info={info} />
                    </span>
                    <span className="starter__label">{templateText(t, info).label}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="home__section home__section--grow">
              <div className="home__bar">
                <h2 className="home__section-title">{t('home.recent')}</h2>
                <span className="home__bar-spacer" />
                <input
                  className="field__input home__search"
                  type="search"
                  placeholder={t('home.filter')}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <select
                  className="field__input home__sort"
                  value={sort}
                  aria-label={t('home.sort')}
                  onChange={(event) => setSort(event.target.value as Sort)}
                >
                  <option value="opened">{t('home.sortOpened')}</option>
                  <option value="name">{t('home.sortName')}</option>
                </select>
                <span className="home__layout" role="group">
                  <button
                    type="button"
                    title={t('home.grid')}
                    aria-pressed={layout === 'grid'}
                    className={layout === 'grid' ? 'home__layout--on' : ''}
                    onClick={() => setLayout('grid')}
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" />
                      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" />
                      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" />
                      <rect x="9" y="9" width="5.5" height="5.5" rx="1" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    title={t('home.list')}
                    aria-pressed={layout === 'list'}
                    className={layout === 'list' ? 'home__layout--on' : ''}
                    onClick={() => setLayout('list')}
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <rect x="1.5" y="2" width="13" height="2.5" rx="1" />
                      <rect x="1.5" y="6.75" width="13" height="2.5" rx="1" />
                      <rect x="1.5" y="11.5" width="13" height="2.5" rx="1" />
                    </svg>
                  </button>
                </span>
              </div>

              {recent.length === 0 ? (
                <p className="home__empty">{t('home.empty')}</p>
              ) : shown.length === 0 ? (
                <p className="home__empty">{t('home.noMatch')}</p>
              ) : layout === 'grid' ? (
                <ul className="recent-grid">
                  {shown.map((entry) => (
                    <li key={entry.path} className="recent-card">
                      <button
                        type="button"
                        className="recent-card__open"
                        title={entry.path}
                        onClick={() => onOpenPath(entry.path)}
                      >
                        <span className="recent-card__thumb">
                          <RecentThumb entry={entry} />
                        </span>
                        <span className="recent-card__title">{entry.title}</span>
                        <span className="recent-card__meta">
                          {fileName(entry.path)} · {relativeTime(entry.openedAt, settings.language)}
                        </span>
                      </button>
                      <RecentActions entry={entry} onForget={onForget} />
                    </li>
                  ))}
                </ul>
              ) : (
                <table className="recent-list">
                  <thead>
                    <tr>
                      <th>{t('home.colName')}</th>
                      <th>{t('home.colFolder')}</th>
                      <th>{t('home.colOpened')}</th>
                      <th>{t('home.colModified')}</th>
                      <th aria-label={t('home.actions')} />
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((entry) => (
                      <tr key={entry.path} onClick={() => onOpenPath(entry.path)} title={entry.path}>
                        <td>
                          <span className="recent-list__name">
                            <span className="recent-list__thumb">
                              <RecentThumb entry={entry} />
                            </span>
                            <span>
                              <strong>{entry.title}</strong>
                              <span>{fileName(entry.path)}</span>
                            </span>
                          </span>
                        </td>
                        <td className="recent-list__folder">{shortPath(parentDir(entry.path), 3)}</td>
                        <td>{relativeTime(entry.openedAt, settings.language)}</td>
                        <td>{relativeTime(entry.modifiedAt, settings.language)}</td>
                        <td onClick={(event) => event.stopPropagation()}>
                          <RecentActions entry={entry} onForget={onForget} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </main>

      <div className="home__drop" aria-hidden="true">
        {t('home.drop')}
      </div>
    </div>
  );
}

/** The first page when one has been rendered, the template's drawing until then. */
function RecentThumb({ entry }: { entry: RecentEntry }): JSX.Element {
  if (entry.thumb) return <img src={entry.thumb} alt="" draggable={false} />;
  const info = templateCatalog.find((candidate) => candidate.name === entry.template) ?? templateCatalog[0]!;
  return <TemplateThumb info={info} />;
}

function RecentActions({ entry, onForget }: { entry: RecentEntry; onForget: (path: string) => void }): JSX.Element {
  const { t } = useSettings();
  return (
    <span className="recent-actions">
      <button type="button" title={t('home.reveal')} onClick={() => void window.raporgo.revealFile(entry.path)}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M1.5 4a1 1 0 0 1 1-1h3.2l1.4 1.5h6.4a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" />
        </svg>
      </button>
      <button type="button" title={t('home.forget')} onClick={() => onForget(entry.path)}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </span>
  );
}
