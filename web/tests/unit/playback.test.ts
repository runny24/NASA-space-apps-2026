import { describe, expect, it } from 'vitest';
import {
  PLAY_CEILING_MS,
  PLAY_DWELL_MS,
  canPlay,
  msUntilStep,
  nextPlayItem,
  playOrder,
  playStart,
  wantsAutoplay,
} from '../../src/state/playback';
import { buildTimeline, stepDate } from '../../src/state/timeline';

// Four acquisitions and a missing pass; the layer has no file for 2026-07-01. The layer's items are
// deliberately not in date order, so item indexes and date order differ.
const site = {
  dates: ['2026-06-19', '2026-07-01', '2026-07-25', '2026-08-06'].map((date) => ({ date })),
  missing_passes: [{ date: '2026-07-13', reason: 'no product' }],
} as Parameters<typeof buildTimeline>[0];
const layer = {
  items: [
    { url: 'c.tif', date: '2026-07-25' },
    { url: 'a.tif', date: '2026-06-19' },
    { url: 'd.tif', date: '2026-08-06' },
  ],
};
const entries = buildTimeline(site, layer);

describe('playback order', () => {
  it('goes through the dates the layer can show, in date order, skipping missing passes and absent files', () => {
    expect(playOrder(entries)).toEqual([1, 0, 2]);
  });

  it('follows the "Next date" button exactly', () => {
    for (const item of playOrder(entries)) {
      const next = nextPlayItem(entries, item);
      expect(next ?? item).toBe(stepDate(entries, item, 1));
    }
  });

  it('steps one date at a time and stops on the last date', () => {
    expect(nextPlayItem(entries, 1)).toBe(0);
    expect(nextPlayItem(entries, 0)).toBe(2);
    expect(nextPlayItem(entries, 2)).toBeNull();
  });

  it('stops when the current item is not one it can show', () => {
    expect(nextPlayItem(entries, 7)).toBeNull();
    expect(nextPlayItem([], 0)).toBeNull();
  });

  it('starts from the date on screen, or from the first date when on the last one', () => {
    expect(playStart(entries, 0)).toBe(0);
    expect(playStart(entries, 1)).toBe(1);
    expect(playStart(entries, 2)).toBe(1);
    expect(playStart(entries, -1)).toBe(1);
  });

  it('cannot play fewer than two dates', () => {
    const one = buildTimeline(site, { items: [{ url: 'a.tif', date: '2026-06-19' }] });
    expect(canPlay(one)).toBe(false);
    expect(playStart(one, 0)).toBe(-1);
    expect(canPlay([])).toBe(false);
    expect(canPlay(entries)).toBe(true);
  });
});

describe('playback timing', () => {
  it('steps a dwell after the map has drawn the picture', () => {
    expect(msUntilStep({ shownAt: 1000, drawnAt: 1300, now: 1300 })).toBe(PLAY_DWELL_MS);
    expect(msUntilStep({ shownAt: 1000, drawnAt: 1300, now: 1300 + PLAY_DWELL_MS })).toBe(0);
    expect(msUntilStep({ shownAt: 1000, drawnAt: 1300, now: 5000 })).toBe(0);
  });

  it('waits for a slow picture instead of skipping it, up to the ceiling', () => {
    // Not drawn after twice the dwell: keep waiting.
    expect(msUntilStep({ shownAt: 0, drawnAt: null, now: 2 * PLAY_DWELL_MS })).toBe(PLAY_CEILING_MS - 2 * PLAY_DWELL_MS);
    // Drawn late: still a full dwell from then.
    expect(msUntilStep({ shownAt: 0, drawnAt: 5000, now: 5000 })).toBe(PLAY_DWELL_MS);
  });

  it('steps on at the ceiling when the map never reports the picture', () => {
    expect(msUntilStep({ shownAt: 0, drawnAt: null, now: PLAY_CEILING_MS })).toBe(0);
  });

  it('counts the dwell from pressing Play when the picture was drawn before', () => {
    expect(msUntilStep({ shownAt: 10_000, drawnAt: 2000, now: 10_000 })).toBe(PLAY_DWELL_MS);
  });

  it('keeps the dwell well under the ceiling', () => {
    expect(PLAY_DWELL_MS).toBeGreaterThanOrEqual(300);
    expect(PLAY_CEILING_MS).toBeGreaterThan(5 * PLAY_DWELL_MS);
  });
});

describe('play=1 in the link', () => {
  it('starts playing only with play=1 and without reduced motion', () => {
    expect(wantsAutoplay('?site=x&play=1', false)).toBe(true);
    expect(wantsAutoplay('?site=x&play=1', true)).toBe(false);
    expect(wantsAutoplay('?site=x', false)).toBe(false);
    expect(wantsAutoplay('?play=true', false)).toBe(false);
    expect(wantsAutoplay('', false)).toBe(false);
  });
});
