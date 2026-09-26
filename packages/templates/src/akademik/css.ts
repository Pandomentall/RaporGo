import { fontFaceCss, fontStacks } from '../fonts.js';
import { colorVariables } from '../tokens.js';
import type { RenderContext } from '../types.js';
import { cssString, figureLabel, pageCounter, sharedCss } from '../base/css.js';
import { labelsFor } from '../base/labels.js';

/**
 * `akademik` — the paper.
 *
 * Serif body, numbered headings, a lead paragraph set as an abstract,
 * figures and tables numbered by counters, a running title. Everything a
 * reviewer expects and nothing they would call decoration.
 */

const PAGE = { top: 57, right: 57, bottom: 57, left: 57 };
const SCALE = { base: 9.5, small: 8.5, caption: 9, segment: 10 };


export function stylesheet(ctx: RenderContext): string {
  const { colors, doc } = ctx;
  const { meta } = doc;
  const { abstract, table } = labelsFor(doc);
  const running = meta.headerText ?? meta.title;
  const byline = [meta.author, meta.date].filter(Boolean).join(' · ');

  return `
${fontFaceCss(['serif', 'mono'])}

:root {
${colorVariables(colors)}
  --rg-font-sans: ${fontStacks.serif};
  --rg-font-serif: ${fontStacks.serif};
  --rg-font-mono: ${fontStacks.mono};
  counter-reset: sec fig tbl;
}

@page {
  size: A4;
  margin: ${PAGE.top}pt ${PAGE.right}pt ${PAGE.bottom}pt ${PAGE.left}pt;
  @top-left { content: ${cssString(running)}; }
  @top-right { content: ${pageCounter(doc)}; }
}
@page :first { @top-left { content: none; } @top-right { content: none; } }

.pagedjs_margin-top { border-bottom: 0.4pt solid var(--rg-border); }
.pagedjs_first_page .pagedjs_margin-top { border-bottom: none; }
.pagedjs_margin-top-left, .pagedjs_margin-top-right {
  font-family: var(--rg-font-serif);
  font-size: 8.5pt;
  font-style: italic;
  color: var(--rg-muted);
  align-items: end;
  padding-bottom: 4pt;
}
.pagedjs_margin-top-right { font-style: normal; }

html { font-size: ${SCALE.base}pt; }
body {
  margin: 0;
  font-family: var(--rg-font-serif);
  font-size: 11pt;
  line-height: 1.5;
  color: var(--rg-ink);
  background: var(--rg-page);
  text-align: justify;
  hyphens: auto;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--rg-primary-alt); text-decoration: none; }

.rg-segment { margin: 0 0 ${SCALE.segment}pt; }
.rg-segment:last-child { margin-bottom: 0; }

/* --- title block ----------------------------------------------------------- */

.rg-cover { text-align: center; margin: 12pt 0 28pt; break-after: avoid; }
.rg-cover__eyebrow { font-size: 8.5pt; letter-spacing: 1.5pt; text-transform: uppercase; color: var(--rg-muted); margin-bottom: 12pt; }
.rg-cover__title { font-size: 19pt; font-weight: 700; line-height: 1.25; }
.rg-cover__subtitle { font-size: 12pt; font-style: italic; color: var(--rg-muted); margin-top: 6pt; }
.rg-cover::after { content: ${cssString(byline)}; display: block; font-size: 10pt; margin-top: 14pt; color: var(--rg-ink); }

/* --- abstract: the lead paragraph ------------------------------------------ */

.rg-paragraph--lead {
  font-size: 10pt;
  line-height: 1.45;
  margin: 0 28pt 20pt;
  padding: 10pt 0;
  border-top: 0.6pt solid var(--rg-ink);
  border-bottom: 0.6pt solid var(--rg-ink);
}
.rg-paragraph--lead::before { content: ${cssString(`${abstract}. `)}; font-weight: 700; }

/* --- numbered headings ----------------------------------------------------- */

.rg-section { display: flex; align-items: baseline; gap: 6pt; margin: 20pt 0 8pt; counter-increment: sec; counter-reset: sub; break-after: avoid; text-align: left; }
.rg-section:first-child { margin-top: 0; }
.rg-section__badge { font-size: 13pt; font-weight: 700; }
.rg-section__badge::after { content: "."; }
.rg-section__title { font-size: 13pt; font-weight: 700; }

.rg-subheading { font-size: 11pt; font-weight: 700; margin: 14pt 0 4pt; counter-increment: sub; break-after: avoid; text-align: left; }
.rg-subheading::before { content: counter(sec) "." counter(sub) " "; }

/* --- text: indented paragraphs, except the first after a heading ----------- */

.rg-paragraph { font-size: 11pt; text-indent: 16pt; }
.rg-section + .rg-paragraph, .rg-subheading + .rg-paragraph, .rg-cover + .rg-paragraph, .rg-paragraph--lead { text-indent: 0; }

.rg-list { padding-left: 22pt; margin: 0 0 ${SCALE.segment}pt; }
.rg-list li { margin-bottom: 2pt; }

/* --- tables: numbered, ruled the Chicago way ------------------------------- */

.rg-table-wrap { counter-increment: tbl; }
.rg-table-wrap::before { content: ${cssString(`${table} `)} counter(tbl); display: block; font-size: 9.5pt; font-weight: 700; margin-bottom: 4pt; text-align: left; }
.rg-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; text-align: left; border-top: 1pt solid var(--rg-ink); border-bottom: 1pt solid var(--rg-ink); }
.rg-table th { font-weight: 700; padding: 4pt 6pt; border-bottom: 0.5pt solid var(--rg-ink); }
.rg-table td { padding: 4pt 6pt; vertical-align: top; }
.rg-table--kv td:first-child { width: 140pt; font-weight: 700; }
.rg-table .rg-mono { font-family: var(--rg-font-mono); font-size: 8.5pt; }
.rg-table thead { display: table-header-group; }
.rg-table tr { break-inside: avoid; }

/* --- figures: numbered captions -------------------------------------------- */

.rg-figure, .rg-chart { counter-increment: fig; }
.rg-figure figcaption::before, .rg-chart figcaption::before { content: ${cssString(`${figureLabel(doc)} `)} counter(fig) ". "; font-weight: 700; font-style: normal; }

/* --- steps and callouts, quietly ------------------------------------------- */

.rg-steps { display: flex; flex-direction: column; gap: 5pt; }
.rg-step { display: flex; gap: 8pt; break-inside: avoid; text-align: left; }
.rg-step__number { flex: 0 0 18pt; font-weight: 700; }
.rg-step__number::after { content: "."; }
.rg-step__title { font-weight: 700; }
.rg-step__desc { color: var(--rg-muted); margin-top: 1pt; }

.rg-callout { margin: 0 20pt ${SCALE.segment}pt; padding: 0 0 0 12pt; border-left: 1.5pt solid var(--rg-callout-accent); font-size: 10pt; break-inside: avoid; text-align: left; }
.rg-callout__title { font-weight: 700; margin-bottom: 2pt; color: var(--rg-callout-accent); }
.rg-callout__text { margin: 0; font-style: italic; }
.rg-callout--info { --rg-callout-accent: var(--rg-primary-alt); }
.rg-callout--warning { --rg-callout-accent: var(--rg-accent-text); }
.rg-callout--success { --rg-callout-accent: var(--rg-success); }
.rg-callout--danger { --rg-callout-accent: var(--rg-danger); }
.rg-callout--note { --rg-callout-accent: var(--rg-note); }

${sharedCss(SCALE)}
.rg-figure figcaption, .rg-chart figcaption { font-family: var(--rg-font-serif); font-style: normal; color: var(--rg-ink); text-align: left; }
.rg-code { font-size: 8.5pt; text-align: left; }
`.trim();
}
