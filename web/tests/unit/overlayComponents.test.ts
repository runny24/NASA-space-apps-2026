// Server-side renders of the overlay parts of the page (components/Overlays.tsx, and where the
// Legend and the "At a point" panel show them). No browser needed.

import { createElement, type FC, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InspectPanel } from '../../src/components/InspectPanel';
import { Legend, LEGEND_METHOD_SUMMARY } from '../../src/components/Legend';
import { OVERLAY_GROUP_LABEL, OverlayLegendEntry, OverlayMapCaption, OverlayPointBlock, OverlaySwitches } from '../../src/components/Overlays';
import type { Layer, Overlay } from '../../src/contract/manifest';
import type { InspectResult } from '../../src/map/inspect';
import { OVERLAY_NOT_NISAR } from '../../src/state/overlayPeriod';
import { overlayView, type OverlayReading, type OverlayView } from '../../src/state/overlayView';

const overlay = {
  id: 'fires',
  title: 'Fire detections',
  kind: 'points',
  url: 'f.geojson',
  description: 'Each dot is one 375 m pixel at the time of the satellite pass.',
  method: 'Selected by confidence.',
  credit: 'Credit line text',
  date_property: 'day',
  date_range: ['2026-10-01', '2026-10-31'],
  fields: [{ name: 'frp', label: 'Fire radiative power', unit: 'MW' }],
} as Overlay;
const layer = {
  id: 'hh',
  title: 'HH',
  kind: 'per-date',
  unit: 'dB',
  description: 'Backscatter.',
  encoding: { type: 'linear-uint8', nodata: 0, lo: -35, hi: 5 },
  items: [{ date: '2026-10-01', url: 'a.tif' }, { date: '2026-10-13', url: 'b.tif' }],
} as unknown as Layer;
const ready = (undated = 0): OverlayView =>
  overlayView(
    overlay,
    {
      status: 'ready',
      loaded: {
        points: [
          { index: 0, lon: 0, lat: 0, day: '2026-10-02', properties: {} },
          ...Array.from({ length: undated }, (_, i) => ({ index: i + 1, lon: 0, lat: 0, day: null, properties: {} })),
        ],
        skipped: 0,
      },
    },
    layer,
    0,
    '#c000ff',
  );
const html = <P extends object>(type: (props: P) => ReactNode, props: P) => renderToStaticMarkup(createElement(type as FC<P>, props));
const switches = (props: Partial<Parameters<typeof OverlaySwitches>[0]> = {}) =>
  html(OverlaySwitches, { overlays: [overlay], on: [], views: [], onToggle: () => undefined, quiet: false, defaultColor: '#c000ff', ...props });

describe('OverlaySwitches', () => {
  it('nothing at all when the site has no overlays', () => {
    expect(switches({ overlays: undefined })).toBe('');
    expect(switches({ overlays: [] })).toBe('');
  });

  it('a group named "Data from other sources" with a native checkbox as a switch, labelled with the title', () => {
    const out = switches();
    expect(out).toMatch(/role="group" aria-labelledby="([^"]+)"/);
    const labelId = /aria-labelledby="([^"]+)"/.exec(out)![1]!;
    expect(out).toContain(`id="${labelId}">${OVERLAY_GROUP_LABEL}</span>`);
    expect(out).toMatch(/<label class="switch"><input type="checkbox" role="switch"[^>]*\/>.*<span>Fire detections<\/span><\/label>/);
    expect(out).not.toContain('checked');
  });

  it('when on: checked, and the caption under it in a polite live region that is off while the dates play', () => {
    const on = switches({ on: ['fires'], views: [ready()] });
    expect(on).toMatch(/<input type="checkbox" role="switch" checked=""/);
    expect(on).toContain('<p class="overlay-caption" aria-live="polite" data-testid="overlay-caption">Fire detections, 1 to 12 October 2026: 1</p>');
    expect(switches({ on: ['fires'], views: [ready()], quiet: true })).toContain('aria-live="off"');
    // When off, the live region stays in the page, empty, so that switching on is heard.
    expect(switches()).toContain('<p class="overlay-caption" aria-live="polite" data-testid="overlay-caption"></p>');
  });

  it('when its file failed: the reason next to the switch as an alert, and no count', () => {
    const failed = overlayView(overlay, { status: 'error', message: 'Could not load the file of this overlay (HTTP 404), so nothing is drawn.' }, layer, 0, '#c000ff');
    const out = switches({ on: ['fires'], views: [failed] });
    expect(out).toContain('role="alert" data-testid="overlay-error">Could not load the file of this overlay (HTTP 404), so nothing is drawn.</p>');
    expect(out).toContain('data-testid="overlay-caption"></p>');
  });
});

