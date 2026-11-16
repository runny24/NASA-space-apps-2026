// `npm run lint`: ESLint, then the TypeScript type check. A Node script rather than a chained
// command line, so it behaves the same in every shell (cmd.exe, PowerShell, bash, zsh).

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = (name) => path.join(webDir, 'node_modules', name);

const steps = [
  ['eslint', [bin('eslint/bin/eslint.js'), '.']],
  ['tsc --noEmit', [bin('typescript/bin/tsc'), '--noEmit', '-p', webDir]],
];

let failed = false;
for (const [label, args] of steps) {
  console.log(`> ${label}`);
  const result = spawnSync(process.execPath, args, { cwd: webDir, stdio: 'inherit' });
  if (result.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
