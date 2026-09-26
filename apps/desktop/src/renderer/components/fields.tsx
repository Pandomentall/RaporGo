import type { JSX, ReactNode } from 'react';
import { useState } from 'react';
import type { ColorTokens } from '@raporgo/templates/tokens';
import { useT, type TranslationKey } from '../i18n/index.js';

/**
 * The inspector's building blocks.
 *
 * Every control here shows what it will do rather than naming it: colours are
 * swatches, not hex typed into a box; variants are chips in their own colour;
 * chart kinds are drawn. The panel is the only place a person meets the
 * document format, so nothing in it should require knowing the format.
 */

// --- text -------------------------------------------------------------------

/**
 * Grows a textarea to fit its content, so a long paragraph is read whole
 * rather than through a three-line slot. `rows` stays as the floor.
 */
function autoGrow(el: HTMLTextAreaElement | null): void {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + 2}px`;
}

export function Field({
  label,
  value,
  onChange,
  multiline,
  placeholder,
  hint,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  hint?: string;
  rows?: number;
}): JSX.Element {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {multiline ? (
        <textarea
          className="field__input field__input--grow"
          rows={rows}
          value={value}
          placeholder={placeholder}
          ref={autoGrow}
          onChange={(event) => {
            autoGrow(event.target);
            onChange(event.target.value);
          }}
        />
      ) : (
        <input
          className="field__input"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

/** A number that can also be left empty, which usually means "work it out". */
export function NumberField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  hint?: string;
}): JSX.Element {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        className="field__input"
        type="number"
        value={value === undefined ? '' : String(value)}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
      />
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

// --- structure --------------------------------------------------------------

/** A titled block. `advanced` blocks start closed — they are the rare settings. */
export function Group({
  title,
  children,
  advanced,
}: {
  title: string;
  children: ReactNode;
  advanced?: boolean;
}): JSX.Element {
  const [open, setOpen] = useState(!advanced);
  return (
    <section className={`group${advanced ? ' group--advanced' : ''}`}>
      <button type="button" className="group__head" onClick={() => setOpen((current) => !current)}>
        <span className="group__caret">{open ? '▾' : '▸'}</span>
        {title}
      </button>
      {open && <div className="group__body">{children}</div>}
    </section>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}): JSX.Element {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="switch__track" aria-hidden="true">
        <span className="switch__knob" />
      </span>
      <span className="switch__text">
        {label}
        {hint && <span className="field__hint">{hint}</span>}
      </span>
    </label>
  );
}

// --- choosing ---------------------------------------------------------------

export type ChoiceOption<T extends string> = {
  value: T;
  label: string;
  /** Drawn above the label — a glyph, a swatch, anything that shows the effect. */
  preview?: ReactNode;
  hint?: string;
};

/** A grid of buttons that show their effect, replacing a dropdown of enum values. */
export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  columns = 3,
}: {
  label: string;
  value: T;
  options: ChoiceOption<T>[];
  onChange: (value: T) => void;
  columns?: number;
}): JSX.Element {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="choice" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            title={option.hint ?? option.label}
            className={`choice__item${option.value === value ? ' choice__item--on' : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.preview && <span className="choice__preview">{option.preview}</span>}
            <span className="choice__label">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// --- colour -----------------------------------------------------------------

/**
 * Palette roles rather than colour names: a role means the same thing in every
 * palette, so a document rethemed from navy to brick keeps its meaning.
 */
export const COLOR_ROLES: { token: keyof ColorTokens; label: TranslationKey }[] = [
  { token: 'primary', label: 'color.primary' },
  { token: 'primaryAlt', label: 'color.primaryAlt' },
  { token: 'accent', label: 'color.accent' },
  { token: 'info', label: 'color.info' },
  { token: 'success', label: 'color.success' },
  { token: 'danger', label: 'color.danger' },
  { token: 'note', label: 'color.note' },
  { token: 'muted', label: 'color.muted' },
];

/**
 * Picks a palette role, or a literal colour for the rare deliberate exception.
 *
 * Roles come first and are the wide, obvious targets: a role keeps following
 * the theme, while a hex value freezes. The custom well is deliberately the
 * small one at the end.
 */
