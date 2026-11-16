// Puts the active data layer on the map and switches between its dates or pairs without a flash.
//
// Tested recipe (measured in the pre-kickoff browser tests: research/digests/browser.md, section 6.2 and
// facts F13 to F15):
// - Up to PRELOAD_LIMIT files: one source and one raster layer per file, all added at once with
//   raster-opacity 0 and a zero-duration opacity transition. Switching just flips opacities, so the
//   new picture is already loaded and appears within one frame.
// - More files than that: one source at a time, because preloading multiplies every pan and zoom by
//   the number of files. A switch adds a fresh source and layer for the new file at raster-opacity 0
//   and, once that source has loaded (or failed), shows it and removes the old one in the same
//   frame. So no blank frame and no frame that mixes two dates (setUrl on one source mixed old and
//   new tiles for 1 to 3 frames, F15).
// Never remove-and-add to switch (blank frame every step) and never use `visibility` (it does not
// preload, so it flashes on first show).
//
// Why a fresh source rather than setUrl() on the one source: the cog:// protocol ignores MapLibre's
// abort signal, and MapLibre does not check it after a custom protocol answers, so a request for an
// earlier date that answers late still lands in the source that asked for it: its TileJSON replaces
// the new date's tile URLs, or its tile replaces the new date's picture of that tile. And when a
// file fails, setUrl leaves the previous date's tiles on screen. A late answer for a source that has
// been removed lands nowhere, and a file that fails shows nothing, as on the preload path.
//
// While the new file loads, the previous date's picture stays on screen, for at most
// PREVIOUS_PICTURE_LIMIT_MS: after that the map shows nothing until the new file has loaded, so a
// file that never answers cannot leave one date's picture on the map for ever. Meanwhile the date
// stepper, the link and a reading at a point already name the new date; what names the picture is
// the tag on the map (components/PictureLoading.tsx), fed by onPictureShown below, which keeps
// naming the previous date until its picture leaves the map.
//
// The map says when the picture of the date asked for is drawn (onDrawn), on the first 'idle' after
// it: playback (components/usePlayback.ts) waits for that before it moves on, and the app shows
// "Loading the picture of <date>" (after a short delay) until then.
//
// And it says which item's picture is on the map (onPictureShown): the item drawn there in full
// (its file loaded, or failed), until that picture leaves the map. On the one-source path that is
// the previous date while the next one loads; on the preload path the opacity flip swaps it at once.
// When the item's file could not be loaded (the map's 'error' for its source, not for one tile), it
// says so (`failed`): the map then shows no picture of it, and the tag must not name it as drawn.

import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Layer } from '../contract/manifest';
import { DATA_LAYER_PREFIX, beforeIdFor } from './layerOrder';
import { fileLabel, type MapErrorReport } from './mapErrors';
import { cog } from './maplibre';
import { classColorTable, cogSourceUrl } from './ramps';
import { PREVIOUS_PICTURE_LIMIT_MS, chooseStrategy, type SwitchStrategy } from './switching';

export { PRELOAD_LIMIT, PREVIOUS_PICTURE_LIMIT_MS, chooseStrategy, type SwitchStrategy } from './switching';

/** Raster paint shared by every data layer. */
const PAINT = {
  'raster-fade-duration': 0,
  // Nearest keeps each radar pixel a crisp square instead of blurring codes into in-between colours.
  'raster-resampling': 'nearest',
  'raster-opacity-transition': { duration: 0, delay: 0 },
} as const;

export interface ActiveLayer {
  layer: Layer;
  /** Absolute URLs of layer.items, same order. */
  urls: string[];
  /** Credit for the data, shown in the map's attribution line (and so in every screenshot). */
  attribution?: string;
}

/** One map source (and its raster layer of the same id) drawing one item of the active layer. */
interface Shown {
  id: string;
  index: number;
}

/** The picture on the map: item `index` of `layer`. */
export interface PictureOnMap {
  layer: Layer;
  index: number;
  /**
   * The item's file could not be loaded (its source failed as a whole), so the map shows no picture
   * for it: neither this item's nor the previous one's.
   */
  failed: boolean;
}

