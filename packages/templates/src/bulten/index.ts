import { renderSegment } from '../base/segments.js';
import type { Template } from '../types.js';
import { stylesheet } from './css.js';

/** The newsletter: a band on every page, display headings, drop caps, pull quotes. */
export const bulten: Template = {
  name: 'bulten',
  stylesheet,
  renderSegment,
};
