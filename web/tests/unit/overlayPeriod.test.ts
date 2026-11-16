// Which points of an overlay go with what is on screen, and what the caption says (state/overlayPeriod.ts).
// Every case of the rules, with the SYNTHETIC fixture's dates and with hand-made layers.

import { describe, expect, it } from 'vitest';
import type { Layer, Overlay } from '../../src/contract/manifest';
import type { OverlayPoint } from '../../src/contract/overlay';
import {
  addDays,
  formatDay,
  formatPeriod,
  isDay,
  overlayCaption,
  overlayWindow,
  pointInWindow,
  pointsInWindow,
  undatedLeftOut,
  wantedPeriod,
  type OverlayWindow,
} from '../../src/state/overlayPeriod';
import {
  EMPTY_PERIOD,
  HV_ABSENT_DATE,
  OVERLAY_DATE_PROPERTY,
  OVERLAY_DATE_RANGE,
  OVERLAY_ID,
  PASS_SLOTS,
  POINT_DAY_BEFORE_PASS,
  POINT_ON_PASS_DATE,
  YEAR_DATES,
  YEAR_HV_DATES,
  YEAR_LAYERS,
  YEAR_SITE_ID,
  buildManifest,
  overlayPoints,
  pointsDated,
} from '../fixtures/synthetic.mjs';
import { readOverlay } from '../../src/contract/overlay';

const site = buildManifest().sites.find((s: { id: string }) => s.id === YEAR_SITE_ID)! as unknown as {
  layers: Layer[];
  overlays: Overlay[];
};
const layerOf = (id: string) => site.layers.find((l) => l.id === id)!;
const HH = layerOf(YEAR_LAYERS.hh);
const HV = layerOf(YEAR_LAYERS.hv);
const CLASSES = layerOf(YEAR_LAYERS.classes);
const OVERLAY = site.overlays.find((o) => o.id === OVERLAY_ID)!;
const POINTS = readOverlay({ type: 'FeatureCollection', features: overlayPoints().features }, OVERLAY_DATE_PROPERTY).points;
const [RANGE_START, RANGE_END] = OVERLAY_DATE_RANGE as [string, string];
const ABSENT = HV_ABSENT_DATE!;
const ON_PASS = POINT_ON_PASS_DATE!;

const perDate = (dates: string[]): Layer =>
  ({ id: 'l', title: 'L', kind: 'per-date', unit: '', description: '', encoding: { type: 'linear-uint8', nodata: 0, lo: 0, hi: 1 }, items: dates.map((date) => ({ date, url: `${date}.tif` })) }) as unknown as Layer;
const overlay = (extra: Partial<Overlay> = {}): Overlay =>
  ({ id: 'o', title: 'Fire detections', kind: 'points', url: 'o.geojson', description: 'd', credit: 'c', date_property: 'day', ...extra }) as Overlay;
const point = (day: string | null, index = 0): OverlayPoint => ({ index, lon: 0, lat: 0, day, properties: {} });

