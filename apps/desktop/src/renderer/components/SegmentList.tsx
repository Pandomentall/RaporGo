import type { DragEvent, JSX } from 'react';
import { useMemo, useState } from 'react';
import { plainText, segmentLabel } from '@raporgo/core/document';
import type { Segment, SegmentType } from '@raporgo/core/schema';
import { useT, type Translate } from '../i18n/index.js';
import { segmentColors } from '../state.js';
import type { RaporDocument } from '../../shared/api.js';

type SegmentListProps = {
  doc: RaporDocument;
  selectedId: string | null;
  /** Page each segment landed on, reported by the preview after pagination. */
  pages: Map<string, number>;
  onSelect: (id: string | null) => void;
  onAdd: (type: SegmentType, afterId: string | null) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMoveToGap: (id: string, gap: number) => void;
};

const ADD_ORDER: SegmentType[] = [
  'section',
  'subheading',
  'paragraph',
  'list',
  'keyValueTable',
  'table',
  'steps',
  'callout',
  'chart',
  'image',
  'code',
  'signature',
  'pageBreak',
  'spacer',
  'cover',
];

/** One row in the flattened list, plus the page divider that may precede it. */
type Row = {
  segment: Segment;
  index: number;
  /** Set when this row is the first one to land on a new page. */
  startsPage?: number;
};

type Group = {
  key: string;
  /** The `section` segment itself; absent for the run before the first section. */
  header: Segment | null;
  number: number | null;
  rows: Row[];
  /** Set when the section heading is itself the first thing on a new page. */
  startsPage?: number;
};

/**
 * Walks the document once and splits it into section groups, tagging the first
 * row of each new page along the way. A section owns everything up to the next
 * one; whatever precedes the first section (cover, intro) forms a lead-in group.
 */
function buildGroups(doc: RaporDocument, pages: Map<string, number>): Group[] {
  const groups: Group[] = [];
  let current: Group = { key: '__lead', header: null, number: null, rows: [] };
  let sectionNumber = 0;
  let lastPage = 0;

  const notePage = (id: string): number | undefined => {
    const page = pages.get(id);
    if (page === undefined || page <= lastPage) return undefined;
    const previous = lastPage;
    lastPage = page;
    return previous === 0 ? undefined : page;
  };

  for (const [index, segment] of doc.segments.entries()) {
    if (segment.type === 'section') {
      if (current.rows.length > 0 || current.header) groups.push(current);
      sectionNumber = segment.number ?? sectionNumber + 1;
      const startsPage = notePage(segment.id!);
      current = { key: segment.id!, header: segment, number: sectionNumber, rows: [] };
      if (startsPage !== undefined) current.startsPage = startsPage;
      continue;
    }
    const startsPage = notePage(segment.id!);
    current.rows.push(startsPage === undefined ? { segment, index } : { segment, index, startsPage });
  }

  if (current.rows.length > 0 || current.header) groups.push(current);
  return groups;
}

function PageRule({ page }: { page: number }): JSX.Element {
  const t = useT();
  return (
    <div className="page-rule">
      <span className="page-rule__line" />
      <span className="page-rule__label">{t('list.page', { n: page })}</span>
      <span className="page-rule__line" />
    </div>
  );
}

/** One line for a row. A cover with no title of its own shows the document's. */
function summarize(segment: Segment, t: Translate, docTitle: string): string {
  if (segment.type === 'cover') return segment.title ?? docTitle;
  if (segment.type === 'table') return segment.columns.map((column) => column.label).join(' / ');
  if (segment.type === 'chart') return `${segment.title ?? segment.chart} · ${t('list.dataCount', { n: segment.data.length })}`;
  const text = plainText(segmentLabel(segment)).replace(/\s+/g, ' ');
  return segment.type === 'steps' ? `${text} · ${t('list.stepCount', { n: segment.items.length })}` : text;
}

