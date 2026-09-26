import type { ColorTokens } from '../tokens.js';
import { barChart, columnChart, stackedBarChart, waterfallChart } from './bars.js';
import { areaChart, lineChart, scatterChart } from './lines.js';
import { donutChart, gaugeChart, pieChart, radarChart } from './parts.js';
import type { ChartSegment } from './shared.js';

export { formatValue, withChartLocale } from './shared.js';
export type { ChartSegment } from './shared.js';

/** Renders one chart segment's inline SVG. */
export function renderChart(chart: ChartSegment, colors: ColorTokens): string {
  switch (chart.chart) {
    case 'column':
      return columnChart(chart, colors);
    case 'stackedBar':
      return stackedBarChart(chart, colors);
    case 'waterfall':
      return waterfallChart(chart, colors);
    case 'line':
      return lineChart(chart, colors);
    case 'area':
      return areaChart(chart, colors);
    case 'scatter':
      return scatterChart(chart, colors);
    case 'pie':
      return pieChart(chart, colors);
    case 'donut':
      return donutChart(chart, colors);
    case 'gauge':
      return gaugeChart(chart, colors);
    case 'radar':
      return radarChart(chart, colors);
    default:
      return barChart(chart, colors);
  }
}
