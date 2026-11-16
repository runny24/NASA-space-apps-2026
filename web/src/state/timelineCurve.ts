// The year as a curve above the timeline's marks (docs/MOTION_AND_STORY_BRIEF.md, slice 5): the
// layer's series as a dot per pass on the same true time axis as the marks. Pure, no React, so the
// honesty rule is unit-tested: a segment joins two passes only when they follow each other on the
// timeline. Where a pass is missing, the layer has no file for a date, or the value is null, the
// line breaks; a line across the gap would invent a pass that does not exist.
//
// Also here: which series the curve draws for a layer (curveSeries), which passes the story's curve
// may show while a picture is on the map (revealedItems: never one later than the picture drawn),
// and the month names under the axis (monthTicks, from a fixed English list, never a locale).

import type { Layer } from '../contract/manifest';
import type { StatsSeries } from '../contract/stats';
import { isDay } from './overlayPeriod';
import { dayNumber, type TimelineEntry } from './timeline';

/** One pass of the curve: its date, the layer's item, where it sits (0 to 1 both ways) and its value. */
export interface CurvePoint {
  date: string;
  itemIndex: number;
  /** The entry's position on the timeline: 0 (first entry) to 1 (last), proportional to time. */
  x: number;
  /** 0 at the lowest value of the curve, 1 at the highest (0.5 when every value is the same). */
  y: number;
  value: number;
}

/** The dots and the unbroken segments of the curve, and the values its y runs between. */
export interface TimelineCurve {
  points: CurvePoint[];
  /** Pairs of points whose entries are neighbours on the timeline: nothing lies between them. */
  segments: [CurvePoint, CurvePoint][];
  min: number;
  max: number;
}

/**
 * The curve of `series` over the timeline `entries` (state/timeline.ts, buildTimeline, which lists
 * missing passes and dates the layer lacks as entries of their own): a point for every available
 * entry whose date has a finite value in the series (the first it gives for that date), and a
 * segment between two points only when their entries are next to each other. Null when fewer than
 * two points have a value.
 */
export function timelineCurve(entries: TimelineEntry[], series: readonly { date: string; value: number | null }[]): TimelineCurve | null {
  const values = new Map<string, number>();
  for (const p of series) if (typeof p.value === 'number' && Number.isFinite(p.value) && !values.has(p.date)) values.set(p.date, p.value);

  const found: { at: number; date: string; itemIndex: number; x: number; value: number }[] = [];
  entries.forEach((entry, at) => {
    const value = values.get(entry.date);
    if (entry.status !== 'available' || entry.itemIndex === undefined || value === undefined) return;
    found.push({ at, date: entry.date, itemIndex: entry.itemIndex, x: entry.position, value });
  });
  if (found.length < 2) return null;

  const min = Math.min(...found.map((p) => p.value));
  const max = Math.max(...found.map((p) => p.value));
  const points = found.map(({ date, itemIndex, x, value }): CurvePoint => ({ date, itemIndex, x, y: max === min ? 0.5 : (value - min) / (max - min), value }));
  const segments: [CurvePoint, CurvePoint][] = [];
  found.forEach((p, i) => {
    const next = found[i + 1];
    const a = points[i];
    const b = points[i + 1];
    if (next && a && b && next.at === p.at + 1) segments.push([a, b]);
  });
  return { points, segments, min, max };
}

/**
 * `curve` with only the passes shown so far: the points whose item is in `shownItemIndexes`, and
 * the segments whose two ends both are. Whole points and whole segments appear, never part of a
 * line; `min`, `max` and every coordinate stay as they are, so nothing moves as points appear.
 */
export function revealedCurve(curve: TimelineCurve, shownItemIndexes: ReadonlySet<number>): TimelineCurve {
  return {
    points: curve.points.filter((p) => shownItemIndexes.has(p.itemIndex)),
    segments: curve.segments.filter(([a, b]) => shownItemIndexes.has(a.itemIndex) && shownItemIndexes.has(b.itemIndex)),
    min: curve.min,
    max: curve.max,
  };
}

/** The unit of the series the curve draws: backscatter in decibels, as the layers on the map. */
export const CURVE_UNIT = 'dB';

/**
 * The series the year's curve draws for `layer`: the first series of the site's statistics whose
 * `layer` is the layer's id and whose unit is dB (hh-mean for hh, hv-mean for hv). Null for a layer
 * that is not per-date, while the statistics are not loaded (or could not be), and when no series
 * qualifies: then there is no curve, and nothing else changes.
 */
