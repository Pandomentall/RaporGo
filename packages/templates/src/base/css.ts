import type { RaporDocument } from '@raporgo/core';
import { labelsFor } from './labels.js';

/**
 * Stylesheet pieces every template needs and none wants to write twice: the
 * chart classes the SVG renderer emits, code and figure blocks, the text file
 * wrapper, structural segments, signatures. Each template composes these with
 * its own page geometry and typography.
 *
 * `mavi-resmi` predates this file and keeps its own copy of these rules —
 * it is pinned to a measured baseline, and moving its CSS around is not
 * worth risking that.
 */

/** Escapes a string for use inside a CSS `content: "…"` declaration. */
export function cssString(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * The CSS `content` value for the page number in the document's language:
 * `"Sayfa " counter(page)`, or `"第 " counter(page) " 页"`.
 */
export function pageCounter(doc: RaporDocument, options: { lower?: boolean } = {}): string {
  const [before, after] = labelsFor(doc).page.map((part) => (options.lower ? part.toLocaleLowerCase() : part));
  return `${cssString(before!)} counter(page)${after ? ` ${cssString(after)}` : ''}`;
}
export function figureLabel(doc: RaporDocument): string {
  return labelsFor(doc).figure;
}
export function dateLabel(doc: RaporDocument): string {
  return labelsFor(doc).date;
}

/** The few sizes the shared rules need; a template picks them to match its own scale. */
export type SharedScale = {
  base: number;
  small: number;
  caption: number;
  /** Vertical rhythm between segments, in points. */
  segment: number;
};

/** Chart classes as the SVG renderer emits them. The text sizes follow the template's scale. */
export function chartCss(s: SharedScale): string {
  return `
.rg-chart { margin: 0 0 ${s.segment}pt; break-inside: avoid; }
.rg-chart__svg { display: block; width: 100%; height: auto; overflow: visible; }
.rg-chart text { font-family: var(--rg-font-sans); }
.rg-chart__head { margin-bottom: 6pt; }
.rg-chart__title { font-size: ${s.base + 2}pt; font-weight: 700; line-height: 1.3; color: var(--rg-primary); }
.rg-chart__sub { font-size: ${s.small}pt; line-height: 1.4; color: var(--rg-muted); }
.rg-chart__label { font-size: ${s.base}pt; fill: var(--rg-primary); }
.rg-chart__note { font-size: ${s.small}pt; fill: var(--rg-muted); }
.rg-chart__value { font-size: ${s.base + 0.5}pt; font-weight: 700; }
.rg-chart__value--in { fill: var(--rg-on-primary); }
.rg-chart__ring-value { font-size: ${s.base + 5}pt; font-weight: 700; }
.rg-chart__tick { font-size: ${s.small - 1}pt; fill: var(--rg-muted); }
.rg-chart__track { fill: var(--rg-surface); }
.rg-chart__ring-track { fill: none; stroke: var(--rg-surface); }
.rg-chart__axis { stroke: var(--rg-border); }
.rg-chart__grid { stroke: var(--rg-border); stroke-dasharray: 2 3; }
.rg-chart__marker { stroke: var(--rg-accent); stroke-width: 1.5; }
.rg-chart__marker-label { font-size: ${s.small - 0.5}pt; font-weight: 700; fill: var(--rg-accent); }
.rg-chart figcaption {
  font-size: ${s.caption}pt;
  font-style: italic;
  color: var(--rg-muted);
  text-align: center;
  margin-top: 6pt;
}`;
}

/** Images, code, linked text files, page breaks and spacers. */
export function blockCss(s: SharedScale): string {
  return `
.rg-figure { margin: 0 0 ${s.segment}pt; break-inside: avoid; }
.rg-figure img { display: block; width: 100%; height: auto; }
.rg-figure--framed img { border: 0.4pt solid var(--rg-border); }
.rg-figure__missing {
  padding: 26pt 12pt;
  text-align: center;
  font-size: ${s.caption}pt;
  font-style: italic;
  color: var(--rg-muted);
  background: var(--rg-surface);
  border: 0.4pt dashed var(--rg-border);
}
.rg-figure figcaption {
  font-size: ${s.caption}pt;
  font-style: italic;
  color: var(--rg-muted);
  text-align: center;
  margin-top: 6pt;
}

code, .rg-mono, .rg-code { font-variant-ligatures: none; font-feature-settings: "liga" 0, "calt" 0; }
code { font-family: var(--rg-font-mono); font-size: 0.94em; }
.rg-code {
  font-family: var(--rg-font-mono);
  font-size: ${s.base}pt;
  line-height: 1.5;
  color: var(--rg-primary);
  background: var(--rg-surface);
  border-left: 3pt solid var(--rg-border);
  padding: 8pt 10pt;
  margin: 0 0 ${s.segment}pt;
  white-space: pre-wrap;
  break-inside: avoid;
}

.rg-pagebreak { break-after: page; }
.rg-spacer--sm { height: 6pt; }
.rg-spacer--md { height: 14pt; }
.rg-spacer--lg { height: 26pt; }`;
}

/** Signature blocks: one column per party, a rule to sign on, name and title beneath. */
export function signatureCss(s: SharedScale): string {
  return `
.rg-signatures {
  display: flex;
  flex-wrap: wrap;
  gap: 18pt 28pt;
  margin-top: ${s.segment * 2}pt;
  break-inside: avoid;
}
.rg-signature { flex: 1 1 120pt; min-width: 120pt; }
.rg-signature__line { height: 34pt; border-bottom: 0.6pt solid var(--rg-ink); margin-bottom: 5pt; }
.rg-signature__name { font-size: ${s.base + 1}pt; font-weight: 700; color: var(--rg-ink); }
.rg-signature__title { font-size: ${s.small}pt; color: var(--rg-muted); margin-top: 1pt; }
.rg-signature__date { flex: 1 1 100%; font-size: ${s.base}pt; color: var(--rg-muted); margin-top: 4pt; }`;
}

/** Everything above in one call, for templates that take the defaults. */
export function sharedCss(s: SharedScale): string {
  return `${chartCss(s)}\n${blockCss(s)}\n${signatureCss(s)}`;
}
