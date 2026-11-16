// What the bars figure (components/BarsFigure.tsx) and the statistics panel render for an entry of
// `bars`, server-side: the rows in order, the reading order, the drawing hidden, null and zero rows.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BarsFigure, METHOD_SUMMARY } from '../../src/components/BarsFigure';
import { hasNoStatistics, NO_STATISTICS, StatsBody } from '../../src/components/StatsPanel';
import type { Layer } from '../../src/contract/manifest';
import type { BarsEntry, Stats } from '../../src/contract/stats';
import { BARS_ID, BARS_PERIOD_ID, buildManifest, buildYearStats, YEAR_SITE_ID } from '../fixtures/synthetic.mjs';

describe('BarsFigure', () => {
  const site = buildManifest().sites.find((s: { id: string }) => s.id === YEAR_SITE_ID) as { layers: Layer[] };
  const fixture = buildYearStats().bars[0] as BarsEntry;
  const html = renderToStaticMarkup(createElement(BarsFigure, { entry: fixture, layers: site.layers }));
  const rows = html.split('<li ').slice(1).map((row) => `<li ${row.slice(0, row.indexOf('</li>'))}</li>`);
  /** What a screen reader gets from a row: its text without the hidden drawing. */
  const text = (row: string) =>
    row
      .replace(/<div class="bars-track" aria-hidden="true">.*?<\/div>/, '')
      .replace(/<[^>]+>/g, '')
      .trim();

  it('captions the figure with the title and the unit, and puts the region below the rows', () => {
    expect(html).toMatch(/^<figure[^>]*><figcaption><strong>SYNTHETIC points per km2 by class<\/strong> \(points per km2\)<\/figcaption>/);
    const end = html.lastIndexOf('</ul>');
    expect(html.indexOf(`Region: ${fixture.region}`)).toBeGreaterThan(end);
  });

  it('then the method, in a native disclosure that is closed until opened, its summary saying what it holds', () => {
    const region = html.indexOf(`Region: ${fixture.region}`);
    const details = html.indexOf('<details');
    expect(details).toBeGreaterThan(region);
    expect(html.slice(details)).toBe(`<details class="muted bars-method"><summary>${METHOD_SUMMARY}</summary><p>${fixture.method}</p></details></figure>`);
    expect(METHOD_SUMMARY).toBe('How these numbers and their intervals were computed');
    // Written once, inside the disclosure.
    expect(html.split(fixture.method)).toHaveLength(2);
  });

  it('has one list item per category, in the order of the file', () => {
    expect(html).toContain('<ul class="bars-rows" role="list">');
    expect(rows).toHaveLength(fixture.categories.length);
    fixture.categories.forEach((c, i) => expect(rows[i]).toContain(c.label));
  });

  it('reads label, value, interval, n and note in that order, with the drawing hidden', () => {
    const c = fixture.categories[1]!;
    expect(text(rows[1]!)).toBe(`${c.label}: ${String(c.value)} ${fixture.unit} (${String(c.low)} to ${String(c.high)}), n = ${String(c.n)}`);
    const missing = fixture.categories[4]!;
    expect(text(rows[4]!)).toBe(`${missing.label}: not available. Note: ${missing.note!}`);
    // The drawing and the scale are hidden from screen readers; the swatch too.
    expect(html).toMatch(/<div class="bars-axis-row" aria-hidden="true">/);
    expect(rows[1]).toMatch(/<div class="bars-track" aria-hidden="true">/);
    expect(rows[1]).toMatch(/<span class="swatch" style="background:#56b4e9" aria-hidden="true">/);
  });

  it('draws nothing for the null row: no bar, no whisker, no zero line', () => {
    expect(rows[4]).toContain('data-missing="true"');
    expect(rows[4]).not.toContain('bars-track');
    expect(rows[4]).not.toContain('bars-bar');
    expect(rows[4]).not.toContain('bars-whisker');
  });

  it('writes no interval for a null value, even when the file gives low and high: it is not an estimate with an uncertainty', () => {
    const entry = { ...fixture, categories: [{ label: 'X', value: null, low: 0, high: 0.008, n: 3, note: 'too few pixels' }] } as BarsEntry;
    const out = renderToStaticMarkup(createElement(BarsFigure, { entry, layers: [] }));
    expect(out).not.toContain('bars-interval');
    expect(out).not.toContain('0.008');
    expect(out).not.toContain('bars-whisker');
    // The count behind it is still a count, and the note says why.
    expect(text(out.slice(out.indexOf('<li '), out.indexOf('</li>') + 5))).toBe('X: not available, n = 3. Note: too few pixels');
  });

  it('draws a 0 as a mark on the zero line, with its whisker', () => {
    expect(rows[0]).toContain('bars-zero-value');
    expect(rows[0]).not.toContain('class="bars-bar"');
    expect(rows[0]).toContain('bars-whisker');
    expect(text(rows[0]!)).toContain(`: 0 ${fixture.unit} (0 to 0.008), n = 0`);
  });

  it('draws no whisker for the row without low and high', () => {
    expect(rows[3]).toContain('class="bars-bar"');
    expect(rows[3]).not.toContain('bars-whisker');
    expect(rows[3]).not.toContain('(');
  });

  it("writes the scale's zero and end", () => {
    expect(html).toMatch(/class="bars-tick" data-value="0"[^>]*>0</);
    expect(html).toMatch(/class="bars-tick" data-value="0.2"[^>]*>0.2</);
  });

  it('writes the scale in words too, after the caption and before the hidden axis, where screen readers get it', () => {
    const sentence = `<p class="muted bars-scale">Scale: 0 to 0.2 ${fixture.unit}.</p>`;
    expect(html).toContain(`</figcaption>${sentence}<div class="bars-axis-row" aria-hidden="true">`);
  });

  it('shows no swatch when the layer is not one of the site', () => {
    const none = renderToStaticMarkup(createElement(BarsFigure, { entry: fixture, layers: [] }));
    expect(none).not.toContain('swatch');
  });

  it('draws no scale and no bar when every value is null, and says so on every row', () => {
    const empty = { ...fixture, categories: fixture.categories.map((c) => ({ ...c, value: null })) } as BarsEntry;
    const out = renderToStaticMarkup(createElement(BarsFigure, { entry: empty, layers: site.layers }));
    expect(out).not.toContain('bars-axis');
    expect(out).not.toContain('bars-track');
    expect(out.match(/not available/g)).toHaveLength(fixture.categories.length);
  });
});

