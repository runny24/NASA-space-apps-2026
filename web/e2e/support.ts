// What every browser test shares: `test` with a guard that fails loudly when the page loaded any
// manifest that is not the SYNTHETIC fixture one, so that a mis-wired server can never make the
// tests run on real data unnoticed. Import `test` and `expect` from here, not from @playwright/test.

import { test as base, expect } from '@playwright/test';
import type { Manifest } from '../src/contract/manifest';
import { defaultSite } from '../src/state/urlState';
import { notSyntheticReason } from '../tests/fixtures/synthetic.mjs';

export { expect };

/**
 * The site the app opens when the link names none, chosen by the app's own rule (defaultSite: the
 * first site that is not a sample). Never `manifest.sites[0]`, which is that site only while every
 * site before the first real one is a sample.
 */
export function openedSite<S extends { is_sample?: boolean }>(manifest: { sites: S[] }): S | undefined {
  return defaultSite(manifest as unknown as Manifest) as S | undefined;
}

/** Throws, loudly, unless `json` is the synthetic fixture manifest. */
export function expectSyntheticManifest(json: unknown): void {
  const reason = notSyntheticReason(json);
  if (reason)
    throw new Error(
      `THE BROWSER TESTS ARE NOT RUNNING ON THE SYNTHETIC FIXTURES: ${reason}. They must run on the fixtures ` +
        '(playwright.config.ts starts the preview server with SERVE_FIXTURES_AS_DATA=1).',
    );
}

/**
 * Opt-in, for checking timing on a fast machine: E2E_CPU_THROTTLE=4 slows the main thread of every
 * page of the test 4 times, through the DevTools protocol (Chromium only). It does not slow the
 * drawing, which on CI's machines (software WebGL) is what makes frames few and far between. Unset,
 * as in CI and the documented commands, it does nothing.
 */
const CPU_THROTTLE = Number(process.env.E2E_CPU_THROTTLE) || 1;

export const test = base.extend<{ cpuThrottle: void; syntheticDataGuard: void }>({
  cpuThrottle: [
    async ({ context, page }, use) => {
      if (CPU_THROTTLE > 1) {
        const slow = async (p: PageLike) => {
          const cdp = await context.newCDPSession(p);
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
        };
        await slow(page);
        context.on('page', (p) => void slow(p).catch(() => undefined));
      }
      await use();
    },
    { auto: true },
  ],
  syntheticDataGuard: [
    async ({ page }, use) => {
      const reads: Promise<unknown>[] = [];
      page.on('response', (response) => {
        if (!new URL(response.url()).pathname.endsWith('/manifest.json')) return;
        reads.push(
          response.json().catch(async () => {
            // The browser drops the body of a response the page navigated away from before it was
            // read ("Network.getResponseBody: No resource with given identifier found"), which a
            // test that opens links one after another sometimes does. Then read what the server
            // serves at that URL: a server that serves other data is still caught.
            const again = await page.request.get(response.url()).catch(() => null);
            return again ? again.json().catch(() => null) : null;
          }),
        );
      });
      await use();
      for (const json of await Promise.all(reads)) expectSyntheticManifest(json);
    },
    { auto: true },
  ],
});

// Helpers for tests that drive the map (play.spec.ts, static-layer.spec.ts). The map is the one
// MapView exposes as window.__map; data layers are the sources whose id starts with "data-"
// (src/map/dataLayers.ts).

type MapLike = import('maplibre-gl').Map;
type PageLike = import('@playwright/test').Page;

/** Resolves when the map has loaded everything it asked for and drawn it. */
export const waitForMapIdle = (page: PageLike) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const map = (window as unknown as { __map: MapLike }).__map;
        if (map.loaded() && map.areTilesLoaded()) resolve();
        else map.once('idle', () => resolve());
      }),
  );

