// Shared helpers for the root `npm run` commands.
//
// Why Node and not shell scripts: the team works on macOS and Windows, and CI runs on Linux and Windows.
// Every machine that can build the web app already has Node, so these scripts behave the same everywhere.
// Only the Node standard library is used, so they run before anything is installed.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const IS_WINDOWS = process.platform === 'win32';

// The repository root is the parent of this scripts/ folder. Working it out from the file's own location
// (instead of process.cwd()) means the commands work no matter which folder they are started from.
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WEB_DIR = path.join(REPO_ROOT, 'web');
export const VENV_DIR = path.join(REPO_ROOT, '.venv');

// The Python versions the project accepts, 64-bit only. One narrow range means every teammate and CI
// install the same pinned packages the same way. Keep it in step with python-version in ci.yml.
export const SUPPORTED_PYTHON_MINORS = [12, 13];

// A virtual environment puts its interpreter in a different folder on Windows.
export function venvPythonPath() {
  return IS_WINDOWS
    ? path.join(VENV_DIR, 'Scripts', 'python.exe')
    : path.join(VENV_DIR, 'bin', 'python');
}

// Returns the virtual environment's Python, or null after printing how to fix its absence. It does not
// exit, so a composite task can still print its summary line.
export function findVenvPython() {
  const python = venvPythonPath();
  if (existsSync(python)) return python;
  console.error(
    `The project's Python environment is missing (looked for ${path.relative(REPO_ROOT, python)}).\n` +
      'Run this once from the repository root:  npm run setup',
  );
  return null;
}

// Environment for every Python child process. PYTHONUTF8=1 makes Python use UTF-8 for files and console
// output; without it a Windows console using an old code page can crash on a non-ASCII character.
export function pythonEnv() {
  return { ...process.env, PYTHONUTF8: '1' };
}

// On GitHub Actions the full logs can only be read by signed-in users, but error annotations on a run are
// public. So in CI we also keep the last part of each step's output, and `annotateFailure` attaches it to
// the run when a step fails. That lets anyone (and any agent) see why a Windows or Linux run broke without
// logging in. Locally nothing changes: the child writes straight to the terminal.
const IN_CI = process.env.GITHUB_ACTIONS === 'true';
const TAIL_CHARS = 6000;
let outputTail = '';

// Emits a GitHub Actions error annotation holding the end of the failed step's output. Does nothing
// outside CI. Newlines and percent signs must be escaped in workflow commands.
export function annotateFailure(title) {
  if (!IN_CI) return;
  const tail = outputTail
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, '') // drop colour codes
    .split(/\r?\n/)
    .slice(-40)
    .join('\n')
    .slice(-3500);
  const escaped = tail.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.log(`::error title=${title.replace(/[:,\r\n]/g, ' ')}::${escaped || '(no output captured)'}`);
}

// Runs a program with the terminal attached (its output appears as it happens) and resolves to its exit
// code. Arguments are passed as a list, never through a shell, so spaces in paths need no quoting.
export function run(command, args, { cwd = REPO_ROOT, env = process.env } = {}) {
  return new Promise((resolve) => {
    // Ctrl+C reaches the child directly (it shares the terminal). Ignoring it here keeps this script
    // alive until the child has finished, so we can still report what happened.
    const ignoreInterrupt = () => {};
    process.on('SIGINT', ignoreInterrupt);
    const done = (code) => {
      process.off('SIGINT', ignoreInterrupt);
      resolve(code);
    };

    let child;
    try {
      child = spawn(command, args, { cwd, env, stdio: IN_CI ? ['inherit', 'pipe', 'pipe'] : 'inherit' });
    } catch (error) {
      console.error(`Could not start ${command}: ${error.message}`);
      done(1);
      return;
    }
    if (IN_CI) {
      // Pass the output through unchanged and remember its last few thousand characters.
      outputTail = '';
      const forward = (target) => (chunk) => {
        target.write(chunk);
        outputTail = (outputTail + chunk.toString('utf8')).slice(-TAIL_CHARS);
      };
      child.stdout.on('data', forward(process.stdout));
      child.stderr.on('data', forward(process.stderr));
    }
    child.on('error', (error) => {
      const hint = error.code === 'ENOENT' ? ' (not installed, or not on PATH)' : '';
      console.error(`Could not start ${command}${hint}: ${error.message}`);
      done(error.code === 'ENOENT' ? 127 : 1);
    });
    // A child killed by a signal has no exit code; treat that as a failure.
    child.on('close', (code, signal) => done(code ?? (signal ? 1 : 0)));
  });
}

