import { describe, expect, it } from 'vitest';
import { parseSegment } from '@raporgo/core/document';
import { formatValue, renderChart, withChartLocale, type ChartSegment } from './chart/index.js';
import { palettes } from './tokens.js';

const colors = palettes['lacivert']!;

function chart(input: Record<string, unknown>): ChartSegment {
  return parseSegment({ id: 'g', type: 'chart', ...input }) as ChartSegment;
}

/** Every `<rect>`/`<circle>` width the renderer emitted, in document order. */
function barWidths(svg: string): number[] {
  return [...svg.matchAll(/<rect[^>]*?width="([\d.]+)"[^>]*?fill="#/g)].map((m) => Number(m[1]));
}

describe('formatValue', () => {
  it('groups thousands with dots and uses a comma for the fraction', () => {
    expect(formatValue(8800)).toBe('8.800');
    expect(formatValue(1234567)).toBe('1.234.567');
    expect(formatValue(3.5)).toBe('3,5');
    expect(formatValue(96, '%')).toBe('96%');
  });

  it('follows the document language while a chart is drawn', () => {
    const english = { tag: 'en', target: 'target' };
    expect(withChartLocale(english, () => formatValue(8800))).toBe('8,800');
    expect(withChartLocale(english, () => formatValue(3.5, ' h'))).toBe('3.5 h');
    const gauge = chart({ chart: 'gauge', target: 80, unit: '%', data: [{ label: 'x', value: 64 }] });
    expect(withChartLocale(english, () => renderChart(gauge, colors))).toContain('target 80%');
    // And back to Turkish afterwards.
    expect(formatValue(8800)).toBe('8.800');
  });
});

describe('bar chart', () => {
  it('scales bars against the largest value by default', () => {
    const svg = renderChart(chart({ chart: 'bar', unit: '%', data: [
      { label: 'A', value: 100 },
      { label: 'B', value: 50 },
    ] }), colors);
    const [a, b] = barWidths(svg);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeCloseTo(a! / 2, 1);
  });

  it('honours an explicit max so a 96% bar is not drawn full width', () => {
    const svg = renderChart(chart({ chart: 'bar', max: 100, unit: '%', data: [{ label: 'A', value: 96 }] }), colors);
    const [width] = barWidths(svg);
    expect(width).toBeLessThan(400);
    expect(width! / 400).toBeCloseTo(0.96, 2);
  });

  /**
   * The case that motivated the log scale: 8.8e12 against 4.15e9. On a linear
   * axis the smaller bar is under a pixel wide and the chart hides one of its
   * two values.
   */
  it('keeps a value orders of magnitude smaller visible on a log scale', () => {
    const data = [
      { label: 'Talep', value: 8.8e12 },
      { label: 'Arz', value: 4.15e9 },
    ];
    const linear = barWidths(renderChart(chart({ chart: 'bar', data }), colors));
    const log = barWidths(renderChart(chart({ chart: 'bar', scale: 'log', data }), colors));

    // Linear: under a point wide out of a 400pt track — invisible on paper.
    expect(linear[1]).toBeLessThan(1);
    // Log: a fifth of the track, and still clearly shorter than the big one.
    expect(log[1]).toBeGreaterThan(50);
    expect(log[0]).toBeGreaterThan(log[1]! * 2);
  });

  it('puts the value inside a wide bar so it cannot leave the viewBox', () => {
    const svg = renderChart(chart({ chart: 'bar', data: [{ label: 'A', value: 100, text: '8,8 trilyon $' }] }), colors);
    expect(svg).toContain('rg-chart__value--in');
    expect(svg).toContain('text-anchor="end"');
    expect(svg).toContain('8,8 trilyon $');
  });

  it('places the value outside a short bar instead', () => {
    const svg = renderChart(chart({ chart: 'bar', max: 100, data: [{ label: 'A', value: 5 }] }), colors);
    expect(svg).not.toContain('rg-chart__value--in');
  });
});

describe('line chart', () => {
  it('spreads points evenly and puts the highest value at the top', () => {
    const svg = renderChart(chart({ chart: 'line', max: 100, unit: '%', data: [
      { label: '2014', value: 28 },
      { label: '2019', value: 60 },
      { label: '2024', value: 95 },
    ] }), colors);

    const points = /points="([^"]+)"/.exec(svg)![1]!.split(' ').map((p) => p.split(',').map(Number));
    expect(points).toHaveLength(3);
    // Evenly spaced horizontally.
    expect(points[1]![0]! - points[0]![0]!).toBeCloseTo(points[2]![0]! - points[1]![0]!, 1);
    // Higher value means smaller y — SVG counts downwards.
    expect(points[2]![1]!).toBeLessThan(points[0]![1]!);
  });

  it('draws the marker at the point it names, and nothing when it names nothing', () => {
    const data = [
      { label: '2014', value: 28 },
      { label: '2016', value: 45 },
    ];
    expect(renderChart(chart({ chart: 'line', data, marker: { at: '2016', label: "Let's Encrypt" } }), colors))
      .toContain('rg-chart__marker');
    expect(renderChart(chart({ chart: 'line', data, marker: { at: '1999', label: 'yok' } }), colors))
      .not.toContain('rg-chart__marker');
  });
});

