// Writes the SYNTHETIC test fixtures to tests/fixtures/synthetic-out/ (git-ignored).
// Run with `npm run fixtures` from web/. The dev and preview servers then serve them at
// /synthetic-fixtures/, and `?manifest=synthetic-fixtures/manifest.json` shows them in dev.
// The browser tests write them the same way before they start (e2e/global-setup.ts).

import { writeFixtures } from './write-fixtures.mjs';

console.log(`Wrote synthetic test fixtures to ${writeFixtures()}`);
