// Size budget for the data the web app publishes (web/public/data).
//
// GitHub refuses files of 100 MiB or more, and a GitHub Pages site may be at most 1 GB. We fail well
// before the site limit so there is room for the app itself and for one more site while experimenting.
//
//   node scripts/check-size.mjs            checks web/public/data
//   node scripts/check-size.mjs <folder>   checks another folder (used by tests)

import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './lib.mjs';

const FILE_LIMIT = 100 * 1024 * 1024; // 100 MiB: GitHub's hard limit per file
const TOTAL_WARN = 400 * 1000 * 1000; // 400 MB: time to think about resolution or the number of dates
const TOTAL_LIMIT = 900 * 1000 * 1000; // 900 MB: leaves 100 MB of the 1 GB Pages limit for everything else

const target = path.resolve(process.argv[2] ?? path.join(REPO_ROOT, 'web', 'public', 'data'));
const shown = path.relative(REPO_ROOT, target).split(path.sep).join('/') || '.';

// Lists every regular file below `folder`. Symbolic links are skipped: the repository uses none, and
// following one could count files that are not really there.
function listFiles(folder) {
  const files = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full));
    else if (entry.isFile()) files.push({ path: full, size: statSync(full).size });
  }
  return files;
}

function formatMB(bytes) {
  return `${(bytes / 1e6).toFixed(1)} MB`;
}

let files;
try {
  files = listFiles(target);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  files = [];
}

if (files.length === 0) {
  console.log(`Size check: ${shown} is missing or empty. Nothing to check.`);
  process.exit(0);
}

files.sort((a, b) => b.size - a.size);
const total = files.reduce((sum, f) => sum + f.size, 0);

console.log(`Size check of ${shown}: ${files.length} files, ${formatMB(total)} in total.`);
console.log('Largest files:');
for (const f of files.slice(0, 10)) {
  const name = path.relative(target, f.path).split(path.sep).join('/');
  console.log(`  ${formatMB(f.size).padStart(10)}  ${name}`);
}

const problems = [];
for (const f of files.filter((f) => f.size >= FILE_LIMIT)) {
  const name = path.relative(target, f.path).split(path.sep).join('/');
  problems.push(`${name} is ${(f.size / 1024 / 1024).toFixed(2)} MiB; GitHub rejects files of 100 MiB or more.`);
}
if (total > TOTAL_LIMIT) {
  problems.push(
    `Total ${formatMB(total)} is over the ${formatMB(TOTAL_LIMIT)} budget (GitHub Pages allows 1 GB per site).`,
  );
} else if (total > TOTAL_WARN) {
  console.log(
    `WARNING: total ${formatMB(total)} is over ${formatMB(TOTAL_WARN)}. ` +
      'Consider a coarser display resolution or fewer dates before it reaches the limit.',
  );
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`FAIL: ${problem}`);
  process.exit(1);
}
console.log('Size check passed.');
