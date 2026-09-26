import { fontFaceCss, fontStacks } from '../fonts.js';
import { colorVariables } from '../tokens.js';
import type { RenderContext } from '../types.js';
import { cssString, pageCounter, sharedCss } from '../base/css.js';
import { labelsFor } from '../base/labels.js';

/**
 * `sozlesme` — the contract.
 *
 * Serif, justified, no colour bands: the page should look like something
 * two parties sign, not something a marketing team made. Sections are
 * "MADDE n", subheadings are numbered "n.m" beneath them, and the running
 * footer counts pages out of the total so nobody can slip one in.
 */

const PAGE = { top: 64, right: 58, bottom: 64, left: 58 };
const SCALE = { base: 9.5, small: 8, caption: 8.5, segment: 10 };


export function stylesheet(ctx: RenderContext): string {
  const { colors, doc } = ctx;
  const { meta } = doc;
  const { clause } = labelsFor(doc);
  const running = meta.headerText ?? meta.title;

  return `
${fontFaceCss(['serif', 'mono'])}

:root {
${colorVariables(colors)}
  --rg-font-sans: ${fontStacks.serif};
  --rg-font-serif: ${fontStacks.serif};
  --rg-font-mono: ${fontStacks.mono};
  counter-reset: article;
}

@page {
  size: A4;
  margin: ${PAGE.top}pt ${PAGE.right}pt ${PAGE.bottom}pt ${PAGE.left}pt;
  @top-center { content: ${cssString(running)}; }
  @bottom-center { content: ${pageCounter(doc)} " / " counter(pages); }
}
@page :first { @top-center { content: none; } }

.pagedjs_margin-top-center {
  font-family: var(--rg-font-serif);
  font-size: 7.5pt;
  letter-spacing: 1pt;
  text-transform: uppercase;
  color: var(--rg-muted);
}
.pagedjs_margin-bottom-center { font-family: var(--rg-font-serif); font-size: 8.5pt; color: var(--rg-muted); }

html { font-size: ${SCALE.base}pt; }
body {
  margin: 0;
  font-family: var(--rg-font-serif);
  font-size: 10.5pt;
  line-height: 1.55;
  color: var(--rg-ink);
  background: var(--rg-page);
  text-align: justify;
  hyphens: auto;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--rg-ink); text-decoration: underline; }

.rg-segment { margin: 0 0 ${SCALE.segment}pt; }
.rg-segment:last-child { margin-bottom: 0; }

/* --- cover: a centred title block, the way a contract opens --------------- */

.rg-cover { text-align: center; padding: 18pt 0 22pt; margin-bottom: 26pt; border-bottom: 0.8pt solid var(--rg-ink); break-after: avoid; }
.rg-cover__eyebrow { font-size: 8pt; letter-spacing: 2pt; text-transform: uppercase; color: var(--rg-muted); margin-bottom: 14pt; }
.rg-cover__title { font-size: 20pt; font-weight: 700; letter-spacing: 1pt; text-transform: uppercase; line-height: 1.2; }
.rg-cover__subtitle { font-size: 11pt; font-style: italic; color: var(--rg-muted); margin-top: 8pt; }

/* --- articles ------------------------------------------------------------ */

.rg-section {
  display: flex;
  align-items: baseline;
  gap: 8pt;
  margin: 22pt 0 8pt;
  counter-increment: article;
  counter-reset: clause;
  break-after: avoid;
  text-align: left;
}
.rg-section:first-child { margin-top: 0; }
.rg-section__badge { font-weight: 700; font-size: 10.5pt; white-space: nowrap; }
.rg-section__badge::before { content: ${cssString(clause[0])}; }
.rg-section__badge::after { content: ${cssString(`${clause[1]} —`)}; }
.rg-section__title { font-weight: 700; font-size: 10.5pt; text-transform: uppercase; letter-spacing: 0.4pt; }

.rg-subheading {
  font-weight: 700;
  font-size: 10.5pt;
  margin: 12pt 0 4pt;
  counter-increment: clause;
  break-after: avoid;
  text-align: left;
}
.rg-subheading::before { content: counter(article) "." counter(clause) "  "; }

/* --- text ---------------------------------------------------------------- */

.rg-paragraph { font-size: 10.5pt; }
.rg-paragraph--lead { font-size: 11pt; }

.rg-list { padding-left: 22pt; margin: 0 0 ${SCALE.segment}pt; }
.rg-list li { margin-bottom: 3pt; padding-left: 4pt; }
ol.rg-list { list-style-type: lower-alpha; }
ol.rg-list li::marker { content: counter(list-item, lower-alpha) ") "; }
ul.rg-list { list-style: none; padding-left: 16pt; }
ul.rg-list li::before { content: "–"; display: inline-block; width: 12pt; margin-left: -12pt; }

/* --- tables: rules, no fills ---------------------------------------------- */

.rg-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; text-align: left; border: 0.6pt solid var(--rg-ink); }
.rg-table th { font-weight: 700; padding: 5pt 8pt; border-bottom: 0.6pt solid var(--rg-ink); background: var(--rg-surface); }
.rg-table td { padding: 5pt 8pt; border-top: 0.4pt solid var(--rg-border); border-left: 0.4pt solid var(--rg-border); vertical-align: top; }
.rg-table td:first-child { border-left: none; }
.rg-table--kv td:first-child { width: 150pt; font-weight: 700; }
.rg-table .rg-mono { font-family: var(--rg-font-mono); font-size: 8.5pt; }
.rg-table thead { display: table-header-group; }
.rg-table tr { break-inside: avoid; }

/* --- steps: numbered plainly ---------------------------------------------- */

.rg-steps { display: flex; flex-direction: column; gap: 6pt; }
.rg-step { display: flex; gap: 10pt; break-inside: avoid; text-align: left; }
.rg-step__number { flex: 0 0 22pt; font-weight: 700; }
.rg-step__number::after { content: "."; }
.rg-step__title { font-weight: 700; }
.rg-step__desc { color: var(--rg-muted); margin-top: 2pt; }

/* --- callouts: a ruled box -------------------------------------------------- */

.rg-callout { border: 0.6pt solid var(--rg-ink); padding: 8pt 12pt; font-size: 10pt; break-inside: avoid; text-align: left; }
.rg-callout__title { font-weight: 700; text-transform: uppercase; letter-spacing: 0.6pt; font-size: 8.5pt; margin-bottom: 3pt; }
.rg-callout__text { margin: 0; }
.rg-callout--warning, .rg-callout--danger { border-width: 1.2pt; }

/* --- signatures: the point of the document -------------------------------- */

.rg-signatures { margin-top: 36pt; gap: 24pt 40pt; }
.rg-signature__line { height: 42pt; }
.rg-signature__name { text-transform: uppercase; letter-spacing: 0.4pt; }

${sharedCss(SCALE)}
.rg-figure figcaption, .rg-chart figcaption { font-family: var(--rg-font-serif); }
.rg-code { font-size: 8.5pt; border-left-color: var(--rg-ink); text-align: left; }
`.trim();
}
