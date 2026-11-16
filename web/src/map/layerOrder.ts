// The one place that decides where on the map's stack of layers a new layer goes, for the data
// rasters (map/dataLayers.ts), the overlay circles (map/overlayLayers.ts) and what the guided story
// draws (story/stageLayers.ts):
//
//   basemap ... | the story's night | data rasters | overlay circles and the story's marks |
//   the basemap's labels (its first symbol layer) ...
//
// So the dots of another source are never hidden under a radar picture, and place names stay
// readable on top of both. A raster added later (every date of a layer with more than 12 dates gets
// a fresh one) still goes below the circles, and below the story's outline and ring; the night the
// story lays over the basemap stays under every raster, so the data keeps its exact colours.

/** Ids of the map layers that draw data rasters start with this. */
export const DATA_LAYER_PREFIX = 'data-';
/** Ids of the map layers (and sources) that draw overlays start with this. */
export const OVERLAY_LAYER_PREFIX = 'overlay-';
/** Ids of the map layers (and sources) the guided story adds start with this. */
export const STORY_LAYER_PREFIX = 'story-';
/** The one story layer that lies under the data: the night over the basemap. */
export const STORY_NIGHT_LAYER = 'story-night';

export type LayerRole = 'data' | 'overlay';

/**
 * The id of the layer a new layer of `role` must be added before (MapLibre's `beforeId`), given the
 * map's layers from bottom to top; undefined puts it on top. The story's marks (its outline and its
 * ring) are added as 'overlay'.
 */
export function beforeIdFor(role: LayerRole, layers: readonly { id: string; type: string }[]): string | undefined {
  const firstLabel = layers.findIndex((l) => l.type === 'symbol');
  if (role === 'data') {
    const firstOverlay = layers.findIndex((l) => l.id.startsWith(OVERLAY_LAYER_PREFIX));
    const firstMark = layers.findIndex((l) => l.id.startsWith(STORY_LAYER_PREFIX) && l.id !== STORY_NIGHT_LAYER);
    const candidates = [firstOverlay, firstMark, firstLabel].filter((i) => i >= 0);
    return candidates.length ? layers[Math.min(...candidates)]!.id : undefined;
  }
  return firstLabel >= 0 ? layers[firstLabel]!.id : undefined;
}
