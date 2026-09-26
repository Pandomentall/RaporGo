import { fontFaceCss, fontStacks } from '../fonts.js';
import { colorVariables, page, space, type } from '../tokens.js';
import type { RenderContext } from '../types.js';
import { pageCounter, signatureCss } from '../base/css.js';

/** Escapes a string for use inside a CSS `content: "…"` declaration. */
function cssString(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}


/**
 * The `mavi-resmi` stylesheet.
 *
 * Geometry here is measured from the reference report in points, so the
 * numbers are intentionally not round. The running header and footer bands are
 * painted as pseudo-elements on the Paged.js sheet rather than as margin-box
 * backgrounds: margin boxes are hidden when empty and are inset by the page
 * margins, neither of which suits a full-bleed band.
 */
export function stylesheet(ctx: RenderContext): string {
  const { colors, doc } = ctx;
  const { meta } = doc;

  const headerLeft = meta.headerText ?? meta.eyebrow ?? '';
  const headerRight = meta.date ?? '';
  const footerLeft = meta.footerText ?? meta.title;

  return `
${fontFaceCss()}

:root {
${colorVariables(colors)}
  --rg-font-sans: ${fontStacks.sans};
  --rg-font-mono: ${fontStacks.mono};
  --rg-content-width: ${page.width - page.marginLeft - page.marginRight}pt;
}

@page {
  size: ${page.size};
  margin: ${page.marginTop}pt ${page.marginRight}pt ${page.marginBottom}pt ${page.marginLeft}pt;

  @top-left { content: ${cssString(headerLeft)}; }
  @top-right { content: ${cssString(headerRight)}; }
  @bottom-left { content: ${cssString(footerLeft)}; }
  @bottom-center { content: ""; }
  @bottom-right { content: ${pageCounter(doc)}; }
}

/* --- Running bands ------------------------------------------------------ */

.pagedjs_sheet { position: relative; }

.pagedjs_sheet::before,
.pagedjs_sheet::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  background: var(--rg-primary);
}
.pagedjs_sheet::before { top: 0; height: ${page.headerBand}pt; }
.pagedjs_sheet::after { bottom: 0; height: ${page.footerBand}pt; }

/* The cover page carries no running header. */
.pagedjs_first_page .pagedjs_sheet::before { display: none; }
.pagedjs_first_page .pagedjs_margin-top { display: none; }

.pagedjs_pagebox { position: relative; z-index: 1; }

.pagedjs_pagebox .pagedjs_margin-top-left,
.pagedjs_pagebox .pagedjs_margin-top-right {
  align-self: start;
  height: ${page.headerBand}pt;
  align-items: center;
  color: var(--rg-on-primary);
  font-size: ${type.band}pt;
}
.pagedjs_pagebox .pagedjs_margin-top-left { font-weight: 700; margin-left: -${page.marginLeft - page.bandInset}pt; }
.pagedjs_pagebox .pagedjs_margin-top-right { margin-right: -${page.marginRight - page.bandInset}pt; }

.pagedjs_pagebox .pagedjs_margin-bottom-left,
.pagedjs_pagebox .pagedjs_margin-bottom-center,
.pagedjs_pagebox .pagedjs_margin-bottom-right {
  align-self: end;
  height: ${page.footerBand}pt;
  align-items: center;
  color: var(--rg-on-primary);
  font-size: ${type.base}pt;
}
.pagedjs_pagebox .pagedjs_margin-bottom-left { margin-left: -${page.marginLeft - page.bandInset}pt; }
.pagedjs_pagebox .pagedjs_margin-bottom-right { font-weight: 700; margin-right: -${page.marginRight - page.bandInset}pt; }

/* Short accent rule between the footer texts. */
.pagedjs_pagebox .pagedjs_margin-bottom-center .pagedjs_margin-content {
  width: 30pt;
  margin: 0 auto;
  border-top: 2pt solid var(--rg-accent);
}

/* --- Document ------------------------------------------------------------ */

html { font-size: ${type.base}pt; }

body {
  margin: 0;
  font-family: var(--rg-font-sans);
  font-size: ${type.lead}pt;
  line-height: ${type.lineHeight};
  color: var(--rg-ink);
  background: var(--rg-page);
  -webkit-font-smoothing: antialiased;
}

a { color: var(--rg-primary-alt); text-decoration: none; }

/* Ligatures would turn "=>" into an arrow glyph; code must read literally. */
code, .rg-mono, .rg-code { font-variant-ligatures: none; font-feature-settings: "liga" 0, "calt" 0; }
code { font-family: var(--rg-font-mono); font-size: 0.94em; }

.rg-segment { margin: 0 0 ${space.segment}pt; }
.rg-segment:last-child { margin-bottom: 0; }

/* --- cover --------------------------------------------------------------- */

.rg-cover {
  background: var(--rg-primary);
  color: var(--rg-on-primary);
  padding: 30pt 26pt 37pt;
  margin-bottom: ${space.loose}pt;
  break-after: avoid;
}
.rg-cover__eyebrow {
  font-size: ${type.coverEyebrow + 1}pt;
  font-weight: 700;
  letter-spacing: 0.3pt;
  color: var(--rg-accent);
  text-transform: uppercase;
  margin: 0 0 12pt;
}
.rg-cover__title { font-size: 34pt; font-weight: 700; line-height: 1; margin: 0; }
.rg-cover__subtitle { font-size: 13pt; line-height: 1.3; color: var(--rg-on-primary-muted); margin: 16pt 0 0; }

/* --- section / subheading ------------------------------------------------ */

.rg-section {
  display: flex;
  align-items: center;
  gap: 10pt;
  padding-left: 6pt;
  padding-bottom: 9pt;
  border-bottom: 0.4pt solid var(--rg-border);
  margin-top: ${space.loose}pt;
  margin-bottom: ${space.segment}pt;
  break-after: avoid;
  break-inside: avoid;
}
.rg-section:first-child { margin-top: 0; }
.rg-section__badge {
  flex: 0 0 auto;
  width: 26pt;
  height: 26pt;
  background: var(--rg-primary-alt);
  color: var(--rg-on-primary);
  font-size: 11pt;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rg-section__title { font-size: ${type.sectionTitle}pt; font-weight: 700; color: var(--rg-primary); }

.rg-subheading {
  font-size: ${type.subheading + 0.5}pt;
  font-weight: 700;
  color: var(--rg-primary);
  margin: ${space.segment}pt 0 ${space.tight}pt;
  break-after: avoid;
}

/* --- text ---------------------------------------------------------------- */

.rg-paragraph { font-size: 9.5pt; line-height: 1.58; }
.rg-paragraph--lead { font-size: 9.5pt; }
.rg-paragraph strong { font-weight: 700; }

.rg-list { font-size: 9.5pt; line-height: 1.58; padding-left: 14pt; margin: 0 0 ${space.segment}pt; }

.rg-list li { margin-bottom: 2pt; }

/* --- tables -------------------------------------------------------------- */

.rg-table {
  width: 100%;
  border-collapse: collapse;
  font-size: ${type.base}pt;
  border: 0.4pt solid var(--rg-border);
}
.rg-table th {
  background: var(--rg-primary-alt);
  color: var(--rg-on-primary);
  font-size: ${type.tableHeader + 1}pt;
  font-weight: 700;
  text-align: left;
  padding: 6pt 8pt;
}
.rg-table--kv th { background: var(--rg-primary); }
.rg-table td {
  padding: 6pt 8pt;
  border-top: 0.4pt solid var(--rg-border);
  border-left: 0.4pt solid var(--rg-border);
  vertical-align: top;
}
.rg-table td:first-child { border-left: none; }
.rg-table tbody tr:nth-child(even) td { background: var(--rg-surface); }
.rg-table .rg-mono { font-family: var(--rg-font-mono); }
.rg-table--kv td:first-child { width: 130pt; }
.rg-table thead { display: table-header-group; }
.rg-table tr { break-inside: avoid; }

/* --- steps --------------------------------------------------------------- */

.rg-steps { display: flex; flex-direction: column; }
.rg-step { display: flex; align-items: stretch; min-height: 40pt; break-inside: avoid; }
.rg-step__number {
  flex: 0 0 26pt;
  background: var(--rg-primary-alt);
  color: var(--rg-on-primary);
  font-size: 11pt;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rg-step:nth-child(even) .rg-step__number { background: var(--rg-info); }
.rg-step__body {
  flex: 1 1 auto;
  margin-left: 10pt;
  padding: 4pt 10pt;
  background: var(--rg-page);
  border-top: 1.3pt solid var(--rg-page);
  border-bottom: 1.3pt solid var(--rg-page);
}
.rg-step:nth-child(even) .rg-step__body {
  background: var(--rg-surface);
  border-color: var(--rg-page);
}
.rg-step__title { font-size: 9pt; font-weight: 700; color: var(--rg-primary); }
.rg-step__desc { font-size: ${type.lead}pt; color: var(--rg-muted); margin-top: 3pt; }

/* --- callout ------------------------------------------------------------- */

.rg-callout {
  border-left: 3pt solid var(--rg-callout-accent);
  background: var(--rg-callout-bg);
  padding: 8pt 12pt;
  font-size: ${type.lead}pt;
  font-style: italic;
  color: var(--rg-callout-accent);
  break-inside: avoid;
}
.rg-callout__title { font-weight: 700; font-style: normal; margin-bottom: 2pt; }
.rg-callout__text { margin: 0; }
.rg-callout--info { --rg-callout-accent: var(--rg-primary-alt); --rg-callout-bg: var(--rg-surface); }
.rg-callout--warning { --rg-callout-accent: var(--rg-accent-text); --rg-callout-bg: var(--rg-cream); }
.rg-callout--success { --rg-callout-accent: var(--rg-success); --rg-callout-bg: #eefaf2; }
.rg-callout--danger { --rg-callout-accent: var(--rg-danger); --rg-callout-bg: #fdf0ee; }
.rg-callout--note { --rg-callout-accent: var(--rg-note); --rg-callout-bg: #f5f1fb; }

/* --- image --------------------------------------------------------------- */

.rg-figure { margin: 0 0 ${space.segment}pt; break-inside: avoid; }
.rg-figure img { display: block; width: 100%; height: auto; }
.rg-figure--framed img { border: 0.4pt solid var(--rg-border); }
.rg-figure__missing {
  padding: 26pt 12pt;
  text-align: center;
  font-size: ${type.caption}pt;
  font-style: italic;
  color: var(--rg-muted);
  background: var(--rg-surface);
  border: 0.4pt dashed var(--rg-border);
}
.rg-figure figcaption {
  font-size: ${type.caption}pt;
  font-style: italic;
  color: var(--rg-muted);
  text-align: center;
  margin-top: 6pt;
}

/* --- chart --------------------------------------------------------------- */

/*
 * Inline SVG, so the chart is set in the document's own typeface and reads
 * from the same palette every other segment does.
 */
.rg-chart { margin: 0 0 ${space.segment}pt; break-inside: avoid; }
.rg-chart__svg { display: block; width: 100%; height: auto; overflow: visible; }
.rg-chart text { font-family: var(--rg-font-sans); }
.rg-chart__head { margin-bottom: 6pt; }
.rg-chart__title { font-size: 10pt; font-weight: 700; line-height: 1.3; color: var(--rg-primary); }
.rg-chart__sub { font-size: ${type.small}pt; line-height: 1.4; color: var(--rg-muted); }
.rg-chart__label { font-size: ${type.base}pt; fill: var(--rg-primary); }
.rg-chart__note { font-size: ${type.small}pt; fill: var(--rg-muted); }
.rg-chart__value { font-size: ${type.lead}pt; font-weight: 700; }
.rg-chart__value--in { fill: var(--rg-on-primary); }
.rg-chart__ring-value { font-size: 13pt; font-weight: 700; }
.rg-chart__tick { font-size: 6.5pt; fill: var(--rg-muted); }
.rg-chart__track { fill: var(--rg-surface); }
.rg-chart__ring-track { fill: none; stroke: var(--rg-surface); }
.rg-chart__axis { stroke: var(--rg-border); }
.rg-chart__grid { stroke: var(--rg-border); stroke-dasharray: 2 3; }
.rg-chart__marker { stroke: var(--rg-accent); stroke-width: 1.5; }
.rg-chart__marker-label { font-size: 7pt; font-weight: 700; fill: var(--rg-accent); }
.rg-chart figcaption {
  font-size: ${type.caption}pt;
  font-style: italic;
  color: var(--rg-muted);
  text-align: center;
  margin-top: 6pt;
}

/* --- code ---------------------------------------------------------------- */

.rg-code {
  font-family: var(--rg-font-mono);
  font-size: ${type.base}pt;
  line-height: 1.5;
  color: var(--rg-primary);
  background: var(--rg-surface);
  border-left: 3pt solid var(--rg-border);
  padding: 8pt 10pt;
  margin: 0 0 ${space.segment}pt;
  white-space: pre-wrap;
  break-inside: avoid;
}

/* --- structural ---------------------------------------------------------- */

.rg-pagebreak { break-after: page; }
.rg-spacer--sm { height: 6pt; }
.rg-spacer--md { height: 14pt; }
.rg-spacer--lg { height: 26pt; }
${signatureCss({ base: type.base, small: type.small, caption: type.caption, segment: space.segment })}
`.trim();
}
