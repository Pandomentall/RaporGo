import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

/**
 * Builds a self-contained `@font-face` block with every font file inlined as a
 * data URI.
 *
 * Fonts ship with the package rather than being looked up on the machine: the
 * PDF must come out identical in the editor, in the CLI and in CI, and a
 * missing system font is exactly how Turkish characters go missing.
 *
 * Arimo is metric-compatible with Arial, Tinos with Times New Roman, and
 * JetBrains Mono stands in for Consolas; all three are OFL-licensed and safe
 * to redistribute. A template asks for the families it uses — embedding a
 * serif in a document set entirely in sans would be a quarter megabyte for
 * nothing.
 */

const require = createRequire(import.meta.url);

export type FontFamily = 'sans' | 'serif' | 'mono';

type FaceSpec = { pkg: string; cssFile: string };

const FACES: Record<FontFamily, FaceSpec[]> = {
  sans: [
    { pkg: '@fontsource/arimo', cssFile: '400.css' },
    { pkg: '@fontsource/arimo', cssFile: '400-italic.css' },
    { pkg: '@fontsource/arimo', cssFile: '700.css' },
    { pkg: '@fontsource/arimo', cssFile: '700-italic.css' },
  ],
  serif: [
    { pkg: '@fontsource/tinos', cssFile: '400.css' },
    { pkg: '@fontsource/tinos', cssFile: '400-italic.css' },
    { pkg: '@fontsource/tinos', cssFile: '700.css' },
    { pkg: '@fontsource/tinos', cssFile: '700-italic.css' },
  ],
  mono: [
    { pkg: '@fontsource/jetbrains-mono', cssFile: '400.css' },
    { pkg: '@fontsource/jetbrains-mono', cssFile: '700.css' },
  ],
};

/** Only these subsets are embedded; together they cover Turkish and Western European text. */
const SUBSETS = ['latin', 'latin-ext'];

const FACE_BLOCK = /@font-face\s*\{[^}]*\}/g;
const WOFF2_URL = /url\((\.\/files\/([^)]+\.woff2))\)/;

function packageDir(pkg: string): string {
  // Fontsource packages expose ./*.css but not ./package.json, so resolve a
  // stylesheet and walk up from there.
  return dirname(require.resolve(`${pkg}/400.css`));
}

function subsetOf(fileName: string): string | undefined {
  // e.g. arimo-latin-ext-400-italic.woff2 -> latin-ext
  const match = /^[a-z-]+?-((?:[a-z]+)(?:-ext)?)-\d{3}-(?:normal|italic)\.woff2$/.exec(fileName);
  return match?.[1];
}

function inlineFaces({ pkg, cssFile }: FaceSpec): string[] {
  const dir = packageDir(pkg);
  const css = readFileSync(resolve(dir, cssFile), 'utf8');

  const out: string[] = [];
  for (const block of css.match(FACE_BLOCK) ?? []) {
    const url = WOFF2_URL.exec(block);
    if (!url) continue;
    const fileName = url[2]!;
    const subset = subsetOf(fileName);
    if (!subset || !SUBSETS.includes(subset)) continue;

    const data = readFileSync(resolve(dir, 'files', fileName)).toString('base64');
    out.push(
      block
        // Keep only the woff2 source and drop the sibling woff url.
        .replace(/src:[^;]+;/, `src: url(data:font/woff2;base64,${data}) format('woff2');`)
        .replace(/font-display:\s*swap;/, 'font-display: block;'),
    );
  }
  return out;
}

const cache = new Map<FontFamily, string>();

function familyCss(family: FontFamily): string {
  let css = cache.get(family);
  if (css === undefined) {
    css = FACES[family].flatMap(inlineFaces).join('\n\n');
    cache.set(family, css);
  }
  return css;
}

/** Returns the embedded `@font-face` CSS for the given families, each built once per process. */
export function fontFaceCss(families: readonly FontFamily[] = ['sans', 'mono']): string {
  return families.map(familyCss).join('\n\n');
}

export const fontStacks = {
  sans: "'Arimo', 'Liberation Sans', Arial, sans-serif",
  serif: "'Tinos', 'Liberation Serif', 'Times New Roman', Times, serif",
  mono: "'JetBrains Mono', 'Consolas', 'Liberation Mono', monospace",
} as const;
