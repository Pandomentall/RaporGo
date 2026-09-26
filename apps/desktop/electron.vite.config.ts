import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

/**
 * The main process keeps its dependencies external: the workspace packages
 * read files (fonts, the Paged.js build) relative to their own location.
 * The editor imports only `@raporgo/render/html` — PDFs print through
 * Electron's Chromium (`main/pdf.ts`), so Playwright never loads in the app.
 * The renderer bundles normally; it only imports browser-safe subpaths.
 */
const nodeExternals = [
  'electron',
  'chokidar',
  'playwright',
  'playwright-core',
  '@raporgo/core',
  '@raporgo/render',
  '@raporgo/render/html',
  '@raporgo/templates',
];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: { input: { index: 'src/main/index.ts' }, external: nodeExternals },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: { input: { index: 'src/preload/index.ts' }, external: nodeExternals },
    },
  },
  renderer: {
    // `input` defaults to <root>/index.html; spelling it out relative to the
    // repo instead made the dev-time dependency scan fail to resolve it.
    root: 'src/renderer',
    plugins: [react()],
  },
});
