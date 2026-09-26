import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { alignments, calloutVariants, chartKinds, type Segment } from '@raporgo/core/schema';
import { documentLanguages } from '@raporgo/templates/labels';
import { resolveColors, type ColorTokens } from '@raporgo/templates/tokens';
import { useT, type Translate } from '../i18n/index.js';
import type { FormatAction } from './formatting.js';
import { segmentColors } from '../state.js';
import {
  CHART_GLYPHS,
  COLOR_ROLES,
  Choice,
  ColorPicker,
  Field,
  Group,
  NumberField,
  SEGMENT_GLYPHS,
  Toggle,
  type ChoiceOption,
} from './fields.js';
import type { RaporDocument } from '../../shared/api.js';

type InspectorProps = {
  doc: RaporDocument;
  dir: string;
  segment: Segment | null;
  /** Acts on whatever text is selected in the preview; disabled when nothing is. */
  formatting: { enabled: boolean; apply: (action: FormatAction) => void };
  onPatch: (id: string, patch: Record<string, unknown>) => void;
  onPatchMeta: (patch: Record<string, unknown>) => void;
};

/** Segment types whose page text can be selected and formatted in place. */
const RICH_TEXT_TYPES = new Set<Segment['type']>([
  'cover',
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
  'signature',
]);

/**
 * The properties panel.
 *
 * Text is edited straight in the preview; this panel is for everything with no
 * visual handle — variants, colours, table structure — and it is the only
 * place a person meets the document format. So nothing here names a format
 * concept: choices are shown as the thing they produce, rare settings sit
 * behind a closed group, and the document's own fields appear only when no
 * segment is selected, because the segment is what gets edited all day.
 */
export function Inspector({ doc, dir, segment, formatting, onPatch, onPatchMeta }: InspectorProps): JSX.Element {
  const t = useT();
  const colors = resolveColors(doc.theme?.preset, doc.theme?.overrides);

  return (
    <aside className="panel panel--right">
      {segment ? (
        <>
          <header className="inspector__head">
            <span className="inspector__glyph" style={{ color: segmentColors[segment.type] }}>
              {SEGMENT_GLYPHS[segment.type]}
            </span>
            <span className="inspector__title">
              <strong>{t(`segment.${segment.type}`)}</strong>
              <span className="inspector__id">{segment.id}</span>
            </span>
          </header>
          {RICH_TEXT_TYPES.has(segment.type) && <FormatGroup colors={colors} t={t} {...formatting} />}
          <SegmentFields segment={segment} dir={dir} colors={colors} t={t} onPatch={(patch) => onPatch(segment.id!, patch)} />
          <Group title={t('insp.note')} advanced>
            <Field
              label={t('insp.noteLabel')}
              value={segment.note ?? ''}
              multiline
              rows={2}
              hint={t('insp.noteHint')}
              onChange={(note) => onPatch(segment.id!, { note: note || undefined })}
            />
          </Group>
        </>
      ) : (
        <>
          <header className="inspector__head">
            <span className="inspector__glyph" style={{ color: 'var(--primary)' }}>
              {SEGMENT_GLYPHS['cover']}
            </span>
            <span className="inspector__title">
              <strong>{t('insp.docTitle')}</strong>
              <span className="inspector__id">{t('insp.docHint')}</span>
            </span>
          </header>
          <Group title={t('insp.docCover')}>
            <Field label={t('insp.title')} value={doc.meta.title} onChange={(title) => onPatchMeta({ title })} />
            <Field label={t('insp.subtitle')} value={doc.meta.subtitle ?? ''} onChange={(subtitle) => onPatchMeta({ subtitle })} />
            <Field label={t('insp.eyebrow')} value={doc.meta.eyebrow ?? ''} onChange={(eyebrow) => onPatchMeta({ eyebrow })} />
            <div className="row__grid">
              <Field label={t('insp.date')} value={doc.meta.date ?? ''} onChange={(date) => onPatchMeta({ date })} />
              <Field label={t('insp.author')} value={doc.meta.author ?? ''} onChange={(author) => onPatchMeta({ author })} />
            </div>
          </Group>
          <Group title={t('insp.running')}>
            <Field
              label={t('insp.headerText')}
              value={doc.meta.headerText ?? ''}
              placeholder={t('insp.headerHint')}
              onChange={(headerText) => onPatchMeta({ headerText })}
            />
            <Field
              label={t('insp.footerText')}
              value={doc.meta.footerText ?? ''}
              placeholder={t('insp.footerHint')}
              onChange={(footerText) => onPatchMeta({ footerText })}
            />
          </Group>
          <Group title={t('insp.language')} advanced>
            <Choice
              label={t('insp.docLanguage')}
              columns={2}
              value={doc.meta.language ?? 'tr'}
              options={documentLanguages.map((language) => ({ value: language.code as string, label: language.name }))}
              onChange={(language) => onPatchMeta({ language })}
            />
            <p className="hint">{t('insp.docLanguageHint')}</p>
          </Group>
        </>
      )}
    </aside>
  );
}

