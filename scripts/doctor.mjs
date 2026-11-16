// Checks that this machine is ready to work on the project, and says how to fix what is not.
//
//   npm run doctor
//
// It needs nothing but Node, so it can run before `npm run setup`. It exits with 1 only when something
// blocks all work (Node too old, or no usable Python); other problems are reported but do not fail it.
// Credentials are only ever reported as present or absent; their values are never read out or printed.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statfsSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  describeRejected,
  findPython,
  IS_WINDOWS,
  nodeMajor,
  probePython,
  PYTHON_INSTALL_HINT,
  REPO_ROOT,
  venvPythonPath,
  WEB_DIR,
} from './lib.mjs';

const MIN_FREE_BYTES = 20 * 1e9; // one NISAR product file is 2 to 8 GB
const NETRC_HOST = 'urs.earthdata.nasa.gov';
const HOSTS = [
  ['NASA catalog (CMR)', 'https://cmr.earthdata.nasa.gov/search/'],
  ['NASA map tiles (GIBS)', 'https://gibs.earthdata.nasa.gov/'],
  ['NISAR data (ASF)', 'https://nisar.asf.earthdatacloud.nasa.gov/'],
];

const results = [];
function ok(check, detail) {
  results.push({ ok: true, check, detail });
}
function problem(check, detail, fix, { blocking = false } = {}) {
  results.push({ ok: false, check, detail, fix, blocking });
}

function checkNode() {
  if (nodeMajor() >= 22) ok('Node', `version ${process.versions.node}`);
  else problem('Node', `version ${process.versions.node}`, 'Install Node 22 LTS or newer from nodejs.org.', { blocking: true });
}

// True when the project's own environment exists and its Python runs.
function venvPythonWorks() {
  const venvPython = venvPythonPath();
  return existsSync(venvPython) && Boolean(probePython(venvPython)?.supported);
}

function checkPython() {
  const { found, rejected } = findPython();
  if (found) {
    ok('Python', `${found.version} (64-bit) at ${found.executable}`);
  } else if (venvPythonWorks()) {
    // A machine whose .venv was built with `setup --python <path>` (for example from a Python that is
    // not on PATH) works fine: a system-wide Python is only needed again to rebuild the environment.
    ok('Python', 'none on PATH, but .venv has a working one (to rebuild .venv: setup --python <path>)');
  } else {
    const seen = rejected.length > 0 ? `found only: ${describeRejected(rejected)}` : 'none found';
    problem('Python 3.12 or 3.13', seen, PYTHON_INSTALL_HINT, { blocking: true });
  }
}

function checkGit() {
  const result = spawnSync('git', ['--version'], { encoding: 'utf8', windowsHide: true });
  if (result.status === 0) ok('git', result.stdout.trim());
  else problem('git', 'not found', 'Install Git from git-scm.com, then open a new terminal.');
}

function checkDisk() {
  try {
    const stats = statfsSync(REPO_ROOT);
    const free = stats.bavail * stats.bsize;
    // Rounded down, so 19.96 GB never shows as "20.0 GB" next to "under 20 GB".
    const freeText = `${(Math.floor(free / 1e8) / 10).toFixed(1)} GB free`;
    if (free >= MIN_FREE_BYTES) ok('Disk space', freeText);
    else {
      problem(
        'Disk space',
        `${freeText} (under 20 GB)`,
        'Free some space before downloading real NISAR data: one product file is 2 to 8 GB. ' +
          'The sample site needs far less.',
      );
    }
  } catch (error) {
    problem('Disk space', `could not measure (${error.code ?? error.message})`, 'Check free space by hand.');
  }
}

function checkInstalled() {
  const venvPython = venvPythonPath();
  if (existsSync(venvPython)) {
    const info = probePython(venvPython);
    if (info?.supported) ok('.venv', `Python ${info.version}`);
    else problem('.venv', 'exists but its Python does not run', 'Delete the .venv folder, then run: npm run setup');
  } else {
    problem('.venv', 'not created yet', 'Run: npm run setup');
  }
  if (existsSync(path.join(WEB_DIR, 'node_modules'))) ok('web/node_modules', 'installed');
  else problem('web/node_modules', 'not installed yet', 'Run: npm run setup');
}

// Any HTTP answer at all, even "401 unauthorised" or "404 not found", proves the host can be reached.
// Returns a function that records the result, so results print in a fixed order whichever host answers
// first.
async function checkHost([name, url]) {
  const host = new URL(url).host;
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(10000) });
    return () => ok(name, `${host} answered (HTTP ${response.status})`);
  } catch (error) {
    const reason = error.cause?.code ?? error.name ?? error.message;
    const proxyNote =
      process.env.HTTPS_PROXY || process.env.https_proxy
        ? " A proxy is configured; Node's built-in fetch ignores HTTPS_PROXY, so this check may be wrong."
        : '';
    return () =>
      problem(
        name,
        `${host} not reachable (${reason})`,
        `Check the internet connection, VPN, or school or venue firewall (some block nasa.gov sites).${proxyNote}`,
      );
  }
}

