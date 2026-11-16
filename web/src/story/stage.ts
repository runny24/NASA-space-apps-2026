// Everything the story does to the MapLibre map, and nothing else does: it takes the map from the
// visitor while the story is open, moves the camera, lays the night over the basemap, marks the site,
// and gives the map back exactly as it found it. It knows nothing of React; story/useStory.ts
// creates one Stage per opening and calls it inside try/catch (a throw closes the story and shows
// the map).
//
// - `inert` on the map's canvas container and on its zoom buttons: the visitor cannot move the map
//   into a state the words do not describe. The credit line is left alone, so its links stay reachable.
// - The camera glides (a flight when the zoom changes much, otherwise an ease) or jumps. It never
//   passes `essential: true`, and under reduced motion the story asks for a jump itself.
// - The night, the site's outline and the cover's ring are in story/stageLayers.ts. Every layer and
//   source the story adds has an id starting with STORY_PREFIX (never "data-": the end-to-end helpers
//   count those as a date's picture), and leave() removes every one of them (the night once it has
//   lifted).
// - Once the story has closed from the cover, frameForTool frames the site for the tool as it opens:
//   a jump, with no cover offset.
//
// What never happens here: no data layer is touched (no raster-* paint, no fade: web/MOTION.md, rule
// 1), the style URL is never changed and setStyle is never called (it would drop every data layer).

import type { CameraOptions, Map as MapLibreMap } from 'maplibre-gl';
import { STORY_LAYER_PREFIX } from '../map/layerOrder';
import { NIGHT_LAYER, fallNight, hideOutline, hideRing, liftNight, showOutline, showRing } from './stageLayers';
import type { CameraTarget } from './storyModel';
import { BOUNDS_PADDING_PX, CAMERA_EASE_MS, CAMERA_FLY_MS, CAMERA_FLY_ZOOM_CHANGE } from './timing';

/** Ids of the map layers and sources the story adds start with this (map/layerOrder.ts orders them). */
export const STORY_PREFIX = STORY_LAYER_PREFIX;

/** The camera options for a target on this map: a centre and zoom, or the bounds fitted with padding. */
export function cameraFor(map: MapLibreMap, target: CameraTarget): CameraOptions {
  if ('center' in target) return { center: target.center, zoom: target.zoom };
  const [w, s, e, n] = target.bounds;
  return map.cameraForBounds([w, s, e, n], { padding: BOUNDS_PADDING_PX }) ?? { center: [(w + e) / 2, (s + n) / 2] };
}

/**
 * Frames `target` for the tool, as MapView frames a site when the page opens: the map first takes
 * its container's size now (closing the story may just have changed it: on a phone the tool's map
 * is taller than the story's, and MapLibre's own resize comes later and keeps the old centre and
 * zoom), then the camera jumps, with no cover offset. No motion. useStory calls it after the stage
 * has left (leave() has stopped the camera, so nothing moves it afterwards).
 */
export function frameForTool(map: MapLibreMap, target: CameraTarget): void {
  map.resize();
  map.jumpTo(cameraFor(map, target));
}

/** Removes every layer, then every source, whose id starts with STORY_PREFIX, except the ids in `keep`. */
export function removeStoryLayers(map: MapLibreMap, keep: readonly string[] = []): void {
  const style = map.getStyle();
  const ours = (id: string) => id.startsWith(STORY_PREFIX) && !keep.includes(id);
  for (const layer of style?.layers ?? []) if (ours(layer.id) && map.getLayer(layer.id)) map.removeLayer(layer.id);
  for (const id of Object.keys(style?.sources ?? {})) if (ours(id) && map.getSource(id)) map.removeSource(id);
}

/** The colour and strength of the night: the tokens --night and --night-opacity of story.css. */
export interface NightLook {
  color: string;
  opacity: number;
}

/** The night's look as the stylesheet gives it, with the brief's values when it gives none. */
export function nightLook(): NightLook {
  const css = getComputedStyle(document.documentElement);
  const opacity = Number(css.getPropertyValue('--night-opacity'));
  return { color: css.getPropertyValue('--night').trim() || '#0b1016', opacity: Number.isFinite(opacity) && opacity > 0 ? opacity : 0.72 };
}

export interface MoveOptions {
  /** Glide there (a flight when the zoom changes by more than CAMERA_FLY_ZOOM_CHANGE, else an ease); false: jump. */
  animate: boolean;
  /**
   * Where the target's centre lands, as a share of the map's width to the right of the map's centre
   * (0: the centre). The cover on a desktop keeps the site clear of its words this way.
   */
  offsetShare?: number;
}

