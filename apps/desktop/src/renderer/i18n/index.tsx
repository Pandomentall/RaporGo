import type { JSX, ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { DEFAULT_SETTINGS, type Language, type Settings } from '../../shared/settings.js';
import type { PaletteInfo, TemplateInfo } from '@raporgo/templates/catalog';
import { de } from './de.js';
import { en } from './en.js';
import { es } from './es.js';
import { fr } from './fr.js';
import { it } from './it.js';
import { ja } from './ja.js';
import { ptBR } from './pt-BR.js';
import { ru } from './ru.js';
import { zhCN } from './zh-CN.js';
import { tr, type TranslationKey } from './tr.js';

/**
 * Settings and translation in one provider: the language is a setting, and
 * every string in the chrome comes through `t`, so changing the language in
 * the settings dialog re-renders the whole window at once.
 */

const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = {
  tr,
  en,
  es,
  de,
  fr,
  'pt-BR': ptBR,
  it,
  ru,
  'zh-CN': zhCN,
  ja,
};

export type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

type SettingsContextValue = {
  settings: Settings;
  /** The theme actually in use: `system` resolved against Windows. */
  theme: 'light' | 'dark';
  /** Persists the whole object; the main process is the store. */
  update: (patch: Partial<Settings>) => void;
  t: Translate;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function translate(language: Language): Translate {
  const dictionary = DICTIONARIES[language];
  return (key, vars) => {
    const text = dictionary[key] ?? tr[key] ?? key;
    return vars ? text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole)) : text;
  };
}

export function SettingsProvider({ children }: { children: ReactNode }): JSX.Element {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    void window.raporgo.getSettings().then(setSettings);
    // The View menu changes the theme from the main process.
    return window.raporgo.onSettingsChange(setSettings);
  }, []);

  // The main process pins `prefers-color-scheme` to the setting, so the
  // media query alone is the truth; the setting is read too so a change
  // shows before the round trip to the main process lands.
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const follow = (): void => setSystemDark(query.matches);
    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  }, []);
  const theme = settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme;
  // Layout effect: it runs before any child's effect, so a child that reads
  // a theme token (the preview's page ground) already sees the new one.
  useLayoutEffect(() => {
    document.documentElement.dataset['theme'] = theme;
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next: Settings = {
        ...current,
        ...patch,
        defaults: { ...current.defaults, ...(patch.defaults ?? {}) },
        pdf: { ...current.pdf, ...(patch.pdf ?? {}) },
      };
      void window.raporgo.setSettings(next);
      return next;
    });
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, theme, update, t: translate(settings.language) }),
    [settings, theme, update],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside SettingsProvider');
  return value;
}

/** The translator alone — what most components need. */
export function useT(): Translate {
  return useSettings().t;
}

/**
 * A template's name and description in the editor's language. The catalog
 * carries Turkish text for code that has no translator (the CLI); the editor
 * looks its own up and falls back to the catalog's.
 */
export function templateText(t: Translate, info: TemplateInfo): { label: string; description: string } {
  const label = `template.${info.name}` as TranslationKey;
  const description = `templateDesc.${info.name}` as TranslationKey;
  return {
    label: t(label) === label ? info.label : t(label),
    description: t(description) === description ? info.description : t(description),
  };
}

export function paletteLabel(t: Translate, info: PaletteInfo): string {
  const key = `palette.${info.name}` as TranslationKey;
  return t(key) === key ? info.label : t(key);
}

export type { TranslationKey };
