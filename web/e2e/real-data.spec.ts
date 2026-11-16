// One smoke test on the REAL data format: the production build with its own data/ (the pipeline's
// files: DEFLATE with predictor 2, 256 px tiles, overviews, about 3 MB each, read by many range
// requests, decoded in geotiff's worker pool and by the lazily loaded deflate code). Every other
// browser test runs on the SYNTHETIC fixtures, which are small, uncompressed and untiled, so only this
// one goes through the path the deployed site takes. It runs in its own Playwright project, against
// a second preview server on port 4174 that does not serve the fixtures (playwright.config.ts), and
// outside the fixture guard of e2e/support.ts (so `test` comes from @playwright/test). Ids, dates and
// units come from the manifest the page loads, never from literals; with no real site in the build
// it skips, and says why.

import { expect, test, type Response } from '@playwright/test';
import type { Manifest } from '../src/contract/manifest';
import { notSyntheticReason } from '../tests/fixtures/synthetic.mjs';
import { clickMapAt, dataFiles, dataFingerprint, dataIsBlank, openedSite, waitForMapIdle } from './support';

/** The file name of a manifest item's url ("tarn-taran/hh_2026-11-04.tif" gives "hh_2026-11-04.tif"). */
const fileName = (url: string) => url.split('/').pop() ?? url;

test('the first real site draws, steps and reads values from the real files', async ({ page }) => {
  test.setTimeout(90_000);
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`page error: ${err.message}`));
  const rasters: { file: string; status: number }[] = [];
  page.on('response', (response: Response) => {
    const path = new URL(response.url()).pathname;
    if (path.includes('/data/') && path.endsWith('.tif')) rasters.push({ file: fileName(path), status: response.status() });
  });

  const manifestResponse = page.waitForResponse((r) => new URL(r.url()).pathname.endsWith('/manifest.json'));
  // story=off: the bare address opens the guided story's cover (e2e/story.spec.ts); this test is about the map.
  await page.goto('./?story=off');
  const manifest = (await (await manifestResponse).json()) as Manifest;
  // This test is only worth anything on the build's own data: a server mis-wired to the fixtures fails it.
  expect(notSyntheticReason(manifest), 'the real-data server served the SYNTHETIC fixture manifest').not.toBeNull();
  const site = openedSite(manifest);
  test.skip(!site || site.is_sample === true, "The build's manifest has no real site (every site is a sample, or there is none): nothing to test.");
  if (!site) return;
  await expect(page.locator('#site-title')).toHaveText(site.title);

  const layer = site.layers.find((l) => l.kind === 'per-date' && l.items.length > 1 && l.unit === 'dB');
  test.skip(!layer, `The real site ${site.id} has no per-date layer in dB with two dates or more.`);
  if (!layer) return;
  if (site.layers[0]?.id !== layer.id) await page.getByLabel('Layer', { exact: true }).selectOption(layer.id);
  const currentDate = page.getByTestId('current-date');

  // The date on screen, and the file the map draws for it.
  const dateOnScreen = await currentDate.innerText();
  const at = layer.items.findIndex((it) => it.date === dateOnScreen);
  expect(at, `the date on screen, ${dateOnScreen}, is one of ${layer.id}'s`).toBeGreaterThanOrEqual(0);
  // The map's style (the basemap's, from the network) may arrive after the stepper shows: wait for it.
  await page.waitForFunction(
    () => Boolean((window as unknown as { __map?: import('maplibre-gl').Map }).__map?.getStyle()?.sources),
    undefined,
    { timeout: 30_000 },
  );
  await expect.poll(() => dataFiles(page), { timeout: 30_000 }).toEqual([fileName(layer.items[at]!.url)]);
  await waitForMapIdle(page);

  // The data layer draws a picture: with the basemap hidden, the canvas is not one flat colour.
  await expect.poll(() => dataIsBlank(page), { timeout: 30_000 }).toBe(false);
  const before = await dataFingerprint(page);

  // Another date of the layer draws another picture.
  const other = at > 0 ? at - 1 : at + 1;
  await page.getByRole('button', { name: other < at ? 'Previous date' : 'Next date' }).click();
  await expect(currentDate).toHaveText(layer.items[other]!.date!);
  await expect.poll(() => dataFiles(page), { timeout: 30_000 }).toEqual([fileName(layer.items[other]!.url)]);
  await waitForMapIdle(page);
  expect(await dataIsBlank(page)).toBe(false);
  expect(await dataFingerprint(page)).not.toBe(before);

  // A click on the map reads a value in dB there (and its history from the stack file). The middle
  // of the site first; a few other points inside it in case the middle has no data.
  const [w, s, e, n] = site.bounds;
  const points = [
    [0.5, 0.5],
    [0.35, 0.35],
    [0.65, 0.65],
    [0.35, 0.65],
    [0.65, 0.35],
  ].map(([x, y]) => [w + (e - w) * x!, s + (n - s) * y!] as const);
  const inDb = /^-?\d+(\.\d+)? dB( or (less|more))?$/;
  let value = '';
  for (const [lon, lat] of points) {
    await clickMapAt(page, lon, lat);
    await expect(page.getByTestId('inspect')).toContainText(`Value (${layer.items[other]!.date})`, { timeout: 30_000 });
    value = await page.getByTestId('inspect-value').innerText();
    if (inDb.test(value)) break;
  }
  expect(value).toMatch(inDb);
  await expect(page.locator('[data-testid="inspect"] table.history tbody tr').first()).toBeVisible({ timeout: 30_000 });

  // Every raster was read with range requests, answered 206 Partial Content.
  expect(rasters.length).toBeGreaterThan(0);
  expect(rasters.filter((r) => r.status !== 206)).toEqual([]);
  expect(new Set(rasters.map((r) => r.file))).toContain(fileName(layer.items[other]!.url));

  expect(problems).toEqual([]);
});