type FieldsProps = {
  segment: Segment;
  dir: string;
  colors: ColorTokens;
  t: Translate;
  onPatch: (patch: Record<string, unknown>) => void;
};

const CALLOUT_TOKENS: Record<(typeof calloutVariants)[number], keyof ColorTokens> = {
  info: 'primaryAlt',
  warning: 'accentText',
  success: 'success',
  danger: 'danger',
  note: 'note',
};

function alignOptions(t: Translate): ChoiceOption<(typeof alignments)[number]>[] {
  return [
    { value: 'left', label: t('align.left'), preview: <Align to="left" /> },
    { value: 'center', label: t('align.center'), preview: <Align to="center" /> },
    { value: 'right', label: t('align.right'), preview: <Align to="right" /> },
  ];
}

// --- list helpers -----------------------------------------------------------

function replaceAt<T>(items: readonly T[], index: number, value: T): T[] {
  const copy = [...items];
  copy[index] = value;
  return copy;
}

function removeAt<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, i) => i !== index);
}

/** Moves one entry by `delta` places; out-of-range moves leave the list alone. */
function moveAt<T>(items: readonly T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return [...items];
  const copy = [...items];
  const [moved] = copy.splice(index, 1);
  copy.splice(target, 0, moved!);
  return copy;
}

