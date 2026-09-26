import { renderSegment } from '../base/segments.js';
import type { Template } from '../types.js';
import { stylesheet } from './css.js';

/** A contract: serif, justified, numbered articles, signature lines. */
export const sozlesme: Template = {
  name: 'sozlesme',
  stylesheet,
  renderSegment,
};
