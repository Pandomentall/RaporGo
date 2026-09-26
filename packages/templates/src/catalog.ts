import { palettes, type ColorTokens } from './tokens.js';

/**
 * What the template and theme picker offers.
 *
 * Kept here rather than in the editor so the list cannot drift from what the
 * renderer can actually produce: a template marked `ready` must exist in the
 * registry, and every palette entry is derived from `palettes` itself.
 */

export type TemplateInfo = {
  name: string;
  label: string;
  description: string;
  /** One English line for the `_llm` guide in every report file: what the template is for. */
  summary: string;
  /** Draft templates are shown but cannot be applied — nothing renders them yet. */
  status: 'ready' | 'draft';
};

export const templateCatalog: TemplateInfo[] = [
  {
    name: 'mavi-resmi',
    summary: 'corporate/project report, default',
    label: 'Mavi Resmi',
    description: 'Kurumsal rapor: renk bantları, numaralı bölüm rozetleri',
    status: 'ready',
  },
  {
    name: 'sozlesme',
    summary: 'contract; numbered articles, signature block',
    label: 'Sözleşme',
    description: 'Serif, iki yana yaslı, MADDE numaralı, imza satırlı',
    status: 'ready',
  },
  {
    name: 'sade-teknik',
    summary: 'plain technical note',
    label: 'Sade Teknik',
    description: 'Bantsız; numaralar kenar boşluğunda, tek vurgu rengi',
    status: 'ready',
  },
  {
    name: 'sunum-raporu',
    summary: 'landscape deck, each section on a new page',
    label: 'Sunum Raporu',
    description: 'Yatay sayfa, tam sayfa kapak, her bölüm yeni sayfada',
    status: 'ready',
  },
  {
    name: 'akademik',
    summary: 'paper with abstract, numbered headings, figure/table counters',
    label: 'Akademik',
    description: 'Serif; özet, numaralı başlıklar, Şekil ve Tablo sayaçları',
    status: 'ready',
  },
  {
    name: 'bulten',
    summary: 'newsletter, big headings, pull quotes',
    label: 'Bülten',
    description: 'Üst bant, büyük başlıklar, ilk harf büyük, alıntı kutuları',
    status: 'ready',
  },
];

export type PaletteInfo = {
  name: string;
  label: string;
  /** The four colours that identify the palette at a glance. */
  swatches: [string, string, string, string];
};

const PALETTE_LABELS: Record<string, string> = {
  lacivert: 'Lacivert',
  'yesil-kurumsal': 'Yeşil Kurumsal',
  kiremit: 'Kiremit',
};

function swatchesOf(tokens: ColorTokens): [string, string, string, string] {
  return [tokens.primary, tokens.primaryAlt, tokens.accent, tokens.surface];
}

export const paletteCatalog: PaletteInfo[] = Object.entries(palettes).map(([name, tokens]) => ({
  name,
  label: PALETTE_LABELS[name] ?? name,
  swatches: swatchesOf(tokens),
}));