function SegmentFields({ segment, dir, colors, t, onPatch }: FieldsProps): JSX.Element {
  switch (segment.type) {
    case 'cover':
      return (
        <Group title={t('cover.group')}>
          <Field
            label={t('cover.eyebrow')}
            value={segment.eyebrow ?? ''}
            placeholder={t('insp.fromMeta')}
            onChange={(eyebrow) => onPatch({ eyebrow: eyebrow || undefined })}
          />
          <Field
            label={t('cover.title')}
            value={segment.title ?? ''}
            placeholder={t('insp.fromMeta')}
            onChange={(title) => onPatch({ title: title || undefined })}
          />
          <Field
            label={t('cover.subtitle')}
            value={segment.subtitle ?? ''}
            placeholder={t('insp.fromMeta')}
            onChange={(subtitle) => onPatch({ subtitle: subtitle || undefined })}
          />
        </Group>
      );

    case 'section':
      return (
        <Group title={t('section.group')}>
          <Field label={t('insp.title')} value={segment.title} onChange={(title) => onPatch({ title })} />
          <NumberField
            label={t('section.number')}
            value={segment.number}
            placeholder={t('section.numberPlaceholder')}
            hint={t('section.numberHint')}
            onChange={(number) => onPatch({ number })}
          />
        </Group>
      );

    case 'subheading':
      return (
        <Group title={t('subheading.group')}>
          <Field label={t('insp.text')} value={segment.text} onChange={(text) => onPatch({ text })} />
        </Group>
      );

    case 'paragraph':
      return (
        <>
          <Group title={t('paragraph.group')}>
            <Field
              label={t('insp.text')}
              value={segment.text}
              multiline
              rows={5}
              hint={t('insp.markupHint')}
              onChange={(text) => onPatch({ text })}
            />
          </Group>
          <Group title={t('insp.appearance')} advanced>
            <Choice
              label={t('insp.align')}
              value={segment.align ?? 'left'}
              options={alignOptions(t)}
              onChange={(align) => onPatch({ align: align === 'left' ? undefined : align })}
            />
            <Toggle
              label={t('paragraph.lead')}
              hint={t('paragraph.leadHint')}
              checked={segment.lead ?? false}
              onChange={(lead) => onPatch({ lead: lead || undefined })}
            />
          </Group>
        </>
      );

    case 'callout':
      return (
        <Group title={t('callout.group')}>
          <Choice
            label={t('callout.kind')}
            columns={5}
            value={segment.variant}
            options={calloutVariants.map<ChoiceOption<(typeof calloutVariants)[number]>>((variant) => ({
              value: variant,
              label: t(`callout.${variant}`),
              preview: <span className="chip" style={{ background: colors[CALLOUT_TOKENS[variant]] }} />,
            }))}
            onChange={(variant) => onPatch({ variant })}
          />
          <Field
            label={t('callout.title')}
            value={segment.title ?? ''}
            placeholder={t('callout.optional')}
            onChange={(title) => onPatch({ title: title || undefined })}
          />
          <Field label={t('insp.text')} value={segment.text} multiline onChange={(text) => onPatch({ text })} />
        </Group>
      );

    case 'list':
      return (
        <Group title={t('list.group')}>
          <Choice
            label={t('list.format')}
            columns={2}
            value={segment.ordered ? 'ordered' : 'bullet'}
            options={[
              { value: 'bullet', label: t('list.bullet'), preview: <span className="chip chip--text">•</span> },
              { value: 'ordered', label: t('list.ordered'), preview: <span className="chip chip--text">1.</span> },
            ]}
            onChange={(kind) => onPatch({ ordered: kind === 'ordered' || undefined })}
          />
          {segment.items.map((item, index) => (
            <div className="row" key={index}>
              <Field
                label={t('list.item', { n: index + 1 })}
                value={item}
                onChange={(value) => onPatch({ items: replaceAt(segment.items, index, value) })}
              />
              <RowTools
                index={index}
                count={segment.items.length}
                t={t}
                onMove={(delta) => onPatch({ items: moveAt(segment.items, index, delta) })}
                onRemove={() => onPatch({ items: removeAt(segment.items, index) })}
              />
            </div>
          ))}
          <AddRow label={t('list.addItem')} onClick={() => onPatch({ items: [...segment.items, ''] })} />
        </Group>
      );

    case 'steps':
      return (
        <>
          <Group title={t('steps.group')}>
            {segment.items.map((item, index) => (
              <div className="row" key={index}>
                <Field
                  label={t('steps.title', { n: (segment.start ?? 1) + index })}
                  value={item.title}
                  onChange={(title) => onPatch({ items: replaceAt(segment.items, index, { ...item, title }) })}
                />
                <Field
                  label={t('steps.desc')}
                  value={item.desc ?? ''}
                  multiline
                  rows={2}
                  onChange={(desc) => onPatch({ items: replaceAt(segment.items, index, { ...item, desc }) })}
                />
                <RowTools
                  index={index}
                  count={segment.items.length}
                  t={t}
                  onMove={(delta) => onPatch({ items: moveAt(segment.items, index, delta) })}
                  onRemove={() => onPatch({ items: removeAt(segment.items, index) })}
                />
              </div>
            ))}
            <AddRow
              label={t('steps.add')}
              onClick={() => onPatch({ items: [...segment.items, { title: 'Yeni adım', desc: '' }] })}
            />
          </Group>
          <Group title={t('insp.appearance')} advanced>
            <NumberField
              label={t('steps.start')}
              value={segment.start}
              placeholder="1"
              hint={t('steps.startHint')}
              onChange={(start) => onPatch({ start })}
            />
          </Group>
        </>
      );

    case 'keyValueTable':
      return (
        <>
          <Group title={t('kv.group')}>
            {segment.rows.map((row, index) => (
              <div className="row row--pair" key={index}>
                <Field
                  label={t('kv.left')}
                  value={row[0]}
                  onChange={(key) => onPatch({ rows: replaceAt(segment.rows, index, [key, row[1]]) })}
                />
                <Field
                  label={t('kv.right')}
                  value={row[1]}
                  onChange={(value) => onPatch({ rows: replaceAt(segment.rows, index, [row[0], value]) })}
                />
                <RowTools
                  index={index}
                  count={segment.rows.length}
                  t={t}
                  onMove={(delta) => onPatch({ rows: moveAt(segment.rows, index, delta) })}
                  onRemove={() => onPatch({ rows: removeAt(segment.rows, index) })}
                />
              </div>
            ))}
            <AddRow label={t('kv.addRow')} onClick={() => onPatch({ rows: [...segment.rows, ['', '']] })} />
          </Group>
          <Group title={t('kv.headers')} advanced>
            <Toggle
              label={t('kv.headersOn')}
              checked={segment.headers !== undefined}
              onChange={(on) => onPatch({ headers: on ? ['Başlık', 'Değer'] : undefined })}
            />
            {segment.headers && (
              <div className="row__grid">
                <Field
                  label={t('kv.leftHeader')}
                  value={segment.headers[0]}
                  onChange={(left) => onPatch({ headers: [left, segment.headers![1]] })}
                />
                <Field
                  label={t('kv.rightHeader')}
                  value={segment.headers[1]}
                  onChange={(right) => onPatch({ headers: [segment.headers![0], right] })}
                />
              </div>
            )}
          </Group>
        </>
      );

    case 'table':
      return (
        <>
          <Group title={t('table.columns')}>
            {segment.columns.map((column, index) => (
              <div className="row" key={index}>
                <Field
                  label={t('table.columnTitle', { n: index + 1 })}
                  value={column.label}
                  onChange={(label) => onPatch({ columns: replaceAt(segment.columns, index, { ...column, label }) })}
                />
                <div className="row__grid">
                  <Field
                    label={t('table.width')}
                    value={column.width ?? ''}
                    placeholder={t('insp.auto')}
                    hint={t('table.widthHint')}
                    onChange={(width) =>
                      onPatch({ columns: replaceAt(segment.columns, index, { ...column, width: width || undefined }) })
                    }
                  />
                  <Choice
                    label={t('insp.align')}
                    value={column.align ?? 'left'}
                    options={alignOptions(t)}
                    onChange={(align) =>
                      onPatch({
                        columns: replaceAt(segment.columns, index, { ...column, align: align === 'left' ? undefined : align }),
                      })
                    }
                  />
                </div>
                <Toggle
                  label={t('table.mono')}
                  checked={column.mono ?? false}
                  onChange={(mono) =>
                    onPatch({ columns: replaceAt(segment.columns, index, { ...column, mono: mono || undefined }) })
                  }
                />
                <RowTools
                  index={index}
                  count={segment.columns.length}
                  t={t}
                  onMove={(delta) =>
                    // Cells travel with their column so rows stay aligned.
                    onPatch({
                      columns: moveAt(segment.columns, index, delta),
                      rows: segment.rows.map((row) => moveAt(row, index, delta)),
                    })
                  }
                  onRemove={() =>
                    onPatch({
                      columns: removeAt(segment.columns, index),
                      rows: segment.rows.map((row) => removeAt(row, index)),
                    })
                  }
                />
              </div>
            ))}
            <AddRow
              label={t('table.addColumn')}
              onClick={() =>
                onPatch({
                  columns: [...segment.columns, { label: `Sütun ${segment.columns.length + 1}` }],
                  rows: segment.rows.map((row) => [...row, '']),
                })
              }
            />
          </Group>
          <Group title={t('table.rows')}>
            <p className="hint">{t('table.rowsHint')}</p>
            {segment.rows.map((row, index) => (
              <div className="row row--slim" key={index}>
                <span className="row__title">
                  <span className="row__index">{index + 1}</span>
                  {row.find((cell) => cell.trim()) || t('table.emptyRow')}
                </span>
                <RowTools
                  index={index}
                  count={segment.rows.length}
                  min={0}
                  t={t}
                  onMove={(delta) => onPatch({ rows: moveAt(segment.rows, index, delta) })}
                  onRemove={() => onPatch({ rows: removeAt(segment.rows, index) })}
                />
              </div>
            ))}
            <AddRow
              label={t('table.addRow')}
              onClick={() => onPatch({ rows: [...segment.rows, segment.columns.map(() => '')] })}
            />
          </Group>
        </>
      );

    case 'chart':
      return <ChartFields segment={segment} colors={colors} t={t} onPatch={onPatch} />;

    case 'image':
      return (
        <>
          <Group title={t('image.group')}>
            <button
              type="button"
              className="button button--primary big-button"
              onClick={() => {
                void window.raporgo.addAsset(dir).then((src) => src && onPatch({ src }));
              }}
            >
              {t('image.pick')}
            </button>
            <p className="hint">{segment.src || t('image.none')}</p>
            <Field
              label={t('image.caption')}
              value={segment.caption ?? ''}
              onChange={(caption) => onPatch({ caption: caption || undefined })}
            />
          </Group>
          <Group title={t('insp.appearance')} advanced>
            <Choice
              label={t('image.width')}
              columns={3}
              value={segment.width ?? 'full'}
              options={[
                { value: 'full', label: t('image.full'), preview: <Bar width="100%" /> },
                { value: '70%', label: t('image.narrow'), preview: <Bar width="70%" /> },
                { value: '45%', label: t('image.small'), preview: <Bar width="45%" /> },
              ]}
              onChange={(width) => onPatch({ width: width === 'full' ? undefined : width })}
            />
            <Toggle
              label={t('image.border')}
              checked={segment.border !== false}
              onChange={(border) => onPatch({ border: border ? undefined : false })}
            />
          </Group>
        </>
      );

    case 'code':
      return (
        <Group title={t('code.group')}>
          <Field
            label={t('code.content')}
            value={segment.content}
            multiline
            rows={8}
            onChange={(content) => onPatch({ content })}
          />
          <Field
            label={t('code.language')}
            value={segment.language ?? ''}
            placeholder={t('code.languagePlaceholder')}
            hint={t('code.languageHint')}
            onChange={(language) => onPatch({ language: language || undefined })}
          />
        </Group>
      );

    case 'signature':
      return (
        <Group title={t('sig.group')}>
          {segment.parties.map((party, index) => (
            <div className="row" key={index}>
              <div className="row__grid">
                <Field
                  label={t('sig.name', { n: index + 1 })}
                  value={party.name}
                  onChange={(name) => onPatch({ parties: replaceAt(segment.parties, index, { ...party, name }) })}
                />
                <Field
                  label={t('sig.title')}
                  value={party.title ?? ''}
                  placeholder={t('callout.optional')}
                  onChange={(title) => onPatch({ parties: replaceAt(segment.parties, index, { ...party, title: title || undefined }) })}
                />
              </div>
              <RowTools
                index={index}
                count={segment.parties.length}
                t={t}
                onMove={(delta) => onPatch({ parties: moveAt(segment.parties, index, delta) })}
                onRemove={() => onPatch({ parties: removeAt(segment.parties, index) })}
              />
            </div>
          ))}
          {segment.parties.length < 4 && (
            <AddRow label={t('sig.add')} onClick={() => onPatch({ parties: [...segment.parties, { name: '' }] })} />
          )}
          <Toggle
            label={t('sig.date')}
            hint={t('sig.dateHint')}
            checked={segment.date ?? false}
            onChange={(date) => onPatch({ date: date || undefined })}
          />
        </Group>
      );

    case 'spacer':
      return (
        <Group title={t('spacer.group')}>
          <Choice
            label={t('spacer.size')}
            columns={3}
            value={segment.size}
            options={[
              { value: 'sm', label: t('spacer.sm'), preview: <Gap height={4} /> },
              { value: 'md', label: t('spacer.md'), preview: <Gap height={9} /> },
              { value: 'lg', label: t('spacer.lg'), preview: <Gap height={15} /> },
            ]}
            onChange={(size) => onPatch({ size })}
          />
        </Group>
      );

    case 'pageBreak':
      return (
        <div className="inspector__empty">
          <p>{t('pageBreak.title')}</p>
          <span>{t('pageBreak.hint')}</span>
        </div>
      );
  }
}

