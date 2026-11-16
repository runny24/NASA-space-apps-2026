// What the app shows about each overlay that is switched on (the captions, the legend, the dots
// and the reading at a point), from its file's state and what is on screen. Pure functions over
// state/overlayPeriod.ts; the components only lay these out.

import type { Layer, Overlay } from '../contract/manifest';
import type { LoadedOverlay, OverlayPoint } from '../contract/overlay';
import { capWindow, overlayCaption, overlayWindow, pointsInWindow, undatedLeftOut, type OverlayCap, type OverlayWindow } from './overlayPeriod';

/** An overlay's file as the app has it: loading, failed (with a sentence for a person), or loaded. */
export type OverlayLoad = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; loaded: LoadedOverlay };

/** Everything the app shows about one overlay that is switched on. */
export interface OverlayView {
  overlay: Overlay;
  /** The dots' colour: the overlay's, or the app's default. */
  color: string;
  status: OverlayLoad['status'];
  /** The caption (period and count, or no data, or that it is loading); null when the file failed. */
  caption: string | null;
  /** Why the file could not be used; null unless it failed. */
  error: string | null;
  /** The window the caption, the drawn points and the map's filter all come from (capped, when a cap was given). */
  window: OverlayWindow;
  /** The points the map draws now (none until loaded). */
  drawn: OverlayPoint[];
  /** Points left out of the dated period because their date is missing or not YYYY-MM-DD. */
  undated: number;
  /** Features of the file that are not points and are never drawn. */
  skipped: number;
}

/**
 * What to show for `overlay` with item `itemIndex` of `layer` on screen. With `cap` (the story
 * building a period day by day), everything is computed from the capped window (capWindow), and
 * that is the window returned, so the map's filter follows the caption's count.
 */
export function overlayView(
  overlay: Overlay,
  load: OverlayLoad | undefined,
  layer: Layer | null,
  itemIndex: number,
  defaultColor: string,
  cap?: OverlayCap | null,
): OverlayView {
  const window = capWindow(overlayWindow(overlay, layer, itemIndex), cap);
  const base = { overlay, color: overlay.color ?? defaultColor, window, drawn: [] as OverlayPoint[], undated: 0, skipped: 0 };
  if (!load || load.status === 'loading') return { ...base, status: 'loading', caption: `Loading ${overlay.title}…`, error: null };
  if (load.status === 'error') return { ...base, status: 'error', caption: null, error: load.message };
  const { points, skipped } = load.loaded;
  const drawn = pointsInWindow(points, window);
  return {
    ...base,
    status: 'ready',
    caption: overlayCaption(overlay.title, window, drawn.length),
    error: null,
    drawn,
    undated: undatedLeftOut(points, window),
    skipped,
  };
}

/** What the "At a point" panel lists for a point of an overlay. */
export interface OverlayReading {
  overlayId: string;
  title: string;
  /** The overlay's fields in the manifest's order: a label and the value with its unit. */
  rows: { label: string; value: string }[];
  /** How many drawn points of this overlay were within reach (the one shown is the nearest). */
  withinReach: number;
}

/** What a point is missing reads as this: never empty, never 0. */
export const NOT_AVAILABLE = 'not available';

/** A property's value as text with its unit, or NOT_AVAILABLE when the point lacks it. */
export function fieldText(value: unknown, unit: string | undefined): string {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) return NOT_AVAILABLE;
  if (typeof value === 'number' && !Number.isFinite(value)) return NOT_AVAILABLE;
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return unit ? `${text} ${unit}` : text;
}

/** The reading of `point` of `overlay`, its fields in the manifest's order. */
export function pointReading(overlay: Overlay, point: OverlayPoint, withinReach: number): OverlayReading {
  return {
    overlayId: overlay.id,
    title: overlay.title,
    rows: (overlay.fields ?? []).map((f) => ({ label: f.label, value: fieldText(point.properties[f.name], f.unit) })),
    withinReach,
  };
}
