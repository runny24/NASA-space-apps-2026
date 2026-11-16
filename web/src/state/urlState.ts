// What is on screen, kept in the URL query string, so a copied link reproduces the view
// (site, layer, date or pair, the overlays switched on, map centre and zoom). Pure functions;
// App.tsx does the replaceState.

import type { Layer, Manifest, Site } from '../contract/manifest';
import { MAX_MAP_LATITUDE, MAX_ZOOM, MIN_ZOOM, wrapLongitude } from '../map/geo';

export interface UrlState {
  site?: string;
  layer?: string;
  date?: string;
  /** A pair as "reference_secondary", e.g. "2026-07-01_2026-07-13". */
  pair?: string;
  /** Ids of the overlays switched on, as overlays=<id>,<id> (absent when none is on). */
  overlays?: string[];
  lon?: number;
  lat?: number;
  zoom?: number;
}

const finite = (text: string | null): number | undefined => {
  if (text === null || text.trim() === '') return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
};

export function parseUrlState(search: string): UrlState {
  const p = new URLSearchParams(search);
  const state: UrlState = {};
  const text = (key: string) => p.get(key) ?? undefined;
  state.site = text('site');
  state.layer = text('layer');
  state.date = text('date');
  state.pair = text('pair');
  const overlays = [...new Set((p.get('overlays') ?? '').split(',').map((id) => id.trim()))].filter((id) => id !== '');
  if (overlays.length > 0) state.overlays = overlays;
  // A link is typed or edited by hand, so its view is made safe here: the map throws on a latitude
  // it cannot show, which would take the whole page down. Such a latitude is dropped (the app then
  // frames the site instead), a longitude on another copy of the world is brought back, and the
  // zoom is held to the map's range.
  const lon = finite(p.get('lon'));
  const lat = finite(p.get('lat'));
  const zoom = finite(p.get('z'));
  state.lon = lon === undefined ? undefined : wrapLongitude(lon);
  state.lat = lat !== undefined && Math.abs(lat) <= MAX_MAP_LATITUDE ? lat : undefined;
  state.zoom = zoom === undefined ? undefined : Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
  // Drop keys that are absent so a round trip gives back an equal object.
  for (const key of Object.keys(state) as (keyof UrlState)[]) if (state[key] === undefined) delete state[key];
  return state;
}

/**
 * The query string for a state, in a fixed key order. Other parameters already in `keep` (for
 * example the development-only ?manifest=) are preserved, except `play` and `story`. A link that
 * opens playing (state/playback.ts, wantsAutoplay) is read once when the page loads and never written
 * back, so a link copied later opens still, on the date it shows. `story` (story/storyUrl.ts) is
 * written only while the guided story is open, by storyQuery; this is the query of the map without
 * it, so a link copied after the story closed opens the map as it is.
 */
export function serializeUrlState(state: UrlState, keep = ''): string {
  const p = new URLSearchParams(keep);
  for (const key of ['site', 'layer', 'date', 'pair', 'overlays', 'lon', 'lat', 'z', 'play', 'story']) p.delete(key);
  if (state.site) p.set('site', state.site);
  if (state.layer) p.set('layer', state.layer);
  if (state.date) p.set('date', state.date);
  if (state.pair) p.set('pair', state.pair);
  if (state.overlays && state.overlays.length > 0) p.set('overlays', state.overlays.join(','));
  // 5 decimals of a degree is about 1 m: plenty for a shared link, and keeps it short.
  if (state.lon !== undefined) p.set('lon', state.lon.toFixed(5));
  if (state.lat !== undefined) p.set('lat', state.lat.toFixed(5));
  if (state.zoom !== undefined) p.set('z', state.zoom.toFixed(2));
  // The commas between overlay ids are left readable (overlays=a,b rather than a%2Cb); ids are slugs,
  // so the only commas there are the separators.
  const text = p.toString().replace(/(^|&)overlays=([^&]*)/, (_, start: string, ids: string) => `${start}overlays=${ids.replaceAll('%2C', ',')}`);
  return text ? `?${text}` : '';
}

export const pairKey = (reference: string, secondary: string) => `${reference}_${secondary}`;

/** What the app shows: indexes into the manifest, always valid. */
export interface Selection {
  site: Site;
  layer: Layer | null;
  /** Index into layer.items (the date, the pair, or 0 for a static layer); -1 when there are none. */
  itemIndex: number;
  /** Ids of the site's overlays that are switched on, in the site's order. */
  overlays: string[];
}

/**
 * The site to open when the URL names none (or one the manifest does not have): the first site built
 * from real observations, so a visitor lands on real data even while a sample or test site is listed
 * before it. When every site is a sample, the first site.
 */
export function defaultSite(manifest: Manifest): Site | undefined {
  return manifest.sites.find((s) => s.is_sample !== true) ?? manifest.sites[0];
}

/** The overlays of `site` among `ids`, in the site's order: ids the site does not have are dropped. */
export function siteOverlays(site: Site, ids: readonly string[] | undefined): string[] {
  return (site.overlays ?? []).map((o) => o.id).filter((id) => ids?.includes(id));
}

/**
 * Turn a (possibly stale or hand-edited) URL state into a valid selection, falling back to sensible
 * defaults: the first site that is not a sample (defaultSite), its first layer, the most recent
 * date or pair, and no overlay. Returns null when the manifest has no sites.
 */
export function resolveSelection(manifest: Manifest, state: UrlState): Selection | null {
  const site = manifest.sites.find((s) => s.id === state.site) ?? defaultSite(manifest);
  if (!site) return null;
  const layer = site.layers.find((l) => l.id === state.layer) ?? site.layers[0] ?? null;
  const overlays = siteOverlays(site, state.overlays);
  if (!layer) return { site, layer: null, itemIndex: -1, overlays };
  const found =
    layer.kind === 'per-date'
      ? layer.items.findIndex((it) => it.date === state.date)
      : layer.kind === 'pair'
        ? layer.items.findIndex((it) => it.reference && it.secondary && pairKey(it.reference, it.secondary) === state.pair)
        : 0;
  // Not found: the most recent date or pair (items are in date order), or -1 if the layer is empty.
  return { site, layer, itemIndex: found === -1 ? layer.items.length - 1 : found, overlays };
}

/** The URL keys that describe a selection (map view is added separately). */
export function selectionToUrlState(sel: Selection): UrlState {
  const state: UrlState = { site: sel.site.id };
  if (sel.overlays.length > 0) state.overlays = [...sel.overlays];
  if (!sel.layer) return state;
  state.layer = sel.layer.id;
  const item = sel.layer.items[sel.itemIndex];
  if (item && sel.layer.kind === 'per-date' && item.date) state.date = item.date;
  if (item && sel.layer.kind === 'pair' && item.reference && item.secondary) state.pair = pairKey(item.reference, item.secondary);
  return state;
}
