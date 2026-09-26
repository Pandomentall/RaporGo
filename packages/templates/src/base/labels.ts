import type { RaporDocument } from '@raporgo/core';

/**
 * The few words a template prints on its own — "Page 3", "Figure 2", the
 * contract's "ARTICLE 1" — in each language a document can declare in
 * `meta.language`. Everything else on the page is the author's text.
 *
 * Browser-safe (no Node imports): the editor reads `documentLanguages` for
 * its language picker.
 */

/** Words around a number: `["Page ", ""]` prints "Page 3", `["第", "页"]` prints "第3页". */
type Around = readonly [before: string, after: string];

export type DocumentLabels = {
  page: Around;
  figure: string;
  table: string;
  abstract: string;
  clause: Around;
  date: string;
  /** Before a gauge chart's target value. */
  target: string;
  imageNone: string;
  imageMissing: string;
};

/** The languages a document can be written in, by BCP 47 tag, with their own names. */
export const documentLanguages = [
  { code: 'tr', name: 'Türkçe' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'pt-BR', name: 'Português (Brasil)' },
  { code: 'it', name: 'Italiano' },
  { code: 'ru', name: 'Русский' },
  { code: 'zh-CN', name: '简体中文' },
  { code: 'ja', name: '日本語' },
] as const;

const LABELS: Record<string, DocumentLabels> = {
  tr: {
    page: ['Sayfa ', ''],
    figure: 'Şekil',
    table: 'Tablo',
    abstract: 'Özet',
    clause: ['MADDE ', ''],
    date: 'Tarih',
    target: 'hedef',
    imageNone: 'Görsel seçilmedi',
    imageMissing: 'Görsel bulunamadı',
  },
  en: {
    page: ['Page ', ''],
    figure: 'Figure',
    table: 'Table',
    abstract: 'Abstract',
    clause: ['ARTICLE ', ''],
    date: 'Date',
    target: 'target',
    imageNone: 'No image chosen',
    imageMissing: 'Image not found',
  },
  es: {
    page: ['Página ', ''],
    figure: 'Figura',
    table: 'Tabla',
    abstract: 'Resumen',
    clause: ['ARTÍCULO ', ''],
    date: 'Fecha',
    target: 'objetivo',
    imageNone: 'No se ha elegido ninguna imagen',
    imageMissing: 'Imagen no encontrada',
  },
  de: {
    page: ['Seite ', ''],
    figure: 'Abbildung',
    table: 'Tabelle',
    abstract: 'Zusammenfassung',
    clause: ['ARTIKEL ', ''],
    date: 'Datum',
    target: 'Ziel',
    imageNone: 'Kein Bild gewählt',
    imageMissing: 'Bild nicht gefunden',
  },
  fr: {
    page: ['Page ', ''],
    figure: 'Figure',
    table: 'Tableau',
    abstract: 'Résumé',
    clause: ['ARTICLE ', ''],
    date: 'Date',
    target: 'objectif',
    imageNone: 'Aucune image choisie',
    imageMissing: 'Image introuvable',
  },
  pt: {
    page: ['Página ', ''],
    figure: 'Figura',
    table: 'Tabela',
    abstract: 'Resumo',
    clause: ['CLÁUSULA ', ''],
    date: 'Data',
    target: 'meta',
    imageNone: 'Nenhuma imagem escolhida',
    imageMissing: 'Imagem não encontrada',
  },
  it: {
    page: ['Pagina ', ''],
    figure: 'Figura',
    table: 'Tabella',
    abstract: 'Sommario',
    clause: ['ARTICOLO ', ''],
    date: 'Data',
    target: 'obiettivo',
    imageNone: 'Nessuna immagine scelta',
    imageMissing: 'Immagine non trovata',
  },
  ru: {
    page: ['Страница ', ''],
    figure: 'Рисунок',
    table: 'Таблица',
    abstract: 'Аннотация',
    clause: ['СТАТЬЯ ', ''],
    date: 'Дата',
    target: 'цель',
    imageNone: 'Изображение не выбрано',
    imageMissing: 'Изображение не найдено',
  },
  zh: {
    page: ['第 ', ' 页'],
    figure: '图',
    table: '表',
    abstract: '摘要',
    clause: ['第', '条'],
    date: '日期',
    target: '目标',
    imageNone: '未选择图片',
    imageMissing: '找不到图片',
  },
  ja: {
    page: ['', ' ページ'],
    figure: '図',
    table: '表',
    abstract: '要旨',
    clause: ['第', '条'],
    date: '日付',
    target: '目標',
    imageNone: '画像が選択されていません',
    imageMissing: '画像が見つかりません',
  },
};

/** The labels for a document; a tag like `pt-BR` falls back to `pt`, anything unknown to English. */
export function labelsFor(doc: RaporDocument): DocumentLabels {
  const tag = (doc.meta.language ?? 'tr').toLowerCase();
  return LABELS[tag] ?? LABELS[tag.split('-')[0]!] ?? LABELS['en']!;
}
