import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Layer } from '../../src/contract/manifest';
import type { MapErrorReport } from '../../src/map/mapErrors';

// The controller talks to MapLibre and the cog:// protocol; both are replaced by small fakes here.
const failing = new Set<string>();
vi.mock('../../src/map/maplibre', () => ({
  cog: {
    getCogMetadata: async (url: string) => {
      if (failing.has(url)) throw new Error('Request failed');
      return { scale: 1, offset: 0 };
    },
    setColorFunction: () => undefined,
  },
  maplibregl: {},
}));
const { DataLayerController, PRELOAD_LIMIT, PREVIOUS_PICTURE_LIMIT_MS } = await import('../../src/map/dataLayers');

/**
 * A stand-in for the MapLibre map: sources, layers with their opacity, the paint and the source
 * spec each layer was added with, event listeners (`fire` plays an event, with the data MapLibre
 * gives it: an 'error' about a source carries its `sourceId`, and `tile` when it is about one
 * tile), and `loading`: the
 * sources that still have requests in flight (isSourceLoaded is false for them; a new source is
 * loading until `finish(id)` says it has loaded, or failed, and the map renders).
 */
function fakeMap() {
  const sources = new Map<string, Record<string, unknown> & { setUrl: (url: string) => void }>();
  const layers = new Map<string, number>();
  const specs = new Map<string, Record<string, unknown>>();
  const listeners = new Map<string, Set<(e?: unknown) => void>>();
  const loading = new Set<string>();
  const setUrlCalls: string[] = [];
  return {
    sources,
    layers,
    specs,
    loading,
    setUrlCalls,
    listenerCount: () => [...listeners.values()].reduce((n, set) => n + set.size, 0),
    fire: (event: string, data?: Record<string, unknown>) => [...(listeners.get(event) ?? [])].forEach((fn) => fn(data)),
    on: (event: string, fn: (e?: unknown) => void) => void listeners.set(event, (listeners.get(event) ?? new Set()).add(fn)),
    off: (event: string, fn: (e?: unknown) => void) => void listeners.get(event)?.delete(fn),
    addSource: (id: string, spec: Record<string, unknown>) => {
      loading.add(id);
      sources.set(id, {
        ...spec,
        setUrl(url: string) {
          this.url = url;
          setUrlCalls.push(url);
          loading.add(id);
        },
      });
    },
    addLayer: (spec: { id: string; paint?: Record<string, unknown> }) => {
      layers.set(spec.id, Number(spec.paint?.['raster-opacity'] ?? 1));
      specs.set(spec.id, spec);
    },
    removeLayer: (id: string) => void layers.delete(id),
    removeSource: (id: string) => {
      sources.delete(id);
      loading.delete(id);
    },
    getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
    getSource: (id: string) => sources.get(id),
    isSourceLoaded: (id: string) => !loading.has(id),
    setPaintProperty: (id: string, _key: string, value: number) => void layers.set(id, value),
    getStyle: () => ({ layers: [] }),
  };
}

const layer = {
  id: 'hh',
  title: 'HH',
  unit: 'dB',
  kind: 'per-date',
  description: '',
  encoding: { type: 'linear-uint8', nodata: 0, lo: -35, hi: 5 },
  items: [{ url: 'a.tif' }, { url: 'b.tif' }],
} as unknown as Layer;
const URLS = ['https://example.org/data/sample/hh_2008-10-12.tif', 'https://example.org/data/sample/hh_2008-11-27.tif'];

