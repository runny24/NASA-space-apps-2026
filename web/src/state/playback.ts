// Playing through the dates of a per-date layer: which date comes next, when to stop, and how long
// to wait. Pure functions; the timer and the wait for the map live in components/usePlayback.ts.

import { stepDate, type TimelineEntry } from './timeline';

/**
 * How long a date stays on screen once the map has drawn it, before playback moves on. Long enough
 * to take in a picture, short enough that a year of passes plays in about 20 seconds.
 */
export const PLAY_DWELL_MS = 700;

/**
 * The longest playback waits on one date for the map to say its picture is drawn. Past this it
 * moves on anyway, so one file that never loads cannot stall the playback.
 */
export const PLAY_CEILING_MS = 8000;

/** The item indexes a play goes through: the dates the layer can show, in the order of "Next date". */
export function playOrder(entries: TimelineEntry[]): number[] {
  return entries.flatMap((e) => (e.status === 'available' && e.itemIndex !== undefined ? [e.itemIndex] : []));
}

/** Playing needs at least two dates the layer can show. */
export function canPlay(entries: TimelineEntry[]): boolean {
  return playOrder(entries).length >= 2;
}

/**
 * Where pressing Play starts: from the date on screen, or from the first date when that is the last
 * one (or not one the layer can show). -1 when the layer cannot play.
 */
export function playStart(entries: TimelineEntry[], current: number): number {
  const order = playOrder(entries);
  if (order.length < 2) return -1;
  const at = order.indexOf(current);
  return at === -1 || at === order.length - 1 ? (order[0] ?? -1) : current;
}

/** The date after `current` while playing, or null when playback should stop (the last date, or none). */
export function nextPlayItem(entries: TimelineEntry[], current: number): number | null {
  const order = playOrder(entries);
  if (!order.includes(current)) return null;
  const next = stepDate(entries, current, 1);
  return next === current || next < 0 ? null : next;
}

/**
 * Milliseconds until playback takes its next step (0 when it is due now).
 * - `shownAt`: when the current date became the one on screen (or Play was pressed on it).
 * - `drawnAt`: when the map said this date's picture was drawn, or null while it has not.
 * A step is due a dwell after the picture was drawn (never counting from before `shownAt`). While
 * the map has not drawn it, the step waits, up to the ceiling counted from `shownAt`.
 */
export function msUntilStep(t: { shownAt: number; drawnAt: number | null; now: number }): number {
  const due = t.drawnAt === null ? t.shownAt + PLAY_CEILING_MS : Math.max(t.drawnAt, t.shownAt) + PLAY_DWELL_MS;
  return Math.max(0, due - t.now);
}

/**
 * Whether a page opened with this query string should start playing by itself: only with `play=1`,
 * and never when the person asks for reduced motion (they press Play themselves).
 */
export function wantsAutoplay(search: string, reducedMotion: boolean): boolean {
  return !reducedMotion && new URLSearchParams(search).get('play') === '1';
}
