// Which drawn overlay point a click (or "Read values at the map centre") is about. Pure: distances
// are measured in screen pixels of a north-up Web Mercator map at the given zoom, MapLibre's
// 512-pixel world, so no map is needed to test it.

import { MAX_MAP_LATITUDE } from './geo';

/** How far from the click a point may be, in screen pixels, and still be read. */
export const POINT_REACH_PX = 12;

const WORLD_PX = 512;

/** Web Mercator y of a latitude, as a fraction of the world (0 at the top). */
function mercatorY(lat: number): number {
  const clamped = Math.max(-MAX_MAP_LATITUDE, Math.min(MAX_MAP_LATITUDE, lat));
  const s = Math.sin((clamped * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
}

/** Screen pixels between two places at a zoom, the short way round the 180th meridian. */
export function pixelDistance(a: { lon: number; lat: number }, b: { lon: number; lat: number }, zoom: number): number {
  const world = WORLD_PX * 2 ** zoom;
  let dLon = (((b.lon - a.lon) % 360) + 360) % 360;
  if (dLon > 180) dLon -= 360;
  const dx = (dLon / 360) * world;
  const dy = (mercatorY(b.lat) - mercatorY(a.lat)) * world;
  return Math.hypot(dx, dy);
}

export interface NearestPoint<P> {
  /** The nearest point within reach (on a tie, the first in the list). */
  point: P;
  /** How many points are within reach, the nearest included. */
  withinReach: number;
}

/**
 * The point of `points` nearest to `target` within `reachPx` screen pixels at `zoom`, and how many
 * are within reach; null when none is.
 */
export function nearestPoint<P extends { lon: number; lat: number }>(
  target: { lon: number; lat: number },
  points: readonly P[],
  zoom: number,
  reachPx = POINT_REACH_PX,
): NearestPoint<P> | null {
  let best: P | null = null;
  let bestDistance = Infinity;
  let withinReach = 0;
  for (const p of points) {
    const d = pixelDistance(target, p, zoom);
    if (d > reachPx) continue;
    withinReach += 1;
    if (d < bestDistance) {
      best = p;
      bestDistance = d;
    }
  }
  return best ? { point: best, withinReach } : null;
}
