import type { SegmentOfType } from '@raporgo/core/schema';
import { escapeHtml } from '../inline.js';
import type { ColorTokens } from '../tokens.js';

/**
 * Pieces every chart kind needs: the drawing box, colour resolution and
 * number formatting. The title block is plain HTML above the SVG (see the
 * template's chart segment) so the editor can make it editable in place.
 *
 * Charts are emitted as *inline* SVG rather than as an image, which is what
 * lets them inherit the document's font and palette — the same page that gets
 * rethemed gets it in its charts too. Everything is pure, so the geometry can
 * be tested without a browser.
 */

export type ChartSegment = SegmentOfType<'chart'>;

/** Drawing width, in the same points the rest of the template works in. */
export const W = 720;

/** The order colours are handed out when nothing names one. */
const SERIES_TOKENS = ['primary', 'accent', 'info', 'success', 'note', 'danger', 'primaryAlt'] as const;

export function resolveColor(name: string | undefined, index: number, colors: ColorTokens): string {
  const token = name ?? SERIES_TOKENS[index % SERIES_TOKENS.length]!;
  if (token.startsWith('#')) return token;
  return (colors as unknown as Record<string, string>)[token] ?? colors.primary;
}

/**
 * The document's language while a chart is drawn. Rendering is synchronous,
 * so `renderChart` sets it for the duration of one chart instead of every
 * helper taking a locale argument. Outside a render it is Turkish, the
 * format's default language.
 */
let locale = { tag: 'tr', target: 'hedef' };

export function withChartLocale<T>(next: { tag: string; target: string }, draw: () => T): T {
  const previous = locale;
  locale = next;
  try {
    return draw();
  } finally {
    locale = previous;
  }
}

const formats = new Map<string, Intl.NumberFormat>();
function numberFormat(key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const id = `${locale.tag}|${key}`;
  let format = formats.get(id);
  if (!format) {
    try {
      format = new Intl.NumberFormat(locale.tag, options);
    } catch {
      format = new Intl.NumberFormat('en', options);
    }
    formats.set(id, format);
  }
  return format;
}

/** A number in the document's convention — `8.800` and `3,5` in Turkish, `8,800` and `3.5` in English. */
export function formatValue(value: number, unit = ''): string {
  return `${numberFormat('value', { maximumFractionDigits: 2 }).format(value)}${unit}`;
}

/** 1e9 -> "1 Mr" (Turkish) or "1B" (English), so a large axis stays readable at report size. */
export function shortMagnitude(value: number): string {
  return numberFormat('compact', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

/** The word before a gauge's target value: "hedef", "target"… */
export function targetWord(): string {
  return locale.target;
}

export function svg(height: number, body: string): string {
  return `<svg class="rg-chart__svg" viewBox="0 0 ${W} ${Math.round(height)}" role="img">${body}</svg>`;
}

export function text(
  x: number,
  y: number,
  content: string,
  className: string,
  extra = '',
): string {
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="${className}"${extra}>${escapeHtml(content)}</text>`;
}

/** A datum's single value, whichever field carries it. */
export function valueOf(datum: ChartSegment['data'][number]): number {
  if (datum.value !== undefined) return datum.value;
  return (datum.values ?? []).reduce((sum, part) => sum + part, 0);
}

/** The label printed for a datum: its override, or the formatted number. */
export function labelFor(datum: ChartSegment['data'][number], unit: string): string {
  return datum.text ?? formatValue(valueOf(datum), unit);
}

/**
 * A legend row, drawn under a chart with more than one series. Multi-series
 * charts are unreadable without one, and the space is cheaper than the
 * confusion.
 */
export function legend(
  chart: ChartSegment,
  colors: ColorTokens,
  y: number,
): { markup: string; height: number } {
  const series = chart.series ?? [];
  if (series.length < 2) return { markup: '', height: 0 };

  const slot = W / series.length;
  const markup = series
    .map((entry, index) => {
      const x = slot * index;
      return (
        `<rect x="${x.toFixed(1)}" y="${(y - 8).toFixed(1)}" width="10" height="10" fill="${resolveColor(entry.color, index, colors)}"/>` +
        text(x + 15, y + 1, entry.name, 'rg-chart__note')
      );
    })
    .join('');
  return { markup, height: 20 };
}

/**
 * Rounds an axis up to a readable maximum and returns its grid values.
 *
 * Scaling the raw maximum by a fixed headroom factor produces axes labelled
 * "146,72 bin", which is noise: the reader has to decode the axis before
 * reading the data. This snaps the step to 1, 2, 2.5 or 5 times a power of ten
 * so every gridline lands on a number a person would have chosen.
 */
export function niceScale(rawMax: number, count = 4): { max: number; ticks: number[] } {
  if (!Number.isFinite(rawMax) || rawMax <= 0) return { max: 1, ticks: [0, 1] };

  const rough = rawMax / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalized = rough / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10) * magnitude;

  const max = Math.ceil(rawMax / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= max + step / 2; value += step) {
    ticks.push(Math.round(value * 1e6) / 1e6);
  }
  return { max, ticks };
}

/** Evenly spaced grid values, for axes whose maximum is already chosen. */
export function ticksTo(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, index) => (max * index) / count);
}
