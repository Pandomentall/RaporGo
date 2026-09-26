import type { Segment } from '@raporgo/core';
import { renderChart, withChartLocale } from '../chart/index.js';
import { escapeHtml, renderInline, renderInlineBlock } from '../inline.js';
import type { RenderContext } from '../types.js';
import { dateLabel } from './css.js';
import { labelsFor } from './labels.js';

/**
 * The segment markup every template shares. A template is a stylesheet over
 * this HTML — the class names are the contract, and keeping the markup in one
 * place is what lets the editor's in-place editing work the same under every
 * template.
 *
 * Every segment carries `data-segment-id` so the desktop editor can map a
 * click in the paginated preview back to the segment in the JSON, and so the
 * preview can scroll to whatever the editor has selected.
 *
 * Text-bearing elements additionally carry `data-edit`, a path into the
 * segment (`text`, `items.2.title`, `rows.0.1`). That single attribute is what
 * lets the editor make the preview itself editable without knowing anything
 * about the template.
 */
function open(segment: Segment, className: string, extra = ''): string {
  return `<div class="rg-segment ${className}" data-segment-id="${escapeHtml(segment.id!)}" data-segment-type="${segment.type}"${extra}>`;
}

/** Marks an element as editable, bound to `path` inside the segment. */
function edit(path: string, kind: 'rich' | 'plain' = 'rich'): string {
  return ` data-edit="${path}" data-edit-kind="${kind}"`;
}

