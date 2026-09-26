import { z } from 'zod';

/**
 * The RaporGo document schema.
 *
 * This schema is the contract between three clients of the same file: the
 * desktop editor, the `raporgo` CLI and any LLM that edits the JSON directly.
 * Every field carries a `.describe()` because those descriptions are emitted
 * into `schema/rapor-1.0.json`, which is what an LLM reads to learn the format.
 */

export const SCHEMA_VERSION = '1.0';

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a hex color such as #1b2a4a');

/**
 * Text fields accept a small inline markup subset so that a whole paragraph
 * stays a single readable JSON string: `**bold**`, `*italic*`, `` `code` ``,
 * `[label](https://url)` and `[text]{colour}`.
 */
const richText = z
  .string()
  .describe('Inline markup allowed: **bold**, *italic*, `code`, [label](url), [text]{colour} where colour is a palette role (primary, accent, danger, success, info, note, muted) or a hex');

const segmentId = z
  .string()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, 'Ids may contain letters, digits, hyphen and underscore')
  .describe('Stable identifier used to address this segment from the CLI, the editor and an LLM');

/** Fields shared by every segment. `id` may be omitted; `normalizeDocument` fills it in. */
const segmentBase = {
  id: segmentId.optional(),
  /** Free-form note for humans and LLMs; never rendered. */
  note: z.string().optional().describe('Editorial note, never rendered into the PDF'),
};

export const calloutVariants = ['info', 'warning', 'success', 'danger', 'note'] as const;
export const alignments = ['left', 'center', 'right'] as const;

// --- Segments ---------------------------------------------------------------

const CoverSegment = z.object({
  ...segmentBase,
  type: z.literal('cover'),
  eyebrow: z.string().optional().describe('Small uppercase label above the title; defaults to meta.eyebrow'),
  title: z.string().optional().describe('Defaults to meta.title'),
  subtitle: z.string().optional().describe('Defaults to meta.subtitle'),
});

const SectionSegment = z.object({
  ...segmentBase,
  type: z.literal('section'),
  title: z.string(),
  number: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Badge number. Omit to let RaporGo number sections sequentially at render time'),
});

const SubheadingSegment = z.object({
  ...segmentBase,
  type: z.literal('subheading'),
  text: z.string(),
});

const ParagraphSegment = z.object({
  ...segmentBase,
  type: z.literal('paragraph'),
  text: richText,
  align: z.enum(alignments).optional(),
  lead: z.boolean().optional().describe('Renders slightly larger, for an opening paragraph'),
});

const KeyValueTableSegment = z.object({
  ...segmentBase,
  type: z.literal('keyValueTable'),
  headers: z
    .tuple([z.string(), z.string()])
    .optional()
    .describe('Header row labels, e.g. ["Baslik", "Deger"]. Omit for a headerless table'),
  rows: z.array(z.tuple([z.string(), richText])).describe('[key, value] pairs, one per row'),
});

const TableColumn = z.object({
  label: z.string(),
  width: z.string().optional().describe('CSS width such as "30%" or "120pt"'),
  mono: z.boolean().optional().describe('Render this column in the monospace face'),
  align: z.enum(alignments).optional(),
});

const TableSegment = z.object({
  ...segmentBase,
  type: z.literal('table'),
  columns: z.array(TableColumn).min(1),
  rows: z.array(z.array(richText)).describe('Each row must have as many cells as there are columns'),
});

const StepItem = z.object({
  title: z.string(),
  desc: richText.optional(),
});

const StepsSegment = z.object({
  ...segmentBase,
  type: z.literal('steps'),
  items: z.array(StepItem).min(1),
  start: z.number().int().min(0).optional().describe('First step number, defaults to 1'),
});

const CalloutSegment = z.object({
  ...segmentBase,
  type: z.literal('callout'),
  variant: z.enum(calloutVariants).default('info'),
  title: z.string().optional(),
  text: richText,
});

const ImageSegment = z.object({
  ...segmentBase,
  type: z.literal('image'),
  src: z
    .string()
    .describe('Path relative to the document file, conventionally under assets/. Data URIs are not allowed'),
  caption: richText.optional(),
  width: z.string().optional().describe('CSS width such as "100%" or "420pt"'),
  border: z.boolean().optional().describe('Draw a hairline frame around the image, defaults to true'),
});

export const chartKinds = [
  'bar',
  'column',
  'stackedBar',
  'waterfall',
  'line',
  'area',
  'scatter',
  'pie',
  'donut',
  'gauge',
  'radar',
] as const;

/**
 * Colours are named against the template palette rather than given as hex, so
 * a chart follows the document's theme the way every other segment does. A
 * literal hex value is still allowed for the rare deliberate exception.
 */
const chartColor = z
  .string()
  .describe('Palette token (primary, primaryAlt, accent, info, success, danger, note, muted) or a hex value');

const ChartDatum = z.object({
  label: z.string().describe('Category name, or the x value for a line chart'),
  value: z.number().optional().describe('Single-series charts. Omit when using `values`'),
  values: z
    .array(z.number())
    .optional()
    .describe('One number per entry in `series`, for stackedBar and radar'),
  x: z.number().optional().describe('Scatter charts: the horizontal value'),
  color: chartColor.optional(),
  /** Overrides the printed value, for figures that need words. */
  text: z.string().optional().describe('Shown instead of the formatted value, e.g. "8,8 trilyon $"'),
  note: z.string().optional().describe('Small caption under the label'),
});

