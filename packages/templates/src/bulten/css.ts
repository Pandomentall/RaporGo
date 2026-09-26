import { fontFaceCss, fontStacks } from '../fonts.js';
import { colorVariables } from '../tokens.js';
import type { RenderContext } from '../types.js';
import { cssString, sharedCss } from '../base/css.js';

/**
 * `bulten` — the newsletter.
 *
 * A colour band across the top of every page, display-sized headings, a
 * drop cap opening each section, callouts set as pull quotes. Louder than
 * the others on purpose: this is the report that has to be picked up.
 */

const BAND = 40;
const PAGE = { top: 76, right: 50, bottom: 52, left: 50 };
const SCALE = { base: 9, small: 8, caption: 8.5, segment: 12 };

export function stylesheet(ctx: RenderContext): string {
  const { colors, doc } = ctx;
  const { meta } = doc;
  const bandLeft = meta.headerText ?? meta.eyebrow ?? meta.title;
  const bandRight = meta.date ?? '';

  return `
${fontFaceCss(['sans', 'mono'])}

:root {
${colorVariables(colors)}
  --rg-font-sans: ${fontStacks.sans};
  --rg-font-mono: ${fontStacks.mono};
}

@page {
  size: A4;
  margin: ${PAGE.top}pt ${PAGE.right}pt ${PAGE.bottom}pt ${PAGE.left}pt;
  @top-left { content: ${cssString(bandLeft)}; }
  @top-right { content: ${cssString(bandRight)}; }
  @bottom-center { content: counter(page); }
}

/* --- the band -------------------------------------------------------------- */

.pagedjs_sheet { position: relative; }
.pagedjs_sheet::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: ${BAND}pt; background: var(--rg-primary); }
.pagedjs_sheet::after { content: ""; position: absolute; left: 0; right: 0; top: ${BAND}pt; height: 4pt; background: var(--rg-accent); }
.pagedjs_pagebox { position: relative; z-index: 1; }
.pagedjs_margin-top-left, .pagedjs_margin-top-right {
  align-self: start;
  height: ${BAND}pt;
  align-items: center;
  color: var(--rg-on-primary);
  font-size: 9pt;
  font-weight: 700;
  letter-spacing: 1pt;
  text-transform: uppercase;
}
.pagedjs_margin-top-left { margin-left: -${PAGE.left - 24}pt; }
.pagedjs_margin-top-right { margin-right: -${PAGE.right - 24}pt; font-weight: 400; letter-spacing: 0; text-transform: none; }
.pagedjs_margin-bottom-center { justify-content: center; }
.pagedjs_margin-bottom-center .pagedjs_margin-content {
  flex: 0 0 20pt; width: 20pt !important; height: 20pt; border-radius: 50%;
  background: var(--rg-accent); color: var(--rg-primary);
  font-size: 9pt; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto;
}

html { font-size: ${SCALE.base}pt; }
body {
  margin: 0;
  font-family: var(--rg-font-sans);
  font-size: 10pt;
  line-height: 1.55;
  color: var(--rg-ink);
  background: var(--rg-page);
  -webkit-font-smoothing: antialiased;
}
a { color: var(--rg-primary-alt); text-decoration: none; }

.rg-segment { margin: 0 0 ${SCALE.segment}pt; }
.rg-segment:last-child { margin-bottom: 0; }

/* --- cover: a headline ------------------------------------------------------ */

.rg-cover { padding: 8pt 0 22pt; margin-bottom: 24pt; border-bottom: 1.5pt solid var(--rg-ink); break-after: avoid; }
.rg-cover__eyebrow { display: inline-block; background: var(--rg-accent); color: var(--rg-primary); font-size: 8pt; font-weight: 700; letter-spacing: 1.5pt; text-transform: uppercase; padding: 2pt 7pt; margin-bottom: 14pt; }
.rg-cover__title { font-size: 40pt; font-weight: 700; line-height: 0.98; letter-spacing: -1pt; color: var(--rg-primary); }
.rg-cover__subtitle { font-size: 14pt; line-height: 1.35; color: var(--rg-muted); margin-top: 14pt; max-width: 420pt; }

/* --- headings ---------------------------------------------------------------- */

.rg-section { margin: 24pt 0 10pt; break-after: avoid; }
.rg-section:first-child { margin-top: 0; }
.rg-section__badge { display: none; }
.rg-section__title { font-size: 22pt; font-weight: 700; line-height: 1.1; letter-spacing: -0.4pt; color: var(--rg-primary); }
.rg-section__title::after { content: ""; display: block; width: 32pt; height: 3pt; background: var(--rg-accent); margin-top: 8pt; }

.rg-subheading { font-size: 8.5pt; font-weight: 700; letter-spacing: 1.5pt; text-transform: uppercase; color: var(--rg-accent-text); margin: 16pt 0 5pt; break-after: avoid; }

/* --- text: a drop cap opens each section ------------------------------------ */

.rg-paragraph { font-size: 10pt; }
.rg-paragraph--lead { font-size: 12.5pt; line-height: 1.45; color: var(--rg-primary); }
.rg-paragraph--opening::first-letter {
  float: left;
  font-size: 36pt;
  line-height: 0.82;
  font-weight: 700;
  color: var(--rg-primary);
  padding: 3pt 6pt 0 0;
}

.rg-list { padding-left: 18pt; margin: 0 0 ${SCALE.segment}pt; }
.rg-list li { margin-bottom: 3pt; padding-left: 3pt; }
.rg-list li::marker { color: var(--rg-accent-text); font-weight: 700; }

/* --- tables: accent header, striped ----------------------------------------- */

.rg-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
.rg-table th { background: var(--rg-accent); color: var(--rg-primary); font-size: 8pt; font-weight: 700; letter-spacing: 0.5pt; text-transform: uppercase; text-align: left; padding: 6pt 9pt; }
.rg-table td { padding: 6pt 9pt; border-bottom: 0.4pt solid var(--rg-border); vertical-align: top; }
.rg-table tbody tr:nth-child(even) td { background: var(--rg-surface); }
.rg-table--kv td:first-child { width: 130pt; font-weight: 700; color: var(--rg-primary); }
.rg-table .rg-mono { font-family: var(--rg-font-mono); font-size: 8.5pt; }
.rg-table thead { display: table-header-group; }
.rg-table tr { break-inside: avoid; }

/* --- steps: accent counters ------------------------------------------------- */

.rg-steps { display: flex; flex-direction: column; gap: 8pt; }
.rg-step { display: flex; align-items: flex-start; gap: 10pt; break-inside: avoid; }
.rg-step__number { flex: 0 0 24pt; height: 24pt; border-radius: 50%; background: var(--rg-accent); color: var(--rg-primary); font-size: 11pt; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.rg-step__body { padding-top: 3pt; }
.rg-step__title { font-weight: 700; color: var(--rg-primary); }
.rg-step__desc { color: var(--rg-muted); margin-top: 1pt; }

/* --- callouts as pull quotes ------------------------------------------------- */

.rg-callout { margin: 16pt 24pt; padding: 12pt 0; border-top: 2pt solid var(--rg-callout-accent); border-bottom: 2pt solid var(--rg-callout-accent); text-align: center; break-inside: avoid; }
.rg-callout__title { font-size: 8pt; font-weight: 700; letter-spacing: 1.5pt; text-transform: uppercase; color: var(--rg-callout-accent); margin-bottom: 5pt; }
.rg-callout__text { margin: 0; font-size: 13.5pt; line-height: 1.35; font-style: italic; color: var(--rg-primary); }
.rg-callout--info { --rg-callout-accent: var(--rg-primary-alt); }
.rg-callout--warning { --rg-callout-accent: var(--rg-accent-text); }
.rg-callout--success { --rg-callout-accent: var(--rg-success); }
.rg-callout--danger { --rg-callout-accent: var(--rg-danger); }
.rg-callout--note { --rg-callout-accent: var(--rg-note); }

${sharedCss(SCALE)}
.rg-chart__title { font-size: 13pt; letter-spacing: -0.2pt; }
.rg-code { border-left-color: var(--rg-accent); }
`.trim();
}
