// Loading an overlay's file (docs/DATA_CONTRACT.md, "Overlays"): a GeoJSON FeatureCollection of
// Point features, [longitude, latitude] in EPSG:4326. The browser loads the whole file, once.

import type { Overlay } from './manifest';
import { isDay } from '../state/overlayPeriod';

export type { Overlay };

/** One point of an overlay, as the app uses it. */
export interface OverlayPoint {
  /** Position among the points kept, in file order; also the point's feature id on the map. */
  index: number;
  lon: number;
  lat: number;
  /** The point's UTC day from the overlay's date_property, or null when it is missing or not YYYY-MM-DD. */
  day: string | null;
  /** The feature's properties, as in the file. */
  properties: Record<string, unknown>;
}

export interface LoadedOverlay {
  points: OverlayPoint[];
  /** Features that are not Points with two finite coordinates: counted, never drawn. */
  skipped: number;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The point a GeoJSON feature holds, or null when it is not a Point with two finite coordinates. */
function pointOf(feature: unknown): { lon: number; lat: number; properties: Record<string, unknown> } | null {
  if (!isObject(feature) || feature.type !== 'Feature' || !isObject(feature.geometry) || feature.geometry.type !== 'Point') return null;
  const c = feature.geometry.coordinates;
  // A position may carry an elevation as a third number; the app uses the first two.
  if (!Array.isArray(c) || c.length < 2 || c.length > 3) return null;
  const [lon, lat] = c as unknown[];
  if (typeof lon !== 'number' || typeof lat !== 'number' || !Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 90) return null;
  return { lon, lat, properties: isObject(feature.properties) ? feature.properties : {} };
}

/** Check a parsed overlay file and keep its points. Throws an Error whose message is fit to show a person. */
export function readOverlay(json: unknown, dateProperty: string | undefined): LoadedOverlay {
  if (!isObject(json) || json.type !== 'FeatureCollection' || !Array.isArray(json.features))
    throw new Error('The file of this overlay is not a GeoJSON FeatureCollection, so nothing is drawn.');
  const points: OverlayPoint[] = [];
  let skipped = 0;
  for (const feature of json.features) {
    const p = pointOf(feature);
    if (!p) {
      skipped += 1;
      continue;
    }
    const day = dateProperty === undefined ? null : p.properties[dateProperty];
    points.push({ index: points.length, ...p, day: isDay(day) ? day : null });
  }
  return { points, skipped };
}

/** Fetch an overlay's file and keep its points. Throws an Error whose message is fit to show a person. */
export async function loadOverlay(href: string, dateProperty: string | undefined, fetchFn: typeof fetch = fetch): Promise<LoadedOverlay> {
  let response: Response;
  try {
    response = await fetchFn(href, { cache: 'no-cache' });
  } catch {
    throw new Error('Could not reach the file of this overlay. Check the network connection.');
  }
  if (!response.ok) throw new Error(`Could not load the file of this overlay (HTTP ${response.status}), so nothing is drawn.`);
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new Error('The file of this overlay is not valid JSON, so nothing is drawn.');
  }
  return readOverlay(json, dateProperty);
}