export function runPython(args, options = {}) {
  const python = findVenvPython();
  if (!python) return Promise.resolve(1);
  return run(python, args, { env: pythonEnv(), ...options });
}

// How to run npm without a shell.
//
// The trap: on Windows `npm` is not a program but a batch file, npm.cmd. Since April 2024 (the fix for
// CVE-2024-27980) Node refuses to spawn .cmd or .bat files unless `shell: true` is set, and fails with
// EINVAL. Turning the shell on would make cmd.exe re-read every argument, so a path with spaces or a
// character like & would need careful quoting.
//
// The way round it: npm itself is a JavaScript program (npm-cli.js). We start it with the Node that is
// already running this script, so there is no .cmd file and no shell on any platform. When a script runs
// under `npm run`, npm tells us where npm-cli.js is in the npm_execpath environment variable. Otherwise we
// look in the two places Node installers put it.
export function npmCliPath() {
  const fromNpm = process.env.npm_execpath;
  // npm_execpath can point at yarn or pnpm when those started us; only accept npm's own entry point.
  if (fromNpm && /^npm-cli\.c?js$/i.test(path.basename(fromNpm)) && existsSync(fromNpm)) {
    return fromNpm;
  }
  const nodeDir = path.dirname(process.execPath);
  const candidates = [
    path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'), // Windows layout
    path.join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'), // macOS and Linux layout
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export function runNpm(args, options = {}) {
  const cli = npmCliPath();
  if (cli) return run(process.execPath, [cli, ...args], options);
  // On macOS and Linux `npm` is a real executable, so spawning it by name is safe.
  if (!IS_WINDOWS) return run('npm', args, options);
  console.error(
    "Could not find npm's npm-cli.js next to this Node installation.\n" +
      'Start this command through npm (for example `npm run setup`), or reinstall Node from nodejs.org.',
  );
  return Promise.resolve(1);
}

// Python 3 code that reports the interpreter's version, pointer size and real path as JSON. It uses no
// double quotes so that Windows argument quoting cannot mangle it.
const PYTHON_PROBE =
  "import json, struct, sys; print(json.dumps({'version': list(sys.version_info[:3]), " +
  "'bits': struct.calcsize('P') * 8, 'executable': sys.executable}))";

// Asks one interpreter what it is. Returns null when it cannot be started or does not answer (for example
// the Microsoft Store placeholder `python.exe` on Windows, which only prints an install hint).
export function probePython(command, prefixArgs = []) {
  // -I (isolated mode) stops a stray file in the current folder, such as a json.py, from being imported.
  const result = spawnSync(command, [...prefixArgs, '-I', '-c', PYTHON_PROBE], {
    encoding: 'utf8',
    env: pythonEnv(),
    timeout: 20000,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) return null;
  try {
    const info = JSON.parse(result.stdout.trim().split(/\r?\n/).pop());
    const [major, minor, micro] = info.version;
    const supported = major === 3 && SUPPORTED_PYTHON_MINORS.includes(minor) && info.bits === 64;
    return {
      label: [command, ...prefixArgs].join(' '),
      executable: info.executable,
      version: `${major}.${minor}.${micro}`,
      bits: info.bits,
      supported,
    };
  } catch {
    return null;
  }
}

// Finds a supported Python on this machine. Tries the Windows launcher first (it knows every installed
// Python even when none is on PATH), then the usual command names. Returns the first supported one plus
// every unsupported one it saw, so the caller can explain why nothing fitted.
export function findPython(explicitPath = null) {
  const candidates = explicitPath
    ? [[explicitPath, []]]
    : [
        ['py', ['-3.12']],
        ['py', ['-3.13']],
        ['python3.12', []],
        ['python3.13', []],
        ['python3', []],
        ['python', []],
      ];
  const rejected = [];
  for (const [command, prefixArgs] of candidates) {
    const found = probePython(command, prefixArgs);
    if (found?.supported) return { found, rejected };
    if (found) rejected.push(found);
  }
  return { found: null, rejected };
}

export function describeRejected(rejected) {
  return rejected
    .map((p) => `${p.label} is Python ${p.version} (${p.bits}-bit)`)
    .join('; ');
}

export const PYTHON_INSTALL_HINT = IS_WINDOWS
  ? 'Install 64-bit Python 3.12 from python.org (keep "py launcher" ticked), then open a new terminal.'
  : process.platform === 'darwin'
    ? 'Install Python 3.12, for example `brew install python@3.12` or the python.org installer.'
    : 'Install Python 3.12 with venv support, for example `sudo apt install python3.12 python3.12-venv`.';

export function nodeMajor() {
  return Number(process.versions.node.split('.')[0]);
}
