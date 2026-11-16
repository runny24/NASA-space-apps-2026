// The three things the story draws on the map that are not data (docs/MOTION_AND_STORY_BRIEF.md,
// section 5 "The night map" and slice 2; web/MOTION.md, rules 6 to 8): the night laid over the
// basemap, the outline of the site, and the ring that marks the site on the cover. story/stage.ts
// calls these; nothing else does.
//
// - They are interface, not data. No data layer is touched (no raster-* paint), and none of them
//   uses a data colour (the fire dots' #d55e00, the classes' viridis): the ring is the app's amber,
//   "where you are", and the outline is white.
// - Every id starts with "story-" (STORY_PREFIX in stage.ts; a unit test pins it), so
//   removeStoryLayers removes them all and the end-to-end helpers never take one for a picture
//   (those count the sources whose id starts with "data-").
// - Only paint properties move (an opacity, the radius of the ring's echo), through MapLibre's own
//   transitions. With a duration of 0 (the person asked for reduced motion) each is set at once.
// - The style URL is never changed and setStyle is never called: it would drop every data layer.
// - Every function can be called twice, and the ones that keep a timer give back a function that
//   drops it, so a step or the whole story can be left at any moment.

import type { DataDrivenPropertyValueSpecification, Map as MapLibreMap } from 'maplibre-gl';
import { DATA_LAYER_PREFIX, STORY_LAYER_PREFIX, STORY_NIGHT_LAYER, beforeIdFor } from '../map/layerOrder';

/** Under the data (map/layerOrder.ts keeps every raster above it); the three below lie over the data. */
export const NIGHT_LAYER = STORY_NIGHT_LAYER;
export const OUTLINE_LAYER = 'story-outline';
export const RING_LAYER = 'story-site';
export const RING_ECHO_LAYER = 'story-site-echo';

/** Every layer id this file adds (sources carry the same ids), for stage.ts and the tests. */
export const STAGE_LAYER_IDS = [NIGHT_LAYER, OUTLINE_LAYER, RING_LAYER, RING_ECHO_LAYER] as const;

/** The basemap's place names while it is night: light text with a dark edge. */
const LABEL_TEXT = '#d7dee6';
const LABEL_HALO = 'rgba(11,16,22,0.85)';
/** The app's amber (--focus, --story-accent): where you are. Never a data colour. */
const RING_COLOUR = '#ffb000';
const OUTLINE_COLOUR = '#ffffff';

const RING_RADIUS_PX = 11;
const RING_ECHO_RADIUS_PX = 36;
const RING_ECHO_MS = 900;
/** Between two echoes; also the frame the map needs to take the reset before the next one starts. */
const RING_ECHO_GAP_MS = 160;

/** A label colour as a style holds it (a colour or an expression); undefined: the style's own default. */
type LabelColour = DataDrivenPropertyValueSpecification<string> | undefined;

const transition = (durationMs: number) => ({ duration: Math.max(0, durationMs), delay: 0 });

/** What night remembers about one map, so that lifting it puts back exactly what was there. */
interface Night {
  /** The label colours of each basemap symbol layer before night fell (undefined: the style's default). */
  labels: Map<string, { color: LabelColour; halo: LabelColour }>;
  /** Removes the night layer once it has faded out. */
  lift: ReturnType<typeof setTimeout> | null;
}
const nights = new WeakMap<MapLibreMap, Night>();

function nightOf(map: MapLibreMap): Night {
  let night = nights.get(map);
  if (!night) {
    night = { labels: new Map(), lift: null };
    nights.set(map, night);
  }
  return night;
}

/** Whether a symbol layer draws its text on an icon of its own (a road shield): both an icon and a text. */
function drawnOnIcon(map: MapLibreMap, id: string): boolean {
  const icon = map.getLayoutProperty(id, 'icon-image') as unknown;
  const text = map.getLayoutProperty(id, 'text-field') as unknown;
  return icon !== undefined && icon !== null && icon !== '' && text !== undefined && text !== null && text !== '';
}