describe('DataLayerController', () => {
  beforeEach(() => failing.clear());

  it('still draws the other dates when the first file cannot be read, and names the bad file', async () => {
    failing.add(URLS[0]!);
    const map = fakeMap();
    const reports: (MapErrorReport | null)[] = [];
    const controller = new DataLayerController(map as never, (r) => reports.push(r));
    await controller.setLayer({ layer, urls: URLS }, 0, 1);
    expect(map.sources.size).toBe(2);
    expect(reports[0]).toBeNull(); // old problems are cleared when a new layer starts
    expect(reports.slice(1)).toEqual([{ message: 'Could not read hh_2008-10-12.tif: Request failed', url: URLS[0] }]);
    // Stepping to the good date draws it.
    controller.show(1);
    expect([...map.layers.values()]).toEqual([0, 1]);
  });

  it('reads the header of the file being shown, not always the first', async () => {
    failing.add(URLS[1]!);
    const reports: (MapErrorReport | null)[] = [];
    await new DataLayerController(fakeMap() as never, (r) => reports.push(r)).setLayer({ layer, urls: URLS }, 1, 1);
    expect(reports.slice(1).map((r) => r?.url)).toEqual([URLS[1]]);
  });

  it('passes the site citation to the map as the attribution of every data source', async () => {
    const map = fakeMap();
    await new DataLayerController(map as never, () => undefined).setLayer({ layer, urls: URLS, attribution: 'Data: someone' }, 0, 1);
    expect([...map.sources.values()].map((s) => s.attribution)).toEqual(['Data: someone', 'Data: someone']);
  });

  it('knows which file a map source draws, so a map error can name it', async () => {
    const map = fakeMap();
    const controller = new DataLayerController(map as never, () => undefined);
    await controller.setLayer({ layer, urls: URLS }, 0, 1);
    const [first] = [...map.sources.keys()];
    expect(controller.urlForSource(first)).toBe(URLS[0]);
    expect(controller.urlForSource('openmaptiles')).toBeUndefined();
  });
});

// A layer with more dates than PRELOAD_LIMIT: one source at a time, replaced by a fresh one per date.
const MANY = Array.from({ length: PRELOAD_LIMIT + 2 }, (_, i) => `https://example.org/data/year/hh_${String(i).padStart(2, '0')}.tif`);
const manyLayer = { ...layer, items: MANY.map((url) => ({ url })) } as unknown as Layer;
/** The file a cog:// source URL points at. */
const fileOf = (cogUrl: unknown) => String(cogUrl).replace('cog://', '').split('#')[0];