export function SegmentList({
  doc,
  selectedId,
  pages,
  onSelect,
  onAdd,
  onRemove,
  onDuplicate,
  onMoveToGap,
}: SegmentListProps): JSX.Element {
  const t = useT();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropGap, setDropGap] = useState<number | null>(null);

  const groups = useMemo(() => buildGroups(doc, pages), [doc, pages]);

  const needle = query.trim().toLocaleLowerCase('tr');
  const matches = useMemo(() => {
    if (!needle) return null;
    const hit = (segment: Segment): boolean =>
      summarize(segment, t, doc.meta.title).toLocaleLowerCase('tr').includes(needle) ||
      t(`segment.${segment.type}`).toLocaleLowerCase('tr').includes(needle) ||
      segment.id!.toLocaleLowerCase('tr').includes(needle);
    return new Set(doc.segments.filter(hit).map((segment) => segment.id!));
  }, [doc.segments, needle, t]);

  const visible = (segment: Segment): boolean => !matches || matches.has(segment.id!);

  const toggle = (key: string): void =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const endDrag = (): void => {
    setDragging(null);
    setDropGap(null);
  };

  /** A drop lands before or after the hovered row depending on which half it is over. */
  const dragOverRow = (event: DragEvent, index: number): void => {
    event.preventDefault();
    const box = event.currentTarget.getBoundingClientRect();
    setDropGap(event.clientY - box.top < box.height / 2 ? index : index + 1);
  };

  const commitDrop = (event: DragEvent): void => {
    event.preventDefault();
    if (dragging && dropGap !== null) onMoveToGap(dragging, dropGap);
    endDrag();
  };

  const renderRow = (row: Row, indent: boolean): JSX.Element | null => {
    const { segment, index } = row;
    const id = segment.id!;
    if (!visible(segment)) return null;

    return (
      <div key={id}>
        {row.startsPage !== undefined && <PageRule page={row.startsPage} />}
        {dropGap === index && <div className="drop-line" />}
        <div
          className={`segment${id === selectedId ? ' segment--selected' : ''}${
            dragging === id ? ' segment--dragging' : ''
          }`}
          style={{ borderLeftColor: segmentColors[segment.type], marginLeft: indent ? 14 : 0 }}
          onClick={() => onSelect(id)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => event.key === 'Enter' && onSelect(id)}
          draggable
          onDragStart={(event) => {
            setDragging(id);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', id);
          }}
          onDragEnd={endDrag}
          onDragOver={(event) => dragOverRow(event, index)}
          onDrop={commitDrop}
        >
          <span className="segment__grip" aria-hidden="true">
            ⠿
          </span>
          <div className="segment__main">
            <span className="segment__type">{t(`segment.${segment.type}`)}</span>
            <span className="segment__summary">{summarize(segment, t, doc.meta.title) || '—'}</span>
          </div>
          <div className="segment__actions">
            <button
              type="button"
              title={t('list.duplicate')}
              onClick={(event) => {
                event.stopPropagation();
                onDuplicate(id);
              }}
            >
              ⧉
            </button>
            <button
              type="button"
              title={t('list.remove')}
              onClick={(event) => {
                event.stopPropagation();
                onRemove(id);
              }}
            >
              ×
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <aside className="panel panel--left">
      <header className="panel__header">
        <h2>{t('list.title')}</h2>
        <button
          type="button"
          className="button button--small button--primary"
          onClick={() => setAdding((open) => !open)}
        >
          {adding ? t('list.close') : t('list.add')}
        </button>
      </header>

      {adding && (
        <div className="add-menu">
          {ADD_ORDER.map((type) => (
            <button
              key={type}
              type="button"
              className="add-menu__item"
              onClick={() => {
                onAdd(type, selectedId);
                setAdding(false);
              }}
            >
              <span className="add-menu__swatch" style={{ background: segmentColors[type] }} />
              {t(`segment.${type}`)}
            </button>
          ))}
        </div>
      )}

      <div className="segment-search">
        <input
          className="field__input"
          value={query}
          placeholder={t('list.search')}
          onChange={(event) => setQuery(event.target.value)}
        />
        {matches && <p className="segment-search__count">{t('list.matches', { n: matches.size })}</p>}
      </div>

      <div
        className="segment-list"
        onDragEnd={endDrag}
        onClick={(event) => {
          // Only the bare list — rows and section heads handle their own clicks.
          if (!(event.target as HTMLElement).closest('.segment, .group-head')) onSelect(null);
        }}
      >
        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.key);
          const shown = group.rows.filter((row) => visible(row.segment));
          const header = group.header;
          if (shown.length === 0 && !(header && visible(header))) return null;

          return (
            <div key={group.key}>
              {group.startsPage !== undefined && <PageRule page={group.startsPage} />}
              {header && (
                <div
                  className={`group-head${header.id === selectedId ? ' group-head--selected' : ''}`}
                  onClick={() => onSelect(header.id!)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => event.key === 'Enter' && onSelect(header.id!)}
                >
                  <span
                    className="group-head__caret"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggle(group.key);
                    }}
                  >
                    {isCollapsed ? '▸' : '▾'}
                  </span>
                  <span className="group-head__badge">{group.number}</span>
                  <span className="group-head__title">{plainText(segmentLabel(header))}</span>
                  <span className="group-head__count">{group.rows.length}</span>
                </div>
              )}
              {!isCollapsed && shown.map((row) => renderRow(row, header !== null))}
            </div>
          );
        })}

        {/* The trailing gap, so a row can be dropped at the very end. */}
        <div
          className="drop-tail"
          onDragOver={(event) => {
            event.preventDefault();
            setDropGap(doc.segments.length);
          }}
          onDrop={commitDrop}
        >
          {dropGap === doc.segments.length && <div className="drop-line" />}
        </div>
      </div>
    </aside>
  );
}
