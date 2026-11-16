// The year as a curve above the timeline (state/timelineCurve.ts). Honesty test 3 of
// docs/MOTION_AND_STORY_BRIEF.md: no segment across a missing pass, a date the layer lacks or a
// null value; checked on hand-made timelines and on the published series of Tarn Taran.

import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Layer, Site } from '../../src/contract/manifest';
import type { Stats, StatsSeries } from '../../src/contract/stats';
import { buildTimeline, dayNumber, type TimelineEntry } from '../../src/state/timeline';
import {
  curveSeries,
  drawnItemOf,
  MAX_MONTH_LABELS,
  MONTH_NAMES,
  monthTicks,
  revealedCurve,
  revealedItems,
  timelineCurve,
  type DrawnPicture,
  type TimelineCurve,
} from '../../src/state/timelineCurve';
import { buildManifest, buildStats, buildYearStats, SITE_ID, YEAR_LAYERS, YEAR_SERIES, YEAR_SITE_ID } from '../fixtures/synthetic.mjs';

type SiteDates = Parameters<typeof buildTimeline>[0];
const siteOf = (dates: string[], missing: string[] = []) =>
  ({ dates: dates.map((date) => ({ date })), missing_passes: missing.map((date) => ({ date, reason: 'no product' })) }) as unknown as SiteDates;
const layerOf = (dates: string[]) => ({ items: dates.map((date) => ({ url: `${date}.tif`, date })) });

// Six 12-day slots: 2026-06-19 (item 0), 2026-07-01 (item 1), 2026-07-13 missing,
// 2026-07-25 (item 2), 2026-08-06 not in this layer, 2026-08-18 (item 3).
const site = siteOf(['2026-06-19', '2026-07-01', '2026-07-25', '2026-08-06', '2026-08-18'], ['2026-07-13']);
const layer = layerOf(['2026-06-19', '2026-07-01', '2026-07-25', '2026-08-18']);
const entries = buildTimeline(site, layer);
const series = (values: (number | null)[]) => layer.items.map((item, i) => ({ date: item.date, value: values[i] ?? null }));

const dates = (curve: TimelineCurve) => curve.segments.map(([a, b]) => [a.date, b.date]);
/** Whether a segment has one end before `date` and the other after it. */
const spans = (curve: TimelineCurve, date: string) => curve.segments.some(([a, b]) => (a.date < date && b.date > date) || (b.date < date && a.date > date));

