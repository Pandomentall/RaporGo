import type { ColorTokens } from '../tokens.js';
import {
  W,
  formatValue,
  labelFor,
  resolveColor,
  svg,
  text,
  niceScale,
  valueOf,
  type ChartSegment,
} from './shared.js';

/** Charts plotted against a pair of axes: line, area and scatter. */

const PLOT = { left: 52, right: 22, top: 12, height: 190, bottom: 30 };

type Plot = {
  top: number;
  width: number;
  x: (index: number) => number;
  y: (value: number) => number;
  max: number;
  ticks: number[];
};

function plotOf(chart: ChartSegment, headHeight: number): Plot {
  const top = headHeight + PLOT.top;
  const width = W - PLOT.left - PLOT.right;
  const scale = chart.max === undefined ? niceScale(Math.max(...chart.data.map(valueOf))) : { max: chart.max, ticks: niceScale(chart.max).ticks };
  const step = chart.data.length > 1 ? width / (chart.data.length - 1) : 0;
  return {
    top,
    width,
    max: scale.max,
    ticks: scale.ticks,
    x: (index) => PLOT.left + step * index,
    y: (value) => top + PLOT.height * (1 - value / scale.max),
  };
}

function grid(plot: Plot, unit: string): string {
  return plot.ticks
    .map(
      (value) =>
        `<line x1="${PLOT.left}" y1="${plot.y(value).toFixed(1)}" x2="${PLOT.left + plot.width}" y2="${plot.y(value).toFixed(1)}" class="rg-chart__grid"/>` +
        text(PLOT.left - 8, plot.y(value) + 3.5, formatValue(value, unit), 'rg-chart__tick', ' text-anchor="end"'),
    )
    .join('');
}

/** The optional vertical rule that annotates one point on the x axis. */
function marker(chart: ChartSegment, plot: Plot): string {
  if (!chart.marker) return '';
  const index = chart.data.findIndex((datum) => datum.label === chart.marker!.at);
  if (index < 0) return '';
  const x = plot.x(index);
  return (
    `<line x1="${x.toFixed(1)}" y1="${plot.top}" x2="${x.toFixed(1)}" y2="${plot.top + PLOT.height}" class="rg-chart__marker"/>` +
    text(x + 6, plot.top + 12, chart.marker.label, 'rg-chart__marker-label')
  );
}

function xLabels(chart: ChartSegment, plot: Plot): string {
  return chart.data
    .map((datum, index) =>
      text(plot.x(index), plot.top + PLOT.height + 18, datum.label, 'rg-chart__tick', ' text-anchor="middle"'),
    )
    .join('');
}

export function lineChart(chart: ChartSegment, colors: ColorTokens, filled = false): string {
  const plot = plotOf(chart, 0);
  const unit = chart.unit ?? '';
  // Named rather than taken from the series order: the marker rule is drawn in
  // the accent colour, so a line that defaulted to accent would merge with it.
  const color = resolveColor(chart.data[0]?.color ?? 'primaryAlt', 0, colors);

  const points = chart.data.map((datum, index) => `${plot.x(index).toFixed(1)},${plot.y(valueOf(datum)).toFixed(1)}`);
  const baseline = plot.top + PLOT.height;
  const area = filled
    ? `<polygon points="${plot.x(0).toFixed(1)},${baseline} ${points.join(' ')} ${plot.x(chart.data.length - 1).toFixed(1)},${baseline}" fill="${color}" fill-opacity="0.14"/>`
    : '';

  // The end labels lean inward: centred on the first point, a label runs
  // over the axis numbers; on the last, past the plot's right edge.
  const last = chart.data.length - 1;
  const anchor = (index: number): string => (last > 0 && index === 0 ? 'start' : last > 0 && index === last ? 'end' : 'middle');
  const nudge = (index: number): number => (anchor(index) === 'start' ? -4 : anchor(index) === 'end' ? 4 : 0);
  const dots = chart.data
    .map(
      (datum, index) =>
        `<circle cx="${plot.x(index).toFixed(1)}" cy="${plot.y(valueOf(datum)).toFixed(1)}" r="3.5" fill="${color}"/>` +
        text(
          plot.x(index) + nudge(index),
          plot.y(valueOf(datum)) - 9,
          labelFor(datum, unit),
          'rg-chart__value',
          ` fill="${color}" text-anchor="${anchor(index)}"`,
        ),
    )
    .join('');

  return svg(
    plot.top + PLOT.height + PLOT.bottom,
          grid(plot, unit) +
      marker(chart, plot) +
      area +
      `<polyline points="${points.join(' ')}" fill="none" stroke="${color}" stroke-width="2.5"/>` +
      dots +
      xLabels(chart, plot),
  );
}

export function areaChart(chart: ChartSegment, colors: ColorTokens): string {
  return lineChart(chart, colors, true);
}

/**
 * Scatter: each datum is a point at (`x`, `value`), for showing whether two
 * measurements move together. Falls back to the row index when `x` is absent,
 * which degrades to an unconnected line rather than to nothing.
 */
export function scatterChart(chart: ChartSegment, colors: ColorTokens): string {
  const top = PLOT.top;
  const width = W - PLOT.left - PLOT.right;
  const unit = chart.unit ?? '';

  const xs = chart.data.map((datum, index) => datum.x ?? index);
  const xScale = niceScale(Math.max(...xs));
  const yScale = chart.max === undefined ? niceScale(Math.max(...chart.data.map(valueOf))) : { max: chart.max, ticks: niceScale(chart.max).ticks };
  const toX = (value: number): number => PLOT.left + width * (value / xScale.max);
  const toY = (value: number): number => top + PLOT.height * (1 - value / yScale.max);

  const grid = yScale.ticks
    .map(
      (value) =>
        `<line x1="${PLOT.left}" y1="${toY(value).toFixed(1)}" x2="${PLOT.left + width}" y2="${toY(value).toFixed(1)}" class="rg-chart__grid"/>` +
        text(PLOT.left - 8, toY(value) + 3.5, formatValue(value, unit), 'rg-chart__tick', ' text-anchor="end"'),
    )
    .join('');

  const xTicks = xScale.ticks
    .map((value) => text(toX(value), top + PLOT.height + 18, formatValue(value), 'rg-chart__tick', ' text-anchor="middle"'))
    .join('');

  // One colour for the whole cloud unless a point asks otherwise: a scatter
  // shows one relationship, and per-point colours read as extra categories.
  const seriesColor = resolveColor(chart.data[0]?.color ?? 'primaryAlt', 0, colors);
  const dots = chart.data
    .map((datum, index) => {
      const cx = toX(xs[index]!);
      const cy = toY(valueOf(datum));
      const color = datum.color ? resolveColor(datum.color, index, colors) : seriesColor;
      return (
        `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.5" fill="${color}" fill-opacity="0.85"/>` +
        text(cx, cy - 9, datum.label, 'rg-chart__note', ' text-anchor="middle"')
      );
    })
    .join('');

  return svg(top + PLOT.height + PLOT.bottom, grid + xTicks + dots);
}