export function ColorPicker({
  label,
  value,
  colors,
  onChange,
}: {
  label: string;
  value: string | undefined;
  colors: ColorTokens;
  onChange: (value: string | undefined) => void;
}): JSX.Element {
  const t = useT();
  const custom = value?.startsWith('#') ? value : '';

  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="swatches">
        <button
          type="button"
          title={t('color.auto')}
          className={`swatch swatch--auto${value === undefined ? ' swatch--on' : ''}`}
          onClick={() => onChange(undefined)}
        >
          <span>{t('color.autoShort')}</span>
        </button>

        {COLOR_ROLES.map((role) => (
          <button
            key={role.token}
            type="button"
            title={t(role.label)}
            className={`swatch${value === role.token ? ' swatch--on' : ''}`}
            style={{ background: colors[role.token] }}
            onClick={() => onChange(role.token)}
          >
            <span className="swatch__name">{t(role.label)}</span>
          </button>
        ))}

        <label className={`swatch swatch--custom${custom ? ' swatch--on' : ''}`} title={t('color.custom')}>
          <span className="swatch__pick" style={custom ? { background: custom } : undefined} />
          <input
            type="color"
            value={custom || colors.primary}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
      </div>
      {custom && <span className="field__hint">{t('color.fixedHint', { hex: custom })}</span>}
    </div>
  );
}

// --- little drawings --------------------------------------------------------

const glyph = (body: string): JSX.Element => (
  <svg viewBox="0 0 24 18" className="glyph" dangerouslySetInnerHTML={{ __html: body }} />
);

/** Tiny pictures of each chart kind, so the shape is chosen by its shape. */
export const CHART_GLYPHS: Record<string, JSX.Element> = {
  bar: glyph('<rect x="1" y="2" width="16" height="3"/><rect x="1" y="7" width="21" height="3"/><rect x="1" y="12" width="10" height="3"/>'),
  column: glyph('<rect x="2" y="8" width="4" height="8"/><rect x="8" y="4" width="4" height="12"/><rect x="14" y="10" width="4" height="6"/><rect x="20" y="2" width="3" height="14"/>'),
  stackedBar: glyph('<rect x="3" y="9" width="6" height="7"/><rect x="3" y="4" width="6" height="4" opacity=".55"/><rect x="14" y="6" width="6" height="10"/><rect x="14" y="2" width="6" height="3" opacity=".55"/>'),
  waterfall: glyph('<rect x="1" y="10" width="4" height="6"/><rect x="7" y="6" width="4" height="4"/><rect x="13" y="6" width="4" height="4" opacity=".55"/><rect x="19" y="4" width="4" height="12"/>'),
  line: glyph('<polyline points="1,14 7,9 13,11 22,3" fill="none" stroke="currentColor" stroke-width="2"/>'),
  area: glyph('<polygon points="1,16 1,13 7,8 13,10 22,3 22,16" opacity=".45"/><polyline points="1,13 7,8 13,10 22,3" fill="none" stroke="currentColor" stroke-width="1.6"/>'),
  scatter: glyph('<circle cx="4" cy="13" r="2"/><circle cx="10" cy="8" r="2"/><circle cx="15" cy="11" r="2"/><circle cx="20" cy="4" r="2"/>'),
  pie: glyph('<path d="M12 9 L12 1 A8 8 0 0 1 20 9 Z"/><path d="M12 9 L20 9 A8 8 0 1 1 12 1 Z" opacity=".45"/>'),
  donut: glyph('<circle cx="12" cy="9" r="6.5" fill="none" stroke="currentColor" stroke-width="3.5" opacity=".3"/><circle cx="12" cy="9" r="6.5" fill="none" stroke="currentColor" stroke-width="3.5" stroke-dasharray="28 41" transform="rotate(-90 12 9)"/>'),
  gauge: glyph('<path d="M3 14 A9 9 0 0 1 21 14" fill="none" stroke="currentColor" stroke-width="3.5" opacity=".3"/><path d="M3 14 A9 9 0 0 1 14 5.4" fill="none" stroke="currentColor" stroke-width="3.5"/>'),
  radar: glyph('<polygon points="12,1 22,8 18,17 6,17 2,8" fill="none" stroke="currentColor" opacity=".4"/><polygon points="12,5 18,9 16,14 8,14 6,9" opacity=".6"/>'),
};