describe('OverlayMapCaption (on the map)', () => {
  it('nothing when no overlay is on', () => {
    expect(html(OverlayMapCaption, { views: [] })).toBe('');
  });

  it('the dot, the caption and what a dot is not, and nothing else (no credit, no description); not a live region', () => {
    const view = ready();
    const out = html(OverlayMapCaption, { views: [view] });
    expect(out).toContain('Fire detections, 1 to 12 October 2026: 1');
    // The credit is in the map's credit line and the legend, as the radar's is: a long one would cover the map.
    expect(out).not.toContain('Credit');
    expect(out).not.toContain(view.overlay.credit);
    expect(out).not.toContain(view.overlay.description);
    expect(out.match(/<p/g)).toHaveLength(2);
    expect(out).toContain(OVERLAY_NOT_NISAR);
    expect(out).toMatch(/class="overlay-dot" style="background:#c000ff" aria-hidden="true"/);
    expect(out).not.toContain('aria-live');
  });

  it('says that the overlay is not a NISAR measurement, that a dot marks a reported location and that its size is not a size on the ground', () => {
    expect(OVERLAY_NOT_NISAR).toMatch(/not a NISAR measurement/);
    expect(OVERLAY_NOT_NISAR).toMatch(/reported location/);
    expect(OVERLAY_NOT_NISAR).toMatch(/size on screen is not a size on the ground/);
  });

  it('a file that failed: no number', () => {
    const failed = overlayView(overlay, { status: 'error', message: 'x' }, layer, 0, '#c000ff');
    const text = html(OverlayMapCaption, { views: [failed] }).replace(/<[^>]*>/g, ' ');
    expect(text).toContain('could not be loaded');
    expect(text).not.toMatch(/\d/);
  });
});

describe('the legend entry of an overlay', () => {
  it('the dot, the title, the description, what a dot is not, UTC days, the method (folded) and the credit', () => {
    const out = html(OverlayLegendEntry, { view: ready() });
    for (const text of [overlay.title, overlay.description, OVERLAY_NOT_NISAR, 'Dates are UTC days.', overlay.method!, `Credit: ${overlay.credit}`])
      expect(out).toContain(text);
    expect(out).not.toContain('left out');
  });

  it('folds the method as the layer’s is folded, and nothing else: the description, what a dot is not and the credit stay in view', () => {
    const out = html(OverlayLegendEntry, { view: ready() });
    const fold = `<details class="muted legend-method"><summary>${LEGEND_METHOD_SUMMARY}</summary><p>${overlay.method!}</p></details>`;
    expect(out).toContain(fold);
    expect(out.split('<details')).toHaveLength(2);
    expect(out).not.toContain('<details open');
    expect(out).not.toContain(`Method: ${overlay.method!}`);
    const [before, after] = out.split(fold) as [string, string];
    for (const text of [overlay.description, OVERLAY_NOT_NISAR]) expect(before).toContain(text);
    expect(after).toContain(`Credit: ${overlay.credit}`);
    expect(html(OverlayLegendEntry, { view: overlayView({ ...overlay, method: undefined }, undefined, layer, 0, '#c000ff') })).not.toContain('<details');
  });

  it('how many points without a valid date are left out', () => {
    expect(html(OverlayLegendEntry, { view: ready(1) })).toContain('1 point has no valid date and is left out of every period.');
    expect(html(OverlayLegendEntry, { view: ready(3) })).toContain('3 points have no valid date and are left out of every period.');
  });

  it('no "UTC days" for an overlay without dates', () => {
    const view = overlayView({ ...overlay, date_property: undefined }, undefined, layer, 0, '#c000ff');
    expect(html(OverlayLegendEntry, { view })).not.toContain('UTC');
  });

  it('the legend shows an entry for each overlay that is on', () => {
    expect(html(Legend, { layer, overlays: [ready()] })).toContain('data-testid="legend-overlay"');
    expect(html(Legend, { layer })).not.toContain('legend-overlay');
  });
});

describe('the reading of a point', () => {
  const reading: OverlayReading = { overlayId: 'fires', title: 'Fire detections', rows: [{ label: 'Fire radiative power', value: 'not available' }], withinReach: 1 };
  const result: InspectResult = { lon: 1, lat: 2, valueText: '-12.0 dB', valueWhen: '2026-10-01' };

  it('a block titled with the overlay, its fields as label and value', () => {
    const out = html(OverlayPointBlock, { reading });
    expect(out).toContain('<h3>Fire detections</h3>');
    expect(out).toContain('<dt>Fire radiative power</dt><dd>not available</dd>');
    expect(out).not.toContain('within reach');
  });

  it('says how many points are within reach when there are several', () => {
    expect(html(OverlayPointBlock, { reading: { ...reading, withinReach: 3 } })).toContain('3 points of this overlay are within reach; the nearest is shown.');
  });

  it('in the "At a point" panel, under the layer’s value; none before a point is chosen', () => {
    const out = html(InspectPanel, { state: { status: 'done', result }, mixedRelease: false, onInspectCentre: () => undefined, overlayReadings: [reading] });
    expect(out.indexOf('data-testid="inspect-value"')).toBeGreaterThan(-1);
    expect(out.indexOf('data-testid="overlay-point"')).toBeGreaterThan(out.indexOf('data-testid="inspect-value"'));
    expect(html(InspectPanel, { state: { status: 'idle' }, mixedRelease: false, onInspectCentre: () => undefined, overlayReadings: [reading] })).not.toContain('overlay-point');
    expect(html(InspectPanel, { state: { status: 'done', result }, mixedRelease: false, onInspectCentre: () => undefined })).not.toContain('overlay-point');
  });
});
