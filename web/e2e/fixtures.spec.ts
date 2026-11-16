// The browser tests run on the SYNTHETIC fixtures, not on the real data the build carries: the
// preview server answers /data/ from the fixture folder, and a file the fixtures lack is a 404.

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFiles, notSyntheticReason, YEAR_SITE_ID } from '../tests/fixtures/synthetic.mjs';
import { expect, test } from './support';

const buildData = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'data');

test('the page reads the synthetic manifest at data/manifest.json', async ({ request }) => {
  const response = await request.get('data/manifest.json');
  expect(response.status()).toBe(200);
  const manifest = (await response.json()) as { sites: { id: string }[] };
  expect(notSyntheticReason(manifest)).toBeNull();
  expect(manifest.sites[0]!.id).toBe(YEAR_SITE_ID);
});

test("the build's own data files are not served: a file the fixtures lack is a 404", async ({ request }) => {
  // Two names that exist nowhere, and every file in the build's own data folder (when it has one)
  // that is not also a fixture file. The folder is listed rather than its manifest read, so the
  // shape of the real data (a layer with no files yet, say) cannot break this test.
  const fixtureFiles = new Set(buildFiles().map((f) => f.path));
  const names = ['no-such-site/site.json', 'no-such-file.tif'];
  if (existsSync(buildData)) {
    for (const entry of readdirSync(buildData, { recursive: true, withFileTypes: true })) {
      if (entry.isFile()) names.push(path.relative(buildData, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'));
    }
  }
  for (const name of names.filter((n) => !fixtureFiles.has(n))) {
    expect((await request.get(`data/${name}`)).status(), name).toBe(404);
  }
});

test('fixture rasters are answered with byte ranges, as the map reader needs', async ({ request }) => {
  const tif = buildFiles().find((f) => f.path.startsWith(`${YEAR_SITE_ID}/`) && f.path.endsWith('.tif'))!;
  const response = await request.get(`data/${tif.path}`, { headers: { Range: 'bytes=0-15' } });
  expect(response.status()).toBe(206);
  expect((await response.body()).length).toBe(16);
});