export class DataLayerController {
  /** Preload path: one source and layer id per item, in item order. */
  private ids: string[] = [];
  private strategy: SwitchStrategy = 'preload-opacity';
  /** The item asked for most recently (on screen, or loading on the one-source path). */
  private current = -1;
  /** The item asked for most recently, remembered while a layer is still being set up. */
  private wanted = -1;
  private opacity = 1;
  private urls: string[] = [];
  private active: Layer | null = null;
  private fileScale = { scale: 1, offset: 0 };
  /** Credit for the data, given to every source of the layer. */
  private attribution: string | undefined;
  /** Bumped on every setLayer, so a slow earlier call cannot add its layers after a newer one. */
  private generation = 0;
  /** Numbers the sources of one layer, so every source ever added has its own id. */
  private sourceCount = 0;
  /** Which file each map source of this layer draws or drew, so a map error can name the file. */
  private sourceUrls = new Map<string, string>();
  /** One-source path: the source on screen, if any. */
  private onScreen: Shown | null = null;
  /** One-source path: the source loading at raster-opacity 0, to replace onScreen once loaded. */
  private incoming: Shown | null = null;
  /** One-source path: removes the previous picture when the new one takes too long. */
  private previousTimer: ReturnType<typeof setTimeout> | null = null;
  /** Whether onDrawn has been called for the item on screen. */
  private drawnReported = false;
  /** The item last reported to onPictureShown, and whether its file failed (null: no picture of this layer on the map). */
  private pictureShown: { index: number; failed: boolean } | null = null;
  /** The sources of this layer whose file could not be loaded (a source-level 'error' from the map). */
  private failedSources = new Set<string>();

  constructor(
    private readonly map: MapLibreMap,
    /** Called with a problem, or with null when a new layer starts loading and old problems no longer apply. */
    private readonly onError: (report: MapErrorReport | null) => void,
    /**
     * Called with an item index once the map has drawn that item's picture, and with null when the
     * picture starts to change.
     */
    private readonly onDrawn: (index: number | null) => void = () => undefined,
    /**
     * Called with the picture on the map whenever it changes: an item once the map has it in full
     * (its file loaded, or failed: then with `failed`), until it leaves the map; null when no picture
     * of the layer is on it. Not the item asked for: while a new date loads, it is still the previous
     * one.
     */
    private readonly onPictureShown: (picture: PictureOnMap | null) => void = () => undefined,
  ) {
    map.on('render', this.settle);
    map.on('error', this.onMapError);
    map.on('idle', this.onIdle);
  }

  /** Stop listening to the map and drop any timer (the map is going away). */
  dispose(): void {
    this.clearPreviousTimer();
    this.map.off('render', this.settle);
    this.map.off('error', this.onMapError);
    this.map.off('idle', this.onIdle);
  }

  /** The data file a map source id belongs to, if it is one of ours. */
  urlForSource(sourceId: string | undefined): string | undefined {
    return sourceId === undefined ? undefined : this.sourceUrls.get(sourceId);
  }