// --- chart ------------------------------------------------------------------

function ChartFields({
  segment,
  colors,
  t,
  onPatch,
}: {
  segment: Extract<Segment, { type: 'chart' }>;
  colors: ColorTokens;
  t: Translate;
  onPatch: (patch: Record<string, unknown>) => void;
}): JSX.Element {
  const multiSeries = segment.chart === 'stackedBar' || segment.chart === 'radar';
  const series = segment.series ?? [];
  const patchDatum = (index: number, patch: Record<string, unknown>): void =>
    onPatch({ data: replaceAt(segment.data, index, { ...segment.data[index]!, ...patch }) });

  return (
    <>
      <Group title={t('chart.kind')}>
        <Choice
          label={t('chart.kindLabel')}
          columns={4}
          value={segment.chart}
          options={chartKinds.map<ChoiceOption<(typeof chartKinds)[number]>>((kind) => ({
            value: kind,
            label: t(`chartKind.${kind}`),
            hint: t(`chartHint.${kind}`),
            preview: CHART_GLYPHS[kind],
          }))}
          onChange={(kind) => onPatch({ chart: kind })}
        />
        <p className="hint">{t(`chartHint.${segment.chart}`)}</p>
      </Group>

      <Group title={t('chart.headings')}>
        <Field label={t('chart.title')} value={segment.title ?? ''} onChange={(title) => onPatch({ title: title || undefined })} />
        <Field
          label={t('chart.subtitle')}
          value={segment.subtitle ?? ''}
          placeholder={t('chart.subtitlePlaceholder')}
          onChange={(subtitle) => onPatch({ subtitle: subtitle || undefined })}
        />
        <Field
          label={t('chart.caption')}
          value={segment.caption ?? ''}
          onChange={(caption) => onPatch({ caption: caption || undefined })}
        />
      </Group>

      {multiSeries && (
        <Group title={t('chart.series')}>
          <p className="hint">{t('chart.seriesHint')}</p>
          {series.map((entry, index) => (
            <div className="row" key={index}>
              <Field
                label={t('chart.seriesName', { n: index + 1 })}
                value={entry.name}
                onChange={(name) => onPatch({ series: replaceAt(series, index, { ...entry, name }) })}
              />
              <ColorPicker
                label={t('chart.color')}
                value={entry.color}
                colors={colors}
                onChange={(color) => onPatch({ series: replaceAt(series, index, { ...entry, color }) })}
              />
              <RowTools
                index={index}
                count={series.length}
                t={t}
                onMove={(delta) =>
                  // Every datum's values follow the series order.
                  onPatch({
                    series: moveAt(series, index, delta),
                    data: segment.data.map((datum) =>
                      datum.values ? { ...datum, values: moveAt(datum.values, index, delta) } : datum,
                    ),
                  })
                }
                onRemove={() =>
                  onPatch({
                    series: removeAt(series, index),
                    data: segment.data.map((datum) =>
                      datum.values ? { ...datum, values: removeAt(datum.values, index) } : datum,
                    ),
                  })
                }
              />
            </div>
          ))}
          <AddRow label={t('chart.addSeries')} onClick={() => onPatch({ series: [...series, { name: 'Yeni seri' }] })} />
        </Group>
      )}

      <Group title={t('chart.data')}>
        {segment.data.map((datum, index) => (
          <div className="row" key={index}>
            {multiSeries ? (
              <>
                <Field label={t('chart.datumName', { n: index + 1 })} value={datum.label} onChange={(label) => patchDatum(index, { label })} />
                <div className="row__grid">
                  {(series.length ? series : [{ name: t('chart.valueGeneric') }]).map((entry, seriesIndex) => (
                    <NumberField
                      key={seriesIndex}
                      label={entry.name}
                      value={datum.values?.[seriesIndex]}
                      onChange={(value) => {
                        const values = [...(datum.values ?? [])];
                        values[seriesIndex] = value ?? 0;
                        patchDatum(index, { values });
                      }}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="row__grid">
                <Field label={t('chart.datumName', { n: index + 1 })} value={datum.label} onChange={(label) => patchDatum(index, { label })} />
                <NumberField label={t('chart.value')} value={datum.value} onChange={(value) => patchDatum(index, { value })} />
              </div>
            )}

            {segment.chart === 'scatter' && (
              <NumberField label={t('chart.x')} value={datum.x} onChange={(x) => patchDatum(index, { x })} />
            )}

            <div className="row__grid">
              <Field
                label={t('chart.text')}
                value={datum.text ?? ''}
                placeholder={t('chart.textPlaceholder')}
                onChange={(text) => patchDatum(index, { text: text || undefined })}
              />
              <Field
                label={t('chart.datumNote')}
                value={datum.note ?? ''}
                onChange={(note) => patchDatum(index, { note: note || undefined })}
              />
            </div>

            {!multiSeries && (
              <ColorPicker
                label={t('chart.color')}
                value={datum.color}
                colors={colors}
                onChange={(color) => patchDatum(index, { color })}
              />
            )}

            <RowTools
              index={index}
              count={segment.data.length}
              t={t}
              onMove={(delta) => onPatch({ data: moveAt(segment.data, index, delta) })}
              onRemove={() => onPatch({ data: removeAt(segment.data, index) })}
            />
          </div>
        ))}
        <AddRow
          label={t('chart.addDatum')}
          onClick={() =>
            onPatch({
              data: [...segment.data, multiSeries ? { label: 'Yeni', values: [] } : { label: 'Yeni', value: 0 }],
            })
          }
        />
      </Group>

      <Group title={t('chart.axis')} advanced>
        <div className="row__grid">
          <Field
            label={t('chart.unit')}
            value={segment.unit ?? ''}
            placeholder={t('chart.unitPlaceholder')}
            onChange={(unit) => onPatch({ unit: unit || undefined })}
          />
          <NumberField
            label={t('chart.max')}
            value={segment.max}
            placeholder={t('insp.auto')}
            onChange={(max) => onPatch({ max })}
          />
        </div>
        <p className="hint">{t('chart.maxHint')}</p>
        {segment.chart === 'gauge' && (
          <NumberField
            label={t('chart.target')}
            value={segment.target}
            placeholder={t('chart.none')}
            onChange={(target) => onPatch({ target })}
          />
        )}
        {segment.chart === 'bar' && (
          <Choice
            label={t('chart.scale')}
            columns={2}
            value={segment.scale}
            options={[
              { value: 'linear', label: t('chart.linear'), hint: t('chart.linearHint') },
              { value: 'log', label: t('chart.log'), hint: t('chart.logHint') },
            ]}
            onChange={(scale) => onPatch({ scale })}
          />
        )}
        {(segment.chart === 'line' || segment.chart === 'area') && (
          <div className="row__grid">
            <Field
              label={t('chart.markerAt')}
              value={segment.marker?.at ?? ''}
              placeholder={t('chart.markerAtPlaceholder')}
              onChange={(at) => onPatch({ marker: at ? { at, label: segment.marker?.label ?? '' } : undefined })}
            />
            <Field
              label={t('chart.markerLabel')}
              value={segment.marker?.label ?? ''}
              onChange={(label) => onPatch({ marker: segment.marker ? { ...segment.marker, label } : undefined })}
            />
          </div>
        )}
      </Group>
    </>
  );
}

// --- formatting -------------------------------------------------------------

/**
 * Bold, italic, code and colour for the text selected on the page. The
 * buttons refuse focus on mousedown so the preview's selection survives the
 * click; the command then runs against that selection.
 */
function FormatGroup({
  colors,
  t,
  enabled,
  apply,
}: {
  colors: ColorTokens;
  t: Translate;
  enabled: boolean;
  apply: (action: FormatAction) => void;
}): JSX.Element {
  const keep = (event: { preventDefault(): void }): void => event.preventDefault();
  const act = (action: FormatAction) => () => apply(action);

  return (
    <Group title={t('fmt.group')}>
      <div className={`fmt${enabled ? '' : ' fmt--idle'}`}>
        <div className="fmt__row">
          <button type="button" className="fmt__b" title={t('fmt.bold')} disabled={!enabled} onMouseDown={keep} onClick={act({ kind: 'bold' })}>
            {t('fmt.boldMark')}
          </button>
          <button type="button" className="fmt__i" title={t('fmt.italic')} disabled={!enabled} onMouseDown={keep} onClick={act({ kind: 'italic' })}>
            {t('fmt.italicMark')}
          </button>
          <button type="button" className="fmt__code" title={t('fmt.code')} disabled={!enabled} onMouseDown={keep} onClick={act({ kind: 'code' })}>
            {'<>'}
          </button>
          <span className="fmt__divider" />
          {COLOR_ROLES.map((role) => (
            <button
              key={role.token}
              type="button"
              className="fmt__swatch"
              title={t(role.label)}
              style={{ background: colors[role.token] }}
              disabled={!enabled}
              onMouseDown={keep}
              onClick={act({ kind: 'color', role: role.token, hex: colors[role.token] })}
            />
          ))}
          <label className={`fmt__custom${enabled ? '' : ' fmt__custom--off'}`} title={t('color.custom')} onMouseDown={keep}>
            <input
              type="color"
              defaultValue={colors.primary}
              disabled={!enabled}
              onChange={(event) => apply({ kind: 'color', role: null, hex: event.target.value })}
            />
          </label>
          <button type="button" className="fmt__clear" title={t('fmt.clear')} disabled={!enabled} onMouseDown={keep} onClick={act({ kind: 'clear' })}>
            ×
          </button>
        </div>
        <p className="hint">{enabled ? t('fmt.ready') : t('fmt.hint')}</p>
      </div>
    </Group>
  );
}

// --- small pieces -----------------------------------------------------------

function AddRow({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
  return (
    <button type="button" className="add-row" onClick={onClick}>
      + {label}
    </button>
  );
}

/**
 * Reorder and remove controls for one entry of a repeating list. Removing
 * is refused below `min` entries (one, unless the list may be empty).
 */
function RowTools({
  index,
  count,
  min = 1,
  t,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  min?: number;
  t: Translate;
  onMove: (delta: number) => void;
  onRemove: () => void;
}): JSX.Element {
  return (
    <span className="row__tools">
      <button type="button" title={t('row.up')} disabled={index === 0} onClick={() => onMove(-1)}>
        ▲
      </button>
      <button type="button" title={t('row.down')} disabled={index === count - 1} onClick={() => onMove(1)}>
        ▼
      </button>
      <button type="button" className="row__tools-remove" title={t('row.remove')} disabled={count <= min} onClick={onRemove}>
        ×
      </button>
    </span>
  );
}

function Align({ to }: { to: 'left' | 'center' | 'right' }): JSX.Element {
  const align = to === 'left' ? 'flex-start' : to === 'right' ? 'flex-end' : 'center';
  return (
    <span className="align-preview" style={{ alignItems: align }}>
      <span style={{ width: '100%' }} />
      <span style={{ width: '62%' }} />
      <span style={{ width: '80%' }} />
    </span>
  );
}

function Bar({ width }: { width: string }): JSX.Element {
  return (
    <span className="align-preview" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ width, height: 14 }} />
    </span>
  );
}

function Gap({ height }: { height: number }): JSX.Element {
  return (
    <span className="align-preview" style={{ alignItems: 'stretch', justifyContent: 'space-between' }}>
      <span style={{ width: '100%' }} />
      <span style={{ width: '100%', height, background: 'transparent' }} />
      <span style={{ width: '100%' }} />
    </span>
  );
}
