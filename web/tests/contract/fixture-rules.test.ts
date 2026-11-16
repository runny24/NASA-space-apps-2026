// The synthetic fixtures keep the data contract's rules that JSON Schema cannot express
// (docs/DATA_CONTRACT.md, "Rules the schema cannot express", and the checks it lists for overlays,
// the story and bars), and the year site carries everything the later app features are tested with.
// The pipeline enforces the same rules on real data (`python -m pipeline validate`).

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromArrayBuffer } from 'geotiff';
import { describe, expect, it } from 'vitest';
import type { Manifest } from '../../src/contract/manifest';
import {
  addDays,
  BARS_ID,
  BARS_PERIOD,
  BARS_PERIOD_ID,
  buildFiles,
  buildManifest,
  daysBetween,
  EMPTY_PERIOD,
  HV_ABSENT_DATE,
  mercatorToLonLat,
  MISSING_SLOTS,
  notSyntheticReason,
  OVERLAY_DATE_PROPERTY,
  OVERLAY_DATE_RANGE,
  OVERLAY_ID,
  overlayPoints,
  PASS_COUNT,
  PASS_INTERVAL_DAYS,
  PASS_SLOTS,
  PASS_START,
  POINT_DAY_BEFORE_PASS,
  POINT_LACKING_FIELD,
  POINT_ON_PASS_DATE,
  pointsDated,
  SHARE_NULL_DATE,
  STORY_MIDYEAR_DATE,
  YEAR_DATES,
  YEAR_HV_DATES,
  YEAR_LAYERS,
  YEAR_SITE_ID,
  yearClassCodes,
  yearDisplayCodes,
} from '../fixtures/synthetic.mjs';

const manifest = buildManifest() as unknown as Manifest;
const files = new Map(buildFiles().map((f) => [f.path, f.bytes]));
const readJson = (file: string) => JSON.parse(new TextDecoder().decode(files.get(file))) as unknown;
const year = manifest.sites.find((s) => s.id === YEAR_SITE_ID)!;
const ascending = (list: string[]) => list.every((d, i) => i === 0 || list[i - 1]! < d);

interface Feature {
  type: string;
  geometry: { type: string; coordinates: [number, number] };
  properties: Record<string, unknown>;
}
interface Stats {
  series: { id: string; unit: string; layer?: string; points: { date: string; value: number | null }[] }[];
  bars?: {
    id: string;
    title: string;
    unit: string;
    layer?: string;
    method: string;
    categories: { label: string; value: number | null; low?: number; high?: number; n?: number; class?: number; note?: string }[];
  }[];
}

async function tiff(url: string) {
  const bytes = files.get(url)!;
  return (await fromArrayBuffer(bytes.slice().buffer)).getImage(0);
}

