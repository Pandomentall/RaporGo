/**
 * User preferences, shared between the main process (which stores them and
 * uses the project and PDF defaults) and the renderer (which shows them and
 * switches its language).
 */

/** The editor's languages, by BCP 47 tag, with their own names for the picker. */
export const APP_LANGUAGES = [
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

export type Language = (typeof APP_LANGUAGES)[number]['code'];

function isLanguage(value: unknown): value is Language {
  return APP_LANGUAGES.some((language) => language.code === value);
}

/**
 * The editor language for a system locale (`app.getLocale()`), used on the
 * very first launch: `pt-PT` still gets Brazilian Portuguese, any Chinese
 * gets Simplified, and a language RaporGo does not speak gets English.
 */
export function languageFromLocale(locale: string): Language {
  const tag = locale.toLowerCase();
  const primary = tag.split('-')[0]!;
  if (primary === 'pt') return 'pt-BR';
  if (primary === 'zh') return 'zh-CN';
  return isLanguage(primary) ? primary : 'en';
}

/** `system` follows Windows; the other two pin the editor's look. */
export type ThemeChoice = 'system' | 'light' | 'dark';

export type Settings = {
  /** Language of the editor's own chrome; a document's language is `meta.language`. */
  language: Language;
  theme: ThemeChoice;
  /** Applied to every project created from the editor. */
  defaults: {
    template: string;
    preset: string;
    author: string;
  };
  /** Skip the welcome screen and reopen the last project. */
  openLastOnStart: boolean;
  pdf: {
    /** `beside` writes straight next to the report file; `ask` shows a save dialog. */
    where: 'beside' | 'ask';
    /** How the file is named: the title alone, or the title with a date stamp. */
    name: 'title' | 'title-date';
  };
};

export const DEFAULT_SETTINGS: Settings = {
  language: 'tr',
  theme: 'system',
  defaults: { template: 'mavi-resmi', preset: 'lacivert', author: '' },
  openLastOnStart: false,
  pdf: { where: 'ask', name: 'title' },
};

/** Fills in anything a stored copy lacks — a setting added later must not break an old file. */
export function withDefaults(stored: unknown): Settings {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Partial<Settings>;
  return {
    language: isLanguage(s.language) ? s.language : DEFAULT_SETTINGS.language,
    theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'system',
    defaults: { ...DEFAULT_SETTINGS.defaults, ...(s.defaults ?? {}) },
    openLastOnStart: s.openLastOnStart === true,
    pdf: {
      ...DEFAULT_SETTINGS.pdf,
      ...(s.pdf ?? {}),
      // `outputs` (an Outputs/ folder) is from when a project was a folder.
      where: s.pdf?.where === 'ask' ? 'ask' : s.pdf?.where === undefined ? DEFAULT_SETTINGS.pdf.where : 'beside',
    },
  };
}
