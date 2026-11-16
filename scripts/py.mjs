// Runs the project's virtual-environment Python with the arguments given, from the repository root.
//
//   npm run pipeline -- validate      runs   python -m pipeline validate
//   node scripts/py.mjs -m pytest -k encode
//
// Nobody has to activate the virtual environment: we call its interpreter by path.

import { runPython } from './lib.mjs';

process.exitCode = await runPython(process.argv.slice(2));
