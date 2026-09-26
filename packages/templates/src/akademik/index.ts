import { renderSegment } from '../base/segments.js';
import type { Template } from '../types.js';
import { stylesheet } from './css.js';

/** The paper: serif, numbered headings, abstract, numbered figures and tables. */
export const akademik: Template = {
  name: 'akademik',
  stylesheet,
  renderSegment,
};