// The names of the keys that have a non-empty value in a .env file. Values are checked for emptiness
// only; they are never kept or printed.
function dotenvKeys(file) {
  const keys = new Set();
  if (!existsSync(file)) return keys;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (match && match[2].trim().replace(/^["']|["']$/g, '') !== '') keys.add(match[1]);
  }
  return keys;
}

// The one netrc file the download really reads (the same rule as pipeline/auth.py, which mirrors the
// earthaccess library): the file named by NETRC if that is set, otherwise _netrc in the home folder on
// Windows and .netrc everywhere else. A file under the other name is not read, so we say so.
function netrcFile() {
  if (process.env.NETRC) return process.env.NETRC;
  return path.join(os.homedir(), IS_WINDOWS ? '_netrc' : '.netrc');
}

function otherNetrcFile() {
  return path.join(os.homedir(), IS_WINDOWS ? '.netrc' : '_netrc');
}

function hasNetrcEntry(file) {
  const tokens = readFileSync(file, 'utf8').split(/\s+/);
  return tokens.some((token, i) => token === 'machine' && tokens[i + 1] === NETRC_HOST);
}

function checkCredentials() {
  const sources = [];
  const notes = [];
  const fromEnv = new Set(Object.keys(process.env).filter((key) => process.env[key]));
  const fromFile = dotenvKeys(path.join(REPO_ROOT, '.env'));
  for (const [where, keys] of [['environment', fromEnv], ['.env file', fromFile]]) {
    if (keys.has('EARTHDATA_TOKEN')) sources.push(`${where} (EARTHDATA_TOKEN)`);
    const user = keys.has('EARTHDATA_USERNAME');
    const pass = keys.has('EARTHDATA_PASSWORD');
    if (user && pass) sources.push(`${where} (EARTHDATA_USERNAME and EARTHDATA_PASSWORD)`);
    else if (user || pass) notes.push(`${where} has only one of EARTHDATA_USERNAME / EARTHDATA_PASSWORD`);
  }
  const file = netrcFile();
  if (existsSync(file) && hasNetrcEntry(file)) {
    if (readFileSync(file).subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
      // Notepad can save a hidden marker at the start of the file that the download cannot read.
      notes.push(`${file} starts with a byte-order mark; save it again as plain UTF-8 (not "UTF-8 with BOM")`);
    } else {
      sources.push(`${path.basename(file)} entry for ${NETRC_HOST}`);
    }
    // Python's netrc reader refuses a file that other users can read, so a loose file would fail later.
    if (!IS_WINDOWS && (statSync(file).mode & 0o077) !== 0) {
      notes.push(`${file} can be read by other users; run: chmod 600 "${file}"`);
    }
  }
  const other = otherNetrcFile();
  if (!process.env.NETRC && existsSync(other) && hasNetrcEntry(other)) {
    notes.push(`found ${other}, but on this computer the download reads ${file}: rename it`);
  }

  const fixFirstSteps =
    'Only needed for real NISAR data (the sample site needs no login). Create a free account at ' +
    'urs.earthdata.nasa.gov, then copy .env.example to .env at the repository root (git ignores it) and ' +
    'fill in EARTHDATA_TOKEN, or EARTHDATA_USERNAME and EARTHDATA_PASSWORD; or add a ' +
    `"machine ${NETRC_HOST}" entry to ${netrcFile()}. Then run: npm run pipeline -- auth-check`;
  if (sources.length > 0 && notes.length === 0) ok('Earthdata login', `present: ${sources.join(', ')}`);
  else if (sources.length > 0) problem('Earthdata login', `present: ${sources.join(', ')}`, notes.join('. '));
  else problem('Earthdata login', 'no credentials found', notes.length ? `${notes.join('. ')}. ${fixFirstSteps}` : fixFirstSteps);
}

function printReport() {
  const width = Math.max(...results.map((r) => r.check.length));
  console.log('');
  for (const r of results) {
    console.log(`${(r.ok ? 'OK' : 'PROBLEM').padEnd(8)} ${r.check.padEnd(width)}  ${r.detail}`);
    if (!r.ok) console.log(`${' '.repeat(10 + width)}fix: ${r.fix}`);
  }
  const problems = results.filter((r) => !r.ok);
  const blocking = problems.filter((r) => r.blocking);
  console.log('');
  if (blocking.length > 0) {
    console.log(`Doctor: ${blocking.length} blocking problem(s): ${blocking.map((r) => r.check).join(', ')}.`);
  } else if (problems.length > 0) {
    console.log(`Doctor: ${problems.length} problem(s), none blocking: ${problems.map((r) => r.check).join(', ')}.`);
  } else {
    console.log('Doctor: everything looks ready.');
  }
  return blocking.length > 0 ? 1 : 0;
}

console.log('Checking this machine (network checks take up to 10 seconds)...');
checkNode();
checkPython();
checkGit();
checkDisk();
checkInstalled();
for (const record of await Promise.all(HOSTS.map(checkHost))) record();
checkCredentials();
process.exitCode = printReport();