describe('timelineCurve', () => {
  it('a point per available pass with a value, at the entry\'s position; a segment only between neighbours', () => {
    expect(entries.map((e) => e.status)).toEqual(['available', 'available', 'missing', 'available', 'not-in-layer', 'available']);
    const curve = timelineCurve(entries, series([-10, -9, -8, -7]))!;
    expect(curve.points.map((p) => [p.date, p.itemIndex, p.value])).toEqual([
      ['2026-06-19', 0, -10],
      ['2026-07-01', 1, -9],
      ['2026-07-25', 2, -8],
      ['2026-08-18', 3, -7],
    ]);
    for (const p of curve.points) expect(p.x).toBe(entries.find((e) => e.date === p.date)!.position);
    expect(dates(curve)).toEqual([['2026-06-19', '2026-07-01']]);
  });

  it('a missing pass between two available passes: no segment across it', () => {
    const curve = timelineCurve(entries, series([-10, -9, -8, -7]))!;
    expect(spans(curve, '2026-07-13')).toBe(false);
  });

  it('a date this layer has no file for, between two points: the line breaks there', () => {
    const curve = timelineCurve(entries, series([-10, -9, -8, -7]))!;
    expect(spans(curve, '2026-08-06')).toBe(false);
    // The same layer with a file for that date joins it on both sides.
    const full = { items: [...layer.items, { url: 'x.tif', date: '2026-08-06' }] };
    const joined = timelineCurve(buildTimeline(site, full), [...series([-10, -9, -8, -7]), { date: '2026-08-06', value: -7.5 }])!;
    expect(dates(joined)).toEqual([
      ['2026-06-19', '2026-07-01'],
      ['2026-07-25', '2026-08-06'],
      ['2026-08-06', '2026-08-18'],
    ]);
  });

  it('a null value: no point, and the line breaks on both sides of it', () => {
    const days = ['2026-01-01', '2026-01-13', '2026-01-25', '2026-02-06'];
    const regular = buildTimeline(siteOf(days), layerOf(days));
    const values = [-10, null, -8, -7];
    const curve = timelineCurve(regular, days.map((date, i) => ({ date, value: values[i] ?? null })))!;
    expect(curve.points.map((p) => p.date)).toEqual(['2026-01-01', '2026-01-25', '2026-02-06']);
    expect(dates(curve)).toEqual([['2026-01-25', '2026-02-06']]);
    expect(spans(curve, '2026-01-13')).toBe(false);
    // A value that is not a finite number is no value either; a date the series lacks has none.
    const odd = timelineCurve(regular, [
      { date: '2026-01-01', value: -10 },
      { date: '2026-01-13', value: Number.NaN },
      { date: '2026-01-25', value: Number.POSITIVE_INFINITY },
      { date: '2026-02-06', value: -7 },
    ])!;
    expect(odd.points.map((p) => p.date)).toEqual(['2026-01-01', '2026-02-06']);
    expect(odd.segments).toEqual([]);
  });

  it('y runs from 0 at the lowest value to 1 at the highest; min and max are those values', () => {
    const curve = timelineCurve(entries, series([-12, -9, -6, -8]))!;
    expect([curve.min, curve.max]).toEqual([-12, -6]);
    expect(curve.points.map((p) => p.y)).toEqual([0, 0.5, 1, 4 / 6]);
  });

  it('every value the same: y is 0.5 for all', () => {
    const curve = timelineCurve(entries, series([-9, -9, -9, -9]))!;
    expect(curve.points.map((p) => p.y)).toEqual([0.5, 0.5, 0.5, 0.5]);
    expect([curve.min, curve.max]).toEqual([-9, -9]);
  });

  it('fewer than two points with a value: null', () => {
    expect(timelineCurve(entries, series([null, null, null, null]))).toBeNull();
    expect(timelineCurve(entries, series([-9, null, null, null]))).toBeNull();
    expect(timelineCurve(entries, [])).toBeNull();
    expect(timelineCurve([], series([-10, -9, -8, -7]))).toBeNull();
  });

  it('only available entries get a point, even when the series has a value for another date', () => {
    const curve = timelineCurve(entries, [...series([-10, -9, -8, -7]), { date: '2026-07-13', value: -1 }, { date: '2026-08-06', value: -2 }])!;
    expect(curve.points.map((p) => p.date)).not.toContain('2026-07-13');
    expect(curve.points.map((p) => p.date)).not.toContain('2026-08-06');
    expect(curve.max).toBe(-7);
  });
});

describe('revealedCurve', () => {
  const days = ['2026-01-01', '2026-01-13', '2026-01-25', '2026-02-06', '2026-02-18'];
  const curve = timelineCurve(
    buildTimeline(siteOf(days), layerOf(days)),
    days.map((date, i) => ({ date, value: [-10, -9, -11, -8, -12][i] ?? null })),
  )!;
  const sameAsIn = (part: TimelineCurve) => {
    for (const p of part.points) expect(curve.points).toContain(p); // the same objects: no coordinate changed
    for (const s of part.segments) expect(curve.segments).toContain(s);
    expect([part.min, part.max]).toEqual([curve.min, curve.max]);
  };

  it('whole points and whole segments only, both ends of a segment shown', () => {
    const part = revealedCurve(curve, new Set([0, 1, 3]));
    expect(part.points.map((p) => p.itemIndex)).toEqual([0, 1, 3]);
    expect(part.segments.map(([a, b]) => [a.itemIndex, b.itemIndex])).toEqual([[0, 1]]);
    sameAsIn(part);
  });

  it('never adds a point or a segment the full curve lacks, and never moves one, as passes appear one by one', () => {
    const shown = new Set<number>();
    expect(revealedCurve(curve, shown)).toEqual({ points: [], segments: [], min: curve.min, max: curve.max });
    let before = 0;
    for (const p of curve.points) {
      shown.add(p.itemIndex);
      const part = revealedCurve(curve, shown);
      sameAsIn(part);
      expect(part.points.length + part.segments.length).toBeGreaterThan(before);
      before = part.points.length + part.segments.length;
    }
    expect(revealedCurve(curve, shown)).toEqual(curve);
    // Items that have no point (or do not exist) add nothing.
    expect(revealedCurve(curve, new Set([42, -1]))).toEqual({ points: [], segments: [], min: curve.min, max: curve.max });
  });

  it('a missing pass stays a break however many passes are shown', () => {
    const gap = timelineCurve(entries, series([-10, -9, -8, -7]))!;
    const all = revealedCurve(gap, new Set([0, 1, 2, 3]));
    expect(spans(all, '2026-07-13')).toBe(false);
    expect(all.segments).toHaveLength(gap.segments.length);
  });
});