describe('DataLayerController, more dates than PRELOAD_LIMIT (one source at a time)', () => {
  afterEach(() => vi.useRealTimers());

  async function setUp(index = 0) {
    const map = fakeMap();
    const drawn: (number | null)[] = [];
    const controller = new DataLayerController(map as never, () => undefined, (i) => drawn.push(i));
    await controller.setLayer({ layer: manyLayer, urls: MANY }, index, 1);
    /** The map's sources as [file, opacity], in the order they were added. */
    const onMap = () => [...map.sources.entries()].map(([id, s]) => [fileOf(s.url), map.layers.get(id)] as const);
    /** The source of a file, by its id. */
    const idOf = (i: number) => [...map.sources.entries()].find(([, s]) => fileOf(s.url) === MANY[i])?.[0];
    /** The file of item i has loaded (or failed: event 'error', about its source), and the map renders. */
    const finish = (i: number, event = 'render') => {
      const id = idOf(i)!;
      map.loading.delete(id);
      map.fire(event, event === 'error' ? { sourceId: id } : undefined);
    };
    finish(index);
    return { map, drawn, controller, onMap, idOf, finish };
  }

  it('draws one source, for the date asked for', async () => {
    const { onMap } = await setUp(3);
    expect(onMap()).toEqual([[MANY[3], 1]]);
  });

  it('loads a new date in a fresh source, then shows it and removes the old one at once', async () => {
    const { map, controller, onMap, finish } = await setUp(3);
    controller.show(4);
    // The old picture stays while the new one loads unseen.
    expect(onMap()).toEqual([
      [MANY[3], 1],
      [MANY[4], 0],
    ]);
    map.fire('render');
    expect(onMap()).toHaveLength(2);
    finish(4);
    expect(onMap()).toEqual([[MANY[4], 1]]);
    expect(map.setUrlCalls).toEqual([]); // never setUrl: a late answer would land in the source
  });

  it('drops a date still loading when another is asked for, so its late answer lands in a removed source', async () => {
    const { map, controller, onMap, idOf, finish } = await setUp(0);
    controller.show(1);
    const first = idOf(1)!;
    controller.show(2);
    expect(map.sources.has(first)).toBe(false);
    expect(onMap()).toEqual([
      [MANY[0], 1],
      [MANY[2], 0],
    ]);
    finish(2);
    expect(onMap()).toEqual([[MANY[2], 1]]);
    // Going back to the date on screen drops the one loading, and shows the picture already there.
    controller.show(3);
    controller.show(2);
    expect(onMap()).toEqual([[MANY[2], 1]]);
  });

  it("shows nothing for a date whose file fails, never the previous date's picture", async () => {
    const { controller, onMap, finish } = await setUp(0);
    controller.show(1);
    finish(1, 'error'); // MapLibre counts a source that failed as loaded
    expect(onMap()).toEqual([[MANY[1], 1]]);
  });

  it('stops showing the previous picture after PREVIOUS_PICTURE_LIMIT_MS when the new file does not answer', async () => {
    vi.useFakeTimers();
    const { controller, onMap, finish } = await setUp(0);
    controller.show(1);
    controller.show(2); // the limit counts from when the picture on screen stopped being the date asked for
    vi.advanceTimersByTime(PREVIOUS_PICTURE_LIMIT_MS - 1);
    expect(onMap()).toEqual([
      [MANY[0], 1],
      [MANY[2], 0],
    ]);
    vi.advanceTimersByTime(1);
    expect(onMap()).toEqual([[MANY[2], 0]]);
    finish(2);
    expect(onMap()).toEqual([[MANY[2], 1]]);
  });

  it('keeps the previous picture when the new one loads in time, and starts the limit afresh for the next date', async () => {
    vi.useFakeTimers();
    const { controller, onMap, finish } = await setUp(0);
    controller.show(1);
    vi.advanceTimersByTime(PREVIOUS_PICTURE_LIMIT_MS - 100);
    finish(1);
    controller.show(2);
    vi.advanceTimersByTime(PREVIOUS_PICTURE_LIMIT_MS - 1);
    expect(onMap()).toEqual([
      [MANY[1], 1],
      [MANY[2], 0],
    ]);
  });

  it('show() right after setLayer, before the layer is set up, shows that date', async () => {
    const map = fakeMap();
    const controller = new DataLayerController(map as never, () => undefined);
    const ready = controller.setLayer({ layer: manyLayer, urls: MANY }, 0, 1);
    controller.show(5);
    await ready;
    expect([...map.sources.values()].map((s) => fileOf(s.url))).toEqual([MANY[5]]);
    expect([...map.layers.values()]).toEqual([1]);
  });

  it('a new layer removes the date still loading and its timer', async () => {
    vi.useFakeTimers();
    const { map, controller } = await setUp(0);
    controller.show(1);
    await controller.setLayer({ layer, urls: URLS }, 1, 1);
    vi.advanceTimersByTime(PREVIOUS_PICTURE_LIMIT_MS);
    map.fire('render');
    expect([...map.sources.values()].map((s) => s.url)).toHaveLength(2);
    expect([...map.layers.values()]).toEqual([0, 1]);
  });

  it('opacity applies to the picture on screen, and to a new one when it is shown', async () => {
    const { controller, onMap, finish } = await setUp(0);
    controller.show(1);
    controller.setOpacity(0.5);
    expect(onMap()).toEqual([
      [MANY[0], 0.5],
      [MANY[1], 0],
    ]);
    finish(1);
    expect(onMap()).toEqual([[MANY[1], 0.5]]);
  });

  it('names the file of every source, also of one removed, so a late error names the right file', async () => {
    const { controller, idOf, finish } = await setUp(0);
    const old = idOf(0)!;
    controller.show(1);
    const next = idOf(1)!;
    finish(1);
    expect(controller.urlForSource(next)).toBe(MANY[1]);
    expect(controller.urlForSource(old)).toBe(MANY[0]);
  });

  it('says a date is drawn on the first idle after it is on screen, and not while it loads', async () => {
    const { map, controller, drawn, idOf } = await setUp(0);
    expect(drawn).toEqual([null]); // setLayer
    map.fire('idle');
    expect(drawn.at(-1)).toBe(0);
    map.fire('idle'); // said once per date
    expect(drawn.filter((d) => d === 0)).toHaveLength(1);
    controller.show(1);
    expect(drawn.at(-1)).toBeNull();
    controller.show(2);
    map.fire('idle');
    expect(drawn.at(-1)).toBeNull();
    map.loading.delete(idOf(2)!);
    map.fire('idle'); // idle also shows a source that has loaded
    expect(drawn.at(-1)).toBe(2);
    expect(drawn).not.toContain(1);
  });

  it('says which picture is on the map: the previous date while the next loads, never the date asked for', async () => {
    vi.useFakeTimers();
    const map = fakeMap();
    const shown: (string | null)[] = [];
    const controller = new DataLayerController(
      map as never,
      () => undefined,
      () => undefined,
      (p) => shown.push(p ? `${p.layer.id}:${p.index}${p.failed ? ' failed' : ''}` : null),
    );
    await controller.setLayer({ layer: manyLayer, urls: MANY }, 3, 1);
    const idOf = (i: number) => [...map.sources.entries()].find(([, s]) => fileOf(s.url) === MANY[i])?.[0];
    const finish = (i: number, event = 'render') => {
      const id = idOf(i)!;
      map.loading.delete(id);
      map.fire(event, event === 'error' ? { sourceId: id } : undefined);
    };
    expect(shown).toEqual([]); // nothing on the map yet
    map.fire('render');
    expect(shown).toEqual([]); // still loading
    finish(3);
    expect(shown).toEqual(['hh:3']);
    // The next date loads unseen: the map still shows date 3, and says so.
    controller.show(4);
    map.fire('render');
    map.fire('idle');
    expect(shown).toEqual(['hh:3']);
    finish(4);
    expect(shown).toEqual(['hh:3', 'hh:4']);
    // A file that takes too long: once the previous picture leaves the map, none is shown.
    controller.show(5);
    vi.advanceTimersByTime(PREVIOUS_PICTURE_LIMIT_MS);
    expect(shown.at(-1)).toBeNull();
    finish(5, 'error'); // failed: it is on the map now, as no picture, and is reported as failed
    expect(shown.at(-1)).toBe('hh:5 failed');
    // Back to the item on the map: it stays named; a new layer clears it.
    controller.show(6);
    controller.show(5);
    expect(shown.at(-1)).toBe('hh:5 failed');
    await controller.setLayer({ layer, urls: URLS }, 0, 1);
    expect(shown.at(-1)).toBeNull();
    expect(shown.filter((s) => s !== null)).not.toContain('hh:6');
  });

  it('reports a date whose file failed as failed, never as a picture drawn; an error about one tile or another source does not count', async () => {
    const map = fakeMap();
    const shown: (string | null)[] = [];
    const controller = new DataLayerController(
      map as never,
      () => undefined,
      () => undefined,
      (p) => shown.push(p ? `${p.index}${p.failed ? ' failed' : ''}` : null),
    );
    await controller.setLayer({ layer: manyLayer, urls: MANY }, 0, 1);
    const idOf = (i: number) => [...map.sources.entries()].find(([, s]) => fileOf(s.url) === MANY[i])?.[0];
    const onMap = () => [...map.sources.entries()].map(([id, s]) => [fileOf(s.url), map.layers.get(id)] as const);
    map.loading.delete(idOf(0)!);
    map.fire('render');
    expect(shown).toEqual(['0']);
    // Date 1's file fails: MapLibre counts its source as loaded, so it replaces date 0's picture
    // and draws nothing, and the controller says so.
    controller.show(1);
    map.loading.delete(idOf(1)!);
    map.fire('error', { sourceId: idOf(1) });
    expect(onMap()).toEqual([[MANY[1], 1]]);
    expect(shown).toEqual(['0', '1 failed']);
    map.fire('render');
    map.fire('idle');
    expect(shown).toEqual(['0', '1 failed']);
    // Date 2: one tile fails, the rest of its picture is drawn; the basemap's error is not ours.
    controller.show(2);
    map.fire('error', { sourceId: idOf(2), tile: {} });
    map.fire('error', { sourceId: 'openmaptiles' });
    map.loading.delete(idOf(2)!);
    map.fire('render');
    expect(shown).toEqual(['0', '1 failed', '2']);
    // The first file of a layer can fail too.
    await controller.setLayer({ layer: manyLayer, urls: MANY }, 4, 1);
    map.loading.delete(idOf(4)!);
    map.fire('error', { sourceId: idOf(4) });
    expect(shown.slice(3)).toEqual([null, '4 failed']);
  });

  it('stops listening to the map when disposed', async () => {
    const { map, controller } = await setUp(0);
    expect(map.listenerCount()).toBe(3);
    controller.dispose();
    expect(map.listenerCount()).toBe(0);
  });
});

