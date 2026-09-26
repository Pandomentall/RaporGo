import { renderSegment } from '../base/segments.js';
import type { Template } from '../types.js';
import { stylesheet } from './css.js';

/** Engineering notes: hairlines, a wide gutter, one accent colour. */
export const sadeTeknik: Template = {
  name: 'sade-teknik',
  stylesheet,
  renderSegment,
};
