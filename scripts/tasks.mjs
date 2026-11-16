// The composite commands behind `npm run lint`, `npm test`, `npm run check` and the others.
//
//   node scripts/tasks.mjs <task> [extra arguments]
//
// Each task is a list of steps run in order. The first failing step stops the task, and a one-line
// summary at the end says what passed, what failed and what did not run. Python steps use the project's
// virtual environment; web steps run the matching script from web/package.json inside web/.

import path from 'node:path';
import { annotateFailure, REPO_ROOT, run, runNpm, runPython, WEB_DIR } from './lib.mjs';

function python(label, args) {
  return { label, run: () => runPython(args) };
}

// Runs a web/package.json script. Extra arguments go after `--` so npm hands them to the script.
function web(label, script, extra = []) {
  const args = extra.length > 0 ? ['run', script, '--', ...extra] : ['run', script];
  return { label, run: () => runNpm(args, { cwd: WEB_DIR }) };
}

function sizeCheck() {
  return { label: 'size budget', run: () => run(process.execPath, [path.join(REPO_ROOT, 'scripts', 'check-size.mjs')]) };
}

const lint = () => [python('ruff', ['-m', 'ruff', 'check', 'pipeline']), web('web lint', 'lint')];
const test = () => [python('pytest', ['-m', 'pytest', '-q']), web('web test', 'test')];
const validate = () => [python('validate', ['-m', 'pipeline', 'validate'])];

// Each task gets the extra command-line arguments. Tasks that pass them on say so with `takesArgs`;
// the others refuse them, because it would be unclear which of their steps should receive them.
const TASKS = {
  lint: { steps: lint },
  test: { steps: test },
  validate: { steps: validate },
  check: {
    steps: () => [...lint(), ...test(), web('contract types up to date', 'gen:contract', ['--check']), ...validate(), sizeCheck()],
  },
  // Rebuilding the sample needs the network but no login. Its output is then checked like CI would.
  sample: {
    steps: () => [python('pipeline run --site sample', ['-m', 'pipeline', 'run', '--site', 'sample']), ...validate(), sizeCheck()],
  },
  // The end-to-end test runs against the production build, so build first.
  e2e: { takesArgs: true, steps: (extra) => [web('build', 'build'), web('e2e', 'e2e', extra)] },
  'gen:contract': { takesArgs: true, steps: (extra) => [web('gen:contract', 'gen:contract', extra)] },
  dev: { takesArgs: true, steps: (extra) => [web('dev server', 'dev', extra)] },
  build: { takesArgs: true, steps: (extra) => [web('build', 'build', extra)] },
  preview: { takesArgs: true, steps: (extra) => [web('preview server', 'preview', extra)] },
};

const [name, ...extra] = process.argv.slice(2);
const task = TASKS[name];
if (!task) {
  console.error(`Unknown task "${name ?? ''}". Known tasks: ${Object.keys(TASKS).join(', ')}`);
  process.exit(2);
}
if (extra.length > 0 && !task.takesArgs) {
  console.error(`"${name}" takes no extra arguments (got: ${extra.join(' ')}).`);
  process.exit(2);
}

// Remember a Ctrl+C so that stopping a dev server is reported as "stopped", not as a failure.
let interrupted = false;
process.on('SIGINT', () => {
  interrupted = true;
});

const steps = task.steps(extra);
const passed = [];
let failed = null;
let exitCode = 0;
for (const step of steps) {
  console.log(`\n==> ${name}: ${step.label}`);
  exitCode = await step.run();
  if (exitCode !== 0) {
    failed = step;
    // In CI, attach the end of this step's output to the run so the cause is visible without logging in.
    annotateFailure(`${name} - ${step.label} failed (exit code ${exitCode})`);
    break;
  }
  passed.push(step);
}

const notRun = steps.slice(passed.length + (failed ? 1 : 0));
const parts = [];
if (passed.length > 0) parts.push(`passed: ${passed.map((s) => s.label).join(', ')}`);
if (failed) parts.push(`${interrupted ? 'STOPPED' : 'FAILED'}: ${failed.label} (exit code ${exitCode})`);
if (notRun.length > 0) parts.push(`not run: ${notRun.map((s) => s.label).join(', ')}`);
const verdict = failed ? (interrupted ? 'stopped' : 'FAILED') : 'OK';
console.log(`\n${name} ${verdict}. ${parts.join('; ')}.`);
process.exitCode = exitCode;