export function renderSegment(segment: Segment, ctx: RenderContext): string {
  switch (segment.type) {
    case 'cover': {
      const eyebrow = segment.eyebrow ?? ctx.doc.meta.eyebrow;
      const title = segment.title ?? ctx.doc.meta.title;
      const subtitle = segment.subtitle ?? ctx.doc.meta.subtitle;
      return [
        open(segment, 'rg-cover'),
        eyebrow ? `<div class="rg-cover__eyebrow"${edit('eyebrow')}>${renderInline(eyebrow)}</div>` : '',
        `<div class="rg-cover__title"${edit('title')}>${renderInline(title)}</div>`,
        subtitle ? `<div class="rg-cover__subtitle"${edit('subtitle')}>${renderInline(subtitle)}</div>` : '',
        '</div>',
      ].join('');
    }

    case 'section': {
      const number = ctx.sectionNumbers.get(segment.id!);
      return [
        open(segment, 'rg-section'),
        number === undefined ? '' : `<div class="rg-section__badge">${number}</div>`,
        `<div class="rg-section__title"${edit('title')}>${renderInline(segment.title)}</div>`,
        '</div>',
      ].join('');
    }

    case 'subheading':
      return `${open(segment, 'rg-subheading', edit('text'))}${renderInline(segment.text)}</div>`;

    case 'paragraph': {
      // The paragraph that opens a section is marked, because a template may
      // want to set it apart (a drop cap, no indent) and Paged.js mangles a
      // `.rg-section + .rg-paragraph::first-letter` selector on its own.
      const index = ctx.doc.segments.findIndex((s) => s.id === segment.id);
      const opening = index > 0 && ctx.doc.segments[index - 1]?.type === 'section';
      const classes = ['rg-paragraph', segment.lead ? 'rg-paragraph--lead' : '', opening ? 'rg-paragraph--opening' : '']
        .filter(Boolean)
        .join(' ');
      const style = segment.align ? ` style="text-align:${segment.align}"` : '';
      return `${open(segment, classes, style + edit('text'))}${renderInlineBlock(segment.text)}</div>`;
    }

    case 'list': {
      const tag = segment.ordered ? 'ol' : 'ul';
      const items = segment.items
        .map((item, index) => `<li${edit(`items.${index}`)}>${renderInline(item)}</li>`)
        .join('');
      return `${open(segment, 'rg-list-wrap')}<${tag} class="rg-list">${items}</${tag}></div>`;
    }

    case 'keyValueTable': {
      const head = segment.headers
        ? `<thead><tr><th${edit('headers.0')}>${escapeHtml(segment.headers[0])}</th><th${edit('headers.1')}>${escapeHtml(segment.headers[1])}</th></tr></thead>`
        : '';
      const body = segment.rows
        .map(
          ([key, value], row) =>
            `<tr><td${edit(`rows.${row}.0`)}>${renderInline(key)}</td><td${edit(`rows.${row}.1`)}>${renderInline(value)}</td></tr>`,
        )
        .join('');
      return `${open(segment, 'rg-table-wrap')}<table class="rg-table rg-table--kv">${head}<tbody>${body}</tbody></table></div>`;
    }

    case 'table': {
      const head = segment.columns
        .map((column, index) => {
          const style = [column.width ? `width:${column.width}` : '', column.align ? `text-align:${column.align}` : '']
            .filter(Boolean)
            .join(';');
          return `<th${style ? ` style="${style}"` : ''}${edit(`columns.${index}.label`)}>${escapeHtml(column.label)}</th>`;
        })
        .join('');
      const body = segment.rows
        .map((row, rowIndex) => {
          const cells = row
            .map((cell, index) => {
              const column = segment.columns[index];
              const classes = column?.mono ? ' class="rg-mono"' : '';
              const style = column?.align ? ` style="text-align:${column.align}"` : '';
              return `<td${classes}${style}${edit(`rows.${rowIndex}.${index}`)}>${renderInline(cell)}</td>`;
            })
            .join('');
          return `<tr>${cells}</tr>`;
        })
        .join('');
      return `${open(segment, 'rg-table-wrap')}<table class="rg-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    }

    case 'steps': {
      const start = segment.start ?? 1;
      const items = segment.items
        .map((item, index) => {
          const desc = item.desc
            ? `<div class="rg-step__desc"${edit(`items.${index}.desc`)}>${renderInline(item.desc)}</div>`
            : '';
          return [
            '<div class="rg-step">',
            `<div class="rg-step__number">${start + index}</div>`,
            `<div class="rg-step__body"><div class="rg-step__title"${edit(`items.${index}.title`)}>${renderInline(item.title)}</div>${desc}</div>`,
            '</div>',
          ].join('');
        })
        .join('');
      return `${open(segment, 'rg-steps')}${items}</div>`;
    }

    case 'callout': {
      const title = segment.title
        ? `<div class="rg-callout__title"${edit('title')}>${renderInline(segment.title)}</div>`
        : '';
      return [
        open(segment, `rg-callout rg-callout--${segment.variant}`),
        title,
        `<div class="rg-callout__text"${edit('text')}>${renderInlineBlock(segment.text)}</div>`,
        '</div>',
      ].join('');
    }

    case 'image': {
      const framed = segment.border === false ? '' : ' rg-figure--framed';
      const style = segment.width ? ` style="width:${segment.width}"` : '';
      const caption = segment.caption
        ? `<figcaption${edit('caption')}>${renderInline(segment.caption)}</figcaption>`
        : '';
      const url = ctx.assetUrl(segment.src);
      const body =
        url === null
          ? `<div class="rg-figure__missing">${escapeHtml(
              segment.src.trim() === '' ? labelsFor(ctx.doc).imageNone : `${labelsFor(ctx.doc).imageMissing}: ${segment.src}`,
            )}</div>`
          : `<img src="${escapeHtml(url)}" alt="${escapeHtml(segment.caption ?? '')}">`;
      return [
        `<figure class="rg-segment rg-figure${framed}" data-segment-id="${escapeHtml(segment.id!)}" data-segment-type="image"${style}>`,
        body,
        caption,
        '</figure>',
      ].join('');
    }

    case 'chart': {
      // Title and source line are HTML rather than SVG text so they can be
      // edited in place like every other heading; the SVG holds only data.
      const head =
        segment.title || segment.subtitle
          ? [
              '<div class="rg-chart__head">',
              segment.title ? `<div class="rg-chart__title"${edit('title', 'plain')}>${escapeHtml(segment.title)}</div>` : '',
              segment.subtitle
                ? `<div class="rg-chart__sub"${edit('subtitle', 'plain')}>${escapeHtml(segment.subtitle)}</div>`
                : '',
              '</div>',
            ].join('')
          : '';
      const caption = segment.caption
        ? `<figcaption${edit('caption')}>${renderInline(segment.caption)}</figcaption>`
        : '';
      return [
        `<figure class="rg-segment rg-chart" data-segment-id="${escapeHtml(segment.id!)}" data-segment-type="chart">`,
        head,
        withChartLocale({ tag: ctx.doc.meta.language ?? 'tr', target: labelsFor(ctx.doc).target }, () =>
          renderChart(segment, ctx.colors),
        ),
        caption,
        '</figure>',
      ].join('');
    }

    case 'code':
      return `${open(segment, 'rg-code', edit('content', 'plain'))}${escapeHtml(segment.content)}</div>`;

    case 'signature': {
      const parties = segment.parties
        .map((party, index) =>
          [
            '<div class="rg-signature">',
            '<div class="rg-signature__line"></div>',
            `<div class="rg-signature__name"${edit(`parties.${index}.name`, 'plain')}>${escapeHtml(party.name)}</div>`,
            party.title ? `<div class="rg-signature__title"${edit(`parties.${index}.title`, 'plain')}>${escapeHtml(party.title)}</div>` : '',
            '</div>',
          ].join(''),
        )
        .join('');
      const date = segment.date ? `<div class="rg-signature__date">${escapeHtml(dateLabel(ctx.doc))}: ____________________</div>` : '';
      return `${open(segment, 'rg-signatures')}${parties}${date}</div>`;
    }

    case 'pageBreak':
      return `${open(segment, 'rg-pagebreak')}</div>`;

    case 'spacer':
      return `${open(segment, `rg-spacer rg-spacer--${segment.size}`)}</div>`;
  }
}