/**
 * Night falls: one `background` layer over the basemap's fills and lines and under every data
 * raster (it goes before the first `data-` layer, or where a data layer would go when there is none
 * yet; data layers added later land above it by themselves), fading in over `durationMs`; and the
 * basemap's labels turn light so they stay readable (a label drawn on a shield of its own keeps its
 * colours). The data keeps its exact colours.
 */
export function fallNight(map: MapLibreMap, look: { color: string; opacity: number }, durationMs: number): void {
  const night = nightOf(map);
  if (night.lift !== null) clearTimeout(night.lift);
  night.lift = null;
  const layers = map.getStyle()?.layers ?? [];
  if (map.getLayer(NIGHT_LAYER)) {
    map.setPaintProperty(NIGHT_LAYER, 'background-opacity-transition', transition(durationMs));
  } else {
    const firstData = layers.find((l) => l.id.startsWith(DATA_LAYER_PREFIX));
    map.addLayer(
      {
        id: NIGHT_LAYER,
        type: 'background',
        paint: { 'background-color': look.color, 'background-opacity': 0, 'background-opacity-transition': transition(durationMs) },
      },
      firstData?.id ?? beforeIdFor('data', layers),
    );
  }
  map.setPaintProperty(NIGHT_LAYER, 'background-opacity', look.opacity);
  for (const layer of layers) {
    if (layer.type !== 'symbol' || layer.id.startsWith(STORY_LAYER_PREFIX) || night.labels.has(layer.id)) continue;
    // A label drawn on its own icon (a road shield such as NH54: dark text on a white shield) keeps
    // its own colours: light text would be white on white. Only labels that lie on the map turn light.
    if (drawnOnIcon(map, layer.id)) continue;
    night.labels.set(layer.id, {
      color: map.getPaintProperty(layer.id, 'text-color') as LabelColour,
      halo: map.getPaintProperty(layer.id, 'text-halo-color') as LabelColour,
    });
    map.setPaintProperty(layer.id, 'text-color', LABEL_TEXT);
    map.setPaintProperty(layer.id, 'text-halo-color', LABEL_HALO);
  }
}

/**
 * Night lifts: the labels get their own colours back at once, and the night layer fades out over
 * `durationMs` and is then removed (at once when it is 0). Falling again before that keeps the layer.
 */
export function liftNight(map: MapLibreMap, durationMs: number): void {
  const night = nightOf(map);
  for (const [id, was] of night.labels) {
    if (!map.getLayer(id)) continue;
    // undefined puts back the style's own default where the layer had set none.
    map.setPaintProperty(id, 'text-color', was.color);
    map.setPaintProperty(id, 'text-halo-color', was.halo);
  }
  night.labels.clear();
  if (night.lift !== null) clearTimeout(night.lift);
  night.lift = null;
  if (!map.getLayer(NIGHT_LAYER)) return;
  if (durationMs <= 0) {
    map.removeLayer(NIGHT_LAYER);
    return;
  }
  map.setPaintProperty(NIGHT_LAYER, 'background-opacity-transition', transition(durationMs));
  map.setPaintProperty(NIGHT_LAYER, 'background-opacity', 0);
  night.lift = setTimeout(() => {
    night.lift = null;
    try {
      if (map.getLayer(NIGHT_LAYER)) map.removeLayer(NIGHT_LAYER);
    } catch {
      // The map itself is gone (the page is closing): there is nothing left to remove.
    }
  }, durationMs + 60);
}

/** Whether night is on this map now (fallen, or still lifting). */
export const isNight = (map: MapLibreMap): boolean => map.getLayer(NIGHT_LAYER) !== undefined;

/**
 * The site's outline: a thin white line round its bounds, above the data and under the place
 * names, fading in over `durationMs`. It frames the picture on the night map; it says nothing
 * about the data.
 */