const ChartSeries = z.object({
  name: z.string(),
  color: chartColor.optional(),
});

const ChartSegment = z.object({
  ...segmentBase,
  type: z.literal('chart'),
  chart: z.enum(chartKinds).default('bar'),
  title: z.string().optional(),
  subtitle: z.string().optional().describe('Small line under the title, usually the data source'),
  caption: richText.optional().describe('Caption below the chart, like an image caption'),
  unit: z.string().optional().describe('Appended to every value, e.g. "%" or " GB"'),
  /**
   * `log` keeps a tiny bar visible next to a huge one. Bar charts only.
   */
  scale: z.enum(['linear', 'log']).default('linear'),
  max: z.number().positive().optional().describe('Axis maximum; inferred from the data when omitted'),
  marker: z
    .object({ at: z.string(), label: z.string() })
    .optional()
    .describe('Line and area charts: a vertical rule at the point with this label'),
  target: z
    .number()
    .optional()
    .describe('Gauge charts: the goal marked on the arc'),
  series: z
    .array(ChartSeries)
    .optional()
    .describe('Names the stacks of a stackedBar or the rings of a radar; each datum then uses `values`'),
  data: z.array(ChartDatum).min(1),
});

const CodeSegment = z.object({
  ...segmentBase,
  type: z.literal('code'),
  language: z.string().optional().describe('Label only; RaporGo does not syntax-highlight in v1'),
  content: z.string(),
});

const ListSegment = z.object({
  ...segmentBase,
  type: z.literal('list'),
  ordered: z.boolean().optional(),
  items: z.array(richText).min(1),
});

const SignatureParty = z.object({
  name: z.string().describe('Who signs: a person or an organisation'),
  title: z.string().optional().describe('Role or capacity, printed under the name'),
});

/** Signature lines, one per party — what a contract or a minute ends with. */
const SignatureSegment = z.object({
  ...segmentBase,
  type: z.literal('signature'),
  parties: z.array(SignatureParty).min(1).max(4),
  date: z.boolean().optional().describe('Add a blank date line under the signatures'),
});

const PageBreakSegment = z.object({
  ...segmentBase,
  type: z.literal('pageBreak'),
});

const SpacerSegment = z.object({
  ...segmentBase,
  type: z.literal('spacer'),
  size: z.enum(['sm', 'md', 'lg']).default('md'),
});

export const SegmentSchema = z.discriminatedUnion('type', [
  CoverSegment,
  SectionSegment,
  SubheadingSegment,
  ParagraphSegment,
  KeyValueTableSegment,
  TableSegment,
  StepsSegment,
  CalloutSegment,
  ChartSegment,
  ImageSegment,
  CodeSegment,
  ListSegment,
  SignatureSegment,
  PageBreakSegment,
  SpacerSegment,
]);

export const segmentTypes = [
  'cover',
  'section',
  'subheading',
  'paragraph',
  'keyValueTable',
  'table',
  'steps',
  'callout',
  'chart',
  'image',
  'code',
  'list',
  'signature',
  'pageBreak',
  'spacer',
] as const;

// --- Document ---------------------------------------------------------------

export const ThemeSchema = z.object({
  preset: z.string().default('lacivert').describe('Named palette shipped with the template'),
  overrides: z
    .record(z.string(), hexColor)
    .optional()
    .describe('Per-token colour overrides, e.g. { "accent": "#f0a500" }'),
});

export const MetaSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  eyebrow: z.string().optional().describe('Small uppercase label on the cover'),
  date: z.string().optional().describe('Free text; shown in the running header'),
  author: z.string().optional(),
  headerText: z.string().optional().describe('Running header, left side. Defaults to meta.eyebrow'),
  footerText: z.string().optional().describe('Running footer, left side. Defaults to meta.title'),
  language: z.string().default('tr').describe('BCP 47 tag, drives hyphenation and locale'),
});

export const DocumentSchema = z.object({
  _llm: z
    .array(z.string())
    .optional()
    .describe('Guide for LLMs editing this file; RaporGo rewrites it on every save and ignores it on read'),
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  template: z.string().default('mavi-resmi'),
  meta: MetaSchema,
  theme: ThemeSchema.optional(),
  segments: z.array(SegmentSchema).default([]),
});

export type Segment = z.infer<typeof SegmentSchema>;
export type SegmentType = Segment['type'];
export type SegmentOfType<T extends SegmentType> = Extract<Segment, { type: T }>;
export type RaporDocument = z.infer<typeof DocumentSchema>;
export type DocumentMeta = z.infer<typeof MetaSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type CalloutVariant = (typeof calloutVariants)[number];
export type ChartKind = (typeof chartKinds)[number];
export type ChartDatum = z.infer<typeof ChartDatum>;
export type ChartSeries = z.infer<typeof ChartSeries>;

/**
 * The published JSON Schema for a document. The CLI (`raporgo schema`) and the
 * generator that writes `schema/rapor-1.0.json` both call this, so the file on
 * disk and the one an LLM asks for at runtime can never drift.
 */
export function toJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(DocumentSchema, { io: 'input' }) as Record<string, unknown>;
}
