// Playwright runs e2e/ against the PRODUCTION build served by `vite preview` (run `npm run build`
// first; the root `npm run e2e` does both), in two projects:
// - "fixtures" (every spec but one), on the SYNTHETIC fixtures and not on web/public/data: the global
//   setup writes the fixtures, and SERVE_FIXTURES_AS_DATA=1 makes the preview server on port 4173
//   serve them at /data/ in front of the build's own data (scripts/serve-synthetic-fixtures.ts).
//   e2e/support.ts fails every test of it that sees any other manifest.
// - "real-data" (e2e/real-data.spec.ts alone), on the build's own data/, served by a second preview
//   server on port 4174 without the fixtures: one smoke test of the real file format (compressed,
//   tiled COGs), which the fixtures do not have.
// The build itself is the same for both, unchanged.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

// On a laptop, use the installed Google Chrome when there is one (no download needed), otherwise
// Playwright's own Chromium (install it once with `npx playwright install chromium`, run inside
// web/ so the browser matches the Playwright version in package-lock.json). In CI always use that
// Chromium, which the workflow installs: the runner's own Chrome changes whenever the runner image
// is updated, and the test could then start failing with no change to the code.
const chromeLocations: Record<string, string[]> = {
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
  win32: [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]
    .filter((dir): dir is string => Boolean(dir))
    .map((dir) => path.join(dir, 'Google', 'Chrome', 'Application', 'chrome.exe')),
  linux: ['/opt/google/chrome/chrome'],
};
const hasChrome = (chromeLocations[process.platform] ?? []).some((file) => existsSync(file));

// Headless browsers on machines without a GPU (CI) need software WebGL, or the map cannot draw.
const webglArgs = ['--enable-unsafe-swiftshader', ...(process.platform === 'linux' ? ['--use-angle=swiftshader'] : [])];

// The two ports are fixed (4173 and 4174) unless E2E_PORT names another pair (that port and the next):
// several working copies of the repository on one machine can then run the browser tests at the same
// time. CI and the documented commands never set it.
const FIXTURES_PORT = Number(process.env.E2E_PORT) || 4173;
const REAL_DATA_PORT = FIXTURES_PORT + 1;
const FIXTURES_URL = `http://localhost:${FIXTURES_PORT}/`;
const REAL_DATA_URL = `http://localhost:${REAL_DATA_PORT}/`;
const REAL_DATA_SPEC = /real-data\.spec\.ts$/;

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  use: {
    viewport: { width: 1280, height: 800 },
    channel: hasChrome && !process.env.CI ? 'chrome' : undefined,
    launchOptions: { args: webglArgs },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'fixtures', testIgnore: REAL_DATA_SPEC, use: { baseURL: FIXTURES_URL } },
    { name: 'real-data', testMatch: REAL_DATA_SPEC, use: { baseURL: REAL_DATA_URL } },
  ],
  // Always start our own servers on the production build. A server that happens to be listening on
  // a port already (a forgotten `npm run preview`, or another project) may be serving an old build
  // or something else entirely, so it is never reused: Playwright stops with "http://localhost:4173/
  // is already used" (or 4174) instead, and strictPort makes vite refuse to move elsewhere.
  webServer: [
    {
      command: `npm run preview -- --port ${FIXTURES_PORT} --strictPort`,
      // Added to the rest of the environment, which the server still receives (PATH and the others).
      env: { SERVE_FIXTURES_AS_DATA: '1' },
      url: FIXTURES_URL,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npm run preview -- --port ${REAL_DATA_PORT} --strictPort`,
      // '0', not left out: a SERVE_FIXTURES_AS_DATA=1 set in the shell must not reach this server.
      env: { SERVE_FIXTURES_AS_DATA: '0' },
      url: REAL_DATA_URL,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
