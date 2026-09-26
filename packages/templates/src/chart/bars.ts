import type { ColorTokens } from '../tokens.js';
import {
  W,
  formatValue,
  labelFor,
  legend,
  resolveColor,
  shortMagnitude,
  svg,
  text,
  niceScale,
  valueOf,
  type ChartSegment,
} from './shared.js';

/** Bars laid out horizontally, and the column-shaped charts that share their maths. */

const ROW = 40;
const BAR_H = 20;
const TRACK_X = 320;
const TRACK_W = W - TRACK_X;

/**
 * Horizontal bars, which suit long category names far better than columns do.
 *
 * A logarithmic scale is offered because the interesting comparisons are often
 * orders of magnitude apart — on a linear axis the smaller bar is not visible,
 * and a chart that hides one of its two values is not a chart.
 */
export function barChart(chart: ChartSegment, colors: ColorTokens): string {
  const values = chart.data.map(valueOf);
  const top = 0;
  const unit = chart.unit ?? '';

  const log = chart.scale === 'log';
  const min = log ? Math.min(...values.filter((value) => value > 0)) / 10 : 0;
  const max = chart.max ?? Math.max(...values, log ? 1 : 0);

  const fraction = (value: number): number => {
    if (!log) return max > 0 ? Math.max(0, value / max) : 0;
    if (value <= 0 || min <= 0) return 0;
    return Math.max(0, Math.log10(value / min) / Math.log10(max / min));
  };

  const rows = chart.data.map((datum, index) => {
    const y = top + index * ROW;
    const color = resolveColor(datum.color, index, colors);
    const width = TRACK_W * fraction(valueOf(datum));
    const value = labelFor(datum, unit);

    // The value sits inside a bar wide enough to hold it, so a full-width bar
    // can never push its own label out of the viewBox.
    const inside = width > 140;
    return [
      text(0, y + (datum.note ? 11 : 15), datum.label, 'rg-chart__label'),
      datum.note ? text(0, y + 24, datum.note, 'rg-chart__note') : '',
      `<rect x="${TRACK_X}" y="${y + 1}" width="${TRACK_W}" height="${BAR_H}" class="rg-chart__track"/>`,
      `<rect x="${TRACK_X}" y="${y + 1}" width="${width.toFixed(1)}" height="${BAR_H}" fill="${color}"/>`,
      inside
        ? text(TRACK_X + width - 8, y + 15, value, 'rg-chart__value rg-chart__value--in', ' text-anchor="end"')
        : text(TRACK_X + width + 8, y + 15, value, 'rg-chart__value', ` fill="${color}"`),
    ].join('');
  });

  const axisY = top + chart.data.length * ROW;
  const ticks = log ? logTicks(min, max) : [0, max / 2, max];
  const axis =
    `<line x1="${TRACK_X}" y1="${axisY}" x2="${W}" y2="${axisY}" class="rg-chart__axis"/>` +
    ticks
      .map((tick) =>
        text(
          TRACK_X + TRACK_W * fraction(tick),
          axisY + 16,
          log ? shortMagnitude(tick) : formatValue(tick, unit),
          'rg-chart__tick',
          ' text-anchor="middle"',
        ),
      )
      .join('');

  return svg(axisY + 26, rows.join('') + axis);
}

function logTicks(min: number, max: number): number[] {
  const ticks: number[] = [];
  for (let power = Math.ceil(Math.log10(min)); Math.pow(10, power) <= max; power += 3) {
    ticks.push(Math.pow(10, power));
  }
  return ticks;
}

// --- vertical families ------------------------------------------------------

const PLOT = { left: 52, right: 12, top: 14, height: 200, labels: 30 };

type Column = { x: number; width: number };

/** Evenly spaced column slots across the plot area. */
function columns(count: number): { slot: number; at: (index: number) => Column } {
  const plotW = W - PLOT.left - PLOT.right;
  const slot = plotW / count;
  const width = Math.min(64, slot * 0.62);
  return {
    slot,
    at: (index) => ({ x: PLOT.left + slot * index + (slot - width) / 2, width }),
  };
}

function grid(ticks: number[], unit: string, toY: (value: number) => number): string {
  return ticks
    .map(
      (value) =>
        `<line x1="${PLOT.left}" y1="${toY(value).toFixed(1)}" x2="${W - PLOT.right}" y2="${toY(value).toFixed(1)}" class="rg-chart__grid"/>` +
        text(PLOT.left - 8, toY(value) + 3.5, formatValue(value, unit), 'rg-chart__tick', ' text-anchor="end"'),
    )
    .join('');
}

