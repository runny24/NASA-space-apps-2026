// The year as a curve, rendered (components/YearCurve.tsx in the date stepper, story/StoryCurve.tsx in
// the story): server-side renders, no browser. Honesty test 3 of docs/MOTION_AND_STORY_BRIEF.md in the
// markup: the segments drawn are exactly the curve's, none joins two passes across a missing pass, a
// date the layer lacks or a null value; and the story's figure never shows a pass later than the
// picture the map has drawn, nor any while that picture is of another layer, failed, or none.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DateStepper } from '../../src/components/Controls';
import { curveValueText } from '../../src/components/YearCurve';
import type { Layer, Site } from '../../src/contract/manifest';
import type { StatsSeries } from '../../src/contract/stats';
import type { PictureOnMap } from '../../src/map/dataLayers';
import { buildTimeline } from '../../src/state/timeline';
import { monthTicks, timelineCurve } from '../../src/state/timelineCurve';
import { StoryCurve } from '../../src/story/StoryCurve';

// Eight 12-day slots: 2026-06-07 (item 0), 06-19 (1), 07-01 missing, 07-13 (2), 07-25 not in this
// layer, 08-06 (3, its value null), 08-18 (4), 08-30 (5).
const SLOTS = ['2026-06-07', '2026-06-19', '2026-07-01', '2026-07-13', '2026-07-25', '2026-08-06', '2026-08-18', '2026-08-30'];
const MISSING = '2026-07-01';
const NOT_IN_LAYER = '2026-07-25';
const NULL_DATE = '2026-08-06';
const site = {
  dates: SLOTS.filter((d) => d !== MISSING).map((date) => ({ date })),
  missing_passes: [{ date: MISSING, reason: 'no product' }],
} as unknown as Pick<Site, 'dates' | 'missing_passes'>;
const layerDates = SLOTS.filter((d) => d !== MISSING && d !== NOT_IN_LAYER);
const layer = { id: 'hh', title: 'HH', kind: 'per-date', items: layerDates.map((date) => ({ url: `hh_${date}.tif`, date })) } as unknown as Layer;
const entries = buildTimeline(site, layer);
const values: Record<string, number | null> = { '2026-06-07': -10, '2026-06-19': -9.5, '2026-07-13': -8, '2026-08-06': null, '2026-08-18': -6.25, '2026-08-30': -7 };
const series: StatsSeries = {
  id: 'hh-mean',
  title: 'Mean HH backscatter',
  unit: 'dB',
  layer: 'hh',
  region: 'r',
  method: 'm',
  // A value for the not-in-layer date too: the curve must still break there (the layer has no picture of it).
  points: [...SLOTS.filter((d) => d !== MISSING).map((date) => ({ date, value: date === NOT_IN_LAYER ? -8.5 : (values[date] ?? null) }))],
};
const curve = timelineCurve(entries, series.points)!;

const stepper = (s?: StatsSeries | null) =>
  renderToStaticMarkup(createElement(DateStepper, { entries, itemIndex: 0, onChange: () => undefined, ...(s === undefined ? {} : { series: s }) }));

