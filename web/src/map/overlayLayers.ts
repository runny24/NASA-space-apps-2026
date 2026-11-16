// Overlays on the map: one GeoJSON source and one circle layer per overlay that is switched on, in
// the overlay's colour with a dark outline, a fixed size in screen pixels (a dot marks a reported
// place; its size says nothing about a size on the ground), no animation. The period is a layer
// filter on each point's checked day, built from the same OverlayWindow as the caption's count
// (state/overlayPeriod.ts). Each source carries the overlay's credit as its attribution, so the
// credit is in the map's credit line whenever the overlay is drawn and gone when it is switched off.
//
// MapLibre comes only through the map instance passed in; where the circles go in the stack of
// layers is decided by map/layerOrder.ts, which the data layers use too.

import type { FilterSpecification, Map as MapLibreMap } from 'maplibre-gl';
import type { LoadedOverlay, OverlayPoint } from '../contract/overlay';
import type { OverlayWindow } from '../state/overlayPeriod';
import { OVERLAY_LAYER_PREFIX, beforeIdFor } from './layerOrder';

/**
 * The colour of an overlay whose manifest gives none: a strong violet-magenta, not a grey (it never
 * matches a pixel of a grey radar picture), neither red nor green, and apart from every shade of the
 * grey ramp for red-green colour blindness too (tests/unit/colours.test.ts).
 */
export const DEFAULT_OVERLAY_COLOR = '#c000ff';
/** The dots' outline, dark so that a light dot reads on a bright radar pixel. */
export const OVERLAY_OUTLINE_COLOR = '#1b1f24';

/**
 * The property the app gives each point on the map: its day when the file gives a valid
 * YYYY-MM-DD date, absent otherwise. The filter compares it as text, which orders such days.
 */
export const DAY_KEY = 'app:day';

/** The map source and layer id of an overlay. */
export const overlayMapId = (overlayId: string) => `${OVERLAY_LAYER_PREFIX}${overlayId}`;

/** The GeoJSON the map draws: every point kept, its feature id its index, its checked day added. */
export function overlaySourceData(points: readonly OverlayPoint[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: points.map((p) => {
      // A property of the file with the same name never stands in for the checked day.
      const properties: Record<string, unknown> = { ...p.properties };
      delete properties[DAY_KEY];
      if (p.day !== null) properties[DAY_KEY] = p.day;
      return { type: 'Feature', id: p.index, geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties };
    }),
  };
}

/**
 * The layer filter of a window: null draws every point, false none, and a dated window the points
 * whose day lies in its period (both ends included). Same rule as pointInWindow.
 */
export function overlayFilter(window: OverlayWindow): FilterSpecification | null {
  if (window.kind === 'all') return null;
  if (window.kind === 'none') return false;
  const day: FilterSpecification = ['to-string', ['get', DAY_KEY]] as unknown as FilterSpecification;
  const { first, last } = window.used;
  return [
    'all',
    ['has', DAY_KEY],
    ['>=', day, first],
    ...(last === null ? [] : [['<=', day, last]]),
  ] as unknown as FilterSpecification;
}

/** The circles' paint: a fixed size in screen pixels that grows a little with the zoom, no transitions. */
export function overlayPaint(color: string) {
  const still = { duration: 0, delay: 0 };
  return {
    'circle-color': color,
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 4, 14, 6.5],
    'circle-stroke-color': OVERLAY_OUTLINE_COLOR,
    'circle-stroke-width': 1.5,
    'circle-opacity': 1,
    'circle-color-transition': still,
    'circle-radius-transition': still,
    'circle-stroke-width-transition': still,
    'circle-opacity-transition': still,
  };
}

/** What the map draws of one overlay. `data` keeps its identity while the file stays the same. */
export interface OverlayOnMap {
  id: string;
  data: GeoJSON.FeatureCollection<GeoJSON.Point>;
  color: string;
  credit: string;
  filter: FilterSpecification | null;
}

export class OverlayController {
  private shown = new Map<string, { data: OverlayOnMap['data']; color: string; credit: string; filter: string }>();

  constructor(private readonly map: MapLibreMap) {}

  /** Make the map draw exactly `overlays`. */
  set(overlays: readonly OverlayOnMap[]): void {
    const wanted = new Set(overlays.map((o) => o.id));
    for (const id of [...this.shown.keys()]) if (!wanted.has(id)) this.remove(id);
    for (const o of overlays) {
      const id = overlayMapId(o.id);
      const filter = JSON.stringify(o.filter);
      const now = this.shown.get(o.id);
      if (now && now.data === o.data && now.color === o.color && now.credit === o.credit) {
        if (now.filter !== filter) {
          this.map.setFilter(id, o.filter);
          now.filter = filter;
        }
        continue;
      }
      if (now) this.remove(o.id);
      this.map.addSource(id, { type: 'geojson', data: o.data, attribution: o.credit });
      this.map.addLayer(
        {
          id,
          type: 'circle',
          source: id,
          ...(o.filter === null ? {} : { filter: o.filter }),
          paint: overlayPaint(o.color) as never,
        },
        beforeIdFor('overlay', this.map.getStyle().layers),
      );
      this.shown.set(o.id, { data: o.data, color: o.color, credit: o.credit, filter });
    }
  }

  private remove(overlayId: string): void {
    const id = overlayMapId(overlayId);
    if (this.map.getLayer(id)) this.map.removeLayer(id);
    if (this.map.getSource(id)) this.map.removeSource(id);
    this.shown.delete(overlayId);
  }

  /** Remove every overlay (the map is going away, or the place changed). */
  dispose(): void {
    for (const id of [...this.shown.keys()]) this.remove(id);
  }
}

const mapData = new WeakMap<LoadedOverlay, OverlayOnMap['data']>();

/** overlaySourceData of a loaded file, made once per file, so the map is not handed the points again. */
export function overlayMapData(loaded: LoadedOverlay): OverlayOnMap['data'] {
  let data = mapData.get(loaded);
  if (!data) {
    data = overlaySourceData(loaded.points);
    mapData.set(loaded, data);
  }
  return data;
}
