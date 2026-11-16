// Bars (an entry of `bars` in stats.json): the shared scale and the positions of bars and whiskers,
// the number formatter, the row texts, the class swatch and loadStats's check of the shape. What the
// figure renders is in barsFigure.test.ts.

import { describe, expect, it } from 'vitest';
import { barScale, barsGeometry, classColour, countText, intervalText, niceCeiling, panelScales, scaleText, valueText } from '../../src/components/barGeometry';
import { formatNumber } from '../../src/components/numberText';
import type { Layer } from '../../src/contract/manifest';
import { loadStats, type BarCategory, type BarsEntry } from '../../src/contract/stats';
import { BARS_ID, BARS_PERIOD_ID, buildManifest, buildYearStats, SYN_CLASS_ENCODING, YEAR_LAYERS, YEAR_SITE_ID } from '../fixtures/synthetic.mjs';

const cat = (value: number | null, extra: Partial<BarCategory> = {}): BarCategory => ({ label: `v${String(value)}`, value, ...extra });
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);

describe('formatNumber', () => {
  it('keeps the significant digits of a small rate', () => {
    expect(formatNumber(0.0123)).toBe('0.0123');
    expect(formatNumber(0.00123)).toBe('0.00123');
    expect(formatNumber(0.012345)).toBe('0.0123');
    expect(formatNumber(0.000012)).toBe('0.000012');
  });

  it('trims trailing zeros and rounds to three significant digits', () => {
    expect(formatNumber(0.19)).toBe('0.19');
    expect(formatNumber(0.1)).toBe('0.1');
    expect(formatNumber(12.345)).toBe('12.3');
    expect(formatNumber(1.5)).toBe('1.5');
    expect(formatNumber(2)).toBe('2');
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
    expect(formatNumber(9.996)).toBe('10');
  });

  it('never rounds away the integer part or writes an exponent for an ordinary value', () => {
    expect(formatNumber(12345)).toBe('12345');
    expect(formatNumber(1234.5)).toBe('1235');
    expect(formatNumber(1e9)).toBe('1000000000');
    expect(formatNumber(187)).toBe('187');
    expect(formatNumber(0.0000015)).not.toMatch(/e/);
  });

  it('writes zero as 0 and keeps the sign of a negative value', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(-0)).toBe('0');
    expect(formatNumber(-0.0123)).toBe('-0.0123');
    expect(formatNumber(-12.345)).toBe('-12.3');
  });

  it('uses an exponent only for a value too small to be ordinary, and never turns it into 0', () => {
    expect(formatNumber(1.5e-9)).toBe('1.5e-9');
    expect(formatNumber(-2e-12)).toBe('-2e-12');
  });

  it("writes the fixture's numbers as the file has them", () => {
    for (const c of buildYearStats().bars[0]!.categories) {
      for (const v of [c.value, c.low, c.high, c.n]) if (typeof v === 'number') expect(formatNumber(v)).toBe(String(v));
    }
  });
});

describe('niceCeiling', () => {
  it('rounds up to 1, 1.5, 2, 2.5, 3, 4, 5, 6 or 8 times a power of ten', () => {
    expect(niceCeiling(0.19)).toBe(0.2);
    expect(niceCeiling(0.105)).toBe(0.15);
    expect(niceCeiling(0.3)).toBe(0.3);
    expect(niceCeiling(7)).toBe(8);
    expect(niceCeiling(8.5)).toBe(10);
    expect(niceCeiling(1)).toBe(1);
    expect(niceCeiling(230)).toBe(250);
    expect(niceCeiling(0.0123)).toBe(0.015);
  });

  it('is never below its argument', () => {
    for (let x = 0.0001; x < 1000; x *= 1.37) expect(niceCeiling(x)).toBeGreaterThanOrEqual(x);
  });
});

