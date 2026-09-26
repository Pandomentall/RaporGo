import type { ColorTokens } from '../tokens.js';
import {
  W,
  formatValue,
  labelFor,
  legend,
  resolveColor,
  svg,
  targetWord,
  text,
  valueOf,
  type ChartSegment,
} from './shared.js';

/** Radial charts: rings, slices, arcs and webs. */

const RING = { radius: 44, stroke: 13, labelGap: 22 };

/**
 * One ring per datum — a row of independent percentages, not slices of a
 * single whole. `pie` is the chart for parts of a whole; this is the one for
 * "how far along is each of these".
 */
export function donutChart(chart: ChartSegment, colors: ColorTokens): string {
  const max = chart.max ?? 100;
  const slot = W / chart.data.length;
  const cy = RING.radius + 12;
  const hasNotes = chart.data.some((datum) => datum.note);
  const circumference = 2 * Math.PI * RING.radius;

  const rings = chart.data
    .map((datum, index) => {
      const cx = slot * index + slot / 2;
      const color = resolveColor(datum.color, index, colors);
      const filled = circumference * Math.min(1, Math.max(0, valueOf(datum) / max));
      return [
        `<circle cx="${cx.toFixed(1)}" cy="${cy}" r="${RING.radius}" class="rg-chart__ring-track" stroke-width="${RING.stroke}"/>`,
        `<circle cx="${cx.toFixed(1)}" cy="${cy}" r="${RING.radius}" fill="none" stroke="${color}" stroke-width="${RING.stroke}" stroke-dasharray="${filled.toFixed(1)} ${circumference.toFixed(1)}" transform="rotate(-90 ${cx.toFixed(1)} ${cy})"/>`,
        text(cx, cy + 6, labelFor(datum, chart.unit ?? ''), 'rg-chart__ring-value', ` fill="${color}" text-anchor="middle"`),
        text(cx, cy + RING.radius + RING.labelGap, datum.label, 'rg-chart__label', ' text-anchor="middle"'),
        datum.note ? text(cx, cy + RING.radius + RING.labelGap + 14, datum.note, 'rg-chart__note', ' text-anchor="middle"') : '',
      ].join('');
    })
    .join('');

  return svg(cy + RING.radius + RING.labelGap + (hasNotes ? 30 : 16), rings);
}

/** Point on a circle, measured clockwise from twelve o'clock. */
function polar(cx: number, cy: number, radius: number, turns: number): [number, number] {
  const angle = turns * 2 * Math.PI - Math.PI / 2;
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
}

function arcPath(cx: number, cy: number, radius: number, from: number, to: number, inner = 0): string {
  const [x1, y1] = polar(cx, cy, radius, from);
  const [x2, y2] = polar(cx, cy, radius, to);
  const large = to - from > 0.5 ? 1 : 0;
  if (inner === 0) {
    return `M${cx.toFixed(1)} ${cy.toFixed(1)} L${x1.toFixed(1)} ${y1.toFixed(1)} A${radius} ${radius} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`;
  }
  const [ix1, iy1] = polar(cx, cy, inner, to);
  const [ix2, iy2] = polar(cx, cy, inner, from);
  return (
    `M${x1.toFixed(1)} ${y1.toFixed(1)} A${radius} ${radius} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} ` +
    `L${ix1.toFixed(1)} ${iy1.toFixed(1)} A${inner} ${inner} 0 ${large} 0 ${ix2.toFixed(1)} ${iy2.toFixed(1)} Z`
  );
}

/** Slices of a single whole, with the legend carrying the labels. */
export function pieChart(chart: ChartSegment, colors: ColorTokens): string {
  const radius = 86;
  const cx = 200;
  const cy = radius + 10;
  const total = chart.data.reduce((sum, datum) => sum + valueOf(datum), 0) || 1;

  let cursor = 0;
  const slices = chart.data
    .map((datum, index) => {
      const share = valueOf(datum) / total;
      const path = arcPath(cx, cy, radius, cursor, cursor + share);
      const [lx, ly] = polar(cx, cy, radius * 0.62, cursor + share / 2);
      cursor += share;
      const color = resolveColor(datum.color, index, colors);
      return (
        `<path d="${path}" fill="${color}"/>` +
        (share > 0.06
          ? text(lx, ly + 4, `${Math.round(share * 100)}%`, 'rg-chart__value rg-chart__value--in', ' text-anchor="middle"')
          : '')
      );
    })
    .join('');

  // The key sits beside the pie rather than under it: slice labels crowd
  // badly at report scale, and there is spare width to the right.
  const keyX = cx + radius + 40;
  const key = chart.data
    .map((datum, index) => {
      const y = 18 + index * 22;
      return (
        `<rect x="${keyX}" y="${y - 9}" width="11" height="11" fill="${resolveColor(datum.color, index, colors)}"/>` +
        text(keyX + 17, y, datum.label, 'rg-chart__label') +
        text(W, y, labelFor(datum, chart.unit ?? ''), 'rg-chart__value', ' text-anchor="end"')
      );
    })
    .join('');

  return svg(
    Math.max(cy + radius + 14, 18 + chart.data.length * 22 + 10),
    slices + key,
  );
}

