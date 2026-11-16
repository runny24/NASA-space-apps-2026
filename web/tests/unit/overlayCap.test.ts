// The story's day-by-day build of an overlay (state/overlayPeriod.ts: capWindow, buildPeriod) and
// overlayView with a cap. Honesty test 2 of docs/MOTION_AND_STORY_BRIEF.md: at every tick the
// caption's count equals the number of points the map's filter lets through, on hand-made points
// and on the published fire detections of Tarn Taran.

import { readFileSync } from 'node:fs';
// MapLibre's own filter evaluator (installed with maplibre-gl; nothing added to package.json), so
// the test checks what the map itself does with the filter.
import { featureFilter } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import type { Layer, Overlay } from '../../src/contract/manifest';
import { readOverlay, type OverlayPoint } from '../../src/contract/overlay';
import { DAY_KEY, overlayFilter, overlaySourceData } from '../../src/map/overlayLayers';
import {
  addDays,
  buildPeriod,
  capWindow,
  overlayCaption,
  overlayWindow,
  pointsInWindow,
  undatedLeftOut,
  type OverlayWindow,
  type Period,
} from '../../src/state/overlayPeriod';
import { overlayView } from '../../src/state/overlayView';

const point = (day: string | null, index = 0): OverlayPoint => ({ index, lon: index, lat: 0, day, properties: {} });
const dated = (used: Period, extra: Partial<Extract<OverlayWindow, { kind: 'dated' }>> = {}): OverlayWindow => ({
  kind: 'dated',
  wanted: used,
  used,
  clippedStart: false,
  clippedEnd: false,
  rangeKnown: true,
  ...extra,
});
const perDate = (dates: string[]): Layer =>
  ({ id: 'l', title: 'L', kind: 'per-date', unit: '', description: '', items: dates.map((date) => ({ date, url: `${date}.tif` })) }) as unknown as Layer;
const STATIC = { id: 's', title: 'S', kind: 'static', unit: '', description: '', items: [{ url: 's.tif' }] } as unknown as Layer;
const overlay = (extra: Partial<Overlay> = {}): Overlay =>
  ({ id: 'o', title: 'Fire detections', kind: 'points', url: 'o.geojson', description: 'd', credit: 'c', date_property: 'day', ...extra }) as Overlay;

/** How many points MapLibre draws with the filter overlayFilter builds for `window`. */
function filterCount(points: readonly OverlayPoint[], window: OverlayWindow): number {
  const filter = overlayFilter(window);
  const test = filter === null ? () => true : featureFilter(filter, 'layers[0].filter').filter;
  return overlaySourceData(points).features.filter((f) => test({ zoom: 10 }, { type: 1, properties: f.properties ?? {}, id: f.id } as never)).length;
}

/** Every tick of a build of the uncapped `window`: capped at each day from the first day of buildPeriod to its last. */
function ticks(window: OverlayWindow, points: readonly OverlayPoint[]): { day: string; capped: OverlayWindow }[] {
  const period = buildPeriod(window, points);
  if (!period) throw new Error('no period to build');
  const out: { day: string; capped: OverlayWindow }[] = [];
  for (let day = period.first; day <= period.last; day = addDays(day, 1)) out.push({ day, capped: capWindow(window, { first: period.first, upTo: day }) });
  return out;
}

/** Walk a build tick by tick and check every rule of the count; returns the last count and how many days added nothing. */
function walk(window: OverlayWindow, points: readonly OverlayPoint[], label: string): { last: number; emptyDays: number } {
  let previous = 0;
  let emptyDays = 0;
  for (const { day, capped } of ticks(window, points)) {
    const count = pointsInWindow(points, capped).length;
    expect(filterCount(points, capped), `${label} ${day}: the filter lets through what the caption counts`).toBe(count);
    expect(capped.kind, `${label} ${day}`).toBe('dated');
    expect(count, `${label} ${day}: never fewer than the day before`).toBeGreaterThanOrEqual(previous);
    const onDay = points.filter((p) => p.day === day).length;
    expect(count - previous, `${label} ${day}: a day adds exactly the points dated on it`).toBe(onDay);
    if (onDay === 0) {
      expect(count, `${label} ${day}: a day with no point leaves the count unchanged`).toBe(previous);
      emptyDays += 1;
    }
    previous = count;
  }
  return { last: previous, emptyDays };
}