describe('the curve of the published Tarn Taran series', () => {
  const data = (file: string) => JSON.parse(readFileSync(new URL(`../../public/data/${file}`, import.meta.url), 'utf8'));
  const site = (data('manifest.json').sites as Site[]).find((s) => s.id === 'tarn-taran')!;
  const stats = data('tarn-taran/stats.json') as Stats;

  for (const [layerId, seriesId] of [
    ['hh', 'hh-mean'],
    ['hv', 'hv-mean'],
  ] as const) {
    it(`${layerId}: 24 points, and no segment spans any of the six missing passes`, () => {
      const layer = site.layers.find((l: Layer) => l.id === layerId)!;
      const timeline: TimelineEntry[] = buildTimeline(site, layer);
      const s = stats.series.find((x) => x.id === seriesId)!;
      expect(s.layer).toBe(layerId);
      const curve = timelineCurve(timeline, s.points)!;
      expect(curve.points).toHaveLength(24);
      expect(site.missing_passes).toHaveLength(6);
      for (const { date } of site.missing_passes) expect(spans(curve, date), date).toBe(false);
      // Every segment joins two passes one 12-day repeat cycle apart, and its ends are timeline neighbours.
      for (const [a, b] of curve.segments) {
        expect(dayNumber(b.date) - dayNumber(a.date), `${a.date} to ${b.date}`).toBe(12);
        expect(timeline.findIndex((e) => e.date === b.date) - timeline.findIndex((e) => e.date === a.date)).toBe(1);
      }
      for (const p of curve.points) expect(p.x).toBe(timeline.find((e) => e.date === p.date)!.position);
      const values = s.points.flatMap((p) => (p.value === null ? [] : [p.value]));
      expect([curve.min, curve.max]).toEqual([Math.min(...values), Math.max(...values)]);
    });
  }
});

// --- Which series, which passes, which months (slice 5) -------------------------------------------------

const seriesOf = (id: string, layer: string | undefined, unit: string): StatsSeries => ({
  id,
  title: id,
  unit,
  ...(layer === undefined ? {} : { layer }),
  region: 'r',
  method: 'm',
  points: [],
});

describe('curveSeries', () => {
  const stats = {
    series: [seriesOf('hh-share', 'hh', '%'), seriesOf('hv-mean', 'hv', 'dB'), seriesOf('no-layer', undefined, 'dB'), seriesOf('hh-mean', 'hh', 'dB'), seriesOf('hh-other', 'hh', 'dB')],
  };
  const perDate = (id: string) => ({ id, kind: 'per-date' as const });

  it('the first series of the layer whose unit is dB; another unit, another layer or none is never drawn', () => {
    expect(curveSeries(stats, perDate('hh'))?.id).toBe('hh-mean');
    expect(curveSeries(stats, perDate('hv'))?.id).toBe('hv-mean');
    expect(curveSeries(stats, perDate('vv'))).toBeNull();
    expect(curveSeries({ series: [seriesOf('hh-share', 'hh', '%')] }, perDate('hh'))).toBeNull();
  });

  it('none for a layer that is not per-date, without a layer, or before the statistics are loaded', () => {
    expect(curveSeries(stats, { id: 'hh', kind: 'static' })).toBeNull();
    expect(curveSeries(stats, { id: 'hh', kind: 'pair' })).toBeNull();
    expect(curveSeries(stats, null)).toBeNull();
    expect(curveSeries(null, perDate('hh'))).toBeNull();
    expect(curveSeries(undefined, perDate('hh'))).toBeNull();
  });

  it('on the fixtures: the dB series of the co-pol layers, never the share in %, and none for a layer without one', () => {
    const year = buildYearStats() as unknown as Stats;
    expect(curveSeries(year, perDate(YEAR_LAYERS.hh))?.id).toBe(YEAR_SERIES.meanHh);
    expect(curveSeries(year, perDate(YEAR_LAYERS.hv))).toBeNull();
    expect(curveSeries(buildStats() as unknown as Stats, perDate('hh'))?.id).toBe('mean-hh');
  });
});