describe('donut chart', () => {
  it('fills the ring in proportion to the value', () => {
    const svg = renderChart(chart({ chart: 'donut', unit: '%', data: [
      { label: 'Tam', value: 100 },
      { label: 'Yarım', value: 50 },
    ] }), colors);

    const dashes = [...svg.matchAll(/stroke-dasharray="([\d.]+) ([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
    // Coordinates are emitted at one decimal place, so compare to within half a unit.
    expect(dashes[0]![0]).toBeCloseTo(dashes[0]![1]!, 0); // full ring
    expect(dashes[1]![0]).toBeCloseTo(dashes[1]![1]! / 2, 0); // half ring
  });

  it('never overfills a ring when the value exceeds the max', () => {
    const svg = renderChart(chart({ chart: 'donut', max: 100, data: [{ label: 'A', value: 140 }] }), colors);
    const [filled, total] = [...svg.matchAll(/stroke-dasharray="([\d.]+) ([\d.]+)"/g)][0]!.slice(1).map(Number);
    expect(filled).toBeLessThanOrEqual(total! + 0.1);
  });
});

describe('theming and safety', () => {
  it('resolves palette token names against the document palette', () => {
    const svg = renderChart(chart({ chart: 'bar', data: [{ label: 'A', value: 1, color: 'accent' }] }), colors);
    expect(svg).toContain(colors.accent);
  });

  it('accepts a literal hex colour for a deliberate exception', () => {
    const svg = renderChart(chart({ chart: 'bar', data: [{ label: 'A', value: 1, color: '#123456' }] }), colors);
    expect(svg).toContain('#123456');
  });

  it('escapes labels, so report text cannot inject markup into the chart', () => {
    const svg = renderChart(chart({ chart: 'bar', data: [{ label: '<script>x</script>', value: 1 }] }), colors);
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('sizes the viewBox to the number of rows', () => {
    const one = /viewBox="0 0 720 ([\d.]+)"/.exec(
      renderChart(chart({ chart: 'bar', data: [{ label: 'A', value: 1 }] }), colors),
    )![1]!;
    const three = /viewBox="0 0 720 ([\d.]+)"/.exec(
      renderChart(chart({ chart: 'bar', data: [
        { label: 'A', value: 1 }, { label: 'B', value: 1 }, { label: 'C', value: 1 },
      ] }), colors),
    )![1]!;
    expect(Number(three)).toBeGreaterThan(Number(one));
  });
});

describe('column family', () => {
  it('draws taller bars for larger values and sits them on the baseline', () => {
    const svg = renderChart(chart({ chart: 'column', max: 100, unit: '%', data: [
      { label: 'A', value: 25 },
      { label: 'B', value: 75 },
    ] }), colors);
    const bars = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)"[^>]*height="([\d.]+)" fill="#/g)]
      .map((m) => ({ x: Number(m[1]), y: Number(m[2]), h: Number(m[3]) }));
    expect(bars).toHaveLength(2);
    expect(bars[1]!.h).toBeCloseTo(bars[0]!.h * 3, 0);
    // Both end at the same baseline.
    expect(bars[0]!.y + bars[0]!.h).toBeCloseTo(bars[1]!.y + bars[1]!.h, 1);
    expect(bars[1]!.x).toBeGreaterThan(bars[0]!.x);
  });

  it('stacks values in order and totals them above the column', () => {
    const svg = renderChart(chart({ chart: 'stackedBar', max: 100,
      series: [{ name: 'Geliştirme' }, { name: 'Bakım' }],
      data: [{ label: '2024', values: [30, 20] }] }), colors);
    // Filter out the 10pt legend swatches, which share the rect shape.
    const heights = [...svg.matchAll(/height="([\d.]+)" fill="#/g)]
      .map((m) => Number(m[1]))
      .filter((height) => height > 15);
    expect(heights).toHaveLength(2);
    expect(heights[0]).toBeCloseTo(heights[1]! * 1.5, 0);
    expect(svg).toContain('>50<');
    // Two series means a legend.
    expect(svg).toContain('Geliştirme');
    expect(svg).toContain('Bakım');
  });

  it('runs a waterfall from the running total and marks gains and losses apart', () => {
    const svg = renderChart(chart({ chart: 'waterfall', data: [
      { label: 'Başlangıç', value: 100 },
      { label: 'Artış', value: 40 },
      { label: 'Azalış', value: -30 },
      { label: 'Sonuç', value: 110, note: 'total' },
    ] }), colors);
    expect(svg).toContain(colors.success); // the gain
    expect(svg).toContain(colors.danger); // the loss
    expect(svg).toContain('+40');
    expect(svg).toContain('-30');
  });
});

describe('area and scatter', () => {
  it('closes an area chart back to the baseline', () => {
    const svg = renderChart(chart({ chart: 'area', max: 100, data: [
      { label: 'A', value: 20 }, { label: 'B', value: 60 },
    ] }), colors);
    expect(svg).toContain('<polygon');
    expect(svg).toContain('fill-opacity="0.14"');
    // The line itself is still drawn on top.
    expect(svg).toContain('<polyline');
  });

  it('places scatter points by x as well as by value', () => {
    const svg = renderChart(chart({ chart: 'scatter', max: 100, data: [
      { label: 'A', x: 10, value: 20 },
      { label: 'B', x: 90, value: 80 },
    ] }), colors);
    const dots = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(dots).toHaveLength(2);
    expect(dots[1]![0]).toBeGreaterThan(dots[0]![0]!); // larger x is further right
    expect(dots[1]![1]).toBeLessThan(dots[0]![1]!); // larger value is higher up
  });
});

describe('pie, gauge and radar', () => {
  it('gives each slice its share of the circle and labels the large ones', () => {
    const svg = renderChart(chart({ chart: 'pie', data: [
      { label: 'Yarım', value: 50 },
      { label: 'Çeyrek', value: 25 },
      { label: 'Çeyrek 2', value: 25 },
    ] }), colors);
    expect([...svg.matchAll(/<path d="M/g)]).toHaveLength(3);
    expect(svg).toContain('50%');
    expect(svg).toContain('25%');
  });

  it('fills a gauge in proportion and marks the target when one is given', () => {
    const withTarget = renderChart(chart({ chart: 'gauge', max: 100, unit: '%', target: 80,
      data: [{ label: 'Kapsam', value: 62 }] }), colors);
    expect(withTarget).toContain('62%');
    expect(withTarget).toContain('rg-chart__marker');
    expect(withTarget).toContain('hedef 80%');

    const without = renderChart(chart({ chart: 'gauge', max: 100,
      data: [{ label: 'Kapsam', value: 62 }] }), colors);
    expect(without).not.toContain('rg-chart__marker');
  });

  it('draws one radar outline per series over shared axes', () => {
    const svg = renderChart(chart({ chart: 'radar', max: 10,
      series: [{ name: 'Bugün' }, { name: 'Hedef' }],
      data: [
        { label: 'Hız', values: [7, 9] },
        { label: 'Güvenlik', values: [5, 9] },
        { label: 'Maliyet', values: [8, 6] },
      ] }), colors);
    // Four grid rings, three spokes, two series outlines.
    const polygons = [...svg.matchAll(/<polygon/g)];
    expect(polygons).toHaveLength(6);
    expect(svg).toContain('Hız');
    expect(svg).toContain('Bugün');
  });
});

describe('axis rounding', () => {
  it('snaps the axis to numbers a person would have chosen', () => {
    // 131 with 12% headroom lands on 146.72; the axis should say 150.
    const svg = renderChart(chart({ chart: 'column', unit: ' bin', data: [{ label: 'A', value: 131 }] }), colors);
    expect(svg).toContain('>150 bin<');
    expect(svg).not.toContain('146,72');
  });

  it('keeps every gridline a round step apart', () => {
    const svg = renderChart(chart({ chart: 'column', data: [{ label: 'A', value: 47 }] }), colors);
    const ticks = [...svg.matchAll(/class="rg-chart__tick"[^>]*>([\d.,]+)</g)].map((m) => Number(m[1]!.replace('.', '')));
    const steps = ticks.slice(1).map((value, index) => value - ticks[index]!);
    expect(new Set(steps).size).toBe(1);
  });
});

describe('default colours', () => {
  it('keeps a line distinct from the accent-coloured marker rule', () => {
    const svg = renderChart(chart({ chart: 'line', marker: { at: 'B', label: 'Nokta' }, data: [
      { label: 'A', value: 1 }, { label: 'B', value: 2 },
    ] }), colors);
    expect(svg).toContain(`stroke="${colors.primaryAlt}"`);
    // The accent belongs to the marker, and only to the marker.
    expect(svg).not.toContain(`stroke="${colors.accent}"`);
  });
});