export function curveSeries(
  stats: { series: readonly StatsSeries[] } | null | undefined,
  layer: Pick<Layer, 'id' | 'kind'> | null | undefined,
): StatsSeries | null {
  if (!stats || !layer || layer.kind !== 'per-date') return null;
  return stats.series.find((s) => s.layer === layer.id && s.unit === CURVE_UNIT) ?? null;
}

/** The picture on the map as the map reports it (map/dataLayers.ts, PictureOnMap). */
export interface DrawnPicture {
  layer: Pick<Layer, 'id' | 'items'>;
  index: number;
  /** Its file could not be loaded: the map shows no picture for it. */
  failed: boolean;
}

/** The item of `layer` whose picture the map has drawn: null when `drawn` is none, failed, or of another layer. */
export function drawnItemOf(layer: Pick<Layer, 'id'>, drawn: DrawnPicture | null): number | null {
  if (!drawn || drawn.failed || drawn.layer.id !== layer.id) return null;
  return drawn.index;
}

/**
 * The items of `layer` whose passes a curve may show while `drawn` is the picture on the map: every
 * item dated on or before the date of the picture drawn, when that picture is of this layer and was
 * drawn (it did not fail). Otherwise none: no point is ever later than the picture on the map, and
 * while the map shows another layer, no picture or a failed one, the curve shows no point at all.
 * Give the result to revealedCurve: whole points and whole segments, as each picture is drawn.
 */
export function revealedItems(layer: Pick<Layer, 'id' | 'items'>, drawn: DrawnPicture | null): Set<number> {
  const shown = new Set<number>();
  const index = drawnItemOf(layer, drawn);
  const until = index === null ? undefined : drawn?.layer.items[index]?.date;
  if (!isDay(until)) return shown;
  layer.items.forEach((item, i) => {
    if (isDay(item.date) && item.date <= until) shown.add(i);
  });
  return shown;
}

/** Month names from a fixed English list: the app writes dates the same on every machine (no locale). */
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** At most this many month names under a curve, so that they never crowd on a phone. */
export const MAX_MONTH_LABELS = 6;

/** A month the axis covers at least this share of is named (its name then fits inside it). */
const NAMED_SHARE = 2 / 3;

/** Every this many months, when there are more months to name than MAX_MONTH_LABELS. */
const MONTH_STRIDES = [1, 2, 3, 4, 6, 12];

/** One month named under the axis, at its true place on it. */
export interface MonthTick {
  /** The month, YYYY-MM. */
  month: string;
  /** Its name, from MONTH_NAMES. */
  label: string;
  /** Where the part of the month the axis covers begins and ends (0 is the first entry, 1 the last). */
  start: number;
  end: number;
  /** Where the name's centre sits: the middle of that part. */
  x: number;
}

/**
 * Month names under the axis of `entries` (state/timeline.ts: 0 at the first entry's date, 1 at the
 * last's, proportional to time), each centred on the part of its month that the axis covers. A
 * month the axis covers less than two thirds of is not named (its name would stick out of it). With
 * more months to name than `maxLabels`, every second (third, fourth, sixth, twelfth) month is named,
 * counted from the first one named (on a span of many years, whole years apart). Written from
 * MONTH_NAMES, never with a locale.
 */
export function monthTicks(entries: readonly Pick<TimelineEntry, 'date'>[], maxLabels = MAX_MONTH_LABELS): MonthTick[] {
  const dates = entries.map((e) => e.date).filter(isDay).sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (first === undefined || last === undefined) return [];
  const d0 = dayNumber(first);
  const d1 = dayNumber(last);
  const span = d1 - d0;
  const at = (day: number) => (span === 0 ? 0.5 : (day - d0) / span);

  const candidates: MonthTick[] = [];
  let [year, month] = first.split('-').map(Number) as [number, number];
  const [lastYear, lastMonth] = last.split('-').map(Number) as [number, number];
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    const begins = Date.UTC(year, month - 1, 1) / 86_400_000;
    const ends = Date.UTC(year, month, 1) / 86_400_000;
    const a = Math.max(begins, d0);
    const b = Math.min(ends, d1);
    if (span === 0 || (b - a) / (ends - begins) >= NAMED_SHARE) {
      const name = MONTH_NAMES[month - 1] ?? '';
      const tick = { month: `${year}-${String(month).padStart(2, '0')}`, label: name, start: at(a), end: at(b) };
      candidates.push({ ...tick, x: (tick.start + tick.end) / 2 });
    }
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  const most = Math.max(1, maxLabels);
  // Beyond a name a year, whole years apart.
  const stride = MONTH_STRIDES.find((s) => Math.ceil(candidates.length / s) <= most) ?? 12 * Math.ceil(candidates.length / (12 * most));
  return candidates.filter((_, i) => i % stride === 0);
}
