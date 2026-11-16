// Writes every file of the SYNTHETIC test fixtures to a folder (by default tests/fixtures/synthetic-out/,
// git-ignored). Shared by `npm run fixtures` and the browser tests' global setup (e2e/global-setup.ts),
// so the two can never write different fixtures.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { FIXTURES_OUT_DIR } from './paths.mjs';
import { buildFiles } from './synthetic.mjs';

/** Write the fixtures to `outDir`, starting clean so a file dropped from the generator does not linger. */
export function writeFixtures(outDir = FIXTURES_OUT_DIR) {
  rmSync(outDir, { recursive: true, force: true });
  for (const file of buildFiles()) {
    const target = path.join(outDir, ...file.path.split('/'));
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, file.bytes);
  }
  return outDir;
}