describe('the fixture keeps the rules the schema cannot express', () => {
  it('1. site ids are unique, and layer ids are unique within a site', () => {
    const ids = manifest.sites.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const site of manifest.sites) expect(new Set(site.layers.map((l) => l.id)).size, site.id).toBe(site.layers.length);
  });

  it('2. dates are strictly ascending, one entry per date', () => {
    for (const site of manifest.sites) expect(ascending(site.dates.map((d) => d.date)), site.id).toBe(true);
  });

  it('3. every per-date and pair item names dates of the site, a pair the earlier one first', () => {
    for (const site of manifest.sites) {
      const dates = new Set(site.dates.map((d) => d.date));
      for (const layer of site.layers) {
        for (const item of layer.items) {
          if (layer.kind === 'per-date') expect(dates.has(item.date!), `${site.id}/${layer.id} ${item.date}`).toBe(true);
          if (layer.kind === 'pair') {
            expect(dates.has(item.reference!) && dates.has(item.secondary!), `${site.id}/${layer.id}`).toBe(true);
            expect(item.reference! < item.secondary!).toBe(true);
          }
        }
      }
    }
  });

  it('4. every stack names a per-date layer, its band dates are ascending dates of the site, one per band', async () => {
    for (const site of manifest.sites) {
      const dates = new Set(site.dates.map((d) => d.date));
      for (const stack of site.stacks) {
        expect(site.layers.find((l) => l.id === stack.layer)?.kind, `${site.id}: ${stack.layer}`).toBe('per-date');
        expect(ascending(stack.band_dates)).toBe(true);
        expect(stack.band_dates.every((d) => dates.has(d))).toBe(true);
        expect((await tiff(stack.url)).getSamplesPerPixel(), stack.url).toBe(stack.band_dates.length);
      }
    }
  });

  it('5. no missing pass is also an acquisition', () => {
    for (const site of manifest.sites) {
      const dates = new Set(site.dates.map((d) => d.date));
      expect(site.missing_passes.filter((m) => dates.has(m.date)), site.id).toEqual([]);
    }
  });

  it("6. every acquisition's release is the site's release (none is mixed)", () => {
    for (const site of manifest.sites) {
      expect(site.source.release).not.toBe('mixed');
      expect(site.dates.every((d) => d.release === site.source.release), site.id).toBe(true);
    }
  });

  it('7. every site is a sample, with a notice and release "sample"', () => {
    for (const site of manifest.sites) {
      expect(site.is_sample, site.id).toBe(true);
      expect(site.notice).toMatch(/SYNTHETIC/);
      expect(site.source.release).toBe('sample');
    }
  });

  it('8. every URL points at a fixture file; rasters are uint8 in EPSG:3857 with nodata 0 declared', async () => {
    for (const site of manifest.sites) {
      const urls = [
        ...site.layers.flatMap((l) => l.items.map((i) => i.url)),
        ...site.stacks.map((s) => s.url),
        ...(site.overlays ?? []).map((o) => o.url),
        ...(site.stats ? [site.stats] : []),
      ];
      for (const url of urls) expect(files.has(url), `${site.id}: ${url}`).toBe(true);
      for (const url of urls.filter((u) => u.endsWith('.tif'))) {
        const image = await tiff(url);
        expect(image.getGeoKeys()?.ProjectedCSTypeGeoKey, url).toBe(3857);
        expect(image.getGDALNoData(), url).toBe(0);
        expect(image.getBitsPerSample(), url).toBe(8);
      }
    }
  });

  it("9. every raster's footprint overlaps its site's bounds", async () => {
    for (const site of manifest.sites) {
      const [w, s, e, n] = site.bounds;
      for (const url of site.layers.flatMap((l) => l.items.map((i) => i.url))) {
        const [x0, y0, x1, y1] = (await tiff(url)).getBoundingBox() as [number, number, number, number];
        const [west, south] = mercatorToLonLat(x0, y0);
        const [east, north] = mercatorToLonLat(x1, y1);
        expect(west < e && east > w && south < n && north > s, `${site.id}: ${url}`).toBe(true);
      }
    }
  });

  it('overlays: the file is a FeatureCollection of points inside the bounds, dated within date_range, as counted', () => {
    const withOverlays = manifest.sites.filter((s) => (s.overlays ?? []).length > 0);
    expect(withOverlays.map((s) => s.id)).toEqual([YEAR_SITE_ID]);
    for (const site of withOverlays) {
      const [w, s, e, n] = site.bounds;
      for (const overlay of site.overlays!) {
        const collection = readJson(overlay.url) as { type: string; features: Feature[] };
        expect(collection.type).toBe('FeatureCollection');
        expect(collection.features.length).toBe(overlay.count);
        expect(files.get(overlay.url)!.length).toBe(overlay.bytes);
        const [first, last] = overlay.date_range!;
        const lacking = collection.features.find(
          (f) => f.properties[overlay.date_property!] === POINT_LACKING_FIELD.day && !(POINT_LACKING_FIELD.field in f.properties),
        );
        for (const f of collection.features) {
          expect(f.type).toBe('Feature');
          expect(f.geometry.type).toBe('Point');
          const [lon, lat] = f.geometry.coordinates;
          expect(lon >= w && lon <= e && lat >= s && lat <= n, `${lon}, ${lat}`).toBe(true);
          const date = f.properties[overlay.date_property!] as string;
          expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(date >= first! && date <= last!, date).toBe(true);
          // Every field is there, except on the one point that lacks one on purpose.
          for (const field of overlay.fields ?? [])
            if (f !== lacking || field.name !== POINT_LACKING_FIELD.field) expect(f.properties[field.name], field.name).toBeDefined();
        }
      }
    }
  });

  it('story: every step names a layer, a date of that layer and overlays that exist', () => {
    for (const site of manifest.sites) {
      for (const step of site.story ?? []) {
        const layer = site.layers.find((l) => l.id === step.layer);
        expect(layer, `${site.id}/${step.id}: layer ${step.layer}`).toBeDefined();
        if (step.date) {
          expect(layer!.kind).toBe('per-date');
          expect(layer!.items.some((i) => i.date === step.date), `${step.id}: ${step.date}`).toBe(true);
        }
        if (layer!.kind === 'static') expect(step.date ?? step.reference ?? step.secondary).toBeUndefined();
        for (const id of step.overlays ?? []) expect((site.overlays ?? []).some((o) => o.id === id), `${step.id}: ${id}`).toBe(true);
        if (step.view) {
          const [w, s, e, n] = site.bounds;
          const [lon, lat] = step.view.center;
          expect(lon >= w && lon <= e && lat >= s && lat <= n, `${step.id}: view`).toBe(true);
        }
      }
    }
  });

  it("bars: every category's class exists in the bars' classified layer, inside its interval", () => {
    for (const site of manifest.sites.filter((s) => s.stats)) {
      for (const bars of (readJson(site.stats!) as Stats).bars ?? []) {
        const layer = site.layers.find((l) => l.id === bars.layer);
        expect(layer?.encoding.type, `${site.id}/${bars.id}`).toBe('categorical-uint8');
        const classes = layer!.encoding.type === 'categorical-uint8' ? layer!.encoding.classes.map((c) => c.value) : [];
        for (const cat of bars.categories) {
          if (cat.class !== undefined) expect(classes, cat.label).toContain(cat.class);
          if (cat.value !== null && cat.low !== undefined && cat.high !== undefined) {
            expect(cat.low).toBeLessThanOrEqual(cat.value);
            expect(cat.high).toBeGreaterThanOrEqual(cat.value);
          }
        }
      }
    }
  });
});

