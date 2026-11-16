// The contract test: the manifests the app reads must pass contract/manifest.schema.json
// (JSON Schema 2020-12). The pipeline has the mirror-image test, so the two sides cannot drift.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { buildFiles, buildManifest, buildStats } from '../fixtures/synthetic.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as unknown;

function validator(schemaFile: string) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(readJson(path.join(repoRoot, 'contract', schemaFile)) as object);
}

const validateManifest = validator('manifest.schema.json');
const validateStats = validator('stats.schema.json');
const errors = (v: { errors?: unknown }) => JSON.stringify(v.errors, null, 2);

describe('contract: manifest.schema.json', () => {
  it('accepts the synthetic fixture manifest', () => {
    expect(validateManifest(buildManifest()), errors(validateManifest)).toBe(true);
  });

  it('accepts the synthetic fixture stats', () => {
    expect(validateStats(buildStats()), errors(validateStats)).toBe(true);
  });

  it('accepts every stats file the synthetic manifest points at, as written to disk', () => {
    const files = new Map(buildFiles().map((f) => [f.path, f.bytes]));
    const sites = buildManifest().sites.filter((s) => s.stats);
    expect(sites.length).toBeGreaterThanOrEqual(2);
    for (const site of sites) {
      const bytes = files.get(site.stats!);
      expect(bytes, `${site.id}: no file ${site.stats}`).toBeDefined();
      const stats = JSON.parse(new TextDecoder().decode(bytes)) as { site: string };
      expect(validateStats(stats), `${site.stats}: ${errors(validateStats)}`).toBe(true);
      expect(stats.site).toBe(site.id);
    }
  });

  it('accepts the synthetic manifest as written to disk', () => {
    const bytes = buildFiles().find((f) => f.path === 'manifest.json')!.bytes;
    expect(validateManifest(JSON.parse(new TextDecoder().decode(bytes))), errors(validateManifest)).toBe(true);
  });

  it('rejects a manifest the schema forbids (sanity check of the validator itself)', () => {
    const broken = structuredClone(buildManifest()) as { sites: { bounds: unknown }[] };
    broken.sites[0]!.bounds = [0, 0, 0];
    expect(validateManifest(broken)).toBe(false);
  });

  const realManifest = path.join(repoRoot, 'web', 'public', 'data', 'manifest.json');
  it.skipIf(!existsSync(realManifest))('accepts web/public/data/manifest.json', () => {
    const manifest = readJson(realManifest) as { sites: { stats?: string }[] };
    expect(validateManifest(manifest), errors(validateManifest)).toBe(true);
    // And every stats file it points at.
    for (const site of manifest.sites) {
      if (!site.stats) continue;
      const statsFile = path.join(path.dirname(realManifest), ...site.stats.split('/'));
      expect(validateStats(readJson(statsFile)), errors(validateStats)).toBe(true);
    }
  });
});
