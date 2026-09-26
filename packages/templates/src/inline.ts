/**
 * The tiny inline markup subset RaporGo text fields accept.
 *
 * Keeping a paragraph as one string — rather than an array of styled runs —
 * is what makes the JSON pleasant for a human to skim and cheap for an LLM to
 * rewrite. The cost is this parser, deliberately kept to five constructs.
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]!);
}

/** Only these schemes survive; anything else is rendered as plain text. */
const SAFE_SCHEME = /^(?:https?:|mailto:|#|\/)/i;

// --- colour -----------------------------------------------------------------

/**
 * Palette roles a colour may name. A role follows the theme — `danger` is
 * brick in one palette and rust in another — where a hex value stays put.
 * Mirrors the keys of `ColorTokens`; anything else is rendered uncoloured.
 */
const COLOR_ROLES = new Set([
  'primary',
  'primaryAlt',
  'accent',
  'accentText',
  'ink',
  'muted',
  'surface',
  'cream',
  'border',
  'success',
  'successAlt',
  'danger',
  'info',
  'note',
  'onPrimary',
  'onPrimaryMuted',
  'page',
]);

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** The CSS value behind a colour name, or null when the name is not one we accept. */
export function cssColor(name: string): string | null {
  if (HEX.test(name)) return name.toLowerCase();
  if (COLOR_ROLES.has(name)) return `var(--rg-${name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)})`;
  return null;
}

function renderColors(text: string): string {
  return text.replace(/\[([^\]]+)\]\{([^}\s]+)\}/g, (whole, label: string, name: string) => {
    const css = cssColor(name);
    return css ? `<span class="rg-color" data-color="${name}" style="color:${css}">${label}</span>` : whole;
  });
}

// --- links and emphasis -----------------------------------------------------

function renderLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label: string, href: string) =>
    SAFE_SCHEME.test(href) ? `<a href="${href}">${label}</a>` : whole,
  );
}

function renderEmphasis(text: string): string {
  return renderLinks(renderColors(text))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
}

/**
 * Converts `**bold**`, `*italic*`, `` `code` ``, `[label](url)` and
 * `[text]{colour}` to HTML. Text is escaped before any markup is applied, and
 * code spans are held out of emphasis processing so `` `a*b*c` `` stays literal.
 */
export function renderInline(text: string): string {
  const parts = escapeHtml(text).split('`');
  return parts
    .map((part, index) => (index % 2 === 1 ? `<code>${part}</code>` : renderEmphasis(part)))
    .join('');
}

/** Renders inline markup and turns blank lines into paragraph breaks. */
export function renderInlineBlock(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => renderInline(paragraph.trim()))
    .filter(Boolean)
    .join('<br><br>');
}

// --- back to markup ---------------------------------------------------------

/** `rgb(192, 57, 43)` → `#c0392b`; a hex passes through; anything else is dropped. */
function toHex(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (HEX.test(trimmed)) return trimmed;
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(trimmed);
  if (!rgb) return null;
  return `#${[rgb[1], rgb[2], rgb[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The inverse of `renderInline`: turns edited HTML back into the markup subset.
 *
 * The desktop editor makes preview elements directly editable, so whatever the
 * browser leaves behind — `<b>`, `<i>`, a `<font color>` from `execCommand`, a
 * stray `<div>` from a paste — has to come back as a plain string the document
 * can store. A span the editor stamped with `data-color` keeps its role; a
 * bare colour comes back as hex.
 */
export function serializeInline(html: string): string {
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    // Browsers begin a new visual line at an opening block tag, not at its close.
    .replace(/<(?:div|p)(?:\s[^>]*)?>/gi, '\n')
    .replace(/<\/(?:div|p)>/gi, '')
    .replace(/<(?:strong|b)(?:\s[^>]*)?>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**')
    .replace(/<(?:em|i)(?:\s[^>]*)?>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*')
    .replace(/<code(?:\s[^>]*)?>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<(?:span|font)\s[^>]*data-color="([^"]+)"[^>]*>([\s\S]*?)<\/(?:span|font)>/gi, (whole, name: string, inner: string) =>
      cssColor(name) ? `[${inner}]{${name}}` : inner,
    )
    .replace(/<font\s[^>]*color="([^"]+)"[^>]*>([\s\S]*?)<\/font>/gi, (whole, value: string, inner: string) => {
      const hex = toHex(value);
      return hex ? `[${inner}]{${hex}}` : inner;
    })
    .replace(/<span\s[^>]*style="[^"]*color:\s*([^;"]+)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, (whole, value: string, inner: string) => {
      const hex = toHex(value);
      return hex ? `[${inner}]{${hex}}` : inner;
    })
    .replace(/<[^>]+>/g, '');

  return unescapeHtml(text)
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const HTML_UNESCAPES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

export function unescapeHtml(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|nbsp|#39);/g, (entity) => HTML_UNESCAPES[entity] ?? entity);
}
