// The timeline for a per-date layer: real acquisitions and missing passes on one time axis.
// The app never invents a calendar: every mark comes from the manifest (docs/DATA_CONTRACT.md, "Dates").

import type { Layer, Site } from '../contract/manifest';

export type TimelineStatus =
  /** An acquisition with a file in this layer: can be shown. */
  | 'available'
  /** An acquisition of the site that this layer has no file for. */
  | 'not-in-layer'
  /** A pass the repeat cycle predicts but that has no usable product (from missing_passes). */
  | 'missing';

export interface TimelineEntry {
  date: string;
  status: TimelineStatus;
  /** Why the pass is missing (only for 'missing'). */
  reason?: string;
  /** Index into layer.items (only for 'available'). */
  itemIndex?: number;
  /** Position along the axis, 0 (first entry) to 1 (last entry), proportional to time. */
  position: number;
}

/** Whole days since 1970-01-01 for a YYYY-MM-DD date (UTC, so no time-zone surprises). */
export function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000;
}

export function buildTimeline(site: Pick<Site, 'dates' | 'missing_passes'>, layer: Pick<Layer, 'items'>): TimelineEntry[] {
  const byDate = new Map<string, Omit<TimelineEntry, 'position'>>();
  for (const acq of site.dates) byDate.set(acq.date, { date: acq.date, status: 'not-in-layer' });
  layer.items.forEach((item, itemIndex) => {
    if (item.date) byDate.set(item.date, { date: item.date, status: 'available', itemIndex });
  });
  for (const miss of site.missing_passes)
    if (!byDate.has(miss.date)) byDate.set(miss.date, { date: miss.date, status: 'missing', reason: miss.reason });
  const entries = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const first = entries[0];
  const last = entries[entries.length - 1];
  if (!first || !last) return [];
  const span = dayNumber(last.date) - dayNumber(first.date);
  return entries.map((e) => ({ ...e, position: span === 0 ? 0.5 : (dayNumber(e.date) - dayNumber(first.date)) / span }));
}

/**
 * The item index `delta` steps away from `currentItemIndex`, moving only between available dates
 * in date order (missing passes are skipped, never shown as pictures). Stops at the ends rather
 * than wrapping, so "next" on the latest date does nothing. Returns -1 when nothing is available.
 */
export function stepDate(entries: TimelineEntry[], currentItemIndex: number, delta: number): number {
  const order = entries.flatMap((e) => (e.status === 'available' && e.itemIndex !== undefined ? [e.itemIndex] : []));
  if (order.length === 0) return -1;
  const at = order.indexOf(currentItemIndex);
  if (at === -1) return order[order.length - 1] ?? -1;
  return order[Math.min(order.length - 1, Math.max(0, at + delta))] ?? -1;
}
