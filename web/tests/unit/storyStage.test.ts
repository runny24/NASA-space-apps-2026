// What the guided story does to the map (src/story/stage.ts and src/story/stageLayers.ts), against a
// small fake map that keeps its layers in order, their paint, its sources, its listeners and its
// camera, and records every call. Honesty test 6 of docs/MOTION_AND_STORY_BRIEF.md at its root:
// nothing of the story is left after it closes, and the basemap's labels get exactly their colours
// back. Also: the night lies under every data raster, no data layer is touched, every id starts with
// "story-", and the camera never passes `essential` (so MapLibre itself jumps under reduced motion).

import type { Map as MapLibreMap } from 'maplibre-gl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { beforeIdFor } from '../../src/map/layerOrder';
import { Stage, STORY_PREFIX, removeStoryLayers } from '../../src/story/stage';
import { NIGHT_LAYER, OUTLINE_LAYER, RING_ECHO_LAYER, RING_LAYER, STAGE_LAYER_IDS, fallNight, hideRing, isNight, liftNight, showOutline, showRing } from '../../src/story/stageLayers';
import { BOUNDS_PADDING_PX, CAMERA_EASE_MS, CAMERA_FLY_MS, NIGHT_MS, OUTLINE_FADE_MS, RING_ECHOES } from '../../src/story/timing';

type Paint = Record<string, unknown>;
interface FakeLayer {
  id: string;
  type: string;
  source?: string;
  paint: Paint;
  layout?: Paint;
}
interface Camera {
  center?: [number, number];
  zoom?: number;
  offset?: [number, number];
  duration?: number;
  [key: string]: unknown;
}

/** The few DOM calls the stage makes on an element (inert on and off). */
class FakeElement {
  private readonly attributes = new Map<string, string>();
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  hasAttribute(name: string) {
    return this.attributes.has(name);
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
}

/**
 * Just enough of a MapLibre map for the stage: layers in order (addLayer with a beforeId that must
 * exist, as MapLibre requires), paint properties (undefined puts back the default, as in MapLibre),
 * sources (one in use by a layer cannot be removed), listeners, and a flat camera (one degree is
 * 2^zoom pixels) whose moves end at once when their duration is 0 and when `arrive` is called
 * otherwise. Every call is recorded.
 */
class FakeMap {
  layers: FakeLayer[] = [];
  sources = new Map<string, unknown>();
  calls: { name: string; args: unknown[] }[] = [];
  private listeners = new Map<string, Set<() => void>>();
  center: [number, number] = [0, 0];
  zoom = 5;
  private pending: Camera | null = null;
  readonly width = 1000;
  readonly height = 600;
  readonly canvasContainer = new FakeElement();
  readonly corner = new FakeElement();