/** Opens the app with a query string (e.g. "?layer=x&date=y") and waits until the map has drawn its data layer. */
export async function openAt(page: PageLike, query = ''): Promise<void> {
  await page.goto(`./${query}`);
  await expect(page.locator('#site-title')).toBeVisible();
  await page.waitForFunction(() => {
    const map = (window as unknown as { __map?: MapLike }).__map;
    return Boolean(map && Object.keys(map.getStyle()?.sources ?? {}).some((id) => id.startsWith('data-')));
  });
  await waitForMapIdle(page);
}

/**
 * The file each data source of the map draws (from its tile URLs once loaded, else its URL). None
 * while the map or its style is not there yet (the basemap's style comes from the network), so that
 * an expect.poll on it waits instead of failing at once.
 */
export const dataFiles = (page: PageLike) =>
  page.evaluate(() => {
    const map = (window as unknown as { __map?: MapLike }).__map;
    const sources = map?.getStyle()?.sources;
    if (!map || !sources) return [];
    return Object.keys(sources)
      .filter((id) => id.startsWith('data-'))
      .map((id) => {
        const source = map.getSource(id) as unknown as { tiles?: string[]; url?: string };
        const url = source.tiles?.[0] ?? source.url ?? '';
        return url.replace('cog://', '').split('#')[0]!.split('/').pop() ?? '';
      });
  });

/**
 * A fingerprint of what the data layers draw: every other map layer is hidden first (the basemap
 * and its labels), then the canvas is read during a render. Equal pictures give equal numbers.
 */
export async function dataFingerprint(page: PageLike): Promise<number> {
  await hideBasemap(page);
  await waitForMapIdle(page);
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const map = (window as unknown as { __map: MapLike }).__map;
        map.once('render', () => {
          const gl = map.getCanvas();
          const copy = document.createElement('canvas');
          copy.width = gl.width;
          copy.height = gl.height;
          const ctx = copy.getContext('2d')!;
          ctx.drawImage(gl, 0, 0);
          const data = ctx.getImageData(0, 0, copy.width, copy.height).data;
          let fingerprint = 0;
          for (let i = 0; i < data.length; i += 4 * 3) fingerprint = (fingerprint * 31 + ((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!)) >>> 0;
          resolve(fingerprint);
        });
        map.triggerRepaint();
      }),
  );
}

/** Hides every map layer that is not a data layer (the basemap and its labels). */
export const hideBasemap = (page: PageLike) =>
  page.evaluate(() => {
    const map = (window as unknown as { __map: MapLike }).__map;
    for (const layer of map.getStyle().layers)
      if (!layer.id.startsWith('data-') && map.getLayoutProperty(layer.id, 'visibility') !== 'none')
        map.setLayoutProperty(layer.id, 'visibility', 'none');
  });

/** Whether the data layers draw nothing at all: with the basemap hidden, the canvas is one colour. */
export async function dataIsBlank(page: PageLike): Promise<boolean> {
  await hideBasemap(page);
  return (await canvasColours(page)).length === 1;
}

/** The distinct colours the map's canvas shows, as "#rrggbb", read during a render. */
export const canvasColours = (page: PageLike) =>
  page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const map = (window as unknown as { __map: MapLike }).__map;
        map.once('render', () => {
          const gl = map.getCanvas();
          const copy = document.createElement('canvas');
          copy.width = gl.width;
          copy.height = gl.height;
          const ctx = copy.getContext('2d')!;
          ctx.drawImage(gl, 0, 0);
          const data = ctx.getImageData(0, 0, copy.width, copy.height).data;
          const colours = new Set<string>();
          for (let i = 0; i < data.length; i += 4) colours.add(`#${[data[i]!, data[i + 1]!, data[i + 2]!].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
          resolve([...colours]);
        });
        map.triggerRepaint();
      }),
  );

/** Clicks the map at a longitude and latitude. */
export async function clickMapAt(page: PageLike, lon: number, lat: number): Promise<void> {
  const point = await page.evaluate(([x, y]) => (window as unknown as { __map: MapLike }).__map.project([x!, y!]), [lon, lat]);
  const box = (await page.locator('#map').boundingBox())!;
  await page.mouse.click(box.x + point.x, box.y + point.y);
}
