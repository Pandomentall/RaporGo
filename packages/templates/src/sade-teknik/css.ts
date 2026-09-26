import { fontFaceCss, fontStacks } from '../fonts.js';
import { colorVariables } from '../tokens.js';
import type { RenderContext } from '../types.js';
import { cssString, pageCounter, sharedCss } from '../base/css.js';

/**
 * `sade-teknik` — engineering notes.
 *
 * No bands, no fills: hairlines, a wide left margin where section and step
 * numbers hang in monospace, and one accent colour used only for rules.
 * The kind of page that photocopies well.
 */

const PAGE = { top: 56, right: 48, bottom: 56, left: 96 };
const GUTTER = 44;
const SCALE = { base: 8.5, small: 7.5, caption: 8, segment: 10 };

export function stylesheet(ctx: RenderContext): string {
  const { colors, doc } = ctx;
  const { meta } = doc;
  const headerLeft = meta.headerText ?? meta.eyebrow ?? meta.title;
  const headerRight = meta.date ?? '';
  const footerLeft = meta.footerText ?? '';

  return `
${fontFaceCss(['sans', 'mono'])}

:root {
${colorVariables(colors)}
  --rg-font-sans: ${fontStacks.sans};
  --rg-font-mono: ${fontStacks.mono};
  --rg-rule: var(--rg-primary-alt);
}

@page {
  size: A4;
  margin: ${PAGE.top}pt ${PAGE.right}pt ${PAGE.bottom}pt ${PAGE.left}pt;
  @top-left { content: ${cssString(headerLeft)}; }
  @top-right { content: ${cssString(headerRight)}; }
  @bottom-left { content: ${cssString(footerLeft)}; }
  @bottom-right { content: ${pageCounter(doc, { lower: true })}; }
}
@page :first { @top-left { content: none; } @top-right { content: none; } }

.pagedjs_margin-top { border-bottom: 0.4pt solid var(--rg-border); }
.pagedjs_first_page .pagedjs_margin-top { border-bottom: none; }
.pagedjs_margin-top-left, .pagedjs_margin-top-right, .pagedjs_margin-bottom-left, .pagedjs_margin-bottom-right {
  font-family: var(--rg-font-mono);
  font-size: 7pt;
  letter-spacing: 0.3pt;
  color: var(--rg-muted);
  align-items: end;
  padding-bottom: 4pt;
}
.pagedjs_margin-bottom-left, .pagedjs_margin-bottom-right { align-items: start; padding-top: 6pt; padding-bottom: 0; }
/* Margin boxes sit inside the page margins; pull the left ones out to the content edge. */
.pagedjs_margin-top-left, .pagedjs_margin-bottom-left { margin-left: -${GUTTER}pt; }

html { font-size: ${SCALE.base}pt; }
body {
  margin: 0;
  font-family: var(--rg-font-sans);
  font-size: 9pt;
  line-height: 1.5;
  color: var(--rg-ink);
  background: var(--rg-page);
  -webkit-font-smoothing: antialiased;
}
a { color: var(--rg-rule); text-decoration: none; }

.rg-segment { margin: 0 0 ${SCALE.segment}pt; }
.rg-segment:last-child { margin-bottom: 0; }

/* --- cover: a title, a short rule, nothing else --------------------------- */

.rg-cover { padding: 0 0 18pt; margin-bottom: 22pt; border-bottom: 0.4pt solid var(--rg-border); break-after: avoid; }
.rg-cover::before { content: ""; display: block; width: 36pt; height: 3pt; background: var(--rg-accent); margin-bottom: 14pt; }
.rg-cover__eyebrow { font-family: var(--rg-font-mono); font-size: 7.5pt; letter-spacing: 1pt; text-transform: uppercase; color: var(--rg-muted); margin-bottom: 8pt; }
.rg-cover__title { font-size: 24pt; font-weight: 700; line-height: 1.1; color: var(--rg-primary); }
.rg-cover__subtitle { font-size: 11pt; color: var(--rg-muted); margin-top: 8pt; }

/* --- sections: the number hangs in the margin ----------------------------- */

.rg-section {
  position: relative;
  margin: 22pt 0 10pt;
  padding-bottom: 5pt;
  border-bottom: 0.6pt solid var(--rg-rule);
  break-after: avoid;
}
.rg-section:first-child { margin-top: 0; }
.rg-section__badge {
  position: absolute;
  left: -${GUTTER}pt;
  top: -2pt;
  width: ${GUTTER - 10}pt;
  text-align: right;
  font-family: var(--rg-font-mono);
  font-size: 14pt;
  font-weight: 700;
  color: var(--rg-rule);
}
.rg-section__title { font-size: 13pt; font-weight: 700; color: var(--rg-primary); }

.rg-subheading {
  font-family: var(--rg-font-mono);
  font-size: 7.5pt;
  font-weight: 700;
  letter-spacing: 1pt;
  text-transform: uppercase;
  color: var(--rg-muted);
  margin: 14pt 0 5pt;
  break-after: avoid;
}
.rg-subheading::before { content: "// "; color: var(--rg-rule); }

/* --- text ---------------------------------------------------------------- */

.rg-paragraph { font-size: 9pt; }
.rg-paragraph--lead { font-size: 10.5pt; line-height: 1.5; color: var(--rg-primary); }

.rg-list { padding-left: 14pt; margin: 0 0 ${SCALE.segment}pt; }
.rg-list li { margin-bottom: 2pt; }
.rg-list li::marker { color: var(--rg-rule); }

/* --- tables: horizontal rules only ---------------------------------------- */

.rg-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
.rg-table th {
  font-family: var(--rg-font-mono);
  font-size: 7pt;
  font-weight: 700;
  letter-spacing: 0.5pt;
  text-transform: uppercase;
  color: var(--rg-muted);
  text-align: left;
  padding: 4pt 6pt 5pt;
  border-bottom: 0.8pt solid var(--rg-ink);
}
.rg-table td { padding: 5pt 6pt; border-bottom: 0.4pt solid var(--rg-border); vertical-align: top; }
.rg-table--kv td:first-child { width: 120pt; color: var(--rg-muted); }
.rg-table .rg-mono { font-family: var(--rg-font-mono); font-size: 8pt; }
.rg-table thead { display: table-header-group; }
.rg-table tr { break-inside: avoid; }

/* --- steps: numbers in the gutter, a rule down the side -------------------- */

.rg-steps { display: flex; flex-direction: column; gap: 8pt; }
.rg-step { position: relative; padding-left: 10pt; border-left: 1pt solid var(--rg-border); break-inside: avoid; }
.rg-step__number {
  position: absolute;
  left: -${GUTTER + 1}pt;
  top: 0;
  width: ${GUTTER - 10}pt;
  text-align: right;
  font-family: var(--rg-font-mono);
  font-size: 10pt;
  font-weight: 700;
  color: var(--rg-rule);
}
.rg-step__title { font-weight: 700; color: var(--rg-primary); }
.rg-step__desc { color: var(--rg-muted); margin-top: 2pt; }

/* --- callouts: a labelled rule --------------------------------------------- */

.rg-callout { border-left: 2pt solid var(--rg-callout-accent); padding: 2pt 0 2pt 10pt; font-size: 9pt; break-inside: avoid; }
.rg-callout__title { font-family: var(--rg-font-mono); font-size: 7pt; letter-spacing: 1pt; text-transform: uppercase; color: var(--rg-callout-accent); margin-bottom: 3pt; }
.rg-callout__text { margin: 0; }
.rg-callout--info { --rg-callout-accent: var(--rg-primary-alt); }
.rg-callout--warning { --rg-callout-accent: var(--rg-accent-text); }
.rg-callout--success { --rg-callout-accent: var(--rg-success); }
.rg-callout--danger { --rg-callout-accent: var(--rg-danger); }
.rg-callout--note { --rg-callout-accent: var(--rg-note); }

${sharedCss(SCALE)}
.rg-figure figcaption, .rg-chart figcaption { font-family: var(--rg-font-mono); font-style: normal; font-size: 7.5pt; text-align: left; }
.rg-figure--framed img { border-color: var(--rg-border); }
.rg-code { border-left: none; background: var(--rg-surface); font-size: 8pt; }
.rg-signature__line { border-bottom-color: var(--rg-border); }
`.trim();
}