  constructor(layers: { id: string; type: string; paint?: Paint; layout?: Paint }[] = []) {
    for (const l of layers) this.layers.push({ id: l.id, type: l.type, paint: { ...(l.paint ?? {}) }, ...(l.layout ? { layout: { ...l.layout } } : {}) });
  }
  private note(name: string, ...args: unknown[]) {
    this.calls.push({ name, args });
  }
  getStyle() {
    return { layers: this.layers.map((l) => ({ id: l.id, type: l.type })), sources: Object.fromEntries(this.sources) };
  }
  getLayer(id: string) {
    return this.layers.find((l) => l.id === id);
  }
  addLayer(layer: { id: string; type: string; source?: string; paint?: Paint }, beforeId?: string) {
    this.note('addLayer', layer, beforeId);
    if (this.getLayer(layer.id)) throw new Error(`layer ${layer.id} exists`);
    if (layer.source && !this.sources.has(layer.source)) throw new Error(`no source ${layer.source}`);
    const at = beforeId === undefined ? this.layers.length : this.layers.findIndex((l) => l.id === beforeId);
    if (at < 0) throw new Error(`no layer ${beforeId} to go before`);
    this.layers.splice(at, 0, { id: layer.id, type: layer.type, source: layer.source, paint: { ...(layer.paint ?? {}) } });
  }
  removeLayer(id: string) {
    this.note('removeLayer', id);
    if (!this.getLayer(id)) throw new Error(`no layer ${id}`);
    this.layers = this.layers.filter((l) => l.id !== id);
  }
  addSource(id: string, spec: unknown) {
    this.note('addSource', id, spec);
    if (this.sources.has(id)) throw new Error(`source ${id} exists`);
    this.sources.set(id, spec);
  }
  getSource(id: string) {
    return this.sources.get(id);
  }
  removeSource(id: string) {
    this.note('removeSource', id);
    if (this.layers.some((l) => l.source === id)) throw new Error(`source ${id} is in use`);
    this.sources.delete(id);
  }
  setPaintProperty(id: string, name: string, value: unknown) {
    this.note('setPaintProperty', id, name, value);
    const layer = this.getLayer(id);
    if (!layer) throw new Error(`no layer ${id}`);
    if (value === undefined) delete layer.paint[name];
    else layer.paint[name] = value;
  }
  getPaintProperty(id: string, name: string) {
    return this.getLayer(id)?.paint[name];
  }
  getLayoutProperty(id: string, name: string) {
    return this.getLayer(id)?.layout?.[name];
  }
  on(type: string, fn: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  off(type: string, fn: () => void) {
    this.listeners.get(type)?.delete(fn);
  }
  listening(type: string) {
    return this.listeners.get(type)?.size ?? 0;
  }
  fire(type: string) {
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn();
  }
  // The camera.
  getContainer() {
    return { clientWidth: this.width, clientHeight: this.height, querySelector: (sel: string) => (sel === '.maplibregl-ctrl-top-right' ? this.corner : null) };
  }
  getCanvasContainer() {
    return this.canvasContainer;
  }
  getZoom() {
    return this.zoom;
  }
  isMoving() {
    return this.pending !== null;
  }
  project(p: [number, number]) {
    const scale = 2 ** this.zoom;
    return { x: this.width / 2 + (p[0] - this.center[0]) * scale, y: this.height / 2 - (p[1] - this.center[1]) * scale };
  }
  cameraForBounds(b: [number, number, number, number], options: unknown) {
    this.note('cameraForBounds', b, options);
    return { center: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2] as [number, number], zoom: 9 };
  }
  stop() {
    this.note('stop');
    // As MapLibre: the camera stays where the move had got to (here: where it started) and moveend fires.
    if (this.pending) {
      this.pending = null;
      this.fire('moveend');
    }
  }
  easeTo(options: Camera) {
    this.note('easeTo', options);
    this.move(options);
  }
  flyTo(options: Camera) {
    this.note('flyTo', options);
    this.move(options);
  }
  jumpTo(options: Camera) {
    this.note('jumpTo', options);
    this.move({ ...options, duration: 0 });
  }
  private move(options: Camera) {
    if (this.pending) this.stop();
    this.pending = options;
    this.fire('movestart');
    if (!options.duration) this.arrive();
  }
  /** The move under way ends where it was going. */
  arrive() {
    const to = this.pending;
    if (!to) return;
    this.zoom = to.zoom ?? this.zoom;
    if (to.center) {
      const scale = 2 ** this.zoom;
      const [ox, oy] = to.offset ?? [0, 0];
      this.center = [to.center[0] - ox / scale, to.center[1] + oy / scale];
    }
    this.pending = null;
    this.fire('moveend');
  }
  callsOf(name: string) {
    return this.calls.filter((c) => c.name === name).map((c) => c.args);
  }
  ids() {
    return this.layers.map((l) => l.id);
  }
}

const asMap = (fake: FakeMap) => fake as unknown as MapLibreMap;
const LOOK = { color: '#0b1016', opacity: 0.72 };
const LABEL_TEXT = '#d7dee6';
const LABEL_HALO = 'rgba(11,16,22,0.85)';
const BOUNDS: [number, number, number, number] = [10, 20, 10.4, 20.3];

/** A basemap with fills and lines, then labels: one with its own colours, one with none set, one with an expression. */
const basemap = (): { id: string; type: string; paint?: Paint }[] => [
  { id: 'background', type: 'background', paint: { 'background-color': '#eeeeee' } },
  { id: 'water', type: 'fill', paint: { 'fill-color': '#aaccee' } },
  { id: 'roads', type: 'line', paint: { 'line-color': '#ffffff' } },
  { id: 'place-labels', type: 'symbol', paint: { 'text-color': '#333333', 'text-halo-color': '#ffffff' } },
  { id: 'poi-labels', type: 'symbol' },
  { id: 'water-labels', type: 'symbol', paint: { 'text-color': ['get', 'colour'] } },
];
/** The same with two data rasters and an overlay's circles where the app puts them. */
const withData = () => {
  const layers = basemap();
  layers.splice(
    3,
    0,
    { id: 'data-1-0', type: 'raster', paint: { 'raster-opacity': 0, 'raster-fade-duration': 0 } },
    { id: 'data-1-1', type: 'raster', paint: { 'raster-opacity': 0.9, 'raster-fade-duration': 0 } },
    { id: 'overlay-fires', type: 'circle', paint: { 'circle-color': '#d55e00' } },
  );
  return layers;
};
const labelPaint = (fake: FakeMap) => fake.layers.filter((l) => l.type === 'symbol').map((l) => [l.id, structuredClone(l.paint)]);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('the night (stageLayers)', () => {
  it('goes just below the first data raster, above the basemap fills and lines, fading in over its duration', () => {
    const fake = new FakeMap(withData());
    fallNight(asMap(fake), LOOK, NIGHT_MS);
    expect(fake.ids()).toEqual(['background', 'water', 'roads', NIGHT_LAYER, 'data-1-0', 'data-1-1', 'overlay-fires', 'place-labels', 'poi-labels', 'water-labels']);
    const night = fake.getLayer(NIGHT_LAYER)!;
    expect(night.type).toBe('background');
    expect(night.paint).toEqual({ 'background-color': LOOK.color, 'background-opacity': LOOK.opacity, 'background-opacity-transition': { duration: NIGHT_MS, delay: 0 } });
    // Added at 0, then set to its strength: MapLibre's own transition fades it in.
    const [added] = fake.callsOf('addLayer')[0] as [{ paint: Paint }];
    expect(added.paint['background-opacity']).toBe(0);
    expect(isNight(asMap(fake))).toBe(true);
  });

  it('with no data raster yet, goes where one would go; rasters added later land above it', () => {
    const fake = new FakeMap(basemap());
    fallNight(asMap(fake), LOOK, NIGHT_MS);
    expect(fake.ids().indexOf(NIGHT_LAYER)).toBe(3);
    fake.addLayer({ id: 'data-1-0', type: 'raster' }, beforeIdFor('data', fake.getStyle().layers));
    expect(fake.ids().indexOf('data-1-0')).toBeGreaterThan(fake.ids().indexOf(NIGHT_LAYER));
    expect(fake.ids().indexOf('data-1-0')).toBeLessThan(fake.ids().indexOf('place-labels'));
    // With the story's outline and an overlay on the map, a later raster still goes between the night and them.
    showOutline(asMap(fake), BOUNDS, 0);
    fake.addLayer({ id: 'overlay-fires', type: 'circle' }, beforeIdFor('overlay', fake.getStyle().layers));
    fake.addLayer({ id: 'data-1-1', type: 'raster' }, beforeIdFor('data', fake.getStyle().layers));
    const ids = fake.ids();
    expect(ids.indexOf(NIGHT_LAYER)).toBeLessThan(ids.indexOf('data-1-0'));
    expect(ids.indexOf('data-1-1')).toBeGreaterThan(ids.indexOf('data-1-0'));
    expect(ids.indexOf('data-1-1')).toBeLessThan(Math.min(ids.indexOf(OUTLINE_LAYER), ids.indexOf('overlay-fires')));
  });

  it("turns the basemap's labels light, and lifting gives each back exactly what it had, also one that had no colour set and one with an expression", () => {
    const fake = new FakeMap(withData());
    const before = labelPaint(fake);
    fallNight(asMap(fake), LOOK, NIGHT_MS);
    for (const id of ['place-labels', 'poi-labels', 'water-labels']) {
      expect(fake.getPaintProperty(id, 'text-color'), id).toBe(LABEL_TEXT);
      expect(fake.getPaintProperty(id, 'text-halo-color'), id).toBe(LABEL_HALO);
    }
    liftNight(asMap(fake), NIGHT_MS);
    expect(labelPaint(fake)).toEqual(before);
    expect(fake.getPaintProperty('poi-labels', 'text-color')).toBeUndefined();
    expect('text-halo-color' in fake.getLayer('water-labels')!.paint).toBe(false);
  });

  it('leaves alone a label drawn on its own icon (a road shield): its dark text on a white shield stays readable', () => {
    const layers: { id: string; type: string; paint?: Paint; layout?: Paint }[] = withData();
    layers.push(
      { id: 'road-shields', type: 'symbol', paint: { 'text-color': '#333333' }, layout: { 'icon-image': 'shield-{ref_length}', 'text-field': '{ref}' } },
      { id: 'road-names', type: 'symbol', paint: { 'text-color': '#555555' }, layout: { 'text-field': '{name}' } },
      { id: 'poi-icons', type: 'symbol', layout: { 'icon-image': 'dot' } },
    );
    const fake = new FakeMap(layers);
    const before = labelPaint(fake);
    fallNight(asMap(fake), LOOK, NIGHT_MS);
    expect(fake.getPaintProperty('road-shields', 'text-color')).toBe('#333333');
    expect(fake.getPaintProperty('road-shields', 'text-halo-color')).toBeUndefined();
    expect(fake.callsOf('setPaintProperty').some(([id]) => id === 'road-shields')).toBe(false);
    // A label with text alone, and an icon without text, turn light as before.
    for (const id of ['place-labels', 'road-names', 'poi-icons']) expect(fake.getPaintProperty(id, 'text-color'), id).toBe(LABEL_TEXT);
    liftNight(asMap(fake), NIGHT_MS);
    expect(labelPaint(fake)).toEqual(before);
  });

  it('falling again (every step) remembers the colours from before the first fall, not its own', () => {
    const fake = new FakeMap(withData());
    const before = labelPaint(fake);
    fallNight(asMap(fake), LOOK, NIGHT_MS);
    fallNight(asMap(fake), LOOK, NIGHT_MS);
    fallNight(asMap(fake), LOOK, 0);
    expect(fake.ids().filter((id) => id === NIGHT_LAYER)).toHaveLength(1);
    expect(fake.getLayer(NIGHT_LAYER)!.paint['background-opacity-transition']).toEqual({ duration: 0, delay: 0 });
    liftNight(asMap(fake), 0);
    expect(labelPaint(fake)).toEqual(before);
  });

  it('never touches a data raster or an overlay: only its own layer and the labels\' two colours', () => {
    const fake = new FakeMap(withData());
    const data = structuredClone(fake.layers.filter((l) => !l.id.startsWith(STORY_PREFIX) && l.type !== 'symbol'));
    fallNight(asMap(fake), LOOK, NIGHT_MS);
    liftNight(asMap(fake), NIGHT_MS);
    vi.runAllTimers();
    for (const [id, name] of fake.callsOf('setPaintProperty') as [string, string][]) {
      if (id.startsWith(STORY_PREFIX)) continue;
      expect(fake.getLayer(id)!.type, id).toBe('symbol');
      expect(['text-color', 'text-halo-color'], `${id} ${name}`).toContain(name);
    }
    expect(fake.layers.filter((l) => !l.id.startsWith(STORY_PREFIX) && l.type !== 'symbol')).toEqual(data);
  });

  it('lifting fades it out over its duration and then removes it; with 0 at once', () => {
    const fake = new FakeMap(withData());
    fallNight(asMap(fake), LOOK, NIGHT_MS);
    liftNight(asMap(fake), NIGHT_MS);
    expect(fake.getLayer(NIGHT_LAYER)!.paint).toMatchObject({ 'background-opacity': 0, 'background-opacity-transition': { duration: NIGHT_MS, delay: 0 } });
    vi.advanceTimersByTime(NIGHT_MS - 1);
    expect(isNight(asMap(fake))).toBe(true);
    vi.advanceTimersByTime(200);
    expect(isNight(asMap(fake))).toBe(false);
    fallNight(asMap(fake), LOOK, 0);
    liftNight(asMap(fake), 0);
    expect(isNight(asMap(fake))).toBe(false);
    liftNight(asMap(fake), NIGHT_MS); // nothing to lift: no throw
  });

  it('falling again while it lifts keeps the layer, at its strength, and cancels the removal', () => {
    const fake = new FakeMap(withData());
    fallNight(asMap(fake), LOOK, NIGHT_MS);
    liftNight(asMap(fake), NIGHT_MS);
    vi.advanceTimersByTime(300);
    fallNight(asMap(fake), LOOK, NIGHT_MS);
    vi.advanceTimersByTime(5000);
    expect(isNight(asMap(fake))).toBe(true);
    expect(fake.getPaintProperty(NIGHT_LAYER, 'background-opacity')).toBe(LOOK.opacity);
    expect(fake.getPaintProperty('place-labels', 'text-color')).toBe(LABEL_TEXT);
    liftNight(asMap(fake), 0);
    expect(fake.getPaintProperty('place-labels', 'text-color')).toBe('#333333');
  });
});

describe('the outline and the ring (stageLayers)', () => {
  it('the outline: a white line round the bounds, above the data and the circles, under the labels, fading in', () => {
    const fake = new FakeMap(withData());
    showOutline(asMap(fake), BOUNDS, OUTLINE_FADE_MS);
    const ids = fake.ids();
    expect(ids.indexOf(OUTLINE_LAYER)).toBe(ids.indexOf('place-labels') - 1);
    expect(fake.getLayer(OUTLINE_LAYER)).toMatchObject({ type: 'line', source: OUTLINE_LAYER });
    expect(fake.getLayer(OUTLINE_LAYER)!.paint).toMatchObject({ 'line-color': '#ffffff', 'line-opacity': 1, 'line-opacity-transition': { duration: OUTLINE_FADE_MS, delay: 0 } });
    showOutline(asMap(fake), BOUNDS, OUTLINE_FADE_MS); // again: no second one, no throw
    expect(fake.ids().filter((id) => id === OUTLINE_LAYER)).toHaveLength(1);
  });

  it("the ring: amber, no fill, pulsing its echoes and then still; never a data colour", () => {
    const fake = new FakeMap(withData());
    showRing(asMap(fake), [10.2, 20.15], RING_ECHOES);
    expect(fake.getLayer(RING_LAYER)!.paint).toMatchObject({ 'circle-opacity': 0, 'circle-stroke-color': '#ffb000' });
    expect(fake.getLayer(RING_ECHO_LAYER)).toBeDefined();
    expect(fake.ids().indexOf(RING_LAYER)).toBeLessThan(fake.ids().indexOf('place-labels'));
    vi.advanceTimersByTime(30_000);
    expect(fake.getLayer(RING_ECHO_LAYER)).toBeUndefined();
    expect(fake.getLayer(RING_LAYER)).toBeDefined();
    const radii = (fake.callsOf('setPaintProperty') as [string, string, unknown][]).filter(([id, name]) => id === RING_ECHO_LAYER && name === 'circle-radius');
    expect(radii.length).toBe(2 * RING_ECHOES);
  });

  it('the ring without echoes (reduced motion) is still from the start; its stopper and hideRing remove the echo early', () => {
    const fake = new FakeMap(withData());
    showRing(asMap(fake), [10.2, 20.15], 0);
    expect(fake.getLayer(RING_ECHO_LAYER)).toBeUndefined();
    hideRing(asMap(fake));
    const stop = showRing(asMap(fake), [10.2, 20.15], RING_ECHOES);
    stop();
    expect(fake.getLayer(RING_ECHO_LAYER)).toBeUndefined();
    vi.advanceTimersByTime(30_000);
    hideRing(asMap(fake));
    expect(fake.ids().filter((id) => id.startsWith(STORY_PREFIX))).toEqual([]);
    expect(fake.sources.has(RING_LAYER)).toBe(false);
  });
});

describe('the Stage', () => {
  /** A whole opening: take the map, night, the ring on the cover, then a step's outline. */
  function opened(layers = withData()) {
    const fake = new FakeMap(layers);
    const stage = new Stage(asMap(fake));
    stage.enter();
    stage.night(LOOK, NIGHT_MS);
    stage.mark('ring', BOUNDS, { echoes: RING_ECHOES, fadeMs: OUTLINE_FADE_MS });
    return { fake, stage };
  }

  it('every layer and source it adds has an id starting with "story-"', () => {
    for (const id of STAGE_LAYER_IDS) expect(id.startsWith(STORY_PREFIX), id).toBe(true);
    expect(STORY_PREFIX).toBe('story-');
    const before = new Set(withData().map((l) => l.id));
    const { fake, stage } = opened();
    const added = new Set<string>(fake.ids().filter((id) => !before.has(id)));
    stage.mark('outline', BOUNDS, { echoes: 0, fadeMs: 0 });
    for (const id of fake.ids()) if (!before.has(id)) added.add(id);
    for (const id of fake.sources.keys()) added.add(id);
    expect([...added].sort()).toEqual([NIGHT_LAYER, OUTLINE_LAYER, RING_ECHO_LAYER, RING_LAYER].sort());
  });

  it('marks the site with the ring on the cover and the outline on a step, never both', () => {
    const { fake, stage } = opened();
    expect(fake.getLayer(RING_LAYER)).toBeDefined();
    expect(fake.getLayer(OUTLINE_LAYER)).toBeUndefined();
    stage.mark('outline', BOUNDS, { echoes: RING_ECHOES, fadeMs: OUTLINE_FADE_MS });
    expect(fake.getLayer(OUTLINE_LAYER)).toBeDefined();
    expect([RING_LAYER, RING_ECHO_LAYER].map((id) => fake.getLayer(id))).toEqual([undefined, undefined]);
    stage.mark('ring', BOUNDS, { echoes: 0, fadeMs: 0 });
    expect(fake.getLayer(OUTLINE_LAYER)).toBeUndefined();
    expect(fake.getLayer(RING_LAYER)).toBeDefined();
  });

  it('takes the canvas container and the zoom corner (inert) and gives back only what it took', () => {
    const fake = new FakeMap(withData());
    fake.corner.setAttribute('inert', ''); // inert before the story: not the story's to give back
    const stage = new Stage(asMap(fake));
    stage.enter();
    stage.enter();
    expect(fake.canvasContainer.hasAttribute('inert')).toBe(true);
    stage.leave(0);
    expect(fake.canvasContainer.hasAttribute('inert')).toBe(false);
    expect(fake.corner.hasAttribute('inert')).toBe(true);
  });

  it('leave() removes everything but the lifting night at once, gives the labels back, stops the camera; then the night goes', () => {
    const before = labelPaint(new FakeMap(withData()));
    const { fake, stage } = opened();
    stage.mark('outline', BOUNDS, { echoes: 0, fadeMs: OUTLINE_FADE_MS });
    stage.go({ center: [10.2, 20.15], zoom: 6 }, { animate: true }, () => undefined);
    expect(fake.isMoving()).toBe(true);
    stage.leave(NIGHT_MS);
    expect(fake.isMoving()).toBe(false);
    expect(fake.ids().filter((id) => id.startsWith(STORY_PREFIX))).toEqual([NIGHT_LAYER]);
    expect([...fake.sources.keys()].filter((id) => id.startsWith(STORY_PREFIX))).toEqual([]);
    expect(labelPaint(fake)).toEqual(before);
    expect(fake.canvasContainer.hasAttribute('inert')).toBe(false);
    vi.advanceTimersByTime(NIGHT_MS + 100);
    expect(fake.ids().filter((id) => id.startsWith(STORY_PREFIX))).toEqual([]);
    expect(fake.ids()).toEqual(withData().map((l) => l.id));
  });

  it('leave(0) removes everything at once, also while the ring still pulses; a removeStoryLayers keeps what it is told to', () => {
    const { fake, stage } = opened();
    expect(fake.getLayer(RING_ECHO_LAYER)).toBeDefined();
    stage.leave(0);
    expect(fake.ids()).toEqual(withData().map((l) => l.id));
    expect(fake.sources.size).toBe(0);
    vi.advanceTimersByTime(30_000); // a pending echo finds its layer gone and adds nothing
    expect(fake.ids()).toEqual(withData().map((l) => l.id));
    const again = opened().fake;
    removeStoryLayers(asMap(again), [NIGHT_LAYER]);
    expect(again.ids().filter((id) => id.startsWith(STORY_PREFIX))).toEqual([NIGHT_LAYER]);
  });

  describe('go: the camera', () => {
    const cameraCalls = (fake: FakeMap) => fake.calls.filter((c) => ['easeTo', 'flyTo', 'jumpTo'].includes(c.name)).map((c) => ({ name: c.name, options: c.args[0] as Camera }));

    it('jumps when asked (a move of no duration), and calls onArrived once', () => {
      const fake = new FakeMap(basemap());
      const arrived = vi.fn();
      new Stage(asMap(fake)).go({ center: [10.2, 20.15], zoom: 6 }, { animate: false }, arrived);
      expect(cameraCalls(fake)).toEqual([{ name: 'easeTo', options: { center: [10.2, 20.15], zoom: 6, duration: 0 } }]);
      expect(arrived).toHaveBeenCalledTimes(1);
      expect(fake.center).toEqual([10.2, 20.15]);
      fake.fire('moveend');
      expect(arrived).toHaveBeenCalledTimes(1);
      expect(fake.listening('moveend')).toBe(0);
    });

    it('glides: an ease for a small change of zoom, a flight for one of more than 3; onArrived on the moveend, once', () => {
      const fake = new FakeMap(basemap());
      const stage = new Stage(asMap(fake));
      const arrived = vi.fn();
      stage.go({ center: [10.2, 20.15], zoom: 7 }, { animate: true }, arrived);
      expect(cameraCalls(fake)).toMatchObject([{ name: 'easeTo', options: { center: [10.2, 20.15], zoom: 7, duration: CAMERA_EASE_MS } }]);
      expect(typeof cameraCalls(fake)[0]!.options.easing).toBe('function');
      expect(arrived).not.toHaveBeenCalled();
      fake.arrive();
      fake.fire('moveend');
      expect(arrived).toHaveBeenCalledTimes(1);
      stage.go({ center: [10.2, 20.15], zoom: 11 }, { animate: true }, arrived);
      expect(cameraCalls(fake)[1]).toMatchObject({ name: 'flyTo', options: { center: [10.2, 20.15], zoom: 11, duration: CAMERA_FLY_MS, curve: 1.42 } });
      fake.arrive();
      expect(arrived).toHaveBeenCalledTimes(2);
    });

    it('never passes `essential` (MapLibre then jumps by itself under reduced motion)', () => {
      const fake = new FakeMap(basemap());
      const stage = new Stage(asMap(fake));
      stage.go({ center: [10.2, 20.15], zoom: 7 }, { animate: true }, () => undefined);
      stage.finish();
      stage.go({ center: [10.2, 20.15], zoom: 12 }, { animate: true }, () => undefined);
      fake.arrive();
      stage.go({ bounds: BOUNDS }, { animate: false, offsetShare: 0.24 }, () => undefined);
      expect(cameraCalls(fake).length).toBe(4);
      for (const { options } of cameraCalls(fake)) expect('essential' in options).toBe(false);
    });

    it('frames bounds with the padding, and lands the centre right of the middle by the share asked', () => {
      const fake = new FakeMap(basemap());
      const arrived = vi.fn();
      new Stage(asMap(fake)).go({ bounds: BOUNDS }, { animate: false, offsetShare: 0.24 }, arrived);
      expect(fake.callsOf('cameraForBounds')).toEqual([[BOUNDS, { padding: BOUNDS_PADDING_PX }]]);
      expect(cameraCalls(fake)[0]!.options.offset).toEqual([240, 0]);
      const at = fake.project([(BOUNDS[0] + BOUNDS[2]) / 2, (BOUNDS[1] + BOUNDS[3]) / 2]);
      expect(at.x).toBeCloseTo(fake.width / 2 + 240, 6);
      expect(at.y).toBeCloseTo(fake.height / 2, 6);
      expect(arrived).toHaveBeenCalledTimes(1);
    });

    it('already there: nothing moves, and onArrived is called at once', () => {
      const fake = new FakeMap(basemap());
      const stage = new Stage(asMap(fake));
      stage.go({ center: [10.2, 20.15], zoom: 7 }, { animate: false }, () => undefined);
      const arrived = vi.fn();
      stage.go({ center: [10.2, 20.15], zoom: 7 }, { animate: true }, arrived);
      expect(cameraCalls(fake)).toHaveLength(1);
      expect(arrived).toHaveBeenCalledTimes(1);
    });

    it('is cancellable: a step left early never hears its arrival, and the next move is its own', () => {
      const fake = new FakeMap(basemap());
      const stage = new Stage(asMap(fake));
      const first = vi.fn();
      const second = vi.fn();
      const cancel = stage.go({ center: [10.2, 20.15], zoom: 7 }, { animate: true }, first);
      cancel();
      expect(fake.listening('moveend')).toBe(0);
      stage.go({ center: [11, 21], zoom: 7.5 }, { animate: true }, second);
      fake.arrive();
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
      expect(fake.center).toEqual([11, 21]);
    });

    it('finish() lands on the target at once, with onArrived called once; with nothing moving it does nothing', () => {
      const fake = new FakeMap(basemap());
      const stage = new Stage(asMap(fake));
      const arrived = vi.fn();
      stage.go({ center: [10.2, 20.15], zoom: 12 }, { animate: true, offsetShare: 0.24 }, arrived);
      expect(fake.isMoving()).toBe(true);
      stage.finish();
      expect(fake.isMoving()).toBe(false);
      expect(fake.zoom).toBe(12);
      const at = fake.project([10.2, 20.15]);
      expect(at.x).toBeCloseTo(fake.width / 2 + 240, 6);
      expect(at.y).toBeCloseTo(fake.height / 2, 6);
      expect(arrived).toHaveBeenCalledTimes(1);
      const calls = fake.calls.length;
      stage.finish();
      expect(fake.calls.length).toBe(calls);
    });
  });
});