describe('drawnItemOf and revealedItems', () => {
  // Items listed out of date order on purpose: the reveal goes by date, never by place in the list.
  const layer = { id: 'hh', items: ['2026-01-25', '2026-01-01', '2026-02-18', '2026-01-13', '2026-02-06'].map((date) => ({ url: `${date}.tif`, date })) };
  const picture = (index: number, over: Partial<DrawnPicture> = {}): DrawnPicture => ({ layer, index, failed: false, ...over });

  it('every item dated on or before the picture drawn, and none later', () => {
    expect([...revealedItems(layer, picture(0))].sort()).toEqual([0, 1, 3]); // up to 2026-01-25
    expect([...revealedItems(layer, picture(1))]).toEqual([1]); // the first date alone
    expect([...revealedItems(layer, picture(2))].sort()).toEqual([0, 1, 2, 3, 4]); // the last: all
    for (let k = 0; k < layer.items.length; k++) {
      const until = layer.items[k]!.date;
      const shown = revealedItems(layer, picture(k));
      for (const i of shown) expect(layer.items[i]!.date <= until).toBe(true);
      for (let i = 0; i < layer.items.length; i++) if (layer.items[i]!.date <= until) expect(shown.has(i)).toBe(true);
    }
  });

  it('none while no picture is drawn, when the picture failed, or when it is of another layer', () => {
    expect(revealedItems(layer, null).size).toBe(0);
    expect(revealedItems(layer, picture(2, { failed: true })).size).toBe(0);
    expect(revealedItems(layer, picture(2, { layer: { ...layer, id: 'hv' } })).size).toBe(0);
    // An item index the layer lacks, or an item without a date (a static or pair layer's), reveals nothing.
    expect(revealedItems(layer, picture(9)).size).toBe(0);
    expect(revealedItems(layer, picture(0, { layer: { id: 'hh', items: [{ url: 'x.tif' }] } })).size).toBe(0);
  });

  it('the item drawn: the picture of this layer that did not fail, else none', () => {
    expect(drawnItemOf(layer, picture(3))).toBe(3);
    expect(drawnItemOf(layer, null)).toBeNull();
    expect(drawnItemOf(layer, picture(3, { failed: true }))).toBeNull();
    expect(drawnItemOf(layer, picture(3, { layer: { ...layer, id: 'hv' } }))).toBeNull();
  });

  it('with revealedCurve: the pictures of the year drawn one after another add one whole point each, never a later one', () => {
    const inOrder = [...layer.items].sort((a, b) => (a.date < b.date ? -1 : 1));
    const curve = timelineCurve(
      buildTimeline(siteOf(inOrder.map((i) => i.date)), layer),
      layer.items.map((item, i) => ({ date: item.date, value: -10 + i })),
    )!;
    inOrder.forEach((item, n) => {
      const part = revealedCurve(curve, revealedItems(layer, picture(layer.items.indexOf(item))));
      expect(part.points.map((p) => p.date)).toEqual(inOrder.slice(0, n + 1).map((i) => i.date));
      expect(part.segments).toHaveLength(n); // no gap in these dates: each new pass joins the one before
      expect([part.min, part.max]).toEqual([curve.min, curve.max]);
    });
  });
});

