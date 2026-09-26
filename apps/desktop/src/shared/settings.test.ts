import { describe, expect, it } from 'vitest';
import { languageFromLocale, withDefaults } from './settings.js';

describe('first-launch language', () => {
  it('maps a system locale onto one of the editor languages', () => {
    expect(languageFromLocale('de-AT')).toBe('de');
    expect(languageFromLocale('pt-PT')).toBe('pt-BR');
    expect(languageFromLocale('zh-TW')).toBe('zh-CN');
    expect(languageFromLocale('ja')).toBe('ja');
    expect(languageFromLocale('nl-NL')).toBe('en');
  });
});

describe('stored settings', () => {
  it('keeps a known language and theme, and replaces anything else', () => {
    expect(withDefaults({ language: 'ru', theme: 'dark' })).toMatchObject({ language: 'ru', theme: 'dark' });
    expect(withDefaults({ language: 'xx', theme: 'blue' })).toMatchObject({ language: 'tr', theme: 'system' });
  });

  it('reads the old Outputs/ PDF setting as "next to the report"', () => {
    expect(withDefaults({ pdf: { where: 'outputs' } }).pdf.where).toBe('beside');
  });
});