  /** Replace whatever data layer is shown with `next`, showing item `index`. */
  async setLayer(next: ActiveLayer | null, index: number, opacity: number): Promise<void> {
    const gen = ++this.generation;
    this.clear();
    this.opacity = opacity;
    this.wanted = index;
    this.onError(null);
    this.notDrawn();
    if (!next || next.urls.length === 0) return;
    // Read one file's header: it tells us if the files declare a GDAL scale/offset, which changes
    // the units of the ramp limits (see rampLimits). Start with the file that will be shown; if it
    // cannot be read, say which file and try the others, so one bad file does not hide every date.
    // The protocol caches the header, so the map's own requests reuse it.
    const first = index >= 0 && index < next.urls.length ? index : 0;
    const order = [first, ...next.urls.keys()].filter((i, pos, all) => all.indexOf(i) === pos);
    let fileScale: { scale: number; offset: number } | null = null;
    for (const i of order) {
      const url = next.urls[i] ?? '';
      try {
        const meta = await cog.getCogMetadata(url);
        fileScale = { scale: meta.scale, offset: meta.offset };
        break;
      } catch (err) {
        if (gen !== this.generation) return;
        this.onError({ message: `Could not read ${fileLabel(url)}: ${err instanceof Error ? err.message : String(err)}`, url });
      }
    }
    if (gen !== this.generation || !fileScale) return;
    this.active = next.layer;
    this.urls = next.urls;
    this.fileScale = fileScale;
    this.attribution = next.attribution;
    this.sourceCount = 0;
    const encoding = next.layer.encoding;
    if (encoding.type === 'categorical-uint8') {
      // The colour function receives raw codes; a lookup table keeps it cheap (it runs 65,536
      // times per tile).
      const table = classColorTable(encoding);
      for (const url of next.urls)
        cog.setColorFunction(url, (pixel, color) => {
          const code = pixel[0] ?? 0;
          color.set(table.subarray(code * 4, code * 4 + 4));
        });
    }
    this.strategy = chooseStrategy(next.urls.length);
    const shown = this.wanted >= 0 && this.wanted < next.urls.length ? this.wanted : 0;
    this.current = -1;
    if (this.strategy === 'preload-opacity') {
      this.ids = next.urls.map((_, i) => this.addSource(i, 0));
      this.show(shown);
      return;
    }
    // Nothing on screen yet, so nothing to keep while it loads: show it at once.
    this.onScreen = { id: this.addSource(shown, this.opacity), index: shown };
    this.current = shown;
  }

  /** Show item `index` of the active layer. */
  show(index: number): void {
    this.wanted = index;
    if (!this.active || index < 0 || index >= this.urls.length) return;
    if (this.strategy === 'preload-opacity') {
      const prev = this.ids[this.current];
      if (prev && this.current !== index) this.map.setPaintProperty(prev, 'raster-opacity', 0);
      const id = this.ids[index];
      if (id) this.map.setPaintProperty(id, 'raster-opacity', this.opacity);
      if (this.current !== index) {
        this.notDrawn();
        // The previous picture has left the map. The new one is on it at once when its file has
        // already loaded unseen (the usual case); otherwise once it has (settle).
        if (id !== undefined && this.loaded(id)) this.reportShown(index, this.failedSources.has(id));
        else this.reportShown(null);
      }
      this.current = index;
      return;
    }
    if (index === this.current) return;
    this.notDrawn();
    this.current = index;
    // A file still loading for another date is dropped: whatever it answers lands in a removed source.
    if (this.incoming) this.removeSource(this.incoming.id);
    this.incoming = null;
    if (this.onScreen?.index === index) {
      // Back to the picture still on screen: nothing to load.
      this.clearPreviousTimer();
      return;
    }
    this.incoming = { id: this.addSource(index, 0), index };
    if (this.onScreen) this.previousTimer ??= setTimeout(this.dropPrevious, PREVIOUS_PICTURE_LIMIT_MS);
  }

  /** Add a source and raster layer for item `index`, drawn at `opacity`; returns their id. */
  private addSource(index: number, opacity: number): string {
    const url = this.urls[index] ?? '';
    const id = `${DATA_LAYER_PREFIX}${this.generation}-${this.sourceCount++}`;
    this.map.addSource(id, {
      type: 'raster',
      url: cogSourceUrl(url, this.active!, this.fileScale),
      tileSize: 256,
      ...(this.attribution ? { attribution: this.attribution } : {}),
    });
    this.sourceUrls.set(id, url);
    // Below any overlay's circles and the basemap's labels, on every date (map/layerOrder.ts).
    this.map.addLayer({ id, type: 'raster', source: id, paint: { ...PAINT, 'raster-opacity': opacity } }, beforeIdFor('data', this.map.getStyle().layers));
    return id;
  }

  private removeSource(id: string): void {
    if (this.map.getLayer(id)) this.map.removeLayer(id);
    if (this.map.getSource(id)) this.map.removeSource(id);
  }

