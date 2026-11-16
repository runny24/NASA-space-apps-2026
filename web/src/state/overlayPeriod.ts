// Which points of an overlay (docs/DATA_CONTRACT.md, "Overlays") belong with what is on screen, and
// what the caption says about them. Pure functions: the map filter (map/overlayLayers.ts), the count
// in the captions and the point search (map/nearestPoint.ts) all read the same OverlayWindow, so the
// number a caption gives is the number of points the map is asked to draw.
//
// Dates are UTC calendar days, compared as YYYY-MM-DD strings; both ends of a period are included.
//
// - Per-date layer: from the selected date to the day before the next date THIS LAYER has (what was
//   reported between the picture on screen and the next picture the stepper goes to). For the
//   layer's last date: to the end of date_range (open-ended when the overlay has none).
// - Pair layer: from the reference date to the day before the secondary date.
// - Static layer, or an overlay without date_property: every point.
// The wanted period is then compared with date_range: wholly outside it the overlay has NO DATA
// (never "0"); partly outside, only the part inside is used and the caption says why.
//
// The guided story builds a period up one real day at a time (docs/MOTION_AND_STORY_BRIEF.md,
// "Fires day by day"). It caps the WINDOW itself (capWindow), never only the caption or only the
// map, so the count and the filter still come from one window at every tick.

import type { Layer, Overlay } from '../contract/manifest';
import type { OverlayPoint } from '../contract/overlay';

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whether a value is a real calendar day written YYYY-MM-DD (2026-02-30 is not). */
export function isDay(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = DAY.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

/** YYYY-MM-DD plus a number of days, in UTC. */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10);
}

/** A period of whole UTC days, both ends included. `last` null: open-ended (no end known). */
export interface Period {
  first: string;
  last: string | null;
}

/**
 * What the map shows of an overlay, and why:
 * - all: every point (static layer, or an overlay without date_property); `range` is the overlay's
 *   date_range, when it has one, which is the period the caption names.
 * - none: the wanted period lies wholly outside date_range: no point, and the caption says that the
 *   overlay has no data for it.
 * - dated: the points dated within `used`, which is `wanted` clipped to date_range. `clippedStart`
 *   and `clippedEnd` say which end the range cut (the caption says why); `rangeKnown` false when the
 *   overlay has no date_range, so "none" cannot be told from "no data".
 */
export type OverlayWindow =
  | { kind: 'all'; range: [string, string] | null }
  | { kind: 'none'; wanted: Period; range: [string, string] }
  | { kind: 'dated'; wanted: Period; used: Period; clippedStart: boolean; clippedEnd: boolean; rangeKnown: boolean };

/**
 * The period of the layer's item on screen, or null when the points are not tied to a period
 * (a static layer, no layer, or an item that does not exist).
 */
export function wantedPeriod(layer: Layer | null, itemIndex: number): Period | null {
  const item = layer?.items[itemIndex];
  if (!layer || !item) return null;
  if (layer.kind === 'per-date' && isDay(item.date)) {
    const date = item.date;
    // The next date this layer has, whatever order the items are listed in.
    const next = layer.items
      .map((it) => it.date)
      .filter((d): d is string => isDay(d) && d > date)
      .sort()[0];
    return { first: date, last: next ? addDays(next, -1) : null };
  }
  if (layer.kind === 'pair' && isDay(item.reference) && isDay(item.secondary) && item.reference < item.secondary)
    return { first: item.reference, last: addDays(item.secondary, -1) };
  return null;
}

/** The overlay's date_range, when it has a usable one. */
function rangeOf(overlay: Overlay): [string, string] | null {
  const r = overlay.date_range;
  return r && isDay(r[0]) && isDay(r[1]) && r[0] <= r[1] ? [r[0], r[1]] : null;
}

/** Which points of `overlay` go with item `itemIndex` of `layer` (see the header). */
export function overlayWindow(overlay: Overlay, layer: Layer | null, itemIndex: number): OverlayWindow {
  const range = rangeOf(overlay);
  const wanted = overlay.date_property ? wantedPeriod(layer, itemIndex) : null;
  if (!wanted) return { kind: 'all', range };
  if (!range) return { kind: 'dated', wanted, used: wanted, clippedStart: false, clippedEnd: false, rangeKnown: false };
  const [start, end] = range;
  if ((wanted.last !== null && wanted.last < start) || wanted.first > end) return { kind: 'none', wanted, range };
  const clippedStart = wanted.first < start;
  // An open-ended period (the layer's last date) runs to the end of the range by definition: that
  // is not a clip that needs a reason.
  const clippedEnd = wanted.last !== null && wanted.last > end;
  return {
    kind: 'dated',
    wanted,
    used: { first: clippedStart ? start : wanted.first, last: wanted.last === null || clippedEnd ? end : wanted.last },
    clippedStart,
    clippedEnd,
    rangeKnown: true,
  };
}

/** Whether the map draws `point` in `window`. A point with no valid day is never in a dated period. */
export function pointInWindow(point: OverlayPoint, window: OverlayWindow): boolean {
  if (window.kind === 'all') return true;
  if (window.kind === 'none' || point.day === null) return false;
  const { first, last } = window.used;
  return point.day >= first && (last === null || point.day <= last);
}

/** The points the map draws in `window`, in file order. */
export function pointsInWindow(points: readonly OverlayPoint[], window: OverlayWindow): OverlayPoint[] {
  return points.filter((p) => pointInWindow(p, window));
}

/**
 * The points left out of every dated period because their date is missing or not a YYYY-MM-DD day
 * (0 when the window is not dated: then every point is drawn, or none).
 */