describe('barScale and barsGeometry', () => {
  it('puts every row on one scale from 0 to a round number at or above the largest high or value', () => {
    const g = barsGeometry([cat(0.087, { low: 0.069, high: 0.105 }), cat(0.165, { low: 0.141, high: 0.19 }), cat(0.017)]);
    expect(g.scale).toMatchObject({ min: 0, max: 0.2, zero: 0 });
    expect(g.scale!.ticks.map((t) => [t.value, t.at])).toEqual([
      [0, 0],
      [0.2, 1],
    ]);
    close(g.rows[0]!.bar!.to, 0.435);
    close(g.rows[1]!.bar!.to, 0.825);
    close(g.rows[2]!.bar!.to, 0.085);
    for (const row of g.rows) expect(row.bar!.from).toBe(0);
    close(g.rows[0]!.whisker!.from, 0.345);
    close(g.rows[0]!.whisker!.to, 0.525);
    close(g.rows[1]!.whisker!.to, 0.95);
  });

  it('reaches the largest value when no row has a high', () => {
    expect(barScale([cat(3), cat(7)])).toMatchObject({ min: 0, max: 8 });
  });

  it('gives a null value no bar and no whisker, and leaves it out of the scale', () => {
    const g = barsGeometry([cat(2), cat(null, { low: 50, high: 90 })]);
    expect(g.rows[1]).toEqual({ bar: null, atZero: false, whisker: null });
    expect(g.scale!.max).toBe(2);
  });

  it('draws a value of 0 as a mark on the zero line, not as missing', () => {
    const g = barsGeometry([cat(0, { low: 0, high: 0.008 }), cat(0.165)]);
    expect(g.rows[0]!.atZero).toBe(true);
    expect(g.rows[0]!.bar).toEqual({ from: 0, to: 0 });
    expect(g.rows[0]!.whisker!.from).toBe(0);
    expect(g.rows[1]!.atZero).toBe(false);
  });

  it('draws no whisker when low or high is missing', () => {
    const g = barsGeometry([cat(1, { low: 0.5 }), cat(1, { high: 1.5 }), cat(1)]);
    for (const row of g.rows) expect(row.whisker).toBeNull();
    // A lone end is not drawn, so it does not stretch the scale either.
    expect(barScale([cat(1, { high: 9 })])!.max).toBe(1);
  });

  it('draws low and high where they are, even beyond the value, and stretches the scale to them', () => {
    const g = barsGeometry([cat(2, { low: 3, high: 4.5 }), cat(1, { low: 0.2, high: 0.5 })]);
    expect(g.scale!.max).toBe(5);
    close(g.rows[0]!.bar!.to, 0.4);
    close(g.rows[0]!.whisker!.from, 0.6);
    close(g.rows[0]!.whisker!.to, 0.9);
    close(g.rows[1]!.whisker!.to, 0.1);
    // Low and high given the wrong way round are still drawn from the smaller to the larger.
    const swapped = barsGeometry([cat(2, { low: 3, high: 1 })]);
    expect(swapped.scale!.max).toBe(3);
    close(swapped.rows[0]!.whisker!.from, 1 / 3);
    close(swapped.rows[0]!.whisker!.to, 1);
  });

  it('starts the scale at a round number below the most negative value or low, with zero inside', () => {
    const g = barsGeometry([cat(-1.2, { low: -1.8, high: -0.4 }), cat(2.5)]);
    expect(g.scale).toMatchObject({ min: -2, max: 2.5 });
    close(g.scale!.zero, 2 / 4.5);
    expect(g.scale!.ticks.map((t) => t.value)).toEqual([-2, 0, 2.5]);
    // A negative bar runs from its value to zero.
    close(g.rows[0]!.bar!.from, 0.8 / 4.5);
    close(g.rows[0]!.bar!.to, 2 / 4.5);
    close(g.rows[0]!.whisker!.from, 0.2 / 4.5);
    close(g.rows[1]!.bar!.from, 2 / 4.5);
    close(g.rows[1]!.bar!.to, 1);
  });

  it('ends the scale at zero when every value is negative', () => {
    const s = barScale([cat(-0.3), cat(-0.05)])!;
    expect(s).toMatchObject({ min: -0.3, max: 0, zero: 1 });
    expect(s.ticks.map((t) => t.value)).toEqual([-0.3, 0]);
  });

  it('has no scale when every value is null', () => {
    const g = barsGeometry([cat(null), cat(null, { low: 1, high: 2, n: 4 })]);
    expect(g.scale).toBeNull();
    expect(g.rows).toEqual([
      { bar: null, atZero: false, whisker: null },
      { bar: null, atZero: false, whisker: null },
    ]);
  });

  it('still has a scale with a length when every value is 0', () => {
    const g = barsGeometry([cat(0), cat(0)]);
    expect(g.scale).toMatchObject({ min: 0, max: 1, zero: 0 });
    expect(g.rows.every((r) => r.atZero)).toBe(true);
  });
});