  /**
   * One-source path: once the incoming source has loaded what the view needs (or failed: a source
   * that errored counts as loaded and shows nothing), show it and remove the previous one, in the
   * same frame.
   */
  private readonly settle = (): void => {
    const incoming = this.incoming;
    if (incoming && this.loaded(incoming.id)) {
      this.map.setPaintProperty(incoming.id, 'raster-opacity', this.opacity);
      if (this.onScreen) this.removeSource(this.onScreen.id);
      this.onScreen = incoming;
      this.incoming = null;
      this.clearPreviousTimer();
    }
    // The picture on the map has come in full: the one just swapped in, or the first of a layer; or
    // its file has failed since.
    const visible = this.strategy === 'preload-opacity' ? { id: this.ids[this.current], index: this.current } : this.onScreen;
    if (!visible || visible.index < 0 || visible.id === undefined) return;
    const failed = this.failedSources.has(visible.id);
    if ((this.pictureShown?.index !== visible.index || this.pictureShown.failed !== failed) && this.loaded(visible.id)) this.reportShown(visible.index, failed);
  };

  /**
   * The map's 'error': a source of ours that failed as a whole (no `tile`: its file could not be
   * opened) is remembered, so its item is never reported as a picture drawn. An error about one tile
   * leaves the rest of the picture on the map.
   */
  private readonly onMapError = (e?: object): void => {
    // MapLibre adds the source's id to an error that one of its sources fires, and `tile` to one about a tile.
    const { sourceId, tile } = (e ?? {}) as { sourceId?: unknown; tile?: unknown };
    if (typeof sourceId === 'string' && tile === undefined && this.sourceUrls.has(sourceId)) this.failedSources.add(sourceId);
    this.settle();
  };

  /** Whether source `id` is on the map and has loaded what the view needs (or failed). */
  private loaded(id: string | undefined): boolean {
    return id !== undefined && this.map.getSource(id) !== undefined && this.map.isSourceLoaded(id);
  }

  /**
   * Tells onPictureShown which item's picture is on the map now (null: none) and whether its file
   * failed, when that changed.
   */
  private reportShown(index: number | null, failed = false): void {
    const shown = this.active && index !== null ? { index, failed } : null;
    if (shown?.index === this.pictureShown?.index && shown?.failed === this.pictureShown?.failed) return;
    this.pictureShown = shown;
    this.onPictureShown(shown && this.active ? { layer: this.active, ...shown } : null);
  }

  /** The new date takes too long: stop showing the previous date's picture. */
  private readonly dropPrevious = (): void => {
    this.previousTimer = null;
    if (!this.incoming || !this.onScreen) return;
    this.removeSource(this.onScreen.id);
    this.onScreen = null;
    this.reportShown(null);
  };

  private clearPreviousTimer(): void {
    if (this.previousTimer !== null) clearTimeout(this.previousTimer);
    this.previousTimer = null;
  }

  private notDrawn(): void {
    this.drawnReported = false;
    this.onDrawn(null);
  }

  /** 'idle': everything asked for is loaded and drawn, so the item on screen is drawn. */
  private readonly onIdle = (): void => {
    this.settle();
    if (this.drawnReported || this.incoming || this.current < 0 || !this.active) return;
    this.drawnReported = true;
    this.onDrawn(this.current);
  };

  setOpacity(opacity: number): void {
    this.opacity = opacity;
    const id = this.strategy === 'preload-opacity' ? this.ids[this.current] : this.onScreen?.id;
    if (id && this.map.getLayer(id)) this.map.setPaintProperty(id, 'raster-opacity', opacity);
  }

  clear(): void {
    this.clearPreviousTimer();
    this.reportShown(null);
    for (const id of [...this.ids, this.onScreen?.id, this.incoming?.id]) if (id) this.removeSource(id);
    this.ids = [];
    this.onScreen = null;
    this.incoming = null;
    this.sourceUrls.clear();
    this.failedSources.clear();
    this.current = -1;
    this.active = null;
    this.urls = [];
  }
}