describe('the year site carries what the app features are tested with', () => {
  const layer = (id: string) => year.layers.find((l) => l.id === id)!;

  it('comes first, sits over open ocean, and says everywhere that it is synthetic', () => {
    expect(manifest.sites[0]!.id).toBe(YEAR_SITE_ID);
    expect(year.source.citation).toMatch(/SYNTHETIC/);
    expect(year.title).toMatch(/SYNTHETIC/);
    for (const l of year.layers) expect(l.description, l.id).toMatch(/SYNTHETIC/);
    // Its own box, apart from the first fixture's.
    const other = manifest.sites[1]!.bounds;
    const [w, s, e, n] = year.bounds;
    expect(e < other[0] || w > other[2] || n < other[1] || s > other[3]).toBe(true);
  });

  it('has 30 pass slots 12 days apart: 26 acquisitions and 4 missing passes with SYNTHETIC reasons', () => {
    expect(PASS_SLOTS).toHaveLength(PASS_COUNT);
    expect(PASS_SLOTS[0]).toBe(PASS_START);
    expect(PASS_SLOTS[PASS_COUNT - 1]).toBe('2026-11-08');
    PASS_SLOTS.forEach((d, i) => i > 0 && expect(addDays(PASS_SLOTS[i - 1]!, PASS_INTERVAL_DAYS)).toBe(d));
    expect(year.dates.map((d) => d.date)).toEqual(YEAR_DATES);
    expect(YEAR_DATES).toHaveLength(26);
    expect(year.missing_passes.map((m) => m.date)).toEqual(MISSING_SLOTS.map((i) => PASS_SLOTS[i]));
    for (const m of year.missing_passes) expect(m.reason).toMatch(/SYNTHETIC/);
  });

  it('has two per-date layers (one lacks an acquisition) with different display ranges, and a static class layer', () => {
    const hh = layer(YEAR_LAYERS.hh);
    const hv = layer(YEAR_LAYERS.hv);
    expect(hh.kind).toBe('per-date');
    expect(hh.items.map((i) => i.date)).toEqual(YEAR_DATES);
    expect(hv.kind).toBe('per-date');
    expect(hv.items.map((i) => i.date)).toEqual(YEAR_HV_DATES);
    expect(YEAR_HV_DATES).toHaveLength(25);
    expect(YEAR_DATES).toContain(HV_ABSENT_DATE);
    expect(YEAR_HV_DATES).not.toContain(HV_ABSENT_DATE);
    expect(hv.display).not.toEqual(hh.display);
    const classes = layer(YEAR_LAYERS.classes);
    expect(classes.kind).toBe('static');
    expect(classes.encoding.type).toBe('categorical-uint8');
    if (classes.encoding.type === 'categorical-uint8') expect(classes.encoding.classes).toHaveLength(5);
  });

  it("never reuses the real site's layer ids or dates", () => {
    // Compared with fixed facts about the real site (tarn-taran: layers hh and hv, a 12-day cycle
    // whose first acquisition is 2025-11-21), never with the files in public/data: this test is
    // part of the deploy gate, and new real data must not be able to fail it.
    const real = { layerIds: ['hh', 'hv'], cycleStart: '2025-11-21', cycleDays: 12 };
    for (const id of real.layerIds) expect(year.layers.map((l) => l.id)).not.toContain(id);
    // Off the real cycle's phase, so no fixture pass slot can ever be a date of that cycle.
    expect(PASS_INTERVAL_DAYS).toBe(real.cycleDays);
    for (const d of PASS_SLOTS) expect(daysBetween(real.cycleStart, d) % real.cycleDays, d).not.toBe(0);
  });

  it("every date's picture differs visibly from every other date's, in both per-date layers", () => {
    for (const [pol, dates] of [
      ['hh', YEAR_DATES],
      ['hv', YEAR_HV_DATES],
    ] as const) {
      const pictures = dates.map((d) => yearDisplayCodes(d, pol));
      for (let a = 0; a < pictures.length; a++) {
        for (let b = a + 1; b < pictures.length; b++) {
          // At least 40 pixels apart by 20 codes (about 3 dB) or more.
          let differ = 0;
          for (let i = 0; i < pictures[a]!.length; i++) if (Math.abs(pictures[a]![i]! - pictures[b]![i]!) >= 20) differ++;
          expect(differ, `${pol} ${dates[a]} vs ${dates[b]}`).toBeGreaterThanOrEqual(40);
        }
      }
      // A nodata corner on every date.
      for (const p of pictures) expect(p[0]).toBe(0);
    }
  });

  it('the class raster agrees with the front: darkened classes are dark on the last date and were not on the first', () => {
    const classes = yearClassCodes();
    const first = yearDisplayCodes(YEAR_DATES[0]!, 'hh');
    const last = yearDisplayCodes(YEAR_DATES[YEAR_DATES.length - 1]!, 'hh');
    const darkenedLast: number[] = [];
    const darkenedFirst: number[] = [];
    classes.forEach((k, i) => {
      if (k >= 1 && k <= 3) {
        darkenedLast.push(last[i]!);
        darkenedFirst.push(first[i]!);
      }
    });
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(darkenedLast.length).toBeGreaterThan(100);
    // About -21 dB on the last date, about -12 dB on the first (codes, 6.35 per dB).
    expect(mean(darkenedFirst) - mean(darkenedLast)).toBeGreaterThan(30);
    expect(classes[0]).toBe(0); // the nodata corner
  });

  it('has a click-query stack for each per-date layer, over that layer’s dates', () => {
    expect(year.stacks.map((s) => [s.layer, s.band_dates])).toEqual([
      [YEAR_LAYERS.hh, YEAR_DATES],
      [YEAR_LAYERS.hv, YEAR_HV_DATES],
    ]);
  });

  it('has the points overlay: a few hundred points, an empty pass period inside its range, points on and before pass days', () => {
    const overlay = year.overlays!.find((o) => o.id === OVERLAY_ID)!;
    expect(overlay.kind).toBe('points');
    expect(overlay.date_property).toBe(OVERLAY_DATE_PROPERTY);
    expect(overlay.date_range).toEqual(['2026-09-15', '2026-11-18']);
    expect(overlay.fields).toHaveLength(3);
    expect(overlay.fields!.some((f) => f.unit)).toBe(true);
    for (const text of [overlay.title, overlay.description, overlay.method, overlay.credit]) expect(text).toMatch(/SYNTHETIC/);
    expect(overlay.color).toMatch(/^#[0-9a-f]{6}$/);
    // The map's credit line drops a credit that another contains: the overlay's must stand alone
    // for a test to see it come and go with the overlay.
    expect(year.source.citation).not.toContain(overlay.credit);
    expect(overlay.credit).not.toContain(year.source.citation);
    expect(overlay.count).toBeGreaterThanOrEqual(200);
    expect(overlay.count).toBeLessThanOrEqual(999);

    // The period of the pass of 2026-10-03 (to the day before the next pass) has none.
    expect(EMPTY_PERIOD).toEqual(['2026-10-03', '2026-10-14']);
    expect(pointsDated(EMPTY_PERIOD[0]!, EMPTY_PERIOD[1]!)).toBe(0);
    // Every other pass period inside the range has points; the range starts inside the period of 2026-09-09.
    const [first, last] = OVERLAY_DATE_RANGE;
    expect(PASS_SLOTS.filter((d) => d < first!).at(-1)).toBe('2026-09-09');
    PASS_SLOTS.forEach((pass, i) => {
      const end = i + 1 < PASS_SLOTS.length ? addDays(PASS_SLOTS[i + 1]!, -1) : last!;
      if (end < first! || pass > last!) return;
      const from = pass < first! ? first! : pass;
      if (pass === EMPTY_PERIOD[0]) return;
      expect(pointsDated(from, end), `${from} to ${end}`).toBeGreaterThan(0);
    });
    // Exactly one point lacks a field, and it is one of the overlay's fields.
    const lackingField = overlayPoints().features.filter((f: { properties: Record<string, unknown> }) => overlay.fields!.some((field) => !(field.name in f.properties)));
    expect(lackingField).toHaveLength(1);
    expect(lackingField[0]!.properties[OVERLAY_DATE_PROPERTY]).toBe(POINT_LACKING_FIELD.day);
    expect(lackingField[0]!.properties).not.toHaveProperty(POINT_LACKING_FIELD.field);
    expect(overlay.fields!.map((f) => f.name)).toContain(POINT_LACKING_FIELD.field);
    expect(PASS_SLOTS).toContain(POINT_ON_PASS_DATE);
    expect(pointsDated(POINT_ON_PASS_DATE, POINT_ON_PASS_DATE)).toBeGreaterThan(0);
    expect(PASS_SLOTS).toContain(addDays(POINT_DAY_BEFORE_PASS, 1));
    expect(pointsDated(POINT_DAY_BEFORE_PASS, POINT_DAY_BEFORE_PASS)).toBeGreaterThan(0);
    // The last day of the range has points too (ten days after the last pass).
    expect(last).toBe(addDays(PASS_SLOTS[PASS_COUNT - 1]!, 10));
    expect(pointsDated(last!, last!)).toBeGreaterThan(0);
  });

  it('is deterministic: two builds give the same bytes', () => {
    const again = new Map(buildFiles().map((f) => [f.path, f.bytes]));
    for (const [file, bytes] of files) expect(Buffer.compare(Buffer.from(bytes), Buffer.from(again.get(file)!)), file).toBe(0);
  });

  it('has a four-step story as the later features need it', () => {
    const story = year.story!;
    expect(story).toHaveLength(4);
    for (const step of story) {
      expect(step.title).toMatch(/SYNTHETIC/);
      expect(step.text).toMatch(/SYNTHETIC/);
    }
    expect(story[0]).toMatchObject({ layer: YEAR_LAYERS.hh });
    expect(story[0]!.date).toBeUndefined();
    expect(story[1]).toMatchObject({ layer: YEAR_LAYERS.hh, date: STORY_MIDYEAR_DATE });
    expect(story[1]!.view).toBeDefined();
    expect(STORY_MIDYEAR_DATE! > YEAR_DATES[5]! && STORY_MIDYEAR_DATE! < YEAR_DATES[20]!).toBe(true);
    expect(story[2]).toMatchObject({ layer: YEAR_LAYERS.classes });
    expect(story[2]!.date).toBeUndefined();
    expect(story[3]).toMatchObject({ layer: YEAR_LAYERS.hv, date: YEAR_HV_DATES.at(-1), overlays: [OVERLAY_ID] });
    expect(story[3]!.view).toBeDefined();
  });

  it('has statistics: a dB series, a % series with a gap, and two bars entries over the classes', () => {
    const stats = readJson(year.stats!) as Stats;
    expect(stats.series.map((s) => s.unit)).toEqual(['dB', '%']);
    const share = stats.series[1]!;
    expect(share.points.filter((p) => p.value === null).map((p) => p.date)).toEqual([SHARE_NULL_DATE]);
    expect(stats.series[0]!.points.every((p) => p.value !== null)).toBe(true);
    expect(stats.bars).toHaveLength(2);
    const bars = stats.bars![0]!;
    expect(bars.id).toBe(BARS_ID);
    expect(bars.layer).toBe(YEAR_LAYERS.classes);
    expect(bars.method).toMatch(/SYNTHETIC/);
    expect(bars.categories.map((c) => c.class)).toEqual([1, 2, 3, 4, 5]);
    const missing = bars.categories.filter((c) => c.value === null);
    expect(missing).toHaveLength(1);
    expect(missing[0]!.note).toMatch(/SYNTHETIC/);
    const noInterval = bars.categories.filter((c) => c.value !== null && c.low === undefined && c.high === undefined);
    expect(noInterval).toHaveLength(1);
    const full = bars.categories.filter((c) => c.value !== null && c.low !== undefined && c.high !== undefined && c.n !== undefined);
    expect(full).toHaveLength(3);

    // The second entry: the same unit and layer, one pass's period, values far below the first's,
    // so that a scale per figure (0.08 against 0.2) would draw its bars far longer than the first's.
    const period = stats.bars![1]!;
    expect(period.id).toBe(BARS_PERIOD_ID);
    expect([period.unit, period.layer]).toEqual([bars.unit, bars.layer]);
    expect(period.title).toContain(`${BARS_PERIOD[0]} to ${BARS_PERIOD[1]}`);
    expect(period.method).toMatch(/SYNTHETIC/);
    const largest = (b: typeof bars) => Math.max(...b.categories.flatMap((c) => (c.value === null ? [] : [c.value, c.high ?? c.value])));
    expect(largest(period)).toBeGreaterThan(0);
    expect(largest(period)).toBeLessThan(largest(bars) / 2);
  });
});

describe('the guard against running the browser tests on real data', () => {
  it('accepts the synthetic manifest', () => {
    expect(notSyntheticReason(buildManifest())).toBeNull();
  });

  it('rejects anything else, saying why', () => {
    expect(notSyntheticReason(null)).toMatch(/not a JSON object/);
    const renamed = structuredClone(buildManifest());
    renamed.generator.name = 'nisar-surface-change pipeline';
    expect(notSyntheticReason(renamed)).toMatch(/written by "nisar-surface-change pipeline"/);
    const foreign = structuredClone(buildManifest()) as { sites: { id: string }[] };
    foreign.sites[1]!.id = 'some-real-place';
    expect(notSyntheticReason(foreign)).toMatch(/some-real-place/);
    const real = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'data', 'manifest.json');
    if (existsSync(real)) expect(notSyntheticReason(JSON.parse(readFileSync(real, 'utf8')))).not.toBeNull();
  });
});