describe('panelScales: one scale for the entries of one unit and layer', () => {
  type Entry = Pick<BarsEntry, 'unit' | 'layer' | 'categories'>;
  const entry = (unit: string, layer: string | undefined, ...categories: BarCategory[]): Entry =>
    ({ unit, ...(layer === undefined ? {} : { layer }), categories }) as Entry;
  const [whole, period] = buildYearStats().bars as BarsEntry[];

  it("draws the fixture's two entries, of one unit and layer and far apart in size, on one scale over both", () => {
    expect([period!.id, period!.unit, period!.layer]).toEqual([BARS_PERIOD_ID, whole!.unit, whole!.layer]);
    // On scales of their own the smaller values would be drawn on a scale ending at 0.08, not 0.2.
    expect(barScale(whole!.categories)!.max).toBe(0.2);
    expect(barScale(period!.categories)!.max).toBe(0.08);
    const scales = panelScales([whole!, period!]);
    expect(scales[1]!.scale).toEqual(scales[0]!.scale);
    expect(scales[0]!.scale).toEqual(barScale([...whole!.categories, ...period!.categories]));
    expect(scales[0]!.scale!.max).toBe(0.2);
    expect(scales.map((s) => [s.charts, s.figures])).toEqual([
      [2, 2],
      [2, 2],
    ]);
    // So a bar's length is its value on that one scale, in either figure: the smaller value of the
    // period draws the shorter bar.
    const a = barsGeometry(whole!.categories, scales[0]!.scale);
    const b = barsGeometry(period!.categories, scales[1]!.scale);
    const i = period!.categories.findIndex((c) => c.value !== null && c.value > 0);
    close(b.rows[i]!.bar!.to, period!.categories[i]!.value! / 0.2);
    close(a.rows[i]!.bar!.to, whole!.categories[i]!.value! / 0.2);
    expect(b.rows[i]!.bar!.to).toBeLessThan(a.rows[i]!.bar!.to);
  });

  it("gives three entries like the real site's (0.69, 1.09 and 0.55 at most) one scale to 1.5, not 0.8, 1.5 and 0.6", () => {
    const windows = [0.69, 1.09, 0.55].map((high) => entry('detections per km2', 'classes', cat(high / 2, { low: 0.01, high }), cat(0.1)));
    expect(windows.map((w) => barScale(w.categories)!.max)).toEqual([0.8, 1.5, 0.6]);
    const scales = panelScales(windows);
    expect(scales.map((s) => s.scale!.max)).toEqual([1.5, 1.5, 1.5]);
    expect(scales.map((s) => s.charts)).toEqual([3, 3, 3]);
    // The same value draws the same bar in every figure.
    const ends = windows.map((w, k) => barsGeometry(w.categories, scales[k]!.scale).rows[1]!.bar!.to);
    for (const end of ends) close(end, 0.1 / 1.5);
  });

  it('keeps a scale of its own for an entry of another unit, of another layer, or of no layer', () => {
    const scales = panelScales([
      entry('points per km2', 'classes', cat(0.1)),
      entry('points per km2', 'classes', cat(0.7)),
      entry('%', 'classes', cat(30)),
      entry('points per km2', 'other-layer', cat(0.03)),
      entry('points per km2', undefined, cat(4)),
      entry('points per km2', undefined, cat(0.02)),
    ]);
    expect(scales.map((s) => s.scale!.max)).toEqual([0.8, 0.8, 30, 0.03, 4, 0.02]);
    expect(scales.map((s) => s.charts)).toEqual([2, 2, 1, 1, 1, 1]);
    for (const s of scales) expect(s.figures).toBe(6);
  });

  it('gives an entry with nothing to draw no scale, and does not count it', () => {
    const scales = panelScales([entry('u', 'l', cat(0.3)), entry('u', 'l', cat(null)), entry('u', 'l', cat(0.9))]);
    expect(scales[1]).toEqual({ scale: null, charts: 0, figures: 2 });
    expect([scales[0]!.scale!.max, scales[0]!.charts, scales[2]!.charts]).toEqual([1, 2, 2]);
    // And its rows draw nothing, whatever scale it is handed.
    expect(barsGeometry([cat(null)], scales[0]!.scale)).toEqual({ scale: null, rows: [{ bar: null, atZero: false, whisker: null }] });
  });

  it('is empty for a file without bars', () => {
    expect(panelScales([])).toEqual([]);
  });
});

describe('scaleText: the scale in words', () => {
  const scale = barScale([cat(0.19)])!;

  it('writes the ends and the unit, and says nothing of other charts when there is none', () => {
    expect(scaleText(scale, 'points per km2', { charts: 1, figures: 1 })).toBe('Scale: 0 to 0.2 points per km2.');
    expect(scaleText(barScale([cat(7)])!, '', { charts: 1, figures: 1 })).toBe('Scale: 0 to 8.');
    expect(scaleText(barScale([cat(-1.8), cat(2.5)])!, 'dB', { charts: 1, figures: 1 })).toBe('Scale: -2 to 2.5 dB.');
  });

  it('says when the scale is this chart\'s only, and when every chart shares it', () => {
    expect(scaleText(scale, 'points per km2', { charts: 1, figures: 3 })).toBe('Scale: 0 to 0.2 points per km2, for this chart only.');
    expect(scaleText(scale, 'points per km2', { charts: 2, figures: 2 })).toBe('Scale: 0 to 0.2 points per km2, the same in both charts.');
    expect(scaleText(barScale([cat(1.09)])!, 'detections per km2', { charts: 3, figures: 3 })).toBe(
      'Scale: 0 to 1.5 detections per km2, the same in all three charts.',
    );
    expect(scaleText(scale, '%', { charts: 12, figures: 12 })).toBe('Scale: 0 to 0.2 %, the same in all 12 charts.');
  });

  it('names the unit and the layer when only some of the charts share it', () => {
    expect(scaleText(scale, 'points per km2', { charts: 2, figures: 3 }, 'SYNTHETIC classes')).toBe(
      'Scale: 0 to 0.2 points per km2, the same in the two charts in points per km2 for the layer “SYNTHETIC classes”.',
    );
  });
});

