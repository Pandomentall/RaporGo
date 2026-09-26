import type { JSX } from 'react';
import { useState } from 'react';
import { paletteCatalog, templateCatalog, type TemplateInfo } from '@raporgo/templates/catalog';
import { paletteLabel, templateText, useT } from '../i18n/index.js';
import type { RaporDocument } from '../../shared/api.js';

type TemplatePickerProps = {
  doc: RaporDocument;
  onApply: (template: string, preset: string) => void;
  onClose: () => void;
};

/**
 * Template and palette chooser (mockup 2c).
 *
 * Each card carries a schematic of the page the template produces — the
 * shapes that make it recognisable, not a rendering. A template still marked
 * draft in the catalog shows but cannot be applied.
 */
export function TemplatePicker({ doc, onApply, onClose }: TemplatePickerProps): JSX.Element {
  const t = useT();
  const [template, setTemplate] = useState(doc.template);
  const [preset, setPreset] = useState(doc.theme?.preset ?? 'lacivert');

  const dirty = template !== doc.template || preset !== (doc.theme?.preset ?? 'lacivert');

  return (
    <div className="modal-scrim" onClick={onClose} role="presentation">
      <div className="modal modal--wide" onClick={(event) => event.stopPropagation()}>
        <header className="modal__head">
          <span>
            {t('picker.title')}
          </span>
          <span className="modal__head-path">{t('picker.path')}</span>
        </header>

        <div className="modal__body">
          <h2 className="modal__section">{t('picker.template')}</h2>
          <div className="template-grid">
            {templateCatalog.map((info) => (
              <button
                key={info.name}
                type="button"
                className={`template-card${template === info.name ? ' template-card--selected' : ''}${
                  info.status === 'draft' ? ' template-card--draft' : ''
                }`}
                disabled={info.status === 'draft'}
                title={info.status === 'draft' ? t('picker.draftTitle') : templateText(t, info).description}
                onClick={() => setTemplate(info.name)}
              >
                <TemplateThumb info={info} />
                <div className="template-card__title">
                  <span>{templateText(t, info).label}</span>
                  {info.status === 'draft' ? (
                    <span className="template-card__draft">{t('picker.draft')}</span>
                  ) : (
                    template === info.name && <span className="template-card__badge">{t('picker.selected')}</span>
                  )}
                </div>
                <p className="template-card__desc">{templateText(t, info).description}</p>
              </button>
            ))}
          </div>

          <h2 className="modal__section modal__section--spaced">
            {t('picker.palette')} <span className="modal__section-alt">{t('picker.paletteAlt')}</span>
          </h2>
          <div className="palette-row">
            {paletteCatalog.map((palette) => (
              <button
                key={palette.name}
                type="button"
                className={`palette${preset === palette.name ? ' palette--selected' : ''}`}
                onClick={() => setPreset(palette.name)}
              >
                <span className="palette__swatches">
                  {palette.swatches.map((color) => (
                    <span key={color} style={{ background: color }} />
                  ))}
                </span>
                <span className="palette__name">{paletteLabel(t, palette)}</span>
              </button>
            ))}
          </div>
        </div>

        <footer className="modal__foot">
          <span className="modal__note">{t('picker.note')}</span>
          <button type="button" className="button button--small" onClick={onClose}>
            {t('picker.cancel')}
          </button>
          <button
            type="button"
            className="button button--small button--primary"
            disabled={!dirty}
            onClick={() => onApply(template, preset)}
          >
            {t('picker.apply')}
          </button>
        </footer>
      </div>
    </div>
  );
}

/** A schematic A4 page standing in for each template's shape. */
export function TemplateThumb({ info }: { info: TemplateInfo }): JSX.Element {
  if (info.name === 'mavi-resmi') {
    return (
      <div className="thumb">
        <div className="thumb__cover">
          <span className="thumb__eyebrow" />
          <span className="thumb__title" />
        </div>
        <span className="thumb__line" />
        <span className="thumb__line thumb__line--short" />
        <div className="thumb__section">
          <span className="thumb__badge" />
          <span className="thumb__rule" />
        </div>
        <span className="thumb__tablehead" />
        <span className="thumb__row" />
        <span className="thumb__row thumb__row--alt" />
        <span className="thumb__band" />
      </div>
    );
  }

  if (info.name === 'sade-teknik') {
    return (
      <div className="thumb">
        <span className="thumb__eyebrow thumb__eyebrow--green" />
        <span className="thumb__title thumb__title--dark" />
        <span className="thumb__hr" />
        <span className="thumb__line" />
        <span className="thumb__line thumb__line--short" />
        <div className="thumb__cols">
          <span />
          <span />
        </div>
        <span className="thumb__hr thumb__hr--bottom" />
      </div>
    );
  }

  if (info.name === 'sozlesme') {
    return (
      <div className="thumb thumb--serif">
        <span className="thumb__center thumb__center--eyebrow" />
        <span className="thumb__center thumb__center--title" />
        <span className="thumb__hr" />
        <span className="thumb__clause" />
        <span className="thumb__line" />
        <span className="thumb__line thumb__line--short" />
        <span className="thumb__clause" />
        <span className="thumb__line" />
        <div className="thumb__sigs">
          <span />
          <span />
        </div>
      </div>
    );
  }

  if (info.name === 'akademik') {
    return (
      <div className="thumb thumb--serif">
        <span className="thumb__center thumb__center--title" />
        <span className="thumb__center thumb__center--sub" />
        <span className="thumb__abstract" />
        <span className="thumb__clause" />
        <span className="thumb__line" />
        <span className="thumb__line thumb__line--short" />
        <span className="thumb__line" />
        <span className="thumb__figure" />
      </div>
    );
  }

  if (info.name === 'bulten') {
    return (
      <div className="thumb thumb--bleed">
        <div className="thumb__band" />
        <div className="thumb__body">
          <span className="thumb__tag" />
          <span className="thumb__title thumb__title--display" />
          <span className="thumb__line" />
          <div className="thumb__dropcap">
            <span />
            <span className="thumb__line" />
          </div>
          <span className="thumb__line thumb__line--short" />
          <span className="thumb__quote" />
        </div>
      </div>
    );
  }

  return (
    <div className="thumb thumb--bleed">
      <div className="thumb__hero">
        <span className="thumb__title" />
        <span className="thumb__subtitle" />
      </div>
      <div className="thumb__body">
        <span className="thumb__line" />
        <span className="thumb__line thumb__line--short" />
        <span className="thumb__callout" />
      </div>
    </div>
  );
}
