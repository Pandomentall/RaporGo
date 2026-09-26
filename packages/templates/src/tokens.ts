/**
 * Design tokens for the `mavi-resmi` template.
 *
 * Every value here was measured from the reference report the template is a
 * port of, so changing one is a deliberate design decision rather than a
 * tweak — the visual regression test in packages/render will notice.
 */

export type ColorTokens = {
  primary: string;
  primaryAlt: string;
  accent: string;
  accentText: string;
  ink: string;
  muted: string;
  surface: string;
  cream: string;
  border: string;
  success: string;
  successAlt: string;
  danger: string;
  info: string;
  note: string;
  onPrimary: string;
  /** Subtitle on the cover block, sitting on `primary`. */
  onPrimaryMuted: string;
  page: string;
};

export const palettes: Record<string, ColorTokens> = {
  lacivert: {
    primary: '#1b2a4a',
    primaryAlt: '#2e5090',
    accent: '#f0a500',
    accentText: '#e67e22',
    ink: '#1c2b3a',
    muted: '#6b7c93',
    surface: '#f4f7fb',
    cream: '#fff8e8',
    border: '#dde3ee',
    success: '#1e8449',
    successAlt: '#27ae60',
    danger: '#c0392b',
    info: '#4a7cc7',
    note: '#7b5ea7',
    onPrimary: '#ffffff',
    onPrimaryMuted: '#c8d8f0',
    page: '#ffffff',
  },

  /** Same structure, green corporate reading. */
  'yesil-kurumsal': {
    primary: '#14352a',
    primaryAlt: '#1e8449',
    accent: '#f0a500',
    accentText: '#c87f0a',
    ink: '#1c2b26',
    muted: '#6b8079',
    surface: '#f2f7f4',
    cream: '#fff8e8',
    border: '#d8e6de',
    success: '#1e8449',
    successAlt: '#27ae60',
    danger: '#c0392b',
    info: '#4a9c78',
    note: '#7b5ea7',
    onPrimary: '#ffffff',
    onPrimaryMuted: '#c3ddd0',
    page: '#ffffff',
  },

  /** Warm, low-contrast reading for less formal reports. */
  kiremit: {
    primary: '#2b2b33',
    primaryAlt: '#c0392b',
    accent: '#e67e22',
    accentText: '#c0392b',
    ink: '#2a2320',
    muted: '#7d7268',
    surface: '#f7f4f2',
    cream: '#fdf1e4',
    border: '#e6ddd8',
    success: '#1e8449',
    successAlt: '#27ae60',
    danger: '#c0392b',
    info: '#b0563f',
    note: '#7b5ea7',
    onPrimary: '#ffffff',
    onPrimaryMuted: '#d8ccc6',
    page: '#ffffff',
  },
};

/** Page geometry in points, matching A4 and the reference margins. */
export const page = {
  size: 'A4',
  width: 595.28,
  height: 841.89,
  marginTop: 51,
  marginRight: 42.5,
  marginBottom: 52,
  marginLeft: 42.5,
  /** Full-bleed running header band, drawn inside the top margin. */
  headerBand: 20,
  /** Full-bleed running footer band, drawn inside the bottom margin. */
  footerBand: 26,
  /** Horizontal inset of header and footer text from the page edge. */
  bandInset: 20,
} as const;

/** Type scale in points. The reference report is set unusually small on purpose. */
export const type = {
  base: 8,
  lead: 8.5,
  small: 7.5,
  coverTitle: 26,
  coverEyebrow: 9,
  coverSubtitle: 11,
  sectionTitle: 13,
  subheading: 9.5,
  tableHeader: 7.5,
  caption: 8.5,
  band: 7.5,
  lineHeight: 1.45,
} as const;

export const space = {
  segment: 11,
  tight: 5,
  loose: 18,
} as const;

export function resolveColors(preset = 'lacivert', overrides?: Record<string, string>): ColorTokens {
  const base = palettes[preset] ?? palettes['lacivert']!;
  return overrides ? { ...base, ...overrides } : base;
}

/** Emits the token block that the stylesheet and every segment renderer read. */
export function colorVariables(colors: ColorTokens): string {
  return Object.entries(colors)
    .map(([key, value]) => `  --rg-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${value};`)
    .join('\n');
}
