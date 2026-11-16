import { readFileSync } from 'node:fs';
import { fromArrayBuffer } from 'geotiff';
import { describe, expect, it } from 'vitest';
import type { Layer, Manifest, Site, Stack } from '../../src/contract/manifest';
import { historyPoints, lonLatToMercator, pixelIndex, stackFor, type GridInfo } from '../../src/map/stackQuery';
import { buildFiles, buildManifest, GRID, mercatorToLonLat, SITE_ID, STACK_FACTOR, YEAR_LAYERS, YEAR_SITE_ID } from '../fixtures/synthetic.mjs';

/** The click-query stack of the first fixture site (the one with three dates). */
const firstStack = () => buildManifest().sites.find((s) => s.id === SITE_ID)!.stacks[0] as unknown as Stack;

const stackGrid: GridInfo = {
  origin: [GRID.x0, GRID.y0],
  resolution: [GRID.res * STACK_FACTOR, -GRID.res * STACK_FACTOR],
  width: GRID.width / STACK_FACTOR,
  height: GRID.height / STACK_FACTOR,
};

/** lon/lat of the centre of stack pixel (col, row). */
const centre = (col: number, row: number): [number, number] =>
  mercatorToLonLat(GRID.x0 + (col + 0.5) * stackGrid.resolution[0], GRID.y0 + (row + 0.5) * stackGrid.resolution[1]);

describe('lon/lat to pixel index', () => {
  it('matches the known Web Mercator formula', () => {
    const [x, y] = lonLatToMercator(-30, 20);
    expect(x).toBeCloseTo(-3339584.72, 1);
    expect(y).toBeCloseTo(2273030.93, 1);
  });

  it('finds the pixel whose centre was given, everywhere in the grid', () => {
    for (const [col, row] of [
      [0, 0],
      [5, 17],
      [stackGrid.width - 1, stackGrid.height - 1],
    ] as const) {
      const [lon, lat] = centre(col, row);
      expect(pixelIndex(stackGrid, lon, lat)).toEqual({ col, row });
    }
  });

  it('returns null outside the file', () => {
    const [lon, lat] = centre(-1, 3);
    expect(pixelIndex(stackGrid, lon, lat)).toBeNull();
    expect(pixelIndex(stackGrid, 0, 89)).toBeNull();
  });

  it('reads the right history from a real (synthetic) stack file', async () => {
    const file = buildFiles().find((f) => f.path === `${SITE_ID}/stack_hh.tif`)!;
    const image = await (await fromArrayBuffer(file.bytes.slice().buffer)).getImage(0);
    expect(image.getOrigin().slice(0, 2)).toEqual(stackGrid.origin);
    const [lon, lat] = centre(24, 20); // inside the disc that changes from date to date
    const px = pixelIndex(stackGrid, lon, lat)!;
    const codes = Array.from(
      (await image.readRasters({ window: [px.col, px.row, px.col + 1, px.row + 1], interleave: true })) as ArrayLike<number>,
    );
    const stack = firstStack();
    const points = historyPoints(stack, codes, 'dB');
    expect(points.map((p) => p.date)).toEqual(stack.band_dates);
    // The synthetic disc is about -10, -24 and -16 dB on the three dates (plus up to 1 dB of noise).
    expect(points[0]!.value!).toBeGreaterThan(-11.5);
    expect(points[1]!.value!).toBeLessThan(-22.5);
    expect(points[2]!.value!).toBeCloseTo(-16, 0);
  });

  it('reports nodata in a history as "no data", never 0', () => {
    const stack = firstStack();
    const points = historyPoints(stack, [128, 0, 0], 'dB');
    expect(points.map((p) => p.value)).toEqual([-15, null, null]);
    expect(points[1]!.text).toBe('no data');
    expect(historyPoints(stack, null, 'dB').every((p) => p.text === 'no data')).toBe(true);
  });

  it('marks points stored at the ends of the range as bounds, in the text and as a flag', () => {
    const stack = firstStack(); // hh: -35..5 dB
    const points = historyPoints(stack, [255, 1, 128], 'dB');
    expect(points.map((p) => p.text)).toEqual(['5.0 dB or more', '-35.0 dB or less', '-15.0 dB']);
    expect(points.map((p) => p.clipped)).toEqual(['above', 'below', undefined]);
  });
});

describe('the stack a click charts', () => {
  const year = () => buildManifest().sites.find((s) => s.id === YEAR_SITE_ID) as unknown as Site;
  const layer = (site: Site, id: string) => site.layers.find((l) => l.id === id)!;

  it('a layer with a stack of its own charts that stack', () => {
    const site = year();
    expect(stackFor(site, layer(site, YEAR_LAYERS.hh))?.layer).toBe(YEAR_LAYERS.hh);
    expect(stackFor(site, layer(site, YEAR_LAYERS.hv))?.layer).toBe(YEAR_LAYERS.hv);
  });

  it('a layer without a stack charts the stack of a layer with its polarization, wherever that stack is listed', () => {
    const site = year();
    const classes: Layer = { ...layer(site, YEAR_LAYERS.classes), polarization: 'HV' };
    expect(site.stacks[0]!.layer).toBe(YEAR_LAYERS.hh); // so the old fallback would have charted HH
    expect(stackFor(site, classes)?.layer).toBe(YEAR_LAYERS.hv);
    expect(stackFor({ ...site, stacks: [...site.stacks].reverse() }, { ...classes, polarization: 'HH' })?.layer).toBe(YEAR_LAYERS.hh);
  });

  it("otherwise the site's first stack: no polarization, one that no stack's layer has, or no layer at all", () => {
    const site = year();
    const classes = layer(site, YEAR_LAYERS.classes);
    expect(classes.polarization).toBeUndefined();
    expect(stackFor(site, classes)).toBe(site.stacks[0]);
    expect(stackFor(site, { ...classes, polarization: 'VV' })).toBe(site.stacks[0]);
    expect(stackFor(site, null)).toBe(site.stacks[0]);
    expect(stackFor({ ...site, stacks: [] }, classes)).toBeUndefined();
  });

  it('on the published data, a click on the harvest map (drawn from HV) charts the HV stack', () => {
    const manifest = JSON.parse(readFileSync(new URL('../../public/data/manifest.json', import.meta.url), 'utf8')) as Manifest;
    const site = manifest.sites.find((s) => s.layers.some((l) => l.id === 'harvest-wave'));
    expect(site, 'no published site has the harvest-wave layer').toBeDefined();
    const wave = layer(site!, 'harvest-wave');
    expect(wave.polarization).toBe('HV');
    expect(site!.stacks.some((s) => s.layer === wave.id)).toBe(false);
    const stack = stackFor(site!, wave)!;
    expect(stack.layer).toBe('hv');
    expect(layer(site!, stack.layer).polarization).toBe('HV');
  });
});