/** The [from, to] of every segment drawn, in order. */
const segmentsIn = (html: string) => [...html.matchAll(/<line class="curve-segment"[^>]*data-from="([^"]+)" data-to="([^"]+)"/g)].map((m) => [m[1], m[2]]);
/** The date of every dot drawn, in order. */
const dotsIn = (html: string) => [...html.matchAll(/<circle class="curve-dot[^"]*"[^>]*data-date="([^"]+)"/g)].map((m) => m[1]!);
/** The markup of the timeline's marks. */
const timelineOf = (html: string) => html.slice(html.indexOf('<div class="timeline"'), html.indexOf('</div>', html.indexOf('<div class="timeline"')) + 6);

describe('the curve above the timeline (DateStepper with a series)', () => {
  const html = stepper(series);

  it('is drawn from timelineCurve: a dot per point and exactly its segments, one <line> each', () => {
    expect(dotsIn(html)).toEqual(curve.points.map((p) => p.date));
    expect(segmentsIn(html)).toEqual(curve.segments.map(([a, b]) => [a.date, b.date]));
    expect(segmentsIn(html).length).toBeGreaterThan(0);
    expect(html).not.toMatch(/<polyline|<path[^>]*class="curve/);
  });

  it('never joins two passes across or to a missing pass, a date the layer lacks, or a null value', () => {
    const at = (date: string) => entries.findIndex((e) => e.date === date);
    for (const [from, to] of segmentsIn(html)) {
      expect(at(to!) - at(from!), `${from} to ${to}`).toBe(1); // neighbours on the timeline: nothing between them
      for (const d of [from!, to!]) {
        expect(entries[at(d)]?.status).toBe('available');
        expect(values[d]).toEqual(expect.any(Number));
      }
    }
    const touched = segmentsIn(html).flat();
    for (const gap of [MISSING, NOT_IN_LAYER, NULL_DATE]) expect(touched).not.toContain(gap);
    // Here: 06-07 to 06-19 only; 07-13 stands alone between the missing pass and the date the layer lacks,
    // and 08-18 to 08-30 after the null value.
    expect(segmentsIn(html)).toEqual([
      ['2026-06-07', '2026-06-19'],
      ['2026-08-18', '2026-08-30'],
    ]);
  });

  it('is aria-hidden, above the marks, with the lowest and highest values and the unit at the left edge, and month names under the marks', () => {
    const curveAt = html.indexOf('data-testid="timeline-curve"');
    expect(curveAt).toBeGreaterThan(-1);
    expect(curveAt).toBeLessThan(html.indexOf('<div class="timeline"'));
    expect(html).toMatch(/<div class="curve" aria-hidden="true" data-testid="timeline-curve" data-series="hh-mean" data-layer="hh">/);
    expect(html).toContain(`<p class="curve-label curve-max">${curveValueText(curve.max, 'dB')}</p>`);
    expect(html).toContain(`<p class="curve-label curve-min">${curveValueText(curve.min, 'dB')}</p>`);
    expect([curveValueText(curve.max, 'dB'), curveValueText(curve.min, 'dB')]).toEqual(['-6.3 dB', '-10.0 dB']);
    const months = html.indexOf('<div class="curve-months" aria-hidden="true"');
    expect(months).toBeGreaterThan(html.indexOf('<div class="timeline"'));
    expect(months).toBeLessThan(html.indexOf('<p class="timeline-key"'));
    for (const m of monthTicks(entries)) expect(html).toContain(`<span class="curve-month" style="left:${m.x * 100}%" data-month="${m.month}">${m.label}</span>`);
  });

  it('leaves the marks exactly as they were, and is static: no transition or animation in its markup', () => {
    expect(timelineOf(html)).toBe(timelineOf(stepper()));
    const curveMarkup = html.slice(html.indexOf('<div class="curve"'), html.indexOf('<div class="timeline"'));
    expect(curveMarkup).not.toMatch(/transition|animation|tick/);
    expect(html).not.toMatch(/<animate|<set /);
  });

  it('a dot stands at the same left as its mark: the same percentage of the same axis', () => {
    for (const p of curve.points) {
      expect(html).toContain(`cx="${p.x * 100}%"`);
      expect(html).toMatch(new RegExp(`style="left:${p.x * 100}%;[^"]*" aria-label="Show ${p.date}"`));
    }
  });

  it('without a series (or with too few values) nothing is drawn and nothing else changes', () => {
    const before = stepper();
    expect(before).not.toContain('curve');
    expect(stepper(null)).toBe(before);
    expect(stepper({ ...series, points: [{ date: '2026-06-07', value: -10 }] })).toBe(before);
  });
});

describe("the story's curve (StoryCurve)", () => {
  const picture = (date: string, over: Partial<PictureOnMap> = {}): PictureOnMap => ({
    layer,
    index: layer.items.findIndex((i) => i.date === date),
    failed: false,
    ...over,
  });
  const render = (shown: PictureOnMap | null) => renderToStaticMarkup(createElement(StoryCurve, { series, curve, entries, layer, picture: shown }));
  const currentIn = (html: string) => [...html.matchAll(/<circle class="curve-dot curve-dot-current"[^>]*data-date="([^"]+)"[^>]*data-current=""/g)].map((m) => m[1]);

  it('with no picture drawn, a failed one, or one of another layer: no point at all; the caption, labels and months stay', () => {
    const other = { ...layer, id: 'hv' } as Layer;
    for (const html of [render(null), render(picture('2026-08-30', { failed: true })), render(picture('2026-08-30', { layer: other }))]) {
      expect(dotsIn(html)).toEqual([]);
      expect(segmentsIn(html)).toEqual([]);
      expect(html).toContain('<p class="curve-caption">Mean HH backscatter (dB)</p>');
      expect(html).toContain(curveValueText(curve.max, 'dB'));
      expect(html).toContain(curveValueText(curve.min, 'dB'));
      expect(html).toContain('data-testid="curve-months"');
    }
  });

  it('as each picture is drawn: the passes up to its date, whole segments between them, the picture on the map marked, never a later pass', () => {
    for (const item of layer.items) {
      const html = render(picture(item.date!));
      const shown = curve.points.filter((p) => p.date <= item.date!);
      expect(dotsIn(html)).toEqual(expect.arrayContaining(shown.map((p) => p.date)));
      expect(dotsIn(html)).toHaveLength(shown.length);
      for (const d of dotsIn(html)) expect(d <= item.date!).toBe(true);
      const segs = segmentsIn(html);
      expect(segs).toEqual(curve.segments.filter(([a, b]) => b.date <= item.date! && a.date <= item.date!).map(([a, b]) => [a.date, b.date]));
      // The picture on the map is the one marked dot (no dot for the null value: nothing is marked then).
      expect(currentIn(html)).toEqual(values[item.date!] === null ? [] : [item.date]);
      expect(html.match(/curve-dot-current/g) ?? []).toHaveLength(values[item.date!] === null ? 0 : 1);
      // The frame never moves: the same labels however far the reveal has gone.
      expect(html).toContain(`<p class="curve-label curve-max">${curveValueText(curve.max, 'dB')}</p>`);
    }
  });

  it('is aria-hidden as a whole, caption included', () => {
    expect(render(null)).toMatch(/^<div class="story-curve" aria-hidden="true" data-testid="story-curve-figure">/);
  });
});