/**
 * A single measurement against its scale, with an optional target tick — the
 * shape a report uses for "where are we on this one number".
 */
export function gaugeChart(chart: ChartSegment, colors: ColorTokens): string {
  const radius = 92;
  const thickness = 22;
  const cx = W / 2;
  const cy = radius + 14;
  const max = chart.max ?? 100;
  const datum = chart.data[0]!;
  const share = Math.min(1, Math.max(0, valueOf(datum) / max));
  const color = resolveColor(datum.color, 0, colors);

  // Half circle: three quarters of a turn round to one quarter.
  const start = 0.75;
  const sweep = 0.5;

  const parts = [
    `<path d="${arcPath(cx, cy, radius, start, start + sweep, radius - thickness)}" class="rg-chart__track"/>`,
    `<path d="${arcPath(cx, cy, radius, start, start + sweep * share, radius - thickness)}" fill="${color}"/>`,
    text(cx, cy - 6, labelFor(datum, chart.unit ?? ''), 'rg-chart__ring-value', ` fill="${color}" text-anchor="middle"`),
    text(cx, cy + 14, datum.label, 'rg-chart__label', ' text-anchor="middle"'),
    text(cx - radius, cy + 16, formatValue(0, chart.unit ?? ''), 'rg-chart__tick', ' text-anchor="middle"'),
    text(cx + radius, cy + 16, formatValue(max, chart.unit ?? ''), 'rg-chart__tick', ' text-anchor="middle"'),
  ];

  if (chart.target !== undefined) {
    const at = start + sweep * Math.min(1, Math.max(0, chart.target / max));
    const [ox, oy] = polar(cx, cy, radius + 5, at);
    const [ix, iy] = polar(cx, cy, radius - thickness - 5, at);
    parts.push(
      `<line x1="${ix.toFixed(1)}" y1="${iy.toFixed(1)}" x2="${ox.toFixed(1)}" y2="${oy.toFixed(1)}" class="rg-chart__marker"/>`,
      text(ox, oy - 6, `${targetWord()} ${formatValue(chart.target, chart.unit ?? '')}`, 'rg-chart__marker-label', ' text-anchor="middle"'),
    );
  }

  // A half gauge only occupies the space above its centre plus the readouts.
  return svg(cy + 34, parts.join(''));
}

/**
 * A radar web: several measurements compared across the same set of axes.
 * Each datum is one axis; each entry in `series` is one outline.
 */
export function radarChart(chart: ChartSegment, colors: ColorTokens): string {
  const radius = 96;
  const cx = W / 2;
  const cy = radius + 26;
  const max = chart.max ?? Math.max(...chart.data.flatMap((datum) => datum.values ?? [valueOf(datum)]));
  const axes = chart.data.length;
  const seriesCount = Math.max(1, chart.series?.length ?? 1);

  const rings = [0.25, 0.5, 0.75, 1]
    .map((step) => {
      const points = chart.data
        .map((_, index) => polar(cx, cy, radius * step, index / axes).map((n) => n.toFixed(1)).join(','))
        .join(' ');
      return `<polygon points="${points}" fill="none" class="rg-chart__grid"/>`;
    })
    .join('');

  const spokes = chart.data
    .map((datum, index) => {
      const [ax, ay] = polar(cx, cy, radius, index / axes);
      const [lx, ly] = polar(cx, cy, radius + 18, index / axes);
      return (
        `<line x1="${cx}" y1="${cy}" x2="${ax.toFixed(1)}" y2="${ay.toFixed(1)}" class="rg-chart__grid"/>` +
        text(lx, ly + 3, datum.label, 'rg-chart__note', ' text-anchor="middle"')
      );
    })
    .join('');

  const webs = Array.from({ length: seriesCount }, (_, seriesIndex) => {
    const color = resolveColor(chart.series?.[seriesIndex]?.color, seriesIndex, colors);
    const points = chart.data
      .map((datum, index) => {
        const value = datum.values?.[seriesIndex] ?? valueOf(datum);
        return polar(cx, cy, radius * Math.min(1, value / max), index / axes)
          .map((n) => n.toFixed(1))
          .join(',');
      })
      .join(' ');
    return `<polygon points="${points}" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="2"/>`;
  }).join('');

  const key = legend(chart, colors, cy + radius + 40);
  return svg(cy + radius + 40 + key.height, rings + spokes + webs + key.markup);
}
