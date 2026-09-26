import type { RaporDocument, Segment } from '@raporgo/core';
import type { ColorTokens } from './tokens.js';

export type RenderContext = {
  doc: RaporDocument;
  colors: ColorTokens;
  /** Resolved badge number per section segment id. */
  sectionNumbers: Map<string, number>;
  /**
   * Turns an `image.src` into a URL the browser can load, or null when the
   * file is missing or not yet chosen. Rendering stays best-effort — an
   * unfinished image must not take the whole preview down with it; catching
   * that is `validateDocument`'s job, and `raporgo render` runs it first.
   */
  assetUrl: (src: string) => string | null;
};

export type Template = {
  name: string;
  /** Full stylesheet for one document, including embedded fonts and page rules. */
  stylesheet(ctx: RenderContext): string;
  /** HTML for a single segment, already wrapped in its own block element. */
  renderSegment(segment: Segment, ctx: RenderContext): string;
};