describe('StatsBody', () => {
  const site = buildManifest().sites.find((s: { id: string }) => s.id === YEAR_SITE_ID) as { layers: Layer[] };
  const stats = buildYearStats() as Stats;
  const render = (s: Stats) => renderToStaticMarkup(createElement(StatsBody, { stats: s, layers: site.layers, mixedRelease: false }));

  it('draws the bars after the series charts', () => {
    const html = render(stats);
    const lastSeries = html.lastIndexOf('class="series"');
    expect(lastSeries).toBeGreaterThan(-1);
    expect(html.indexOf(`data-bars-id="${BARS_ID}"`)).toBeGreaterThan(lastSeries);
  });

  it('says there are no statistics only when there are neither series nor bars', () => {
    expect(hasNoStatistics({ ...stats, series: [] })).toBe(false);
    expect(render({ ...stats, series: [] })).not.toContain(NO_STATISTICS);
    expect(hasNoStatistics({ ...stats, bars: undefined })).toBe(false);
    expect(hasNoStatistics({ ...stats, series: [], bars: [] })).toBe(true);
    expect(hasNoStatistics({ ...stats, series: [], bars: undefined })).toBe(true);
    expect(render({ ...stats, series: [], bars: undefined })).toContain(NO_STATISTICS);
  });

  it('draws nothing extra for a file without bars', () => {
    expect(render({ ...stats, bars: undefined })).not.toContain('bars');
  });

  it('draws the entries of one unit and layer on one scale, and each figure says so in words', () => {
    const figures = render(stats)
      .split('<figure class="bars"')
      .slice(1)
      .map((f) => f.slice(0, f.indexOf('</figure>')));
    expect(figures.map((f) => f.match(/data-bars-id="([^"]+)"/)?.[1])).toEqual([BARS_ID, BARS_PERIOD_ID]);
    const period = stats.bars![1]!;
    for (const f of figures) {
      // The same end on both axes, and the same sentence, which is not hidden from screen readers.
      expect(f.match(/class="bars-tick" data-value="([^"]+)"/g)).toEqual(['class="bars-tick" data-value="0"', 'class="bars-tick" data-value="0.2"']);
      expect(f).toContain(`<p class="muted bars-scale">Scale: 0 to 0.2 ${period.unit}, the same in both charts.</p>`);
    }
    // The period's largest value (far below the other entry's) draws its bar to its share of 0.2,
    // not to most of the row as a scale of its own (to 0.08) would.
    const i = period.categories.findIndex((c) => c.value !== null && c.value > 0);
    const row = figures[1]!.split('<li ')[i + 1]!;
    expect(row).toContain(`class="bars-bar" style="left:0.000%;width:${((period.categories[i]!.value! / 0.2) * 100).toFixed(3)}%"`);
  });

  it('keeps a scale of its own for an entry of another unit, and says that one is for its chart only', () => {
    const other = { ...stats.bars![1]!, id: 'other-unit', unit: '%' };
    const html = render({ ...stats, bars: [stats.bars![0]!, other] });
    expect(html).toContain(`Scale: 0 to 0.2 ${stats.bars![0]!.unit}, for this chart only.`);
    expect(html).toContain('Scale: 0 to 0.08 %, for this chart only.');
  });
});
