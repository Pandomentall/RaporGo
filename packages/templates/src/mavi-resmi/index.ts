import { renderSegment } from '../base/segments.js';
import { stylesheet } from './css.js';
import type { Template } from '../types.js';

/** A port of the reference corporate report style, unbranded and re-themable. */
export const maviResmi: Template = {
  name: 'mavi-resmi',
  stylesheet,
  renderSegment,
};
