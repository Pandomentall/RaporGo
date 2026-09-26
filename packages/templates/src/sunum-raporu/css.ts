import { fontFaceCss, fontStacks } from '../fonts.js';
import { colorVariables } from '../tokens.js';
import type { RenderContext } from '../types.js';
import { cssString, sharedCss } from '../base/css.js';

/**
 * `sunum-raporu` — a report that reads like a deck.
 *
 * Landscape pages, a cover that owns the whole first sheet, every section
 * on a fresh page, and type big enough to be read from across a table.
 * Made for the report that gets shown on a screen before it gets filed.
 */

const PAGE = { top: 48, right: 64, bottom: 44, left: 64 };
/** A4 landscape is 595pt tall; the cover fills the content box of the first page. */
const COVER_HEIGHT = 595 - PAGE.top - PAGE.bottom;
const SCALE = { base: 10, small: 8.5, caption: 9, segment: 14 };

export function stylesheet(ctx: RenderContext): string {
  const { colors, doc } = ctx;
  const { meta } = doc;
  const footerLeft = meta.footerText ?? meta.title;

  return `
${fontFaceCss(['sans', 'mono'])}

:root {
${colorVariables(colors)}
  --rg-font-sans: ${fontStacks.sans};
  --rg-font-mono: ${fontStacks.mono};
}

@page {
  size: A4 landscape;
  margin: ${PAGE.top}pt ${PAGE.right}pt ${PAGE.bottom}pt ${PAGE.left}pt;
  @bottom-left { content: ${cssString(footerLeft)}; }
  @bottom-right { content: counter(page); }
}
@page :first { @bottom-left { content: none; } @bottom-right { content: none; } }

.pagedjs_margin-bottom-left, .pagedjs_margin-bottom-right { font-size: 8.5pt; color: var(--rg-muted); align-items: start; padding-top: 8pt; }
.pagedjs_margin-bottom-right { font-weight: 700; }

/* The first sheet is painted in the primary colour; the cover sits on it. */
.pagedjs_first_page .pagedjs_sheet { background: var(--rg-primary); }

html { font-size: ${SCALE.base}pt; }
body {
  margin: 0;
  font-family: var(--rg-font-sans);
  font-size: 12pt;
  line-height: 1.6;
  color: var(--rg-ink);
  background: var(--rg-page);
  -webkit-font-smoothing: antialiased;
}
a { color: var(--rg-primary-alt); text-decoration: none; }

.rg-segment { margin: 0 0 ${SCALE.segment}pt; }
.rg-segment:last-child { margin-bottom: 0; }

/* --- cover: the whole first page ------------------------------------------ */

.rg-cover {
  min-height: ${COVER_HEIGHT}pt;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  color: var(--rg-on-primary);
  margin: 0;
  break-after: page;
}
.rg-cover__eyebrow { font-size: 11pt; font-weight: 700; letter-spacing: 2pt; text-transform: uppercase; color: var(--rg-accent); margin-bottom: 18pt; }
.rg-cover__title { font-size: 44pt; font-weight: 700; line-height: 1.02; letter-spacing: -0.5pt; max-width: 560pt; }
.rg-cover__subtitle { font-size: 16pt; line-height: 1.35; color: var(--rg-on-primary-muted); margin-top: 18pt; max-width: 520pt; }

/* --- sections: one per page ------------------------------------------------ */

.rg-section { margin: 0 0 22pt; padding-bottom: 12pt; break-before: page; break-after: avoid; }
.rg-cover + .rg-section, .rg-section:first-child { break-before: auto; }
.rg-section__badge { display: inline-block; font-size: 11pt; font-weight: 700; letter-spacing: 2pt; color: var(--rg-accent-text); margin-bottom: 8pt; }
.rg-section__badge::before { content: "0"; }
.rg-section__badge::after { content: ""; display: block; width: 48pt; height: 4pt; background: var(--rg-accent); margin-top: 6pt; }
.rg-section__title { display: block; font-size: 26pt; font-weight: 700; line-height: 1.15; color: var(--rg-primary); }

.rg-subheading { font-size: 15pt; font-weight: 700; color: var(--rg-primary-alt); margin: 18pt 0 6pt; break-after: avoid; }

/* --- text ---------------------------------------------------------------- */

.rg-paragraph { font-size: 12pt; max-width: 600pt; }
.rg-paragraph--lead { font-size: 15pt; line-height: 1.5; color: var(--rg-primary); }

.rg-list { font-size: 12pt; padding-left: 20pt; margin: 0 0 ${SCALE.segment}pt; max-width: 600pt; }
.rg-list li { margin-bottom: 5pt; padding-left: 4pt; }
.rg-list li::marker { color: var(--rg-accent-text); font-weight: 700; }

/* --- tables -------------------------------------------------------------- */

.rg-table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
.rg-table th { background: var(--rg-primary); color: var(--rg-on-primary); font-size: 9.5pt; font-weight: 700; text-align: left; padding: 8pt 12pt; }
.rg-table td { padding: 8pt 12pt; border-bottom: 0.6pt solid var(--rg-border); vertical-align: top; }
.rg-table tbody tr:nth-child(even) td { background: var(--rg-surface); }
.rg-table--kv td:first-child { width: 160pt; font-weight: 700; color: var(--rg-primary); }
.rg-table .rg-mono { font-family: var(--rg-font-mono); font-size: 9.5pt; }
.rg-table thead { display: table-header-group; }
.rg-table tr { break-inside: avoid; }

/* --- steps: big numbered circles ------------------------------------------ */

.rg-steps { display: flex; flex-direction: column; gap: 10pt; }
.rg-step { display: flex; align-items: flex-start; gap: 14pt; break-inside: avoid; }
.rg-step__number {
  flex: 0 0 34pt;
  height: 34pt;
  border-radius: 50%;
  background: var(--rg-accent);
  color: var(--rg-primary);
  font-size: 15pt;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rg-step__body { padding-top: 5pt; }
.rg-step__title { font-size: 13pt; font-weight: 700; color: var(--rg-primary); }
.rg-step__desc { font-size: 11pt; color: var(--rg-muted); margin-top: 2pt; }

/* --- callouts: a big quiet block ------------------------------------------- */

.rg-callout { border-left: 5pt solid var(--rg-callout-accent); background: var(--rg-surface); padding: 12pt 18pt; font-size: 13pt; line-height: 1.5; color: var(--rg-primary); break-inside: avoid; max-width: 640pt; }
.rg-callout__title { font-size: 10pt; font-weight: 700; letter-spacing: 1.5pt; text-transform: uppercase; color: var(--rg-callout-accent); margin-bottom: 4pt; }
.rg-callout__text { margin: 0; }
.rg-callout--info { --rg-callout-accent: var(--rg-primary-alt); }
.rg-callout--warning { --rg-callout-accent: var(--rg-accent-text); }
.rg-callout--success { --rg-callout-accent: var(--rg-success); }
.rg-callout--danger { --rg-callout-accent: var(--rg-danger); }
.rg-callout--note { --rg-callout-accent: var(--rg-note); }

${sharedCss(SCALE)}
.rg-chart, .rg-figure { max-width: 640pt; }
.rg-chart__title { font-size: 14pt; }
.rg-code { font-size: 10pt; }
`.trim();
}
