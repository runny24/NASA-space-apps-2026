/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { fillBrandPlaceholders } from './scripts/brandHtml.ts';
import { serveSyntheticFixtures } from './scripts/serve-synthetic-fixtures.ts';
import { BRANDING } from './src/branding.ts';
import { FIXTURES_OUT_DIR } from './tests/fixtures/paths.mjs';

/** Puts the name and tagline of src/branding.ts into index.html's title and meta description. */
function brandIndexHtml(): Plugin {
  return {
    name: 'brand-index-html',
    transformIndexHtml: { order: 'pre', handler: (html) => fillBrandPlaceholders(html, BRANDING) },
  };
}

export default defineConfig({
  // './' makes every asset URL relative, so the same build works at any path, for example
  // https://runny24.github.io/NASA-space-apps-2026/ on GitHub Pages or http://localhost:4173/.
  base: './',
  plugins: [react(), brandIndexHtml(), serveSyntheticFixtures(FIXTURES_OUT_DIR)],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: {
    // MapLibre alone is about 1.4 MB before compression; the warning would only be noise.
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