export function undatedLeftOut(points: readonly OverlayPoint[], window: OverlayWindow): number {
  return window.kind === 'dated' ? points.filter((p) => p.day === null).length : 0;
}

/**
 * How far a day-by-day build has got: `first` is the first day of the period being built, `upTo`
 * the last day shown so far (UTC days, YYYY-MM-DD, both included).
 */
export interface OverlayCap {
  first: string;
  upTo: string;
}

/**
 * `window` shown only up to `cap.upTo`, so the caption's count and the map's filter (both read the
 * returned window) stay one number while a period builds up day by day:
 * - no cap, or kind none: the same window (no data stays no data);
 * - dated: `used.last` lowered to `cap.upTo` when it is open or later, never raised. `used.first`,
 *   `wanted`, `clippedStart` and `rangeKnown` are kept. `clippedEnd` is dropped when the end is
 *   lowered: the period now ends at the cap, not where the overlay's data end, and the caption must
 *   not say "data end on" the cap's day. It comes back on the tick that reaches the true end.
 * - all: a dated window from `cap.first` to `cap.upTo`. It must be dated: for kind all the map has
 *   no filter at all and would draw every point while the caption counted fewer.
 * A cap that ends before the period starts leaves an empty period (nothing drawn, a count of 0).
 */
export function capWindow(window: OverlayWindow, cap: OverlayCap | null | undefined): OverlayWindow {
  if (!cap || window.kind === 'none') return window;
  if (window.kind === 'all')
    return {
      kind: 'dated',
      wanted: { first: cap.first, last: cap.upTo },
      used: { first: cap.first, last: cap.upTo },
      clippedStart: false,
      clippedEnd: false,
      rangeKnown: window.range !== null,
    };
  const { first, last } = window.used;
  if (last !== null && last <= cap.upTo) return window;
  return { ...window, used: { first, last: cap.upTo }, clippedEnd: false };
}

/** A period of two real days in order, or null. */
function realPeriod(first: string | undefined, last: string | undefined): { first: string; last: string } | null {
  return isDay(first) && isDay(last) && first <= last ? { first, last } : null;
}

/**
 * The days a day-by-day build of the UNCAPPED `window` runs through, both included: for a dated
 * window its period (when it has no end: up to the latest point dated on or after its start); for
 * kind all the overlay's date_range (without one: the earliest to the latest dated point). Null for
 * kind none, or when no real day can end the period. Days without a point are kept: time is real.
 */
export function buildPeriod(window: OverlayWindow, points: readonly OverlayPoint[]): { first: string; last: string } | null {
  if (window.kind === 'none') return null;
  if (window.kind === 'dated') {
    const { first, last } = window.used;
    if (last !== null) return realPeriod(first, last);
    const after = points.flatMap((p) => (isDay(p.day) && p.day >= first ? [p.day] : [])).sort();
    return realPeriod(first, after.at(-1));
  }
  if (window.range) return realPeriod(window.range[0], window.range[1]);
  const days = points.flatMap((p) => (isDay(p.day) ? [p.day] : [])).sort();
  return realPeriod(days[0], days.at(-1));
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** '2026-11-04' as '4 November 2026', the same on every machine (no locale). */
export function formatDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/**
 * A period in words: '4 November 2026', '4 to 14 November 2026', '28 October to 8 November 2026',
 * '28 December 2025 to 8 January 2026', or 'from 8 November 2026' when it has no end.
 */
export function formatPeriod(period: Period): string {
  const { first, last } = period;
  if (last === null) return `from ${formatDay(first)}`;
  if (first === last) return formatDay(first);
  const [y1, m1, d1] = first.split('-').map(Number) as [number, number, number];
  const [y2, m2] = last.split('-').map(Number) as [number, number, number];
  if (y1 === y2 && m1 === m2) return `${d1} to ${formatDay(last)}`;
  if (y1 === y2) return `${d1} ${MONTHS[m1 - 1]} to ${formatDay(last)}`;
  return `${formatDay(first)} to ${formatDay(last)}`;
}

/** What every overlay says about itself where it is drawn (docs/WEB_FEATURES_BRIEF.md, rule "Honest data"). */
export const OVERLAY_NOT_NISAR =
  'From another source, not a NISAR measurement. A dot marks a reported location; its size on screen is not a size on the ground.';

/**
 * The caption of an overlay: its title, the period and the number of points drawn, or that it has
 * no data for the period (never a number then).
 */
export function overlayCaption(title: string, window: OverlayWindow, count: number): string {
  if (window.kind === 'none')
    return `${title}: no data ${window.wanted.last === null ? '' : 'for '}${formatPeriod(window.wanted)} (this overlay covers ${formatPeriod({ first: window.range[0], last: window.range[1] })})`;
  if (window.kind === 'all')
    return window.range ? `${title}, ${formatPeriod({ first: window.range[0], last: window.range[1] })}: ${count}` : `${title}, all points: ${count}`;
  const text = `${title}, ${formatPeriod(window.used)}: ${count}`;
  if (!window.rangeKnown) return `${text}. The file does not say which dates it covers.`;
  const { clippedStart, clippedEnd, used } = window;
  if (clippedStart && clippedEnd) return `${text}. This overlay's data start on ${formatDay(used.first)} and end on ${formatDay(used.last!)}.`;
  if (clippedStart) return `${text}. This overlay's data start on ${formatDay(used.first)}.`;
  if (clippedEnd) return `${text}. This overlay's data end on ${formatDay(used.last!)}.`;
  return text;
}