describe('DataLayerController, up to PRELOAD_LIMIT dates (one source each)', () => {
  it('has one source per date and says a date is drawn when the map is idle after showing it', async () => {
    const map = fakeMap();
    const drawn: (number | null)[] = [];
    const controller = new DataLayerController(map as never, () => undefined, (i) => drawn.push(i));
    await controller.setLayer({ layer, urls: URLS }, 0, 1);
    expect(map.sources.size).toBe(URLS.length);
    map.fire('idle');
    expect(drawn.at(-1)).toBe(0);
    // The picture was already loaded: it is drawn on the next idle all the same.
    controller.show(1);
    expect(drawn.at(-1)).toBeNull();
    map.fire('idle');
    expect(drawn.at(-1)).toBe(1);
  });

  it('says which picture is on the map: at once when the next file has loaded unseen, else once it has', async () => {
    const map = fakeMap();
    const shown: (number | null)[] = [];
    const controller = new DataLayerController(
      map as never,
      () => undefined,
      () => undefined,
      (p) => shown.push(p ? p.index : null),
    );
    await controller.setLayer({ layer, urls: URLS }, 0, 1);
    const [first, second] = [...map.sources.keys()];
    map.fire('render');
    expect(shown).toEqual([]); // nothing has loaded yet
    map.loading.delete(first!);
    map.fire('render');
    expect(shown).toEqual([0]);
    // Date 1 has not loaded yet: its opacity flips at once, so neither date's picture is on the map.
    controller.show(1);
    expect(shown).toEqual([0, null]);
    map.loading.delete(second!);
    map.fire('render');
    expect(shown).toEqual([0, null, 1]);
    // Both loaded: the switch is at once.
    controller.show(0);
    expect(shown).toEqual([0, null, 1, 0]);
  });

  it('reports a date whose file failed as failed: at once when it failed unseen, else when it fails', async () => {
    const map = fakeMap();
    const shown: (string | null)[] = [];
    const controller = new DataLayerController(
      map as never,
      () => undefined,
      () => undefined,
      (p) => shown.push(p ? `${p.index}${p.failed ? ' failed' : ''}` : null),
    );
    await controller.setLayer({ layer, urls: URLS }, 0, 1);
    let [first, second] = [...map.sources.keys()];
    map.loading.delete(first!);
    map.fire('render');
    // Date 1's file fails while unseen: date 0 is still the picture on the map.
    map.loading.delete(second!);
    map.fire('error', { sourceId: second });
    expect(shown).toEqual(['0']);
    controller.show(1);
    expect(shown).toEqual(['0', '1 failed']);
    controller.show(0);
    expect(shown).toEqual(['0', '1 failed', '0']);
    // Date 1's file fails after the switch.
    await controller.setLayer({ layer, urls: URLS }, 0, 1);
    [first, second] = [...map.sources.keys()];
    map.loading.delete(first!);
    map.fire('render');
    controller.show(1);
    map.loading.delete(second!);
    map.fire('error', { sourceId: second });
    expect(shown.slice(3)).toEqual([null, '0', null, '1 failed']);
  });

  it('switches dates without any fade or transition', async () => {
    const map = fakeMap();
    await new DataLayerController(map as never, () => undefined).setLayer({ layer, urls: URLS }, 0, 1);
    for (const spec of map.specs.values())
      expect(spec.paint).toMatchObject({ 'raster-fade-duration': 0, 'raster-opacity-transition': { duration: 0, delay: 0 } });
  });
});