describe('capWindow', () => {
  const all: OverlayWindow = { kind: 'all', range: ['2026-09-15', '2026-11-14'] };
  const none: OverlayWindow = { kind: 'none', wanted: { first: '2026-01-01', last: '2026-01-12' }, range: ['2026-09-15', '2026-11-14'] };
  const closed = dated({ first: '2026-10-01', last: '2026-10-12' }, { wanted: { first: '2026-09-25', last: '2026-10-12' }, clippedStart: true });

  it('no cap: the same window, unchanged', () => {
    for (const w of [all, none, closed]) {
      expect(capWindow(w, null)).toBe(w);
      expect(capWindow(w, undefined)).toBe(w);
    }
  });

  it('kind none: no data stays no data', () => {
    expect(capWindow(none, { first: '2026-01-01', upTo: '2026-01-05' })).toBe(none);
  });

  it('dated: the end is lowered to the cap, never raised; the start, the wanted period, clippedStart and rangeKnown are kept', () => {
    expect(capWindow(closed, { first: '2026-10-01', upTo: '2026-10-05' })).toEqual({ ...closed, used: { first: '2026-10-01', last: '2026-10-05' } });
    expect(capWindow(closed, { first: '2026-10-01', upTo: '2026-10-12' })).toBe(closed);
    expect(capWindow(closed, { first: '2026-10-01', upTo: '2026-10-20' })).toBe(closed);
    expect(closed).toMatchObject({ used: { first: '2026-10-01', last: '2026-10-12' } }); // not changed in place
    const open = dated({ first: '2026-10-01', last: null }, { rangeKnown: false });
    expect(capWindow(open, { first: '2026-10-01', upTo: '2026-10-03' })).toEqual({ ...open, used: { first: '2026-10-01', last: '2026-10-03' } });
  });

  it('dated: while the cap is before the end the overlay\'s data set, the caption gives no "data end" reason; at that end it does', () => {
    // The period 8 to 19 November; the overlay covers only 9 to 10 November: clipped at both ends.
    const o = overlay({ date_range: ['2026-11-09', '2026-11-10'] });
    const w = overlayWindow(o, perDate(['2026-11-08', '2026-11-20']), 0);
    expect(w).toMatchObject({ kind: 'dated', used: { first: '2026-11-09', last: '2026-11-10' }, clippedStart: true, clippedEnd: true });
    const points = [point('2026-11-09', 0), point('2026-11-10', 1)];
    const caption = (upTo: string) => {
      const capped = capWindow(w, { first: '2026-11-09', upTo });
      return overlayCaption('T', capped, pointsInWindow(points, capped).length);
    };
    expect(caption('2026-11-09')).toBe("T, 9 November 2026: 1. This overlay's data start on 9 November 2026.");
    expect(caption('2026-11-10')).toBe("T, 9 to 10 November 2026: 2. This overlay's data start on 9 November 2026 and end on 10 November 2026.");
  });

  it('all: a dated window over the cap, so the map gets a filter and does not draw every point', () => {
    const capped = capWindow(all, { first: '2026-09-15', upTo: '2026-10-02' });
    const period = { first: '2026-09-15', last: '2026-10-02' };
    expect(capped).toEqual({ kind: 'dated', wanted: period, used: period, clippedStart: false, clippedEnd: false, rangeKnown: true });
    expect(overlayFilter(capped)).not.toBeNull();
    const bare = capWindow({ kind: 'all', range: null }, { first: '2026-09-15', upTo: '2026-10-02' });
    expect(bare).toMatchObject({ kind: 'dated', used: period, rangeKnown: false });
    expect(overlayCaption('T', bare, 0)).toBe('T, 15 September to 2 October 2026: 0. The file does not say which dates it covers.');
  });

  it('a cap that ends before the period starts: an empty period, and the filter agrees', () => {
    const capped = capWindow(closed, { first: '2026-10-01', upTo: '2026-09-30' });
    const points = [point('2026-09-30', 0), point('2026-10-01', 1)];
    expect(pointsInWindow(points, capped)).toHaveLength(0);
    expect(filterCount(points, capped)).toBe(0);
  });
});

