// Small coordinate helpers shared by the URL parser and the map.

/** The highest latitude a Web Mercator map can show; MapLibre refuses to centre beyond it. */
export const MAX_MAP_LATITUDE = 85.051129;

/** MapLibre's zoom range. */
export const MIN_ZOOM = 0;
export const MAX_ZOOM = 22;

/**
 * Longitude brought into [-180, 180]. A map can be panned onto a neighbouring copy of the world,
 * where it reports longitudes such as 242; files and the stack lookup only know [-180, 180].
 * Same rule as MapLibre's LngLat.wrap(): -180 becomes 180.
 */
export function wrapLongitude(lon: number): number {
  // Leave ordinary longitudes exactly as they are (the arithmetic below would add rounding noise).
  if (lon > -180 && lon <= 180) return lon;
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}
