import { renderSegment } from '../base/segments.js';
import type { Template } from '../types.js';
import { stylesheet } from './css.js';

/** A landscape report that reads like a deck: full-page cover, a section per page. */
export const sunumRaporu: Template = {
  name: 'sunum-raporu',
  stylesheet,
  renderSegment,
};
