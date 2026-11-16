import { describe, expect, it } from 'vitest';
import { buildTimeline, dayNumber, stepDate } from '../../src/state/timeline';

const site = {
  dates: ['2026-06-19', '2026-07-01', '2026-07-25'].map((date) => ({ date })),
  missing_passes: [{ date: '2026-07-13', reason: 'no product' }],
} as Parameters<typeof buildTimeline>[0];
// The layer has no file for 2026-07-01.
const layer = { items: [{ url: 'a.tif', date: '2026-06-19' }, { url: 'c.tif', date: '2026-07-25' }] };

describe('timeline', () => {
  const entries = buildTimeline(site, layer);

  it('lists acquisitions and missing passes in date order', () => {
    expect(entries.map((e) => [e.date, e.status])).toEqual([
      ['2026-06-19', 'available'],
      ['2026-07-01', 'not-in-layer'],
      ['2026-07-13', 'missing'],
      ['2026-07-25', 'available'],
    ]);
    expect(entries[2]?.reason).toBe('no product');
  });

  it('places entries proportionally to time (12-day steps here)', () => {
    expect(entries.map((e) => e.position)).toEqual([0, 1 / 3, 2 / 3, 1]);
  });

  it('steps between available dates only, skipping missing passes, and stops at the ends', () => {
    expect(stepDate(entries, 0, 1)).toBe(1); // item 1 is 2026-07-25
    expect(stepDate(entries, 1, -1)).toBe(0);
    expect(stepDate(entries, 1, 1)).toBe(1);
    expect(stepDate(entries, 0, -1)).toBe(0);
  });

  it('counts days in UTC', () => {
    expect(dayNumber('2026-07-13') - dayNumber('2026-07-01')).toBe(12);
  });

  it('is empty for a site without dates', () => {
    expect(buildTimeline({ dates: [], missing_passes: [] }, { items: [] })).toEqual([]);
    expect(stepDate([], 0, 1)).toBe(-1);
  });
});
