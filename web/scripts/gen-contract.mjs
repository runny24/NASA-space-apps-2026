// Regenerates the TypeScript types in src/contract/ from the JSON Schemas in ../contract/.
//   npm run gen:contract             write the files
//   npm run gen:contract -- --check  fail (exit 1) if the committed files are out of date
//
// Why generated: the schemas are the source of truth for the data contract. Generating the types
// means the app cannot silently drift from what the pipeline writes.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'json-schema-to-typescript';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contractDir = path.resolve(webDir, '..', 'contract');
const check = process.argv.includes('--check');

const jobs = [
  { schema: 'manifest.schema.json', name: 'Manifest', out: 'manifest.generated.ts' },
  { schema: 'stats.schema.json', name: 'Stats', out: 'stats.generated.ts' },
];

// json-schema-to-typescript does not understand the 2020-12 tuple form (`prefixItems` with
// `items: false`) and would type bounds as never[]. Rewrite it to the older, equivalent tuple form
// (`items: [...]`, `additionalItems: false`) before compiling. The schema file itself is not changed.
function legacyTuples(node) {
  if (Array.isArray(node)) return node.map(legacyTuples);
  if (node === null || typeof node !== 'object') return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) out[key] = legacyTuples(value);
  if (Array.isArray(out.prefixItems)) {
    const rest = out.items;
    out.items = out.prefixItems;
    out.additionalItems = rest === undefined ? true : rest;
    delete out.prefixItems;
  }
  return out;
}

let stale = 0;
for (const job of jobs) {
  const schema = legacyTuples(JSON.parse(readFileSync(path.join(contractDir, job.schema), 'utf8')));
  let ts = await compile(schema, job.name, {
    bannerComment: `// GENERATED from contract/${job.schema} by scripts/gen-contract.mjs. Do not edit by hand:\n// change the schema, then run \`npm run gen:contract\`.`,
    additionalProperties: false,
    style: { singleQuote: true, printWidth: 120 },
    // The schema files are read directly, so $id must not be fetched over the network.
    declareExternallyReferenced: true,
  });
  ts = ts.replace(/\r\n/g, '\n'); // LF on every platform, so --check agrees on Windows
  const target = path.join(webDir, 'src', 'contract', job.out);
  let current = '';
  try {
    current = readFileSync(target, 'utf8');
  } catch {
    // missing file counts as stale
  }
  if (check) {
    if (current !== ts) {
      console.error(`STALE: src/contract/${job.out} does not match contract/${job.schema}. Run: npm run gen:contract`);
      stale += 1;
    }
  } else if (current !== ts) {
    writeFileSync(target, ts, 'utf8');
    console.log(`wrote src/contract/${job.out}`);
  } else {
    console.log(`up to date: src/contract/${job.out}`);
  }
}
if (stale > 0) process.exit(1);
