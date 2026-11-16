// Where the SYNTHETIC test fixtures are written (git-ignored). One place for the generator, the
// browser tests' global setup and vite.config.ts, which serves them.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXTURES_OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'synthetic-out');