describe('monthTicks', () => {
  const ticksOf = (days: string[]) => monthTicks(days.map((date) => ({ date })));

  it('a year from 21 November to 4 November: every second month named, from December, each in the middle of its month', () => {
    const d0 = dayNumber('2025-11-21');
    const span = dayNumber('2026-11-04') - d0;
    const at = (day: string) => (dayNumber(day) - d0) / span;
    const ticks = ticksOf(['2025-11-21', '2026-02-13', '2026-11-04']);
    expect(ticks.map((t) => t.label)).toEqual(['Dec', 'Feb', 'Apr', 'Jun', 'Aug', 'Oct']);
    expect(ticks.map((t) => t.month)).toEqual(['2025-12', '2026-02', '2026-04', '2026-06', '2026-08', '2026-10']);
    // True places: each named month is wholly on the axis here, from its first day to the next month's first.
    for (const t of ticks) {
      const [y, m] = t.month.split('-').map(Number) as [number, number];
      const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
      expect(t.start).toBeCloseTo(at(`${t.month}-01`), 12);
      expect(t.end).toBeCloseTo(at(next), 12);
      expect(t.x).toBeCloseTo((t.start + t.end) / 2, 12);
    }
  });

  it('every month when they fit; a month the axis covers less than two thirds of is not named', () => {
    expect(ticksOf(['2026-07-01', '2026-07-13', '2026-08-06']).map((t) => t.label)).toEqual(['Jul']);
    expect(ticksOf(['2026-01-01', '2026-04-30']).map((t) => t.label)).toEqual(['Jan', 'Feb', 'Mar', 'Apr']);
    // 10 of the 30 days of November and 3 of the 31 of March: neither is named.
    expect(ticksOf(['2025-11-21', '2026-03-04']).map((t) => t.month)).toEqual(['2025-12', '2026-01', '2026-02']);
    expect(ticksOf(['2026-01-15', '2026-02-28']).map((t) => t.label)).toEqual(['Feb']); // 17 of January's 31 days
    expect(ticksOf(['2026-01-11', '2026-02-28']).map((t) => t.label)).toEqual(['Jan', 'Feb']); // 21 of 31
  });

  it('never more than MAX_MONTH_LABELS names, on any span; each from the fixed list, for its own month, left to right', () => {
    for (const [first, last] of [
      ['2026-01-01', '2026-12-31'],
      ['2024-03-05', '2026-11-04'],
      ['2016-01-01', '2026-01-01'],
    ] as const) {
      const ticks = ticksOf([first, last]);
      expect(ticks.length).toBeGreaterThan(0);
      expect(ticks.length).toBeLessThanOrEqual(MAX_MONTH_LABELS);
      for (const t of ticks) expect(t.label).toBe(MONTH_NAMES[Number(t.month.slice(5)) - 1]);
      for (let i = 1; i < ticks.length; i++) expect(ticks[i]!.x).toBeGreaterThan(ticks[i - 1]!.x);
    }
  });

  it('nothing without dates; one date: its month, in the middle', () => {
    expect(monthTicks([])).toEqual([]);
    expect(ticksOf(['2026-05-17'])).toMatchObject([{ month: '2026-05', label: 'May', x: 0.5 }]);
  });

  describe('without a locale', () => {
    afterEach(() => vi.restoreAllMocks());

    it('writes the names from its own list: Intl and toLocale* are never called', () => {
      const thrower = () => {
        throw new Error('a locale was used');
      };
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(thrower as never);
      vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(thrower);
      vi.spyOn(Date.prototype, 'toLocaleString').mockImplementation(thrower);
      expect(ticksOf(['2025-11-21', '2026-11-04']).map((t) => t.label)).toEqual(['Dec', 'Feb', 'Apr', 'Jun', 'Aug', 'Oct']);
    });

    it('and the source of the curve has no locale in it', () => {
      for (const file of ['../../src/state/timelineCurve.ts', '../../src/components/YearCurve.tsx', '../../src/story/StoryCurve.tsx']) {
        expect(readFileSync(new URL(file, import.meta.url), 'utf8'), file).not.toMatch(/toLocale|Intl\./);
      }
    });
  });
});

describe('the fixtures the browser tests use', () => {
  const manifest = buildManifest() as unknown as { sites: Site[] };

  it('the year site: its dB series breaks at the three gaps of missing passes, nowhere else', () => {
    const site = manifest.sites.find((s) => s.id === YEAR_SITE_ID)!;
    const layer = site.layers.find((l) => l.id === YEAR_LAYERS.hh)!;
    const series = curveSeries(buildYearStats() as unknown as Stats, layer)!;
    const curve = timelineCurve(buildTimeline(site, layer), series.points)!;
    expect(curve.points).toHaveLength(layer.items.length);
    // 30 slots with slots 7, 11, 12 and 21 missing: runs of 7, 3, 8 and 8 passes, so 6 + 2 + 7 + 7 segments.
    expect(curve.segments).toHaveLength(22);
    for (const { date } of site.missing_passes) expect(spans(curve, date)).toBe(false);
  });

  it('the first site: one segment, none to the null value at its last date nor across its missing pass', () => {
    const site = manifest.sites.find((s) => s.id === SITE_ID)!;
    const layer = site.layers.find((l) => l.id === 'hh')!;
    const series = curveSeries(buildStats() as unknown as Stats, layer)!;
    expect(series.points.at(-1)?.value).toBeNull();
    const curve = timelineCurve(buildTimeline(site, layer), series.points)!;
    expect(curve.points.map((p) => p.date)).toEqual(layer.items.slice(0, -1).map((i) => i.date));
    expect(dates(curve)).toEqual([[layer.items[0]!.date, layer.items[1]!.date]]);
  });
});
