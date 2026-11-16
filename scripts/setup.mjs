// One-time (and safe to repeat) setup: Python virtual environment, pipeline packages, web packages.
//
//   npm run setup                         find Python 3.12 or 3.13 automatically
//   npm run setup -- --python <path>      use this Python interpreter to create .venv
//   npm run setup -- --force              reinstall packages even if nothing changed
//
// Re-running is cheap: a small stamp file inside .venv remembers a fingerprint of the requirement files
// and of web/package-lock.json, and a step is skipped when its fingerprint has not changed.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  annotateFailure,
  describeRejected,
  findPython,
  nodeMajor,
  probePython,
  PYTHON_INSTALL_HINT,
  pythonEnv,
  REPO_ROOT,
  run,
  runNpm,
  VENV_DIR,
  venvPythonPath,
  WEB_DIR,
} from './lib.mjs';

// pip itself is pinned like every other dependency, so every machine resolves packages the same way.
const PIP_VERSION = '26.2.2';
const PIPELINE_DIR = path.join(REPO_ROOT, 'pipeline');
const DEV_REQUIREMENTS = path.join(PIPELINE_DIR, 'requirements-dev.txt');
const STAMP_FILE = path.join(VENV_DIR, 'setup-stamp.json');

function fail(message) {
  console.error(`\nSetup stopped: ${message}`);
  // In CI, attach the end of the failed command's output to the run (see annotateFailure in lib.mjs).
  annotateFailure(`setup stopped - ${message.split('\n')[0]}`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = { python: null, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--python' && argv[i + 1]) options.python = argv[(i += 1)];
    else if (argv[i] === '--force') options.force = true;
    else fail(`unknown option "${argv[i]}". Options: --python <path>, --force`);
  }
  return options;
}

// A fingerprint of some files' contents: if any of them changes, the fingerprint changes.
function fingerprint(files) {
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(path.basename(file));
    hash.update(existsSync(file) ? readFileSync(file) : 'missing');
  }
  return hash.digest('hex');
}

function readStamp() {
  try {
    return JSON.parse(readFileSync(STAMP_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeStamp(stamp) {
  writeFileSync(STAMP_FILE, `${JSON.stringify(stamp, null, 2)}\n`, 'utf8');
}

async function ensureVenv(explicitPython) {
  const venvPython = venvPythonPath();
  if (existsSync(venvPython)) {
    const existing = probePython(venvPython);
    if (existing?.supported) {
      console.log(`- The virtual environment .venv already exists (Python ${existing.version}). Keeping it.`);
      if (explicitPython) console.log('  (--python is ignored; delete the .venv folder to rebuild it.)');
      return venvPython;
    }
    fail(
      'the existing .venv folder does not hold a working Python 3.12 or 3.13.\n' +
        'Delete the .venv folder (close any program using it first) and run `npm run setup` again.',
    );
  }

  console.log('- Looking for Python 3.12 or 3.13 (64-bit)...');
  const { found, rejected } = findPython(explicitPython);
  if (!found) {
    const seen = rejected.length > 0 ? `\nFound only: ${describeRejected(rejected)}.` : '';
    fail(`no usable Python found.${seen}\n${PYTHON_INSTALL_HINT}`);
  }
  console.log(`  Using Python ${found.version} at ${found.executable}`);

  console.log('- Creating the virtual environment in .venv ...');
  const code = await run(found.executable, ['-m', 'venv', VENV_DIR], { env: pythonEnv() });
  if (code !== 0 || !existsSync(venvPython)) {
    fail(
      'could not create .venv. On Debian or Ubuntu install the venv module first ' +
        '(for example `sudo apt install python3.12-venv`), delete any half-made .venv folder, and retry.',
    );
  }
  return venvPython;
}

async function installPythonPackages(venvPython, stamp, force) {
  if (!existsSync(DEV_REQUIREMENTS)) fail('pipeline/requirements-dev.txt is missing.');
  // Every requirements file counts, because requirements-dev.txt normally includes requirements.txt.
  const requirementFiles = readdirSync(PIPELINE_DIR)
    .filter((name) => /^requirements.*\.txt$/.test(name))
    .sort()
    .map((name) => path.join(PIPELINE_DIR, name));
  const wanted = fingerprint(requirementFiles);
  if (!force && stamp.python === wanted) {
    console.log('- Python packages are already installed and the requirement files have not changed. Skipping.');
    return;
  }

  const pip = ['-m', 'pip', 'install', '--disable-pip-version-check'];
  console.log(`- Installing pip ${PIP_VERSION} into .venv ...`);
  if ((await run(venvPython, [...pip, `pip==${PIP_VERSION}`], { env: pythonEnv() })) !== 0) {
    fail('could not install pip. Check the internet connection and run `npm run setup` again.');
  }
  console.log('- Installing the pipeline packages from pipeline/requirements-dev.txt ...');
  if ((await run(venvPython, [...pip, '-r', DEV_REQUIREMENTS], { env: pythonEnv() })) !== 0) {
    fail('pip could not install the pipeline packages (see the messages above).');
  }
  stamp.python = wanted;
  writeStamp(stamp);
}

async function installWebPackages(stamp, force) {
  if (!existsSync(path.join(WEB_DIR, 'package.json'))) fail('web/package.json is missing.');
  const lockFile = path.join(WEB_DIR, 'package-lock.json');
  const webFiles = [path.join(WEB_DIR, 'package.json'), lockFile];
  const hasModules = existsSync(path.join(WEB_DIR, 'node_modules'));
  if (!force && hasModules && stamp.web === fingerprint(webFiles)) {
    console.log('- Web packages are already installed and web/package-lock.json has not changed. Skipping.');
    return;
  }

  // `npm ci` installs exactly what the lockfile says. Without a lockfile only `npm install` can work,
  // and it writes a new lockfile that should be committed.
  const hasLock = existsSync(lockFile);
  const args = hasLock ? ['ci'] : ['install'];
  console.log(`- Installing the web packages (npm ${args[0]} in web/) ...`);
  if (!hasLock) console.log('  There is no web/package-lock.json yet; npm will create one. Commit it.');
  if ((await runNpm(args, { cwd: WEB_DIR })) !== 0) {
    fail(
      'npm could not install the web packages (see the messages above).\n' +
        'On Windows, stop any running `npm run dev` or `npm run preview` first: open files cannot be replaced.',
    );
  }
  stamp.web = fingerprint(webFiles);
  writeStamp(stamp);
}

const options = parseArgs(process.argv.slice(2));
console.log(`Setting up the project in ${REPO_ROOT}\n`);
if (nodeMajor() < 22) fail(`Node ${process.versions.node} is too old; install Node 22 or newer.`);

const venvPython = await ensureVenv(options.python);
const stamp = readStamp();
await installPythonPackages(venvPython, stamp, options.force);
await installWebPackages(stamp, options.force);

console.log('\nSetup finished. Next, run:  npm run check');
console.log('(or `npm run dev` to start the web app)');
