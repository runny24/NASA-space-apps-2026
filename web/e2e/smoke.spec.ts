// Smoke test of the production build: it loads cleanly, draws a map, and the data contract works
// end to end. It runs on the SYNTHETIC fixtures served at /data/ (playwright.config.ts), whose first
// site is a made-up year of passes; nothing here names a place, a layer or a date.

import type { Page } from '@playwright/test';
import { BRANDING } from '../src/branding';
import { expect, expectSyntheticManifest, openedSite, test } from './support';

interface ManifestLike {
  sites: {
    title: string;
    is_sample?: boolean;
    notice?: string;
    bounds: [number, number, number, number];
    source: { citation?: string };
    layers: { id: string; kind: string; items: unknown[] }[];
  }[];
}

/**
 * Copy the map's WebGL canvas into a 2D canvas during a render (the only moment its pixels are
 * readable) and summarise it: how many distinct colours, and a fingerprint of the pixels.
 */
async function canvasSummary(page: Page): Promise<{ width: number; height: number; colours: number; fingerprint: number }> {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const map = (window as unknown as { __map: import('maplibre-gl').Map }).__map;
        map.once('render', () => {
          const gl = map.getCanvas();
          const copy = document.createElement('canvas');
          copy.width = gl.width;
          copy.height = gl.height;
          const ctx = copy.getContext('2d')!;
          ctx.drawImage(gl, 0, 0);
          const data = ctx.getImageData(0, 0, copy.width, copy.height).data;
          const colours = new Set<number>();
          let fingerprint = 0;
          for (let i = 0; i < data.length; i += 4 * 7) {
            const rgb = (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!;
            colours.add(rgb);
            fingerprint = (fingerprint * 31 + rgb) >>> 0;
          }
          resolve({ width: copy.width, height: copy.height, colours: colours.size, fingerprint });
        });
        map.triggerRepaint();
      }),
  );
}

const waitForIdle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const map = (window as unknown as { __map: import('maplibre-gl').Map }).__map;
        if (map.loaded() && map.areTilesLoaded()) resolve();
        else map.once('idle', () => resolve());
      }),
  );

test('loads cleanly, draws the map and answers the data contract', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`page error: ${err.message}`));

  const manifestResponse = page.waitForResponse((r) => r.url().endsWith('manifest.json'));
  // story=off: the bare address opens the guided story's cover (e2e/story.spec.ts); this test is about the map.
  await page.goto('./?story=off');
  const manifest = (await (await manifestResponse).json()) as ManifestLike;
  expectSyntheticManifest(manifest);
  await expect(page.locator('#map canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean((window as unknown as { __map?: unknown }).__map));
  await waitForIdle(page);

  // The canvas has a real size (a CSS trap can collapse it to 0: see the #map rule in src/styles.css) and is
  // not one flat colour.
  // Poll instead of looking once: on a cold start the map can report "idle" a moment before the first
  // tiles are painted, and one early look would then see a flat background (seen once in practice).
  await expect.poll(async () => (await canvasSummary(page)).colours, { timeout: 30_000 }).toBeGreaterThan(5);
  const first = await canvasSummary(page);
  expect(first.width).toBeGreaterThan(100);
  expect(first.height).toBeGreaterThan(100);

  // The site the app opens by its own rule (the first real site), which is not always sites[0].
  const site = openedSite(manifest);
  if (!site) {
    await expect(page.getByTestId('no-data')).toBeVisible();
  } else {
    await expect(page.locator('#site-title')).toHaveText(site.title);
    if (site.is_sample) {
      await expect(page.getByTestId('sample-notice')).toBeVisible();
      await expect(page.getByTestId('sample-notice')).toContainText(site.notice ?? '');
    }

    // The site's own data credit is shown with the site and in the map's credit line.
    if (site.source.citation) {
      await expect(page.getByTestId('site-citation')).toBeVisible();
      await expect(page.getByTestId('site-citation')).toContainText(site.source.citation);
      await expect(page.locator('.maplibregl-ctrl-attrib-inner')).toContainText(site.source.citation);
    }

    // Stepping the date changes what is drawn.
    const perDate = site.layers.find((l) => l.kind === 'per-date' && l.items.length > 1);
    if (perDate) {
      if (site.layers[0]?.id !== perDate.id) await page.getByLabel('Layer', { exact: true }).selectOption(perDate.id);
      await waitForIdle(page);
      const before = await canvasSummary(page);
      const dateBefore = await page.getByTestId('current-date').innerText();
      await page.getByRole('button', { name: 'Previous date' }).click();
      await expect(page.getByTestId('current-date')).not.toHaveText(dateBefore);
      await waitForIdle(page);
      await expect.poll(async () => (await canvasSummary(page)).fingerprint, { timeout: 15_000 }).not.toBe(before.fingerprint);
    }

    // A click inside the site reports a number with a unit (marked as a bound at the ends of the
    // stored range), or "no data".
    const [w, s, e, n] = site.bounds;
    const point = await page.evaluate(
      ([lon, lat]) => (window as unknown as { __map: import('maplibre-gl').Map }).__map.project([lon!, lat!]),
      [(w + e) / 2, (s + n) / 2],
    );
    const box = (await page.locator('#map').boundingBox())!;
    await page.mouse.click(box.x + point.x, box.y + point.y);
    await expect(page.getByTestId('inspect-value')).toHaveText(/^(-?\d+(\.\d+)?( \S+)?( or (less|more))?|no data)$/);

    // The same point seen on the neighbouring copy of the world (longitude + 360) reads the same.
    const readCentre = async (lon: number, lat: number) => {
      await page.evaluate(
        ([x, y]) => (window as unknown as { __map: import('maplibre-gl').Map }).__map.jumpTo({ center: [x!, y!] }),
        [lon, lat],
      );
      await page.getByRole('button', { name: 'Read values at the map centre' }).click();
      await expect(page.getByTestId('inspect')).not.toContainText('Reading values');
      // The readout names the point in -180..180, whichever copy of the world the map is on.
      await expect(page.getByTestId('inspect')).toContainText(`Longitude ${((w + e) / 2).toFixed(4)}`);
      return page.getByTestId('inspect-value').innerText();
    };
    const atCentre = await readCentre((w + e) / 2, (s + n) / 2);
    expect(await readCentre((w + e) / 2 + 360, (s + n) / 2)).toBe(atCentre);
  }

  expect(problems).toEqual([]);
});

test('a link with a view the map cannot show still opens the app', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`page error: ${err.message}`));
  await page.goto('./?lat=999&lon=999&z=99');
  await expect(page.locator('#map canvas')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(BRANDING.name);
  await expect(page.getByTestId('crash')).toHaveCount(0);
  await page.waitForFunction(() => Boolean((window as unknown as { __map?: unknown }).__map));
  await waitForIdle(page);
  expect(problems).toEqual([]);
});
