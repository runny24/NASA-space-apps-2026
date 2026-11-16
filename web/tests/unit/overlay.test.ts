// The overlay file loader (contract/overlay.ts), the nearest-point search (map/nearestPoint.ts),
// the order of the map's layers (map/layerOrder.ts), the overlay map controller and its filter
// (map/overlayLayers.ts), and what the app shows of an overlay (state/overlayView.ts).

// MapLibre's own filter evaluator (installed with maplibre-gl; nothing added to package.json).
import { featureFilter } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import type { Overlay } from '../../src/contract/manifest';
import { loadOverlay, readOverlay, type OverlayPoint } from '../../src/contract/overlay';
import { beforeIdFor } from '../../src/map/layerOrder';
import { nearestPoint, pixelDistance, POINT_REACH_PX } from '../../src/map/nearestPoint';
import { DAY_KEY, OverlayController, overlayFilter, overlayMapData, overlayMapId, overlaySourceData } from '../../src/map/overlayLayers';
import { overlayWindow, pointInWindow, type OverlayWindow } from '../../src/state/overlayPeriod';
import { NOT_AVAILABLE, fieldText, overlayView, pointReading } from '../../src/state/overlayView';

const feature = (geometry: unknown, properties: unknown = {}) => ({ type: 'Feature', geometry, properties });
const pt = (lon: number, lat: number, properties: Record<string, unknown> = {}) => feature({ type: 'Point', coordinates: [lon, lat] }, properties);
const collection = (features: unknown[]) => ({ type: 'FeatureCollection', features });

describe('readOverlay and loadOverlay', () => {
  it('keeps the Points with two finite coordinates, in file order, and counts the others', () => {
    const loaded = readOverlay(
      collection([
        pt(1, 2, { day: '2026-10-01' }),
        feature({ type: 'LineString', coordinates: [[0, 0], [1, 1]] }),
        feature({ type: 'Point', coordinates: [Number.NaN, 2] }),
        feature({ type: 'Point', coordinates: [1] }),
        feature({ type: 'Point', coordinates: ['1', '2'] }),
        feature({ type: 'Point', coordinates: [1, 95] }),
        feature(null),
        { type: 'NotAFeature' },
        null,
        feature({ type: 'Point', coordinates: [3, 4, 120] }, { day: '2026-10-02' }),
      ]),
      'day',
    );
    expect(loaded.skipped).toBe(8);
    expect(loaded.points).toEqual([
      { index: 0, lon: 1, lat: 2, day: '2026-10-01', properties: { day: '2026-10-01' } },
      { index: 1, lon: 3, lat: 4, day: '2026-10-02', properties: { day: '2026-10-02' } },
    ]);
  });

  it('gives a point no day when its date is missing or not a YYYY-MM-DD day, or the overlay has no date property', () => {
    const features = ['2026-9-5', '2026-02-30', 20261005, null, undefined, '2026-10-05T00:00:00Z'].map((day) => pt(0, 0, day === undefined ? {} : { day }));
    expect(readOverlay(collection(features), 'day').points.map((p) => p.day)).toEqual([null, null, null, null, null, null]);
    expect(readOverlay(collection([pt(0, 0, { day: '2026-10-05' })]), undefined).points[0]!.day).toBeNull();
    // A feature without properties keeps an empty object, so a field reads "not available".
    expect(readOverlay(collection([feature({ type: 'Point', coordinates: [0, 0] }, null)]), 'day').points[0]!.properties).toEqual({});
  });

  it('refuses a file that is not a GeoJSON FeatureCollection, in words fit for a person', () => {
    for (const json of [null, [], { type: 'Feature' }, { type: 'FeatureCollection' }, { type: 'FeatureCollection', features: {} }])
      expect(() => readOverlay(json, 'day')).toThrow('The file of this overlay is not a GeoJSON FeatureCollection, so nothing is drawn.');
  });

  const answer = (body: string, status = 200) => (async () => new Response(body, { status })) as unknown as typeof fetch;

  it('loads a file, and says why when it cannot', async () => {
    const ok = await loadOverlay('https://x/o.geojson', 'day', answer(JSON.stringify(collection([pt(1, 2, { day: '2026-10-01' })]))));
    expect(ok.points).toHaveLength(1);
    await expect(loadOverlay('https://x/o.geojson', 'day', answer('', 404))).rejects.toThrow('Could not load the file of this overlay (HTTP 404), so nothing is drawn.');
    await expect(loadOverlay('https://x/o.geojson', 'day', answer('<html>'))).rejects.toThrow('The file of this overlay is not valid JSON, so nothing is drawn.');
    await expect(loadOverlay('https://x/o.geojson', 'day', answer('{"type":"Topology"}'))).rejects.toThrow('not a GeoJSON FeatureCollection');
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    await expect(loadOverlay('https://x/o.geojson', 'day', offline)).rejects.toThrow('Could not reach the file of this overlay. Check the network connection.');
  });
});