export function showOutline(map: MapLibreMap, bounds: readonly [number, number, number, number], durationMs: number): void {
  if (map.getLayer(OUTLINE_LAYER)) return;
  const [w, s, e, n] = bounds;
  if (!map.getSource(OUTLINE_LAYER)) {
    map.addSource(OUTLINE_LAYER, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [
            [w, s],
            [e, s],
            [e, n],
            [w, n],
            [w, s],
          ],
        },
      },
    });
  }
  map.addLayer(
    {
      id: OUTLINE_LAYER,
      type: 'line',
      source: OUTLINE_LAYER,
      paint: { 'line-color': OUTLINE_COLOUR, 'line-width': 1.5, 'line-opacity': 0, 'line-opacity-transition': transition(durationMs) },
    },
    beforeIdFor('overlay', map.getStyle()?.layers ?? []),
  );
  map.setPaintProperty(OUTLINE_LAYER, 'line-opacity', 1);
}

export function hideOutline(map: MapLibreMap): void {
  if (map.getLayer(OUTLINE_LAYER)) map.removeLayer(OUTLINE_LAYER);
  if (map.getSource(OUTLINE_LAYER)) map.removeSource(OUTLINE_LAYER);
}

/**
 * The ring that marks the site on the cover, where the site itself is a few pixels: a circle with
 * a stroke and no fill, in the app's amber. With `echoes` above 0 a second ring spreads from it and
 * fades that many times and is then removed; the ring itself stays still. The function returned
 * stops the echoes early (hideRing does that too).
 */
export function showRing(map: MapLibreMap, center: readonly [number, number], echoes: number): () => void {
  hideRing(map);
  const before = beforeIdFor('overlay', map.getStyle()?.layers ?? []);
  map.addSource(RING_LAYER, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [center[0], center[1]] } } });
  map.addLayer(
    {
      id: RING_LAYER,
      type: 'circle',
      source: RING_LAYER,
      paint: { 'circle-radius': RING_RADIUS_PX, 'circle-opacity': 0, 'circle-stroke-width': 2, 'circle-stroke-color': RING_COLOUR, 'circle-stroke-opacity': 1 },
    },
    before,
  );
  if (echoes <= 0) return () => undefined;

  map.addLayer(
    {
      id: RING_ECHO_LAYER,
      type: 'circle',
      source: RING_LAYER,
      paint: { 'circle-radius': RING_RADIUS_PX, 'circle-opacity': 0, 'circle-stroke-width': 2, 'circle-stroke-color': RING_COLOUR, 'circle-stroke-opacity': 0 },
    },
    before,
  );
  let timer: ReturnType<typeof setTimeout> | null = null;
  let left = echoes;
  const removeEcho = () => {
    try {
      if (map.getLayer(RING_ECHO_LAYER)) map.removeLayer(RING_ECHO_LAYER);
    } catch {
      // The map itself is gone: nothing left to remove.
    }
  };
  const set = (durationMs: number, radius: number, opacity: number) => {
    map.setPaintProperty(RING_ECHO_LAYER, 'circle-radius-transition', transition(durationMs));
    map.setPaintProperty(RING_ECHO_LAYER, 'circle-stroke-opacity-transition', transition(durationMs));
    map.setPaintProperty(RING_ECHO_LAYER, 'circle-radius', radius);
    map.setPaintProperty(RING_ECHO_LAYER, 'circle-stroke-opacity', opacity);
  };
  // One echo: back to the ring at once, then, a frame later, spread and fade.
  const echo = () => {
    timer = null;
    try {
      if (!map.getLayer(RING_ECHO_LAYER)) return;
      if (left <= 0) return removeEcho();
      left -= 1;
      set(0, RING_RADIUS_PX, 0.9);
      timer = setTimeout(() => {
        timer = null;
        try {
          if (!map.getLayer(RING_ECHO_LAYER)) return;
          set(RING_ECHO_MS, RING_ECHO_RADIUS_PX, 0);
          timer = setTimeout(echo, RING_ECHO_MS + RING_ECHO_GAP_MS);
        } catch {
          // The map is gone.
        }
      }, RING_ECHO_GAP_MS);
    } catch {
      // The map is gone.
    }
  };
  echo();
  return () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    removeEcho();
  };
}

/** Removes the ring and its echo. A pending echo finds its layer gone and stops by itself. */
export function hideRing(map: MapLibreMap): void {
  for (const id of [RING_ECHO_LAYER, RING_LAYER]) if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(RING_LAYER)) map.removeSource(RING_LAYER);
}