/** Vertical bars — the shape most readers expect for a short time series. */
export function columnChart(chart: ChartSegment, colors: ColorTokens): string {
  const top = PLOT.top;
  const unit = chart.unit ?? '';
  const scale = chart.max === undefined ? niceScale(Math.max(...chart.data.map(valueOf))) : { max: chart.max, ticks: [] };
  const max = scale.max;
  const ticks = scale.ticks.length ? scale.ticks : niceScale(max).ticks;
  const toY = (value: number): number => top + PLOT.height * (1 - value / max);
  const { at } = columns(chart.data.length);

  const bars = chart.data
    .map((datum, index) => {
      const { x, width } = at(index);
      const value = valueOf(datum);
      const y = toY(value);
      const color = resolveColor(datum.color, index, colors);
      return (
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${width.toFixed(1)}" height="${(top + PLOT.height - y).toFixed(1)}" fill="${color}"/>` +
        text(x + width / 2, y - 6, labelFor(datum, unit), 'rg-chart__value', ` fill="${color}" text-anchor="middle"`) +
        text(x + width / 2, top + PLOT.height + 16, datum.label, 'rg-chart__tick', ' text-anchor="middle"')
      );
    })
    .join('');

  return svg(top + PLOT.height + PLOT.labels, grid(ticks, unit, toY) + bars);
}

/**
 * Columns split into stacked parts — how a total is composed, category by
 * category. Each datum carries `values`, one per entry in `series`.
 */
export function stackedBarChart(chart: ChartSegment, colors: ColorTokens): string {
  const top = PLOT.top;
  const unit = chart.unit ?? '';
  const totals = chart.data.map((datum) => (datum.values ?? []).reduce((sum, part) => sum + part, 0));
  const scale = chart.max === undefined ? niceScale(Math.max(...totals)) : { max: chart.max, ticks: niceScale(chart.max).ticks };
  const max = scale.max;
  const ticks = scale.ticks;
  const toY = (value: number): number => top + PLOT.height * (1 - value / max);
  const { at } = columns(chart.data.length);

  const stacks = chart.data
    .map((datum, index) => {
      const { x, width } = at(index);
      let running = 0;
      const parts = (datum.values ?? [])
        .map((part, partIndex) => {
          const y = toY(running + part);
          const height = PLOT.height * (part / max);
          running += part;
          const color = resolveColor(chart.series?.[partIndex]?.color, partIndex, colors);
          return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" fill="${color}"/>`;
        })
        .join('');
      return (
        parts +
        text(x + width / 2, toY(running) - 6, formatValue(running, unit), 'rg-chart__value', ' text-anchor="middle"') +
        text(x + width / 2, top + PLOT.height + 16, datum.label, 'rg-chart__tick', ' text-anchor="middle"')
      );
    })
    .join('');

  const key = legend(chart, colors, top + PLOT.height + PLOT.labels + 4);
  return svg(
    top + PLOT.height + PLOT.labels + key.height + 6,
    grid(ticks, unit, toY) + stacks + key.markup,
  );
}

/**
 * A waterfall: how a starting figure becomes an ending one, step by step.
 *
 * A negative value falls, a positive one rises, and a datum marked `total`
 * (via `color: "primary"` on the last entry, or simply the final row) is drawn
 * from the baseline so the reader can see where the running sum landed.
 */
export function waterfallChart(chart: ChartSegment, colors: ColorTokens): string {
  const top = PLOT.top;
  const unit = chart.unit ?? '';

  let running = 0;
  const steps = chart.data.map((datum, index) => {
    const value = valueOf(datum);
    const isTotal = index === chart.data.length - 1 && datum.note === 'total';
    const from = isTotal ? 0 : running;
    const to = isTotal ? value : running + value;
    if (!isTotal) running += value;
    return { datum, from, to, isTotal, value };
  });

  const highest = Math.max(...steps.map((step) => Math.max(step.from, step.to)), 0);
  const scale = chart.max === undefined ? niceScale(highest) : { max: chart.max, ticks: niceScale(chart.max).ticks };
  const max = scale.max;
  const ticks = scale.ticks;
  const toY = (value: number): number => top + PLOT.height * (1 - value / max);
  const { at } = columns(chart.data.length);

  const bars = steps
    .map((step, index) => {
      const { x, width } = at(index);
      const yTop = toY(Math.max(step.from, step.to));
      const height = Math.abs(toY(step.from) - toY(step.to));
      const color = step.isTotal
        ? resolveColor(step.datum.color ?? 'primary', 0, colors)
        : resolveColor(step.datum.color ?? (step.value >= 0 ? 'success' : 'danger'), index, colors);
      const connector =
        index < steps.length - 1 && !steps[index + 1]!.isTotal
          ? `<line x1="${(x + width).toFixed(1)}" y1="${toY(step.to).toFixed(1)}" x2="${at(index + 1).x.toFixed(1)}" y2="${toY(step.to).toFixed(1)}" class="rg-chart__grid"/>`
          : '';
      return (
        `<rect x="${x.toFixed(1)}" y="${yTop.toFixed(1)}" width="${width.toFixed(1)}" height="${Math.max(1, height).toFixed(1)}" fill="${color}"/>` +
        connector +
        text(
          x + width / 2,
          yTop - 6,
          step.datum.text ?? `${step.value > 0 && !step.isTotal ? '+' : ''}${formatValue(step.value, unit)}`,
          'rg-chart__value',
          ` fill="${color}" text-anchor="middle"`,
        ) +
        text(x + width / 2, top + PLOT.height + 16, step.datum.label, 'rg-chart__tick', ' text-anchor="middle"')
      );
    })
    .join('');

  return svg(top + PLOT.height + PLOT.labels, grid(ticks, unit, toY) + bars);
}