describe('nearestPoint', () => {
  const at = (lon: number, lat: number, index = 0) => ({ lon, lat, index });
  // At zoom 10 a pixel is 360 / (512 * 1024) degrees of longitude.
  const px = (n: number, zoom = 10) => (n * 360) / (512 * 2 ** zoom);

  it('measures screen pixels at the zoom: the same gap is twice as many pixels one zoom in', () => {
    expect(pixelDistance({ lon: 0, lat: 0 }, { lon: px(10), lat: 0 }, 10)).toBeCloseTo(10, 6);
    expect(pixelDistance({ lon: 0, lat: 0 }, { lon: px(10), lat: 0 }, 11)).toBeCloseTo(20, 6);
  });

  it('finds the nearest point within reach and counts every point within reach', () => {
    const points = [at(px(9), 0, 0), at(px(3), 0, 1), at(0, -px(6), 2), at(px(40), 0, 3)];
    expect(nearestPoint({ lon: 0, lat: 0 }, points, 10)).toEqual({ point: points[1], withinReach: 3 });
  });

  it('reaches POINT_REACH_PX pixels and no further', () => {
    expect(POINT_REACH_PX).toBe(12);
    expect(nearestPoint({ lon: 0, lat: 0 }, [at(px(11.9), 0)], 10)).not.toBeNull();
    expect(nearestPoint({ lon: 0, lat: 0 }, [at(px(12.1), 0)], 10)).toBeNull();
    expect(nearestPoint({ lon: 0, lat: 0 }, [at(px(12.1), 0)], 11)).toBeNull();
    expect(nearestPoint({ lon: 0, lat: 0 }, [at(px(12.1), 0)], 9)).not.toBeNull(); // about 6 px one zoom out
  });

  it('on a tie, the first point in the list', () => {
    const points = [at(px(5), 0, 0), at(-px(5), 0, 1)];
    expect(nearestPoint({ lon: 0, lat: 0 }, points, 10)!.point.index).toBe(0);
    expect(nearestPoint({ lon: 0, lat: 0 }, [...points].reverse(), 10)!.point.index).toBe(1);
  });

  it('across the 180th meridian, the short way round', () => {
    const east = at(180 - px(2), 0, 0);
    expect(nearestPoint({ lon: -180 + px(3), lat: 0 }, [east], 10)).toEqual({ point: east, withinReach: 1 });
    expect(pixelDistance({ lon: 179.99, lat: 0 }, { lon: -179.99, lat: 0 }, 0)).toBeCloseTo((0.02 / 360) * 512, 6);
  });

  it('nothing within reach, or no points: null', () => {
    expect(nearestPoint({ lon: 0, lat: 0 }, [at(1, 1)], 10)).toBeNull();
    expect(nearestPoint({ lon: 0, lat: 0 }, [], 10)).toBeNull();
  });
});