/** Pictures of the layout each non-chart segment produces. */
export const SEGMENT_GLYPHS: Record<string, JSX.Element> = {
  paragraph: glyph('<rect x="1" y="3" width="22" height="2"/><rect x="1" y="8" width="22" height="2"/><rect x="1" y="13" width="14" height="2"/>'),
  subheading: glyph('<rect x="1" y="5" width="13" height="3"/><rect x="1" y="11" width="22" height="2" opacity=".4"/>'),
  section: glyph('<rect x="1" y="4" width="6" height="6"/><rect x="9" y="5" width="14" height="4"/><rect x="1" y="13" width="22" height="1" opacity=".4"/>'),
  list: glyph('<circle cx="3" cy="4" r="1.5"/><rect x="7" y="3" width="16" height="2"/><circle cx="3" cy="9" r="1.5"/><rect x="7" y="8" width="16" height="2"/><circle cx="3" cy="14" r="1.5"/><rect x="7" y="13" width="11" height="2"/>'),
  table: glyph('<rect x="1" y="2" width="22" height="4"/><rect x="1" y="7" width="10" height="3" opacity=".4"/><rect x="13" y="7" width="10" height="3" opacity=".4"/><rect x="1" y="11" width="10" height="3" opacity=".4"/><rect x="13" y="11" width="10" height="3" opacity=".4"/>'),
  keyValueTable: glyph('<rect x="1" y="2" width="22" height="4"/><rect x="1" y="7" width="8" height="3" opacity=".4"/><rect x="11" y="7" width="12" height="3" opacity=".25"/><rect x="1" y="11" width="8" height="3" opacity=".4"/><rect x="11" y="11" width="12" height="3" opacity=".25"/>'),
  steps: glyph('<rect x="1" y="2" width="5" height="6"/><rect x="8" y="3" width="15" height="4" opacity=".4"/><rect x="1" y="10" width="5" height="6" opacity=".6"/><rect x="8" y="11" width="15" height="4" opacity=".3"/>'),
  callout: glyph('<rect x="1" y="4" width="2" height="10"/><rect x="5" y="5" width="18" height="2" opacity=".5"/><rect x="5" y="10" width="12" height="2" opacity=".5"/>'),
  image: glyph('<rect x="1" y="2" width="22" height="12" opacity=".25"/><circle cx="7" cy="6" r="2"/><polygon points="4,14 11,7 16,14"/><polygon points="13,14 18,9 22,14" opacity=".7"/>'),
  signature: glyph('<rect x="1" y="11" width="10" height="1"/><rect x="13" y="11" width="10" height="1"/><rect x="1" y="14" width="6" height="1.6" opacity=".5"/><rect x="13" y="14" width="6" height="1.6" opacity=".5"/><path d="M2 8c2-5 4 1 6-3s2 3 3 1" fill="none" stroke="currentColor" stroke-width="1.2"/>'),
  code: glyph('<polyline points="7,4 3,9 7,14" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="17,4 21,9 17,14" fill="none" stroke="currentColor" stroke-width="2"/>'),
  cover: glyph('<rect x="1" y="1" width="22" height="10"/><rect x="1" y="13" width="14" height="2" opacity=".4"/>'),
  pageBreak: glyph('<rect x="1" y="2" width="22" height="4" opacity=".3"/><rect x="1" y="8" width="22" height="1"/><rect x="1" y="12" width="22" height="4" opacity=".3"/>'),
  spacer: glyph('<rect x="1" y="2" width="22" height="3" opacity=".3"/><rect x="1" y="13" width="22" height="3" opacity=".3"/>'),
  chart: glyph('<rect x="2" y="8" width="4" height="8"/><rect x="8" y="4" width="4" height="12"/><rect x="14" y="10" width="4" height="6"/>'),
};