describe('buildPeriod (the days a build runs through)', () => {
  const undatedAndUnreal = [point(null, 7), point('2026-13-01', 8)];

  it('dated with an end: its used period, whatever the points (days without a point are real days)', () => {
    expect(buildPeriod(dated({ first: '2026-10-01', last: '2026-10-12' }), [])).toEqual({ first: '2026-10-01', last: '2026-10-12' });
    // Clipped by the overlay's date_range: the part used, not the part wanted.
    const w = overlayWindow(overlay({ date_range: ['2026-11-09', '2026-11-10'] }), perDate(['2026-11-08', '2026-11-20']), 0);
    expect(buildPeriod(w, [])).toEqual({ first: '2026-11-09', last: '2026-11-10' });
  });

  it('dated without an end: up to the latest real day of a point on or after its start', () => {
    const open = dated({ first: '2026-10-01', last: null }, { rangeKnown: false });
    const points = [point('2026-09-20', 0), point('2026-10-09', 1), point('2026-10-03', 2), ...undatedAndUnreal];
    expect(buildPeriod(open, points)).toEqual({ first: '2026-10-01', last: '2026-10-09' });
    expect(buildPeriod(open, [point('2026-09-20'), ...undatedAndUnreal])).toBeNull();
  });

  it('all: the overlay\'s date_range; without one, the earliest to the latest real day of a point', () => {
    expect(buildPeriod({ kind: 'all', range: ['2026-09-15', '2026-11-14'] }, [])).toEqual({ first: '2026-09-15', last: '2026-11-14' });
    const points = [point('2026-10-09', 0), point('2026-09-20', 1), ...undatedAndUnreal];
    expect(buildPeriod({ kind: 'all', range: null }, points)).toEqual({ first: '2026-09-20', last: '2026-10-09' });
    expect(buildPeriod({ kind: 'all', range: null }, undatedAndUnreal)).toBeNull();
  });

  it('none, or no real day to build: null', () => {
    expect(buildPeriod({ kind: 'none', wanted: { first: '2026-01-01', last: null }, range: ['2026-09-15', '2026-11-14'] }, [point('2026-10-01')])).toBeNull();
    expect(buildPeriod(dated({ first: '2026-02-30', last: '2026-03-02' }), [])).toBeNull();
  });
});

describe('day by day, the caption counts what the map filter draws (hand-made points)', () => {
  // Gaps between days, two points on one day, an undated point, points either side of the
  // period, and a file property holding the app's key (the map must use the checked day).
  const days = ['2026-09-27', '2026-09-30', '2026-10-01', '2026-10-01', '2026-10-04', null, '2026-10-09', '2026-10-13'];
  const points: OverlayPoint[] = days.map((day, index) => ({ index, lon: index, lat: 0, day, properties: { [DAY_KEY]: '2026-10-02' } }));
  const windows: [string, OverlayWindow][] = [
    ['dated', dated({ first: '2026-09-30', last: '2026-10-10' })],
    ['dated, open-ended', dated({ first: '2026-09-30', last: null }, { rangeKnown: false })],
    ['all, with a range', { kind: 'all', range: ['2026-09-28', '2026-10-12'] }],
    ['all, without a range', { kind: 'all', range: null }],
  ];

  for (const [label, window] of windows)
    it(`${label}: at every tick the counts agree and never fall; empty days change nothing`, () => {
      const { last, emptyDays } = walk(window, points, label);
      expect(emptyDays).toBeGreaterThan(0);
      if (window.kind === 'dated') expect(last, 'the last tick is the uncapped count').toBe(pointsInWindow(points, window).length);
      else {
        const period = buildPeriod(window, points)!;
        expect(last).toBe(points.filter((p) => p.day !== null && p.day >= period.first && p.day <= period.last).length);
      }
    });
});