describe('beforeIdFor (the order of the map layers)', () => {
  const basemap = [
    { id: 'background', type: 'background' },
    { id: 'water', type: 'fill' },
    { id: 'roads', type: 'line' },
    { id: 'place-labels', type: 'symbol' },
    { id: 'poi-labels', type: 'symbol' },
  ];
  it('rasters go under the labels; with overlays on, under the first overlay', () => {
    expect(beforeIdFor('data', basemap)).toBe('place-labels');
    const withOverlay = [...basemap.slice(0, 3), { id: 'data-1-0', type: 'raster' }, { id: 'overlay-a', type: 'circle' }, ...basemap.slice(3)];
    expect(beforeIdFor('data', withOverlay)).toBe('overlay-a');
  });
  it('circles go under the labels, above any raster', () => {
    const withData = [...basemap.slice(0, 3), { id: 'data-1-0', type: 'raster' }, ...basemap.slice(3)];
    expect(beforeIdFor('overlay', withData)).toBe('place-labels');
  });
  it('a map with no labels: on top', () => {
    expect(beforeIdFor('data', basemap.slice(0, 3))).toBeUndefined();
    expect(beforeIdFor('overlay', basemap.slice(0, 3))).toBeUndefined();
    expect(beforeIdFor('data', [{ id: 'overlay-a', type: 'circle' }])).toBe('overlay-a');
  });

  // While the guided story is open: its night lies under every raster, its outline and ring lie with
  // the circles, over every raster and under the labels (map/layerOrder.ts, story/stageLayers.ts).
  const night = { id: 'story-night', type: 'background' };
  const outline = { id: 'story-outline', type: 'line' };
  const ring = { id: 'story-site', type: 'circle' };
  it("a raster added while the story is open goes above the night (the night does not count), under its outline or ring", () => {
    expect(beforeIdFor('data', [...basemap.slice(0, 3), night, ...basemap.slice(3)])).toBe('place-labels');
    const withData = [...basemap.slice(0, 3), night, { id: 'data-1-0', type: 'raster' }];
    expect(beforeIdFor('data', [...withData, outline, ...basemap.slice(3)])).toBe('story-outline');
    expect(beforeIdFor('data', [...withData, ring, { id: 'story-site-echo', type: 'circle' }, ...basemap.slice(3)])).toBe('story-site');
  });
  it('under whichever comes first of the circles and the marks', () => {
    const withData = [...basemap.slice(0, 3), night, { id: 'data-1-0', type: 'raster' }];
    expect(beforeIdFor('data', [...withData, outline, { id: 'overlay-a', type: 'circle' }, ...basemap.slice(3)])).toBe('story-outline');
    expect(beforeIdFor('data', [...withData, { id: 'overlay-a', type: 'circle' }, outline, ...basemap.slice(3)])).toBe('overlay-a');
    // A map with no labels: still under the marks, never on top of them.
    expect(beforeIdFor('data', [...withData, outline])).toBe('story-outline');
    expect(beforeIdFor('data', [night])).toBeUndefined();
  });
  it('the circles and the marks still go under the labels, above the night and the rasters', () => {
    const layers = [...basemap.slice(0, 3), night, { id: 'data-1-0', type: 'raster' }, outline, ...basemap.slice(3)];
    expect(beforeIdFor('overlay', layers)).toBe('place-labels');
    expect(beforeIdFor('overlay', [...basemap.slice(0, 3), night])).toBeUndefined();
  });
});