describe('row texts', () => {
  it('writes the value with its unit, and a null as "not available", never 0', () => {
    expect(valueText(0.087, 'points per km2')).toBe('0.087 points per km2');
    expect(valueText(0.0123, '%')).toBe('0.0123 %');
    expect(valueText(0, 'points per km2')).toBe('0 points per km2');
    expect(valueText(5, '')).toBe('5');
    expect(valueText(null, 'points per km2')).toBe('not available');
  });

  it('writes the interval when both ends are there, and a lone end on its own', () => {
    expect(intervalText(0.069, 0.105)).toBe('(0.069 to 0.105)');
    expect(intervalText(0, 0.008)).toBe('(0 to 0.008)');
    expect(intervalText(undefined, undefined)).toBeNull();
    expect(intervalText(0.5, undefined)).toBe('(lower end 0.5)');
    expect(intervalText(undefined, 1.5)).toBe('(upper end 1.5)');
  });

  it('writes n when there is one', () => {
    expect(countText(93)).toBe('n = 93');
    expect(countText(0)).toBe('n = 0');
    expect(countText(undefined)).toBeNull();
  });
});

describe('classColour', () => {
  const site = buildManifest().sites.find((s: { id: string }) => s.id === YEAR_SITE_ID) as { layers: Layer[] };
  const entry = { layer: YEAR_LAYERS.classes };

  it("gives a category the colour of its class in the entry's categorical layer", () => {
    for (const c of SYN_CLASS_ENCODING.classes) expect(classColour(entry, cat(1, { class: c.value }), site.layers)).toBe(c.color);
  });

  it('gives no colour without a layer, without a class, for an unknown class, or for a layer that is not categorical', () => {
    expect(classColour({}, cat(1, { class: 1 }), site.layers)).toBeNull();
    expect(classColour(entry, cat(1), site.layers)).toBeNull();
    expect(classColour(entry, cat(1, { class: 99 }), site.layers)).toBeNull();
    expect(classColour({ layer: YEAR_LAYERS.hh }, cat(1, { class: 1 }), site.layers)).toBeNull();
    expect(classColour({ layer: 'not-a-layer' }, cat(1, { class: 1 }), site.layers)).toBeNull();
  });
});

describe('loadStats and bars', () => {
  const answer = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
  const base = { schema: 1, site: 's', series: [] };
  const entry = (categories: unknown) => ({ id: 'b', title: 't', unit: '', region: 'r', method: 'm', categories });
  const SENTENCE = 'The statistics file is not in the expected format (schema 1).';

  it("loads the fixture's bars and a file without bars", async () => {
    const stats = await loadStats('x', answer(buildYearStats()));
    expect(stats.bars?.[0]?.id).toBe(BARS_ID);
    await expect(loadStats('x', answer(base))).resolves.toEqual(base);
  });

  it('accepts a value of null and a value of 0', async () => {
    await expect(loadStats('x', answer({ ...base, bars: [entry([{ label: 'a', value: null }, { label: 'b', value: 0 }])] }))).resolves.toBeTruthy();
  });

  const broken: [string, unknown][] = [
    ['bars is not an array', { id: 'b' }],
    ['an entry is not an object', [null]],
    ['an entry has no categories', [{ id: 'b', title: 't' }]],
    ['an entry has an empty list of categories', [entry([])]],
    ['categories is not an array', [entry({ label: 'a', value: 1 })]],
    ['a category is not an object', [entry([1])]],
    ['a category has no label', [entry([{ value: 1 }])]],
    ['a label is not text', [entry([{ label: 3, value: 1 }])]],
    ['a category has no value', [entry([{ label: 'a' }])]],
    ['a value is text', [entry([{ label: 'a', value: '0.1' }])]],
  ];
  for (const [what, bars] of broken) {
    it(`throws its usual sentence when ${what}`, async () => {
      await expect(loadStats('x', answer({ ...base, bars }))).rejects.toThrow(SENTENCE);
    });
  }
});
