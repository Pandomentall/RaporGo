import type { JSX } from 'react';
import { paletteCatalog, templateCatalog } from '@raporgo/templates/catalog';
import { APP_LANGUAGES } from '../../shared/settings.js';
import { paletteLabel, templateText, useSettings } from '../i18n/index.js';
import { Choice, Field, Group, Toggle } from './fields.js';

/**
 * The preferences, as a form. Everything here is about the editor or about
 * reports yet to be created — nothing touches an open document — so the same
 * form sits on the home screen and in the dialog behind the gear.
 */
export function SettingsForm(): JSX.Element {
  const { settings, update, t } = useSettings();

  const resetLayout = (): void => {
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('raporgo.panel.') || key === 'raporgo.zoom') localStorage.removeItem(key);
      }
    } catch {
      // Nothing stored, nothing to reset.
    }
    window.location.reload();
  };

  return (
    <>
      <Group title={t('settings.language')}>
        <Choice
          label={t('settings.language')}
          columns={2}
          value={settings.language}
          options={APP_LANGUAGES.map((language) => ({ value: language.code, label: language.name }))}
          onChange={(language) => update({ language })}
        />
        <p className="hint">{t('settings.languageHint')}</p>
      </Group>

      <Group title={t('settings.theme')}>
        <Choice
          label={t('settings.theme')}
          columns={3}
          value={settings.theme}
          options={[
            { value: 'system', label: t('settings.themeSystem') },
            { value: 'light', label: t('settings.themeLight') },
            { value: 'dark', label: t('settings.themeDark') },
          ]}
          onChange={(theme) => update({ theme })}
        />
      </Group>

      <Group title={t('settings.newProject')}>
        <Choice
          label={t('settings.template')}
          columns={3}
          value={settings.defaults.template}
          options={templateCatalog
            .filter((info) => info.status === 'ready')
            .map((info) => ({ value: info.name, label: templateText(t, info).label }))}
          onChange={(template) => update({ defaults: { ...settings.defaults, template } })}
        />
        <Choice
          label={t('settings.preset')}
          columns={3}
          value={settings.defaults.preset}
          options={paletteCatalog.map((palette) => ({
            value: palette.name,
            label: paletteLabel(t, palette),
            preview: (
              <span className="palette__swatches">
                {palette.swatches.map((color) => (
                  <span key={color} style={{ background: color, width: 12, height: 12 }} />
                ))}
              </span>
            ),
          }))}
          onChange={(preset) => update({ defaults: { ...settings.defaults, preset } })}
        />
        <Field
          label={t('settings.author')}
          value={settings.defaults.author}
          hint={t('settings.authorHint')}
          onChange={(author) => update({ defaults: { ...settings.defaults, author } })}
        />
      </Group>

      <Group title={t('settings.startup')}>
        <Toggle
          label={t('settings.openLast')}
          hint={t('settings.openLastHint')}
          checked={settings.openLastOnStart}
          onChange={(openLastOnStart) => update({ openLastOnStart })}
        />
      </Group>

      <Group title={t('settings.pdf')}>
        <Choice
          label={t('settings.pdfWhere')}
          columns={2}
          value={settings.pdf.where}
          options={[
            { value: 'ask', label: t('settings.pdfAsk') },
            { value: 'beside', label: t('settings.pdfBeside') },
          ]}
          onChange={(where) => update({ pdf: { ...settings.pdf, where } })}
        />
        <Choice
          label={t('settings.pdfName')}
          columns={2}
          value={settings.pdf.name}
          options={[
            { value: 'title', label: t('settings.pdfTitle') },
            { value: 'title-date', label: t('settings.pdfTitleDate') },
          ]}
          onChange={(name) => update({ pdf: { ...settings.pdf, name } })}
        />
        <p className="hint">{t('settings.pdfNameHint')}</p>
      </Group>

      <Group title={t('settings.layout')}>
        <p className="hint">{t('settings.layoutHint')}</p>
        <button type="button" className="button big-button" onClick={resetLayout}>
          {t('settings.resetLayout')}
        </button>
      </Group>
    </>
  );
}

export function SettingsModal({ onClose }: { onClose: () => void }): JSX.Element {
  const { t } = useSettings();
  return (
    <div className="modal-scrim" onClick={onClose} role="presentation">
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <header className="modal__head">
          <span>
            {t('settings.title')}
          </span>
          <span className="modal__head-path">settings.json</span>
        </header>

        <div className="modal__body modal__body--groups">
          <SettingsForm />
        </div>

        <footer className="modal__foot">
          <span className="modal__note" />
          <button type="button" className="button button--small button--primary" onClick={onClose}>
            {t('settings.close')}
          </button>
        </footer>
      </div>
    </div>
  );
}