describe('the map filter draws exactly the points the caption counts', () => {
  const days = ['2026-09-30', '2026-10-01', '2026-10-03', '2026-10-05', '2026-10-06', null];
  // The file's own properties may hold the app's key too (here a different day, or one on a point
  // whose date is invalid): the map must use the checked day, and nothing for an undated point.
  const points: OverlayPoint[] = days.map((day, index) => ({
    index,
    lon: index,
    lat: 0,
    day,
    properties: { other: 1, [DAY_KEY]: day === null ? '2026-10-01' : '1999-01-01' },
  }));
  const data = overlaySourceData(points);
  const windows: OverlayWindow[] = [
    { kind: 'all', range: null },
    { kind: 'none', wanted: { first: '2026-01-01', last: '2026-01-02' }, range: ['2026-09-01', '2026-12-01'] },
    { kind: 'dated', wanted: { first: '2026-10-01', last: '2026-10-05' }, used: { first: '2026-10-01', last: '2026-10-05' }, clippedStart: false, clippedEnd: false, rangeKnown: true },
    { kind: 'dated', wanted: { first: '2026-10-03', last: null }, used: { first: '2026-10-03', last: null }, clippedStart: false, clippedEnd: false, rangeKnown: false },
  ];

  it('the source data: ids in file order, the checked day added (never the file\'s own), the properties kept', () => {
    expect(data.features.map((f) => f.id)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(data.features[1]!.properties).toEqual({ other: 1, [DAY_KEY]: '2026-10-01' });
    expect(data.features[5]!.properties).toEqual({ other: 1 });
  });

  for (const window of windows) {
    it(`MapLibre's own filter evaluation agrees with pointInWindow (${window.kind}${window.kind === 'dated' && window.used.last === null ? ', open-ended' : ''})`, () => {
      const filter = overlayFilter(window);
      const test = filter === null ? () => true : featureFilter(filter, 'layers[0].filter').filter;
      const drawn = data.features.filter((f) => test({ zoom: 10 }, { type: 1, properties: f.properties ?? {}, id: f.id } as never));
      expect(drawn.map((f) => f.id)).toEqual(points.filter((p) => pointInWindow(p, window)).map((p) => p.index));
    });
  }

  it('the source data is made once per loaded file', () => {
    const loaded = { points, skipped: 0 };
    expect(overlayMapData(loaded)).toBe(overlayMapData(loaded));
  });
});

/** A stand-in for the MapLibre map: sources, layers in order, filters. */
function fakeMap(labels = ['labels']) {
  const layers: { id: string; type: string; filter?: unknown; paint?: Record<string, unknown> }[] = labels.map((id) => ({ id, type: 'symbol' }));
  const sources = new Map<string, Record<string, unknown>>();
  return {
    layers,
    sources,
    addSource: (id: string, spec: Record<string, unknown>) => void sources.set(id, spec),
    removeSource: (id: string) => void sources.delete(id),
    getSource: (id: string) => sources.get(id),
    addLayer: (spec: { id: string; type: string }, before?: string) => {
      const at = before === undefined ? layers.length : layers.findIndex((l) => l.id === before);
      layers.splice(at, 0, spec);
    },
    removeLayer: (id: string) => void layers.splice(layers.findIndex((l) => l.id === id), 1),
    getLayer: (id: string) => layers.find((l) => l.id === id),
    setFilter: (id: string, filter: unknown) => void (layers.find((l) => l.id === id)!.filter = filter),
    getStyle: () => ({ layers }),
  };
}

describe('OverlayController', () => {
  const data = overlaySourceData([]);
  const on = (filter: unknown = null, id = 'a') => ({ id, data, color: '#8000ff', credit: `Credit ${id}`, filter: filter as never });

  it('adds one GeoJSON source carrying the credit and one circle layer under the labels, refilters, and removes them', () => {
    const map = fakeMap();
    const c = new OverlayController(map as never);
    c.set([on(false)]);
    expect(map.sources.get(overlayMapId('a'))).toMatchObject({ type: 'geojson', data, attribution: 'Credit a' });
    expect(map.layers.map((l) => l.id)).toEqual([overlayMapId('a'), 'labels']);
    expect(map.layers[0]).toMatchObject({ type: 'circle', filter: false, paint: { 'circle-color': '#8000ff', 'circle-stroke-width': 1.5 } });
    c.set([on(['has', 'x'])]);
    expect(map.layers[0]!.filter).toEqual(['has', 'x']);
    expect(map.sources.size).toBe(1);
    c.set([]);
    expect(map.layers.map((l) => l.id)).toEqual(['labels']);
    expect(map.sources.size).toBe(0);
  });

  it('a new colour or file replaces the layer; several overlays each get their own', () => {
    const map = fakeMap();
    const c = new OverlayController(map as never);
    c.set([on(null, 'a'), on(null, 'b')]);
    expect(map.layers.map((l) => l.id)).toEqual([overlayMapId('a'), overlayMapId('b'), 'labels']);
    c.set([{ ...on(null, 'a'), color: '#000000' }, on(null, 'b')]);
    expect(map.layers.find((l) => l.id === overlayMapId('a'))!.paint!['circle-color']).toBe('#000000');
    c.dispose();
    expect(map.layers.map((l) => l.id)).toEqual(['labels']);
  });

  it('the circles have no transitions, and a fixed size in screen pixels', () => {
    const map = fakeMap();
    new OverlayController(map as never).set([on()]);
    const paint = map.layers[0]!.paint!;
    for (const key of Object.keys(paint).filter((k) => k.endsWith('-transition'))) expect(paint[key]).toEqual({ duration: 0, delay: 0 });
    expect(Object.keys(paint)).toEqual(expect.arrayContaining(['circle-color-transition', 'circle-radius-transition', 'circle-opacity-transition']));
    expect(paint['circle-pitch-scale']).toBeUndefined(); // the default, "map": no scaling with the ground
  });
});

describe('overlayView and pointReading', () => {
  const overlay = {
    id: 'fires',
    title: 'Fire detections',
    kind: 'points',
    url: 'f.geojson',
    description: 'One 375 m pixel at the time of the satellite pass.',
    credit: 'Someone',
    date_property: 'day',
    date_range: ['2026-10-01', '2026-10-31'],
    fields: [
      { name: 'frp', label: 'Fire radiative power', unit: 'MW' },
      { name: 'confidence', label: 'Confidence' },
      { name: 'day', label: 'Day (UTC)' },
    ],
  } as Overlay;

  it('while loading: says so; when it failed: the reason, and no caption at all', () => {
    expect(overlayView(overlay, undefined, null, 0, '#c000ff')).toMatchObject({ status: 'loading', caption: 'Loading Fire detections…', drawn: [] });
    expect(overlayView(overlay, { status: 'loading' }, null, 0, '#c000ff').caption).toBe('Loading Fire detections…');
    const failed = overlayView(overlay, { status: 'error', message: 'Could not load it.' }, null, 0, '#c000ff');
    expect(failed).toMatchObject({ status: 'error', caption: null, error: 'Could not load it.', drawn: [] });
  });

  it('when loaded: the caption counts the points drawn; the colour is the overlay’s or the default', () => {
    const points: OverlayPoint[] = [
      { index: 0, lon: 0, lat: 0, day: '2026-10-02', properties: {} },
      { index: 1, lon: 0, lat: 0, day: null, properties: {} },
    ];
    const layer = { id: 'l', kind: 'per-date', items: [{ date: '2026-10-01', url: 'a' }, { date: '2026-10-13', url: 'b' }] } as never;
    const view = overlayView(overlay, { status: 'ready', loaded: { points, skipped: 3 } }, layer, 0, '#c000ff');
    expect(view).toMatchObject({ status: 'ready', caption: 'Fire detections, 1 to 12 October 2026: 1', undated: 1, skipped: 3, color: '#c000ff' });
    expect(view.window).toEqual(overlayWindow(overlay, layer, 0));
    expect(overlayView({ ...overlay, color: '#8000ff' }, undefined, null, 0, '#c000ff').color).toBe('#8000ff');
  });

  it('lists the fields in the manifest’s order with their units; a missing property reads "not available", a zero stays 0', () => {
    const p: OverlayPoint = { index: 4, lon: 0, lat: 0, day: '2026-10-02', properties: { day: '2026-10-02', frp: 0, confidence: 'high' } };
    expect(pointReading(overlay, p, 2)).toEqual({
      overlayId: 'fires',
      title: 'Fire detections',
      rows: [
        { label: 'Fire radiative power', value: '0 MW' },
        { label: 'Confidence', value: 'high' },
        { label: 'Day (UTC)', value: '2026-10-02' },
      ],
      withinReach: 2,
    });
    expect(pointReading(overlay, { ...p, properties: {} }, 1).rows.map((r) => r.value)).toEqual([NOT_AVAILABLE, NOT_AVAILABLE, NOT_AVAILABLE]);
    for (const missing of [undefined, null, '', '  ', Number.NaN]) expect(fieldText(missing, 'MW')).toBe('not available');
    expect(fieldText(12.5, 'MW')).toBe('12.5 MW');
    expect(fieldText(false, undefined)).toBe('false');
  });
});
