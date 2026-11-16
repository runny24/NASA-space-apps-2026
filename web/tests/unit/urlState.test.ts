import { describe, expect, it } from 'vitest';
import type { Manifest } from '../../src/contract/manifest';
import { wrapLongitude } from '../../src/map/geo';
import { parseUrlState, resolveSelection, selectionToUrlState, serializeUrlState, type UrlState } from '../../src/state/urlState';
import { buildManifest, DATES, FIXTURE_SITE_IDS, MISSING, OVERLAY_ID, SITE_ID, YEAR_DATES, YEAR_LAYERS, YEAR_SITE_ID } from '../fixtures/synthetic.mjs';

const manifest = buildManifest() as unknown as Manifest;

describe('URL state', () => {
  it('round-trips through the query string', () => {
    const state: UrlState = { site: 'a-site', layer: 'hh', date: '2026-07-13', lon: -29.92459, lat: 20.02506, zoom: 9.5 };
    expect(parseUrlState(serializeUrlState(state))).toEqual(state);
  });

  it('round-trips a pair', () => {
    const state: UrlState = { site: 's', layer: 'change', pair: '2026-07-01_2026-07-13' };
    expect(parseUrlState(serializeUrlState(state))).toEqual(state);
  });

  it('keeps unrelated parameters such as the development ?manifest=', () => {
    const query = serializeUrlState({ site: 's' }, '?manifest=x.json&site=old');
    expect(new URLSearchParams(query).get('manifest')).toBe('x.json');
    expect(new URLSearchParams(query).get('site')).toBe('s');
  });

  it('drops the story parameter: the query of the map is the map without the story (story/storyUrl.ts writes it while open)', () => {
    for (const keep of ['?story=a-step&manifest=x.json', '?manifest=x.json&story=off']) {
      const query = serializeUrlState({ site: 's', layer: 'hh' }, keep);
      expect(new URLSearchParams(query).has('story'), keep).toBe(false);
      expect(new URLSearchParams(query).get('manifest')).toBe('x.json');
      expect(new URLSearchParams(query).get('site')).toBe('s');
    }
  });

  it('never writes play=1 back into the link (it is read once, when the page loads)', () => {
    const query = serializeUrlState({ site: 's', date: '2026-07-13' }, '?manifest=x.json&play=1');
    expect(new URLSearchParams(query).has('play')).toBe(false);
    expect(new URLSearchParams(query).get('manifest')).toBe('x.json');
  });

  it('never puts a date in the link of a static layer, even when its item carries one', () => {
    const site = manifest.sites.find((s) => s.id === YEAR_SITE_ID)!;
    const still = site.layers.find((l) => l.kind === 'static')!;
    const dated = { ...still, items: still.items.map((it) => ({ ...it, date: YEAR_DATES[0] })) };
    expect(selectionToUrlState({ site, layer: dated, itemIndex: 0, overlays: [] })).toEqual({ site: site.id, layer: still.id });
  });

  it('ignores numbers that are not numbers', () => {
    expect(parseUrlState('?lon=abc&lat=&z=3')).toEqual({ zoom: 3 });
  });

  it('drops a latitude the map cannot show, instead of letting the map throw', () => {
    expect(parseUrlState('?lon=10&lat=999&z=5')).toEqual({ lon: 10, zoom: 5 });
    expect(parseUrlState('?lon=10&lat=-86&z=5')).toEqual({ lon: 10, zoom: 5 });
    expect(parseUrlState('?lon=10&lat=85&z=5')).toEqual({ lon: 10, lat: 85, zoom: 5 });
  });

  it('brings a longitude from another copy of the world back into -180..180', () => {
    expect(parseUrlState('?lon=242&lat=1&z=5').lon).toBeCloseTo(-118);
    expect(parseUrlState('?lon=-190&lat=1&z=5').lon).toBeCloseTo(170);
    expect(parseUrlState('?lon=1e9&lat=1&z=5').lon).toBeGreaterThanOrEqual(-180);
    expect(parseUrlState('?lon=1e9&lat=1&z=5').lon).toBeLessThanOrEqual(180);
  });

  it('holds the zoom to the map range', () => {
    expect(parseUrlState('?z=99').zoom).toBe(22);
    expect(parseUrlState('?z=-4').zoom).toBe(0);
  });
});

describe('wrapLongitude', () => {
  it('matches MapLibre: values inside stay, -180 becomes 180, copies of the world come back', () => {
    expect(wrapLongitude(-118.5)).toBe(-118.5);
    expect(wrapLongitude(180)).toBe(180);
    expect(wrapLongitude(-180)).toBe(180);
    expect(wrapLongitude(241.5)).toBeCloseTo(-118.5);
    expect(wrapLongitude(-478.5)).toBeCloseTo(-118.5);
  });
});