/** A camera position, with where its centre lands on screen. */
type Camera = CameraOptions & { offset?: [number, number] };

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Stage {
  /** The elements this stage made inert, so leave() gives back exactly those. */
  private inerted: Element[] = [];
  /** The move under way: where it ends. */
  private moving: Camera | null = null;
  /** Stops the echoes of the cover's ring. */
  private stopEchoes: (() => void) | null = null;

  constructor(private readonly map: MapLibreMap) {}

  /**
   * Take the map: its canvas container (the canvas takes keyboard focus, the mouse and fingers) and
   * its top-right corner (the zoom buttons) become inert, so the visitor cannot move the map into a
   * state the words do not describe and the tool's controls leave the tab order. The camera still
   * moves from code. The credit line is not touched. Safe to call twice.
   */
  enter(): void {
    const corner = this.map.getContainer().querySelector('.maplibregl-ctrl-top-right');
    for (const el of [this.map.getCanvasContainer(), corner]) {
      if (!el || el.hasAttribute('inert')) continue;
      el.setAttribute('inert', '');
      this.inerted.push(el);
    }
  }

  /**
   * Night falls over the basemap (stageLayers.ts), over `durationMs` (0: at once). It needs the
   * map's style, so the story calls it with its first camera move, not in enter(). Safe to call again.
   */
  night(look: NightLook, durationMs: number): void {
    fallNight(this.map, look, durationMs);
  }

  /**
   * Mark the site once the camera has arrived: on the cover a ring at its centre, which pulses
   * `echoes` times and then stays still; on a step its outline, fading in over `fadeMs`. Never both.
   */
  mark(kind: 'ring' | 'outline', bounds: readonly [number, number, number, number], motion: { echoes: number; fadeMs: number }): void {
    this.stopEchoes?.();
    this.stopEchoes = null;
    if (kind === 'ring') {
      hideOutline(this.map);
      const [w, s, e, n] = bounds;
      this.stopEchoes = showRing(this.map, [(w + e) / 2, (s + n) / 2], motion.echoes);
    } else {
      hideRing(this.map);
      showOutline(this.map, bounds, motion.fadeMs);
    }
  }

  /**
   * Move the camera to `target`. `onArrived` is called on the map's `moveend`, which a jump fires
   * too; the function returned cancels that call (a step left early). When the camera is there
   * already, nothing moves and `onArrived` is called at once.
   */
  go(target: CameraTarget, options: MoveOptions, onArrived: () => void): () => void {
    const map = this.map;
    // Anything still moving ends first, so the moveend below is this move's.
    map.stop();
    const offsetX = Math.round(map.getContainer().clientWidth * (options.offsetShare ?? 0));
    const camera: Camera = { ...cameraFor(map, target), ...(offsetX !== 0 ? { offset: [offsetX, 0] as [number, number] } : {}) };
    let waiting = true;
    const arrived = () => {
      if (!waiting) return;
      waiting = false;
      map.off('moveend', arrived);
      if (this.moving === camera) this.moving = null;
      onArrived();
    };
    if (this.isThere(camera, offsetX)) {
      arrived();
      return () => undefined;
    }
    map.on('moveend', arrived);
    this.moving = camera;
    const zoomChange = Math.abs((camera.zoom ?? map.getZoom()) - map.getZoom());
    // Never `essential: true`. A jump is an ease of no duration, so that it can carry the offset.
    if (!options.animate) map.easeTo({ ...camera, duration: 0 });
    else if (zoomChange > CAMERA_FLY_ZOOM_CHANGE) map.flyTo({ ...camera, duration: CAMERA_FLY_MS, curve: 1.42 });
    else map.easeTo({ ...camera, duration: CAMERA_EASE_MS, easing: easeInOutCubic });
    return () => {
      waiting = false;
      map.off('moveend', arrived);
      if (this.moving === camera) this.moving = null;
    };
  }

  /** Whether the camera already shows `camera`: the same zoom, its centre where it should land. */
  private isThere(camera: Camera, offsetX: number): boolean {
    const map = this.map;
    if (!camera.center || map.isMoving()) return false;
    if (Math.abs((camera.zoom ?? map.getZoom()) - map.getZoom()) > 0.005) return false;
    const at = map.project(camera.center);
    const box = map.getContainer();
    return Math.abs(at.x - (box.clientWidth / 2 + offsetX)) < 1 && Math.abs(at.y - box.clientHeight / 2) < 1;
  }

  /**
   * End the move under way at once, where it was going: a press of Next never waits for a flight.
   * Stopping the map fires the `moveend` the move was waiting for.
   */
  finish(): void {
    const camera = this.moving;
    if (!camera) return;
    this.moving = null;
    this.map.stop();
    this.map.easeTo({ ...camera, duration: 0 });
  }

  /**
   * Give the map back: `inert` removed, the camera stopped where it is (the visitor explores from
   * there; closed from the cover, useStory then frames the site: frameForTool), the ring and the
   * outline removed, the night lifting over `nightLiftMs` (0: at once) and then removed, and every
   * other `story-` layer and source removed. Each part runs even when another throws; the first
   * error is thrown at the end, after everything that could be undone was.
   */
  leave(nightLiftMs: number): void {
    const errors: unknown[] = [];
    const attempt = (part: () => void) => {
      try {
        part();
      } catch (err) {
        errors.push(err);
      }
    };
    for (const el of this.inerted) attempt(() => el.removeAttribute('inert'));
    this.inerted = [];
    this.moving = null;
    attempt(() => this.map.stop());
    attempt(() => this.stopEchoes?.());
    this.stopEchoes = null;
    attempt(() => liftNight(this.map, nightLiftMs));
    attempt(() => removeStoryLayers(this.map, nightLiftMs > 0 ? [NIGHT_LAYER] : []));
    if (errors.length > 0) throw errors[0];
  }
}