describe('overlayView with a cap', () => {
  const o = overlay({ date_range: ['2026-09-15', '2026-11-14'] });
  const points = [point('2026-09-16', 0), point('2026-09-20', 1), point('2026-10-02', 2), point('2026-10-03', 3), point(null, 4)];
  const ready = { status: 'ready' as const, loaded: { points, skipped: 1 } };

  it('without a cap: exactly what it gives today', () => {
    const layer = perDate(['2026-09-15', '2026-10-01']);
    for (const [l, i] of [[layer, 0], [layer, 1], [STATIC, 0], [null, 0]] as const) {
      const today = overlayView(o, ready, l, i, '#c000ff');
      expect(overlayView(o, ready, l, i, '#c000ff', null)).toEqual(today);
      expect(overlayView(o, ready, l, i, '#c000ff', undefined)).toEqual(today);
    }
  });

  it('a static layer capped at a day: the caption, the points drawn, the undated count and the window the map filters by are all the capped ones', () => {
    const uncapped = overlayView(o, ready, STATIC, 0, '#c000ff');
    expect(uncapped).toMatchObject({ caption: 'Fire detections, 15 September to 14 November 2026: 5', undated: 0 });
    const view = overlayView(o, ready, STATIC, 0, '#c000ff', { first: '2026-09-15', upTo: '2026-10-02' });
    expect(view.window).toEqual(capWindow(uncapped.window, { first: '2026-09-15', upTo: '2026-10-02' }));
    expect(view.caption).toBe('Fire detections, 15 September to 2 October 2026: 3');
    expect(view.drawn.map((p) => p.index)).toEqual([0, 1, 2]);
    expect(filterCount(points, view.window)).toBe(3);
    expect(view.undated).toBe(undatedLeftOut(points, view.window));
    expect(view.undated).toBe(1);
  });

  it('while loading, the window is capped too', () => {
    const view = overlayView(o, { status: 'loading' }, STATIC, 0, '#c000ff', { first: '2026-09-15', upTo: '2026-09-20' });
    expect(view.window).toMatchObject({ kind: 'dated', used: { first: '2026-09-15', last: '2026-09-20' } });
    expect(view.drawn).toEqual([]);
  });
});

describe('day by day on the published fire detections of Tarn Taran', () => {
  const data = (file: string) => JSON.parse(readFileSync(new URL(`../../public/data/${file}`, import.meta.url), 'utf8'));
  const site = (data('manifest.json').sites as { id: string; layers: Layer[]; overlays: Overlay[] }[]).find((s) => s.id === 'tarn-taran')!;
  const fires = site.overlays.find((o) => o.id === 'fires')!;
  const geojson = data('tarn-taran/fires.geojson') as { features: { properties: Record<string, unknown> }[] };
  const points = readOverlay(geojson, fires.date_property).points;
  const layerOf = (id: string) => site.layers.find((l) => l.id === id)!;

  it('the harvest map (a static layer): every tick agrees, and the last one draws every point', () => {
    const window = overlayWindow(fires, layerOf('harvest-wave'), 0);
    expect(window.kind).toBe('all');
    const { last } = walk(window, points, 'harvest-wave');
    expect(last).toBe(pointsInWindow(points, window).length);
    expect(last).toBe(fires.count);
  });

  it('the harvest map capped at 2 October: the caption names the period and counts the detections of those days', () => {
    const window = capWindow(overlayWindow(fires, layerOf('harvest-wave'), 0), { first: '2026-09-15', upTo: '2026-10-02' });
    const count = pointsInWindow(points, window).length;
    // Counted straight from the file's own dates, not through the app's code.
    const inFile = geojson.features.filter((f) => {
      const day = f.properties[fires.date_property!];
      return typeof day === 'string' && day >= '2026-09-15' && day <= '2026-10-02';
    }).length;
    expect(count).toBe(inFile);
    expect(filterCount(points, window)).toBe(count);
    expect(overlayCaption(fires.title, window, count)).toBe(`${fires.title}, 15 September to 2 October 2026: ${inFile}`);
  });

  it('every date of the HH layer: every tick agrees, and the last one is the date\'s own count', () => {
    const hh = layerOf('hh');
    let built = 0;
    hh.items.forEach((item, i) => {
      const window = overlayWindow(fires, hh, i);
      if (window.kind !== 'dated') return expect(window.kind, item.date ?? '').toBe('none');
      built += 1;
      expect(walk(window, points, `hh ${item.date}`).last).toBe(pointsInWindow(points, window).length);
    });
    expect(built).toBeGreaterThan(0);
  });
});