describe('resolveSelection', () => {
  it('with every site a sample, falls back to the first site, its first layer and the latest date', () => {
    expect(manifest.sites.every((s) => s.is_sample)).toBe(true);
    const sel = resolveSelection(manifest, {})!;
    expect(sel.site.id).toBe(YEAR_SITE_ID);
    expect(sel.layer?.id).toBe(YEAR_LAYERS.hh);
    expect(sel.layer?.items[sel.itemIndex]?.date).toBe(YEAR_DATES[YEAR_DATES.length - 1]);
  });

  /** The fixture manifest with the site `id` marked as real (not a sample). */
  const withReal = (...ids: string[]): Manifest => {
    const m = structuredClone(manifest);
    for (const site of m.sites) if (ids.includes(site.id)) site.is_sample = false;
    return m;
  };

  it('opens the first site that is not a sample when the URL names no site', () => {
    expect(resolveSelection(withReal(SITE_ID), {})!.site.id).toBe(SITE_ID);
    // The first of several real sites, in manifest order.
    expect(resolveSelection(withReal(FIXTURE_SITE_IDS[2]!, SITE_ID), {})!.site.id).toBe(SITE_ID);
  });

  it('a site without is_sample counts as real (the schema default is false)', () => {
    const m = structuredClone(manifest);
    delete m.sites[1]!.is_sample;
    expect(resolveSelection(m, {})!.site.id).toBe(m.sites[1]!.id);
  });

  it('opens the first real site, not the first site, when the URL names a site the manifest lacks', () => {
    expect(resolveSelection(withReal(SITE_ID), { site: 'no-such-site' })!.site.id).toBe(SITE_ID);
    expect(resolveSelection(manifest, { site: 'no-such-site' })!.site.id).toBe(YEAR_SITE_ID);
  });

  it('honours a site the URL names, sample or not', () => {
    expect(resolveSelection(withReal(SITE_ID), { site: YEAR_SITE_ID })!.site.id).toBe(YEAR_SITE_ID);
    expect(resolveSelection(manifest, { site: SITE_ID })!.site.id).toBe(SITE_ID);
  });

  it('honours a valid date and ignores an invented one', () => {
    expect(resolveSelection(manifest, { site: SITE_ID, layer: 'hh', date: DATES[0] })!.itemIndex).toBe(0);
    const sel = resolveSelection(manifest, { site: SITE_ID, layer: 'hh', date: MISSING[0]!.date })!; // a missing pass
    expect(sel.layer?.items[sel.itemIndex]?.date).toBe(DATES[DATES.length - 1]);
  });

  it('finds a pair and turns a selection back into URL state', () => {
    const pair = `${DATES[0]}_${DATES[1]}`;
    const sel = resolveSelection(manifest, { site: SITE_ID, layer: 'hh-change', pair })!;
    expect(sel.itemIndex).toBe(0);
    expect(selectionToUrlState(sel)).toEqual({ site: SITE_ID, layer: 'hh-change', pair });
  });

  it('returns null when there are no sites', () => {
    expect(resolveSelection({ ...manifest, sites: [] }, {})).toBeNull();
  });
});

describe('overlays in the URL state', () => {
  it('reads overlays=<id>,<id> and writes it back with readable commas, in a round trip', () => {
    const state: UrlState = { site: 's', layer: 'l', overlays: ['fires', 'other'] };
    const query = serializeUrlState(state);
    expect(query).toContain('overlays=fires,other');
    expect(parseUrlState(query)).toEqual(state);
  });

  it('is absent when no overlay is on, and drops empty and repeated ids', () => {
    expect(serializeUrlState({ site: 's', overlays: [] })).toBe('?site=s');
    expect(parseUrlState('?overlays=')).toEqual({});
    expect(parseUrlState('?overlays=a,,a,b,')).toEqual({ overlays: ['a', 'b'] });
    // An old value in the link is replaced, not kept beside the new one.
    expect(serializeUrlState({ site: 's' }, '?overlays=x')).toBe('?site=s');
  });

  it('every overlay is off by default', () => {
    expect(resolveSelection(manifest, {})!.overlays).toEqual([]);
  });

  it('a link with overlays opens with them on; ids the site does not have are dropped', () => {
    const sel = resolveSelection(manifest, { site: YEAR_SITE_ID, overlays: ['no-such-overlay', OVERLAY_ID] })!;
    expect(sel.overlays).toEqual([OVERLAY_ID]);
    expect(selectionToUrlState(sel).overlays).toEqual([OVERLAY_ID]);
    // A site without overlays drops them all.
    expect(resolveSelection(manifest, { site: SITE_ID, overlays: [OVERLAY_ID] })!.overlays).toEqual([]);
  });

  it('choosing another layer keeps them; choosing another place clears them', () => {
    const sel = resolveSelection(manifest, { site: YEAR_SITE_ID, overlays: [OVERLAY_ID] })!;
    // App.tsx: a new layer resolves the current state with the layer replaced; a new place resolves the place alone.
    expect(resolveSelection(manifest, { ...selectionToUrlState(sel), layer: YEAR_LAYERS.classes })!.overlays).toEqual([OVERLAY_ID]);
    expect(resolveSelection(manifest, { site: SITE_ID })!.overlays).toEqual([]);
    expect(resolveSelection(manifest, { site: YEAR_SITE_ID })!.overlays).toEqual([]);
  });

  it('a selection with no overlay on puts none in the link', () => {
    const sel = resolveSelection(manifest, { site: YEAR_SITE_ID })!;
    expect(selectionToUrlState(sel)).not.toHaveProperty('overlays');
  });
});
