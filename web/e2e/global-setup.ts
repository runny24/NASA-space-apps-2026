// Before any browser test: write the SYNTHETIC fixtures, which the preview server serves at /data/
// (playwright.config.ts sets SERVE_FIXTURES_AS_DATA=1). The same function as `npm run fixtures`, so
// `node scripts/tasks.mjs e2e` works in a fresh checkout and in CI with no extra step.

import { writeFixtures } from '../tests/fixtures/write-fixtures.mjs';

export default function globalSetup(): void {
  const dir = writeFixtures();
  console.log(`Wrote the SYNTHETIC test fixtures to ${dir}; the browser tests read them at /data/.`);
}