describe('days', () => {
  it('isDay accepts real calendar days written YYYY-MM-DD and nothing else', () => {
    for (const d of ['2026-11-04', '2024-02-29', '2025-12-31']) expect(isDay(d), d).toBe(true);
    for (const d of ['2026-9-5', '2026-02-30', '2025-02-29', '2026-13-01', '2026-11-04T00:00:00Z', ' 2026-11-04', '', 20261104, null, undefined])
      expect(isDay(d), String(d)).toBe(false);
  });

  it('addDays crosses months, years and leap days in UTC', () => {
    expect(addDays('2026-11-08', -1)).toBe('2026-11-07');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('formatPeriod (the same words on every machine, no locale)', () => {
  it('writes a day, a period in one month, across months and across years', () => {
    expect(formatDay('2026-11-04')).toBe('4 November 2026');
    expect(formatPeriod({ first: '2026-11-04', last: '2026-11-04' })).toBe('4 November 2026');
    expect(formatPeriod({ first: '2026-11-04', last: '2026-11-14' })).toBe('4 to 14 November 2026');
    expect(formatPeriod({ first: '2026-10-28', last: '2026-11-08' })).toBe('28 October to 8 November 2026');
    expect(formatPeriod({ first: '2025-12-28', last: '2026-01-08' })).toBe('28 December 2025 to 8 January 2026');
    expect(formatPeriod({ first: '2026-11-08', last: null })).toBe('from 8 November 2026');
  });

  it('does not use toLocaleDateString', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('../../src/state/overlayPeriod.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/toLocale|Intl\./);
  });
});

describe('wantedPeriod', () => {
  it('per-date: from the date to the day before the next date the layer has; the last date has no end', () => {
    const layer = perDate(['2026-10-27', '2026-11-08', '2026-11-20']);
    expect(wantedPeriod(layer, 0)).toEqual({ first: '2026-10-27', last: '2026-11-07' });
    expect(wantedPeriod(layer, 1)).toEqual({ first: '2026-11-08', last: '2026-11-19' });
    expect(wantedPeriod(layer, 2)).toEqual({ first: '2026-11-20', last: null });
  });

  it('per-date: follows the dates of THIS layer, across missing passes and dates it lacks', () => {
    // syn-hv lacks HV_ABSENT_DATE: its period before it runs to the day before its next date.
    const before = YEAR_HV_DATES.filter((d) => d < ABSENT).at(-1)!;
    const after = YEAR_HV_DATES.find((d) => d > ABSENT)!;
    expect(wantedPeriod(HV, YEAR_HV_DATES.indexOf(before))).toEqual({ first: before, last: addDays(after, -1) });
    // syn-hh has the date, so its period stops before it.
    expect(wantedPeriod(HH, YEAR_DATES.indexOf(before))).toEqual({ first: before, last: addDays(ABSENT, -1) });
  });

  it('per-date: does not depend on the order the items are listed in', () => {
    const layer = perDate(['2026-11-20', '2026-10-27', '2026-11-08']);
    expect(wantedPeriod(layer, 1)).toEqual({ first: '2026-10-27', last: '2026-11-07' });
  });

  it('pair: from the reference date to the day before the secondary date', () => {
    const pair = { ...perDate([]), kind: 'pair', items: [{ reference: '2026-10-27', secondary: '2026-11-08', url: 'p.tif' }] } as unknown as Layer;
    expect(wantedPeriod(pair, 0)).toEqual({ first: '2026-10-27', last: '2026-11-07' });
  });

  it('static layer, no layer or no item: no period', () => {
    expect(wantedPeriod(CLASSES, 0)).toBeNull();
    expect(wantedPeriod(null, 0)).toBeNull();
    expect(wantedPeriod(HH, 99)).toBeNull();
    expect(wantedPeriod(HH, -1)).toBeNull();
  });
});

/** The fixture's caption and drawn points for a date of a layer. */
function onDate(layer: Layer, dates: string[], date: string) {
  const window = overlayWindow(OVERLAY, layer, dates.indexOf(date));
  const drawn = pointsInWindow(POINTS, window);
  return { window, drawn, caption: overlayCaption(OVERLAY.title, window, drawn.length) };
}

describe('the fixture overlay on the fixture layers', () => {
  it('a date inside the range: its period and the number of points dated in it', () => {
    const date = PASS_SLOTS[25]!;
    const last = addDays(PASS_SLOTS[26]!, -1);
    const { window, drawn, caption } = onDate(HH, YEAR_DATES, date);
    expect(window).toMatchObject({ kind: 'dated', used: { first: date, last }, clippedStart: false, clippedEnd: false });
    expect(drawn.length).toBe(pointsDated(date, last));
    expect(drawn.length).toBeGreaterThan(0);
    expect(caption).toBe(`${OVERLAY.title}, ${formatPeriod({ first: date, last })}: ${pointsDated(date, last)}`);
  });

  it('the empty period inside the range is a true zero', () => {
    const { window, drawn, caption } = onDate(HH, YEAR_DATES, EMPTY_PERIOD[0]!);
    expect(window).toMatchObject({ kind: 'dated', used: { first: EMPTY_PERIOD[0], last: EMPTY_PERIOD[1] } });
    expect(drawn).toHaveLength(0);
    expect(caption).toMatch(/: 0$/);
  });

  it('a point dated on a pass day belongs to that pass; one dated the day before belongs to the previous pass', () => {
    const on = onDate(HH, YEAR_DATES, ON_PASS);
    expect(on.drawn.some((p) => p.day === ON_PASS)).toBe(true);
    const before = YEAR_DATES.filter((d) => d < ON_PASS).at(-1)!;
    expect(onDate(HH, YEAR_DATES, before).drawn.some((p) => p.day === ON_PASS)).toBe(false);
    const passAfter = addDays(POINT_DAY_BEFORE_PASS, 1);
    const previous = YEAR_DATES.filter((d) => d < passAfter).at(-1)!;
    expect(onDate(HH, YEAR_DATES, previous).drawn.some((p) => p.day === POINT_DAY_BEFORE_PASS)).toBe(true);
    expect(onDate(HH, YEAR_DATES, passAfter).drawn.some((p) => p.day === POINT_DAY_BEFORE_PASS)).toBe(false);
  });

  it('a date whose period lies wholly before the range: no data, and no number', () => {
    const date = YEAR_DATES.filter((_, i) => i + 1 < YEAR_DATES.length && addDays(YEAR_DATES[i + 1]!, -1) < RANGE_START).at(-1)!;
    const next = YEAR_DATES[YEAR_DATES.indexOf(date) + 1]!;
    const { window, drawn, caption } = onDate(HH, YEAR_DATES, date);
    expect(window.kind).toBe('none');
    expect(drawn).toHaveLength(0);
    expect(caption).toBe(
      `${OVERLAY.title}: no data for ${formatPeriod({ first: date, last: addDays(next, -1) })} (this overlay covers ${formatPeriod({ first: RANGE_START, last: RANGE_END })})`,
    );
    expect(caption).not.toMatch(/: \d+$/);
  });

  it('the date whose period straddles the start of the range: clipped, with the reason', () => {
    const date = YEAR_DATES.filter((d) => d < RANGE_START).at(-1)!;
    const next = YEAR_DATES[YEAR_DATES.indexOf(date) + 1]!;
    const { window, drawn, caption } = onDate(HH, YEAR_DATES, date);
    expect(window).toMatchObject({ kind: 'dated', used: { first: RANGE_START, last: addDays(next, -1) }, clippedStart: true, clippedEnd: false });
    expect(drawn.length).toBe(pointsDated(RANGE_START, addDays(next, -1)));
    expect(caption).toBe(
      `${OVERLAY.title}, ${formatPeriod({ first: RANGE_START, last: addDays(next, -1) })}: ${drawn.length}. This overlay's data start on ${formatDay(RANGE_START)}.`,
    );
  });

  it('the last date: to the end of date_range, with no reason given', () => {
    const date = YEAR_DATES.at(-1)!;
    const { window, drawn, caption } = onDate(HH, YEAR_DATES, date);
    expect(window).toMatchObject({ kind: 'dated', used: { first: date, last: RANGE_END }, clippedStart: false, clippedEnd: false });
    expect(drawn.length).toBe(pointsDated(date, RANGE_END));
    expect(caption).toBe(`${OVERLAY.title}, ${formatPeriod({ first: date, last: RANGE_END })}: ${drawn.length}`);
  });

  it('the static layer: every point, and the period named is the whole range', () => {
    const window = overlayWindow(OVERLAY, CLASSES, 0);
    expect(window).toEqual({ kind: 'all', range: [RANGE_START, RANGE_END] });
    expect(pointsInWindow(POINTS, window)).toHaveLength(POINTS.length);
    expect(overlayCaption(OVERLAY.title, window, POINTS.length)).toBe(`${OVERLAY.title}, ${formatPeriod({ first: RANGE_START, last: RANGE_END })}: ${POINTS.length}`);
  });

  it('the other per-date layer, which lacks one date: every caption count equals the points of ITS periods', () => {
    YEAR_HV_DATES.forEach((date, i) => {
      const window = overlayWindow(OVERLAY, HV, i);
      const drawn = pointsInWindow(POINTS, window);
      const end = i + 1 < YEAR_HV_DATES.length ? addDays(YEAR_HV_DATES[i + 1]!, -1) : RANGE_END;
      if (end < RANGE_START) return expect(window.kind, date).toBe('none');
      const first = date < RANGE_START ? RANGE_START : date;
      expect(drawn.length, date).toBe(pointsDated(first, end));
    });
  });
});

describe('overlayWindow with hand-made cases', () => {
  const layer = perDate(['2026-08-28', '2026-09-09', '2026-09-21', '2026-11-08', '2026-11-20']);
  const o = overlay({ date_range: ['2026-09-15', '2026-11-10'] });

  it('wholly after the range: no data', () => {
    expect(overlayWindow(o, layer, 4)).toEqual({ kind: 'none', wanted: { first: '2026-11-20', last: null }, range: ['2026-09-15', '2026-11-10'] });
    expect(overlayCaption('T', overlayWindow(o, layer, 4), 0)).toBe('T: no data from 20 November 2026 (this overlay covers 15 September to 10 November 2026)');
  });

  it('partly after the range: clipped at the end, with the reason', () => {
    const w = overlayWindow(o, layer, 3);
    expect(w).toMatchObject({ kind: 'dated', used: { first: '2026-11-08', last: '2026-11-10' }, clippedEnd: true, clippedStart: false });
    expect(overlayCaption('T', w, 5)).toBe("T, 8 to 10 November 2026: 5. This overlay's data end on 10 November 2026.");
  });

  it('a period longer than the range at both ends: clipped at both, with both reasons', () => {
    const short = overlay({ date_range: ['2026-09-25', '2026-09-30'] });
    const w = overlayWindow(short, layer, 2);
    expect(w).toMatchObject({ kind: 'dated', used: { first: '2026-09-25', last: '2026-09-30' }, clippedStart: true, clippedEnd: true });
    expect(overlayCaption('T', w, 2)).toBe("T, 25 to 30 September 2026: 2. This overlay's data start on 25 September 2026 and end on 30 September 2026.");
  });

  it('touching the range on one day is inside it, both ends included', () => {
    const edge = overlay({ date_range: ['2026-09-20', '2026-09-21'] });
    expect(overlayWindow(edge, layer, 1)).toMatchObject({ kind: 'dated', used: { first: '2026-09-20', last: '2026-09-20' } });
    expect(overlayWindow(overlay({ date_range: ['2026-09-21', '2026-09-30'] }), layer, 1).kind).toBe('none');
  });

  it('without date_range: the count, and that the file does not say which dates it covers', () => {
    const o2 = overlay();
    const w = overlayWindow(o2, layer, 1);
    expect(w).toMatchObject({ kind: 'dated', rangeKnown: false, used: { first: '2026-09-09', last: '2026-09-20' } });
    expect(overlayCaption('T', w, 0)).toBe('T, 9 to 20 September 2026: 0. The file does not say which dates it covers.');
    // The last date: open-ended.
    const last = overlayWindow(o2, layer, 4);
    expect(last).toMatchObject({ kind: 'dated', used: { first: '2026-11-20', last: null } });
    expect(overlayCaption('T', last, 3)).toBe('T, from 20 November 2026: 3. The file does not say which dates it covers.');
  });

  it('without date_property: every point; with a range the caption names it, without one it says all points', () => {
    const noDates = overlay({ date_property: undefined, date_range: ['2026-09-15', '2026-11-10'] });
    expect(overlayWindow(noDates, layer, 1)).toEqual({ kind: 'all', range: ['2026-09-15', '2026-11-10'] });
    expect(overlayCaption('T', overlayWindow(noDates, layer, 1), 7)).toBe('T, 15 September to 10 November 2026: 7');
    const bare = overlay({ date_property: undefined });
    expect(overlayCaption('T', overlayWindow(bare, layer, 1), 7)).toBe('T, all points: 7');
  });
});

describe('which points are drawn', () => {
  const dated: OverlayWindow = { kind: 'dated', wanted: { first: 'x', last: null }, used: { first: '2026-10-01', last: '2026-10-05' }, clippedStart: false, clippedEnd: false, rangeKnown: true };

  it('both ends of the period are included; days outside are not', () => {
    expect(pointInWindow(point('2026-10-01'), dated)).toBe(true);
    expect(pointInWindow(point('2026-10-05'), dated)).toBe(true);
    expect(pointInWindow(point('2026-09-30'), dated)).toBe(false);
    expect(pointInWindow(point('2026-10-06'), dated)).toBe(false);
  });

  it('a point without a valid day is never drawn in a dated period, and is counted as left out', () => {
    const points = [point('2026-10-02', 0), point(null, 1), point(null, 2)];
    expect(pointsInWindow(points, dated).map((p) => p.index)).toEqual([0]);
    expect(undatedLeftOut(points, dated)).toBe(2);
    // With every point drawn (or none), nothing is left out by its date.
    expect(pointsInWindow(points, { kind: 'all', range: null })).toHaveLength(3);
    expect(undatedLeftOut(points, { kind: 'all', range: null })).toBe(0);
    expect(pointsInWindow(points, { kind: 'none', wanted: { first: 'a', last: 'b' }, range: ['c', 'd'] })).toHaveLength(0);
  });

  it('an open-ended period has no end', () => {
    const open: OverlayWindow = { ...dated, used: { first: '2026-10-01', last: null } };
    expect(pointInWindow(point('2099-01-01'), open)).toBe(true);
    expect(pointInWindow(point('2026-09-30'), open)).toBe(false);
  });
});
